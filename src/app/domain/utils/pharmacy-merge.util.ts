import { Pharmacy, PharmacySource } from '../../core/models/pharmacy.model';
import { haversineDistance } from './distance.util';
import { mergePharmacy } from './pharmacy-details.util';

/** Deux pharmacies à moins de 80 m sont considérées comme identiques. */
const DUPLICATE_RADIUS_METERS = 80;

export interface MergedPharmacySourcesResult {
  pharmacies: Pharmacy[];
  source: PharmacySource | 'none';
  minsanteCount: number;
  osmCount: number;
  mergedCount: number;
}

/**
 * Fusionne l'annuaire local MINSANTE et OpenStreetMap.
 * - Les doublons géographiques sont fusionnés (priorité MINSANTE pour téléphone/horaires/quartier).
 * - Les pharmacies OSM absentes du catalogue local sont conservées.
 */
export function mergePharmacySources(
  minsantePharmacies: Pharmacy[],
  osmPharmacies: Pharmacy[]
): MergedPharmacySourcesResult {
  const result: Pharmacy[] = [];
  const usedOsmIds = new Set<string>();
  let mergedCount = 0;

  for (const local of minsantePharmacies) {
    const osmMatch = findOsmDuplicate(local, osmPharmacies, usedOsmIds);

    if (osmMatch) {
      usedOsmIds.add(osmMatch.id);
      result.push(mergeDuplicate(local, osmMatch));
      mergedCount++;
      continue;
    }

    result.push({ ...local, source: 'minsante' });
  }

  for (const osm of osmPharmacies) {
    if (usedOsmIds.has(osm.id)) {
      continue;
    }

    result.push({ ...osm, source: 'osm' });
  }

  const minsanteOnly = minsantePharmacies.length - mergedCount;
  const osmOnly = osmPharmacies.length - mergedCount;

  return {
    pharmacies: result,
    source: resolveCombinedSource(minsantePharmacies.length, osmPharmacies.length, mergedCount),
    minsanteCount: minsanteOnly + mergedCount,
    osmCount: osmOnly + mergedCount,
    mergedCount,
  };
}

function findOsmDuplicate(
  local: Pharmacy,
  osmPharmacies: Pharmacy[],
  usedOsmIds: Set<string>
): Pharmacy | null {
  let bestMatch: Pharmacy | null = null;
  let bestDistance = DUPLICATE_RADIUS_METERS;

  for (const osm of osmPharmacies) {
    if (usedOsmIds.has(osm.id)) {
      continue;
    }

    const distance = haversineDistance(
      { lat: local.lat, lng: local.lng },
      { lat: osm.lat, lng: osm.lng }
    );

    if (distance <= DUPLICATE_RADIUS_METERS && distance < bestDistance) {
      bestMatch = osm;
      bestDistance = distance;
    }
  }

  return bestMatch;
}

function mergeDuplicate(local: Pharmacy, osm: Pharmacy): Pharmacy {
  return mergePharmacy(
    osm,
    {
      id: local.id,
      name: local.name,
      phone: local.phone,
      openingHours: local.openingHours,
      city: local.city,
      district: local.district,
      photos: local.photos,
      source: 'merged',
    },
    {
      address: osm.address,
      website: osm.website,
      email: osm.email,
      operator: osm.operator,
      description: osm.description,
      wheelchair: osm.wheelchair,
      wikidata: osm.wikidata,
      postcode: osm.postcode,
      osmType: osm.osmType,
      osmId: osm.osmId,
    }
  );
}

function resolveCombinedSource(
  minsanteTotal: number,
  osmTotal: number,
  _mergedCount: number
): PharmacySource | 'none' {
  if (minsanteTotal > 0 && osmTotal > 0) {
    return 'merged';
  }

  if (minsanteTotal > 0) {
    return 'minsante';
  }

  if (osmTotal > 0) {
    return 'osm';
  }

  return 'none';
}
