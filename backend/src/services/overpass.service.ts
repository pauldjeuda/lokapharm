import { Pharmacy } from '../types';
import { isOnCallPharmacy, isOpen24h, isOpenNow } from '../utils/geo';

interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

interface OverpassResponse {
  elements?: OverpassElement[];
}

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

const USER_AGENT = 'LokaPharm/1.0.0 (cm.Lokapharm.app; contact@Lokapharm.cm)';
const TIMEOUT_MS = 20_000;

export async function fetchOsmPharmaciesNearby(
  lat: number,
  lng: number,
  radiusKm: number
): Promise<Pharmacy[]> {
  const radiusMeters = Math.round(radiusKm * 1000);
  const query = `
[out:json][timeout:18];
(
  nwr["amenity"="pharmacy"](around:${radiusMeters},${lat},${lng});
  nwr["healthcare"="pharmacy"](around:${radiusMeters},${lat},${lng});
);
out center tags;
`.trim();

  return runOverpass(query);
}

export async function fetchOsmPharmaciesInBBox(
  south: number,
  west: number,
  north: number,
  east: number
): Promise<Pharmacy[]> {
  const query = `
[out:json][timeout:18];
(
  nwr["amenity"="pharmacy"](${south},${west},${north},${east});
  nwr["healthcare"="pharmacy"](${south},${west},${north},${east});
);
out center tags;
`.trim();

  return runOverpass(query);
}

async function runOverpass(query: string): Promise<Pharmacy[]> {
  let lastError: unknown;

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': USER_AGENT,
          Accept: 'application/json',
        },
        body: `data=${encodeURIComponent(query)}`,
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!response.ok) {
        throw new Error(`Overpass ${response.status}`);
      }

      const data = (await response.json()) as OverpassResponse;
      return mapElements(data.elements ?? []);
    } catch (error) {
      lastError = error;
    }
  }

  console.warn('[overpass] all endpoints failed', lastError);
  return [];
}

function mapElements(elements: OverpassElement[]): Pharmacy[] {
  const seen = new Map<string, Pharmacy>();

  for (const element of elements) {
    const pharmacy = mapElement(element);
    if (pharmacy) {
      seen.set(pharmacy.id, pharmacy);
    }
  }

  return Array.from(seen.values());
}

function mapElement(element: OverpassElement): Pharmacy | null {
  const tags = element.tags ?? {};
  if (tags.amenity !== 'pharmacy' && tags.healthcare !== 'pharmacy') {
    return null;
  }

  const lat = element.lat ?? element.center?.lat;
  const lng = element.lon ?? element.center?.lon;
  if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  const openingHours =
    tags.opening_hours ?? tags['opening_hours:covid19'] ?? tags['opening_hours:signed'];
  const phone =
    tags.phone ?? tags['contact:phone'] ?? tags['contact:mobile'] ?? tags.mobile;
  const name = tags.name ?? tags['name:fr'] ?? tags.brand ?? 'Pharmacie';

  const pharmacy: Pharmacy = {
    id: `osm-${element.type}-${element.id}`,
    name,
    lat,
    lng,
    address: tags['addr:street']
      ? [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' ')
      : undefined,
    city: tags['addr:city'] ?? tags['addr:town'] ?? tags['addr:village'],
    district: tags['addr:suburb'] ?? tags['addr:quarter'] ?? tags['addr:neighbourhood'],
    phone,
    openingHours,
    website: tags.website ?? tags['contact:website'] ?? tags.url,
    email: tags.email ?? tags['contact:email'],
    operator: tags.operator,
    wheelchair: tags.wheelchair,
    wikidata: tags.wikidata,
    postcode: tags['addr:postcode'],
    osmType: element.type,
    osmId: element.id,
    source: 'osm',
    isOpen24h: isOpen24h(openingHours),
    isOpenNow: isOpenNow(openingHours),
  };

  pharmacy.isOnCall = isOnCallPharmacy(pharmacy);
  return pharmacy;
}
