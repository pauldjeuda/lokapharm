import { Pharmacy } from '../types';

const EARTH_RADIUS_M = 6_371_000;

export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

export function sortByDistance(pharmacies: Pharmacy[]): Pharmacy[] {
  return [...pharmacies].sort(
    (a, b) => (a.distanceMeters ?? Number.POSITIVE_INFINITY) - (b.distanceMeters ?? Number.POSITIVE_INFINITY)
  );
}

/** Parse léger opening_hours OSM / FR pour savoir si ouvert maintenant. */
export function isOpenNow(openingHours?: string, now = new Date()): boolean {
  if (!openingHours) {
    return false;
  }

  const normalized = openingHours.trim().toLowerCase();
  if (normalized === '24/7' || normalized.includes('24/7')) {
    return true;
  }

  // Format FR catalogue : "Lun-Sam 07:30-20:00; Dim 09:00-13:00"
  const frDayMap: Record<string, number> = {
    dim: 0,
    lun: 1,
    mar: 2,
    mer: 3,
    jeu: 4,
    ven: 5,
    sam: 6,
  };

  const dayMap = ['su', 'mo', 'tu', 'we', 'th', 'fr', 'sa'];
  const dayIdx = now.getDay();
  const minutes = now.getHours() * 60 + now.getMinutes();

  const ranges = normalized.split(';').map((part) => part.trim());
  for (const range of ranges) {
    // FR: lun-sam 07:30-20:00  |  dim 09:00-13:00
    const frMatch = range.match(
      /^([a-zéû]+)(?:-([a-zéû]+))?\s+(\d{1,2})[:h.](\d{2})-(\d{1,2})[:h.](\d{2})$/i
    );
    if (frMatch) {
      const [, startDay, endDay, h1, m1, h2, m2] = frMatch;
      const startIdx = frDayMap[startDay.slice(0, 3)];
      const endIdx = frDayMap[(endDay ?? startDay).slice(0, 3)];
      if (startIdx == null || endIdx == null) {
        continue;
      }
      const inDay =
        startIdx <= endIdx
          ? dayIdx >= startIdx && dayIdx <= endIdx
          : dayIdx >= startIdx || dayIdx <= endIdx;
      if (!inDay) {
        continue;
      }
      const open = Number(h1) * 60 + Number(m1);
      const close = Number(h2) * 60 + Number(m2);
      if (close > open ? minutes >= open && minutes < close : minutes >= open || minutes < close) {
        return true;
      }
      continue;
    }

    // OSM EN: Mo-Fr 08:00-20:00
    const match = range.match(
      /^([a-z]{2})(?:-([a-z]{2}))?\s+(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/
    );
    if (!match) {
      continue;
    }

    const [, startDay, endDay, h1, m1, h2, m2] = match;
    const startIdx = dayMap.indexOf(startDay);
    const endIdx = dayMap.indexOf(endDay ?? startDay);
    if (startIdx < 0 || endIdx < 0) {
      continue;
    }

    const inDay =
      startIdx <= endIdx
        ? dayIdx >= startIdx && dayIdx <= endIdx
        : dayIdx >= startIdx || dayIdx <= endIdx;

    if (!inDay) {
      continue;
    }

    const open = Number(h1) * 60 + Number(m1);
    const close = Number(h2) * 60 + Number(m2);
    if (close > open ? minutes >= open && minutes < close : minutes >= open || minutes < close) {
      return true;
    }
  }

  return false;
}

export function isOpen24h(openingHours?: string): boolean {
  if (!openingHours) {
    return false;
  }
  const normalized = openingHours.toLowerCase();
  return normalized.includes('24/7') || normalized.includes('00:00-24:00');
}

export function isOnCallPharmacy(pharmacy: Pharmacy): boolean {
  if (pharmacy.isOnCall) {
    return true;
  }
  // Heuristique locale : pharmacie de garde souvent annotée dans description / name
  const haystack = [pharmacy.name, pharmacy.description, pharmacy.openingHours]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return (
    haystack.includes('garde') ||
    haystack.includes('on call') ||
    haystack.includes('on-call') ||
    haystack.includes('urgence')
  );
}
