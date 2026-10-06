import { Request, Response } from 'express';

const OSRM_BASE = process.env.OSRM_URL ?? 'https://router.project-osrm.org';
const USER_AGENT = 'LokaPharm/1.0.0 (cm.Lokapharm.app; contact@Lokapharm.cm)';

export async function getRoute(req: Request, res: Response): Promise<void> {
  try {
    const fromLat = Number(req.query.fromLat);
    const fromLng = Number(req.query.fromLng);
    const toLat = Number(req.query.toLat);
    const toLng = Number(req.query.toLng);
    const profile = req.query.profile === 'foot' ? 'foot' : 'driving';

    if (![fromLat, fromLng, toLat, toLng].every(Number.isFinite)) {
      res.status(400).json({ error: 'Coordonnées from/to requises' });
      return;
    }

    const coords = `${fromLng},${fromLat};${toLng},${toLat}`;
    const url = `${OSRM_BASE}/route/v1/${profile}/${coords}?overview=full&geometries=geojson&steps=true&annotations=false`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!response.ok) {
      res.status(502).json({ error: 'Service itinéraire indisponible' });
      return;
    }

    const data = (await response.json()) as {
      code?: string;
      routes?: Array<{
        distance: number;
        duration: number;
        geometry?: { coordinates?: number[][] };
        legs?: Array<{
          steps?: Array<{
            name?: string;
            distance?: number;
            duration?: number;
            maneuver?: { type?: string; modifier?: string; instruction?: string };
          }>;
        }>;
      }>;
    };

    if (data.code !== 'Ok' || !data.routes?.[0]) {
      res.status(404).json({ error: 'Aucun itinéraire trouvé' });
      return;
    }

    const route = data.routes[0];
    const coordinates = (route.geometry?.coordinates ?? []).map(([lng, lat]) => ({ lat, lng }));
    const steps =
      route.legs?.[0]?.steps?.map((step) => ({
        instruction: buildInstruction(step.maneuver?.type, step.maneuver?.modifier, step.name),
        distanceMeters: step.distance ?? 0,
        durationSeconds: step.duration ?? 0,
        name: step.name ?? '',
      })) ?? [];

    res.setHeader('Cache-Control', 'public, max-age=120');
    res.json({
      distanceMeters: route.distance,
      durationSeconds: route.duration,
      coordinates,
      steps,
      profile,
    });
  } catch (error) {
    console.error('[api/route]', error instanceof Error ? error.message : 'error');
    res.status(500).json({ error: 'Impossible de calculer l’itinéraire' });
  }
}

function buildInstruction(
  type?: string,
  modifier?: string,
  name?: string
): string {
  const road = name ? ` sur ${name}` : '';
  switch (type) {
    case 'depart':
      return 'Départ';
    case 'arrive':
      return 'Vous êtes arrivé';
    case 'turn':
      if (modifier === 'left') return `Tournez à gauche${road}`;
      if (modifier === 'right') return `Tournez à droite${road}`;
      return `Continuez${road}`;
    case 'new name':
    case 'continue':
      return `Continuez tout droit${road}`;
    case 'roundabout':
      return `Au rond-point${road}`;
    default:
      return name ? `Suivez ${name}` : 'Continuez';
  }
}
