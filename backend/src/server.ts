import cors from 'cors';
import express, { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { getRoute } from './routes/route.handler';
import { pharmacyService } from './services/pharmacy.service';
import { PharmacyQuery } from './types';

const PORT = Number(process.env.PORT ?? 3100);
const IS_PROD = process.env.NODE_ENV === 'production';
const app = express();

/** Origines autorisées (Capacitor + web). Surcharge : CORS_ORIGINS=a,b,c */
const DEFAULT_ORIGINS = [
  'http://localhost:4200',
  'http://localhost:8100',
  'https://localhost',
  'capacitor://localhost',
  'ionic://localhost',
  'https://lokapharm.cm',
  'https://www.lokapharm.cm',
  'https://Lokapharm.cm',
];

const allowedOrigins = (process.env.CORS_ORIGINS ?? DEFAULT_ORIGINS.join(','))
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

if (IS_PROD) {
  app.set('trust proxy', 1);
}

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: IS_PROD ? undefined : false,
  })
);

app.use(
  cors({
    origin(origin, callback) {
      // Requêtes server-to-server / healthchecks sans Origin
      if (!origin) {
        callback(null, true);
        return;
      }
      if (!IS_PROD || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
        callback(null, true);
        return;
      }
      callback(new Error(`Origin non autorisée: ${origin}`));
    },
    methods: ['GET', 'OPTIONS'],
    maxAge: 600,
  })
);

app.use(morgan(IS_PROD ? 'combined' : 'dev'));
app.use(express.json({ limit: '16kb' }));

/** Rate limit mémoire simple — 120 req / min / IP sur /api/* */
const rateWindowMs = 60_000;
const rateMax = Number(process.env.RATE_LIMIT_MAX ?? 120);
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

function rateLimit(req: Request, res: Response, next: NextFunction): void {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const bucket = rateBuckets.get(ip);

  if (!bucket || now > bucket.resetAt) {
    rateBuckets.set(ip, { count: 1, resetAt: now + rateWindowMs });
    next();
    return;
  }

  bucket.count += 1;
  if (bucket.count > rateMax) {
    res.setHeader('Retry-After', String(Math.ceil((bucket.resetAt - now) / 1000)));
    res.status(429).json({ error: 'Trop de requêtes. Réessayez plus tard.' });
    return;
  }

  next();
}

// Nettoyage périodique des buckets
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateBuckets) {
    if (now > value.resetAt) {
      rateBuckets.delete(key);
    }
  }
}, 5 * 60_000).unref();

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'lokapharm-api', ts: new Date().toISOString() });
});

app.use('/api', rateLimit);

app.get('/api/route', (req, res) => {
  void getRoute(req, res);
});

app.get('/api/pharmacies', async (req: Request, res: Response) => {
  try {
    const query = parseQuery(req);
    if (!isValidCoordinate(query.lat, query.lng)) {
      res.status(400).json({ error: 'lat et lng valides sont requis (Cameroun)' });
      return;
    }

    if (req.query.partial === '1' || req.query.partial === 'true') {
      const fast = await pharmacyService.listCatalogFast(query);
      res.setHeader('Cache-Control', 'public, max-age=30');
      res.json(fast);
      return;
    }

    const result = await pharmacyService.list(query);
    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    res.json(result);
  } catch (error) {
    console.error('[api/pharmacies]', error instanceof Error ? error.message : 'error');
    res.status(500).json({ error: 'Impossible de charger les pharmacies' });
  }
});

app.get('/api/pharmacies/:id', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id ?? '').slice(0, 120);
    if (!id || !/^[\w.:-]+$/.test(id)) {
      res.status(400).json({ error: 'Identifiant invalide' });
      return;
    }

    const lat = Number(req.query.lat ?? 3.848);
    const lng = Number(req.query.lng ?? 11.502);
    if (!isValidCoordinate(lat, lng)) {
      res.status(400).json({ error: 'Coordonnées invalides' });
      return;
    }

    const result = await pharmacyService.list({ lat, lng, radiusKm: 50, limit: 500 });
    const pharmacy = result.pharmacies.find((item) => item.id === id);

    if (!pharmacy) {
      res.status(404).json({ error: 'Pharmacie introuvable' });
      return;
    }

    res.json({ pharmacy, meta: result.meta });
  } catch (error) {
    console.error('[api/pharmacies/:id]', error instanceof Error ? error.message : 'error');
    res.status(500).json({ error: 'Impossible de charger la pharmacie' });
  }
});

function isValidCoordinate(lat: number, lng: number): boolean {
  // Bounds Cameroun élargies (évite l'exfiltration mondiale via API)
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= 1.5 &&
    lat <= 13.5 &&
    lng >= 8.0 &&
    lng <= 16.5
  );
}

function parseQuery(req: Request): PharmacyQuery {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  const radiusKmRaw = req.query.radiusKm != null ? Number(req.query.radiusKm) : undefined;
  const maxDistanceKmRaw =
    req.query.maxDistanceKm != null ? Number(req.query.maxDistanceKm) : undefined;
  const limitRaw = req.query.limit != null ? Number(req.query.limit) : undefined;
  const cityRaw = String(req.query.city ?? 'nearby');
  const city =
    cityRaw === 'yaounde' || cityRaw === 'douala' || cityRaw === 'nearby'
      ? cityRaw
      : 'nearby';

  const q =
    typeof req.query.q === 'string'
      ? req.query.q.trim().slice(0, 80).replace(/[<>]/g, '')
      : undefined;

  return {
    lat,
    lng,
    radiusKm:
      Number.isFinite(radiusKmRaw) ? Math.min(Math.max(radiusKmRaw as number, 1), 30) : undefined,
    maxDistanceKm:
      Number.isFinite(maxDistanceKmRaw)
        ? Math.min(Math.max(maxDistanceKmRaw as number, 0.5), 50)
        : undefined,
    limit: Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw as number, 1), 500) : undefined,
    city,
    onCall: req.query.onCall === '1' || req.query.onCall === 'true',
    openNow: req.query.openNow === '1' || req.query.openNow === 'true',
    open24h: req.query.open24h === '1' || req.query.open24h === 'true',
    q,
  };
}

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  if (err.message.startsWith('Origin non autorisée')) {
    res.status(403).json({ error: 'Origine non autorisée' });
    return;
  }
  console.error('[api]', err.message);
  res.status(500).json({ error: 'Erreur serveur' });
});

app.listen(PORT, () => {
  console.log(`LokaPharm API listening on http://localhost:${PORT} (${IS_PROD ? 'prod' : 'dev'})`);
});
