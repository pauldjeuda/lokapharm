import { Pharmacy } from '../../core/models/pharmacy.model';

const PHONE_TAG_KEYS = [
  'phone',
  'contact:phone',
  'contact:mobile',
  'mobile',
  'telephone',
  'phone:CM',
  'contact:phone:CM',
] as const;

const WEBSITE_TAG_KEYS = ['website', 'contact:website', 'url'] as const;

const OPENING_HOURS_TAG_KEYS = [
  'opening_hours',
  'opening_hours:covid19',
  'opening_hours:signed',
] as const;

export function extractPhotosFromTags(
  tags: Record<string, string>,
  lat: number,
  lng: number
): string[] {
  const photos: string[] = [];

  for (const key of Object.keys(tags)) {
    if (!key.startsWith('image')) {
      continue;
    }
    const value = tags[key];
    if (value?.startsWith('http')) {
      photos.push(value);
    }
  }

  const directImage = tags['image'] ?? tags['contact:image'];
  if (directImage?.startsWith('http')) {
    photos.push(directImage);
  }

  const commons = tags['wikimedia_commons'];
  if (commons) {
    const filename = commons.replace(/^File:/i, '');
    photos.push(buildCommonsPhotoUrl(filename));
  }

  const wikipedia = tags['wikipedia'];
  if (wikipedia?.includes(':')) {
    const [, title] = wikipedia.split(':', 2);
    if (title) {
      photos.push(
        `https://en.wikipedia.org/wiki/Special:FilePath/${encodeURIComponent(title)}?width=900`
      );
    }
  }

  const mapillary = tags['mapillary'];
  if (mapillary?.startsWith('http')) {
    photos.push(mapillary);
  }

  return [...new Set(photos.filter(Boolean))];
}

export function buildCommonsPhotoUrl(filename: string): string {
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(filename)}?width=900`;
}

export function buildFullAddress(pharmacy: Pharmacy): string {
  if (pharmacy.address?.includes(',')) {
    const parts = [
      pharmacy.address,
      pharmacy.district,
      pharmacy.city,
      'Cameroun',
    ].filter((part, index, array) => part && array.indexOf(part) === index);
    return parts.join(', ');
  }

  const parts = [
    pharmacy.address,
    pharmacy.district,
    pharmacy.city,
    pharmacy.postcode,
    'Cameroun',
  ].filter((part, index, array) => part && array.indexOf(part) === index);

  const built = parts.join(', ');
  return built.replace(/, Cameroun$/, '').trim() ? built : '';
}

/** Adresse lisible dérivée des coordonnées GPS (secours OSM). */
export function formatCoordinatesAddress(lat: number, lng: number): string {
  return `${lat.toFixed(5)}°, ${lng.toFixed(5)}° — Cameroun`;
}

/** Réduit le display_name Nominatim pour l'affichage mobile. */
export function shortenDisplayName(displayName?: string, maxParts = 4): string | undefined {
  if (!displayName?.trim()) {
    return undefined;
  }

  return displayName
    .split(',')
    .slice(0, maxParts)
    .map((part) => part.trim())
    .filter(Boolean)
    .join(', ');
}

export function hasMinsanteStyleLocation(pharmacy: Pharmacy): boolean {
  return Boolean(pharmacy.district?.trim() && pharmacy.city?.trim());
}

export function needsGeocodedLocation(pharmacy: Pharmacy): boolean {
  if (pharmacy.source === 'minsante' && hasMinsanteStyleLocation(pharmacy)) {
    return false;
  }

  return !hasMinsanteStyleLocation(pharmacy);
}

export function sourceLabel(source?: Pharmacy['source']): string {
  switch (source) {
    case 'minsante':
      return 'MINSANTE / DPML';
    case 'merged':
      return 'MINSANTE + OSM';
    case 'osm':
      return 'OpenStreetMap';
    default:
      return 'Annuaire local';
  }
}

export function parseOsmId(pharmacyId: string): { type: 'node' | 'way' | 'relation'; id: number } | null {
  const match = pharmacyId.match(/^osm-(node|way|relation)-(\d+)$/);
  if (!match) {
    return null;
  }

  return {
    type: match[1] as 'node' | 'way' | 'relation',
    id: Number(match[2]),
  };
}

export function formatOpeningHours(raw?: string): string {
  if (!raw) {
    return 'Horaires non renseignés';
  }

  if (raw.toLowerCase().includes('24/7')) {
    return 'Ouvert 24h/24, 7j/7';
  }

  return raw
    .replace(/\bMo\b/g, 'Lun')
    .replace(/\bTu\b/g, 'Mar')
    .replace(/\bWe\b/g, 'Mer')
    .replace(/\bTh\b/g, 'Jeu')
    .replace(/\bFr\b/g, 'Ven')
    .replace(/\bSa\b/g, 'Sam')
    .replace(/\bSu\b/g, 'Dim')
    .replace(/;/g, ' · ')
    .replace(/,/g, ', ');
}

export function isOpenNow(raw?: string): boolean | undefined {
  if (!raw) {
    return undefined;
  }

  if (raw.toLowerCase().includes('24/7')) {
    return true;
  }

  const now = new Date();
  const day = now.getDay();
  const minutes = now.getHours() * 60 + now.getMinutes();
  const dayCodes = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  const todayCode = dayCodes[day];

  const todayRule = raw
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(todayCode) || part.includes(`${todayCode}-`));

  if (!todayRule) {
    return undefined;
  }

  const timeMatch = todayRule.match(/(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})/);
  if (!timeMatch) {
    return undefined;
  }

  const openMinutes = Number(timeMatch[1]) * 60 + Number(timeMatch[2]);
  const closeMinutes = Number(timeMatch[3]) * 60 + Number(timeMatch[4]);

  return minutes >= openMinutes && minutes <= closeMinutes;
}

export function mapTagsToPharmacy(
  elementType: 'node' | 'way' | 'relation',
  elementId: number,
  lat: number,
  lng: number,
  tags: Record<string, string> = {}
): Pharmacy {
  const name = tags['name']?.trim() || tags['name:fr']?.trim() || tags['brand']?.trim() || 'Pharmacie';

  return {
    id: `osm-${elementType}-${elementId}`,
    name,
    lat,
    lng,
    address: buildAddressFromTags(tags),
    city: pickCityFromTags(tags),
    district: pickDistrictFromTags(tags),
    postcode: tags['addr:postcode'],
    phone: normalizePhone(pickFirstTag(tags, PHONE_TAG_KEYS)),
    openingHours: pickFirstTag(tags, OPENING_HOURS_TAG_KEYS),
    website: normalizeWebsite(pickFirstTag(tags, WEBSITE_TAG_KEYS)),
    email: tags['email'] ?? tags['contact:email'],
    operator: tags['operator'] ?? tags['brand'],
    description: tags['description'] ?? tags['note'] ?? tags['fixme'],
    wheelchair: tags['wheelchair'],
    wikidata: tags['wikidata'],
    photos: extractPhotosFromTags(tags, lat, lng),
    osmType: elementType,
    osmId: elementId,
    source: 'osm',
  };
}

export function mergePharmacy(base: Pharmacy, ...partials: Array<Partial<Pharmacy>>): Pharmacy {
  const merged: Pharmacy = { ...base, photos: [...(base.photos ?? [])] };

  for (const partial of partials) {
    for (const [key, value] of Object.entries(partial) as Array<[keyof Pharmacy, Pharmacy[keyof Pharmacy]]>) {
      if (value === undefined || value === null || value === '') {
        continue;
      }

      if (key === 'photos' && Array.isArray(value)) {
        merged.photos = [...new Set([...(value as string[]), ...(merged.photos ?? [])])];
        continue;
      }

      merged[key] = value as never;
    }
  }

  merged.phone = normalizePhone(merged.phone);
  merged.website = normalizeWebsite(merged.website);

  if (!merged.photos?.length) {
    merged.photos = [];
  }

  return merged;
}

function buildAddressFromTags(tags: Record<string, string>): string | undefined {
  if (tags['addr:full']) {
    return tags['addr:full'];
  }

  const parts = [
    tags['addr:housenumber'],
    tags['addr:street'] ?? tags['addr:place'],
  ].filter(Boolean);

  return parts.length ? parts.join(' ') : undefined;
}

function pickDistrictFromTags(tags: Record<string, string>): string | undefined {
  return (
    tags['addr:suburb'] ??
    tags['addr:quarter'] ??
    tags['addr:neighbourhood'] ??
    tags['addr:hamlet'] ??
    tags['is_in:neighbourhood']
  );
}

function pickCityFromTags(tags: Record<string, string>): string | undefined {
  return (
    tags['addr:city'] ??
    tags['addr:town'] ??
    tags['addr:municipality'] ??
    tags['addr:state']
  );
}

function pickFirstTag(tags: Record<string, string>, keys: readonly string[]): string | undefined {
  for (const key of keys) {
    const value = tags[key]?.trim();
    if (value) {
      return value;
    }
  }
  return undefined;
}

function normalizePhone(phone?: string): string | undefined {
  if (!phone) {
    return undefined;
  }

  const cleaned = phone.replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+')) {
    return cleaned;
  }

  if (cleaned.startsWith('237')) {
    return `+${cleaned}`;
  }

  if (cleaned.length >= 9) {
    return `+237${cleaned.replace(/^0/, '')}`;
  }

  return phone.trim();
}

function normalizeWebsite(website?: string): string | undefined {
  if (!website) {
    return undefined;
  }

  const value = website.trim();
  if (value.startsWith('http://') || value.startsWith('https://')) {
    return value;
  }

  return `https://${value}`;
}
