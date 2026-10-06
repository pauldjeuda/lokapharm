import fs from 'fs';
import path from 'path';
import { Pharmacy, PharmacyListResponse, PharmacyQuery, PharmacySource } from '../types';
import { memoryCache } from '../utils/cache';
import {
  haversineDistance,
  isOnCallPharmacy,
  isOpen24h,
  isOpenNow,
  sortByDistance,
} from '../utils/geo';
import { fetchOsmPharmaciesInBBox, fetchOsmPharmaciesNearby } from './overpass.service';

const CITY_BOUNDS = {
  yaounde: { south: 3.72, west: 11.4, north: 3.98, east: 11.62 },
  douala: { south: 3.95, west: 9.62, north: 4.12, east: 9.82 },
} as const;

const OSM_TTL_MS = 5 * 60 * 1000;
const OSM_STALE_MS = 30 * 60 * 1000;
const CATALOG_TTL_MS = 24 * 60 * 60 * 1000;
const MERGE_DISTANCE_M = 80;
const DEFAULT_RADIUS_KM = 8;

export class PharmacyService {
  private catalog: Pharmacy[] | null = null;

  async list(query: PharmacyQuery): Promise<PharmacyListResponse> {
    const radiusKm = query.radiusKm ?? DEFAULT_RADIUS_KM;
    const city = query.city ?? 'nearby';

    const catalog = await this.loadCatalog();
    const catalogFiltered = this.filterCatalog(catalog, city).map((pharmacy) =>
      this.withComputedFlags(pharmacy, query.lat, query.lng)
    );

    const osmResult = await this.loadOsm(query.lat, query.lng, radiusKm, city);
    const osmWithFlags = osmResult.pharmacies.map((pharmacy) =>
      this.withComputedFlags(pharmacy, query.lat, query.lng)
    );

    const merged = this.merge(catalogFiltered, osmWithFlags);
    let pharmacies = sortByDistance(merged.pharmacies);

    pharmacies = this.applyClientFilters(pharmacies, query);

    const limit = Math.min(Math.max(query.limit ?? 200, 1), 500);
    pharmacies = pharmacies.slice(0, limit);

    return {
      pharmacies,
      meta: {
        total: pharmacies.length,
        source: merged.source,
        fromCache: osmResult.fromCache,
        partial: false,
        minsanteCount: merged.minsanteCount,
        osmCount: merged.osmCount,
        fetchedAt: new Date().toISOString(),
        radiusKm,
      },
    };
  }

  /** Réponse rapide catalogue seul (streaming partial côté client). */
  async listCatalogFast(query: PharmacyQuery): Promise<PharmacyListResponse> {
    const catalog = await this.loadCatalog();
    const city = query.city ?? 'nearby';
    let pharmacies = sortByDistance(
      this.filterCatalog(catalog, city).map((p) => this.withComputedFlags(p, query.lat, query.lng))
    );
    pharmacies = this.applyClientFilters(pharmacies, query);

    return {
      pharmacies,
      meta: {
        total: pharmacies.length,
        source: pharmacies.length ? 'minsante' : 'none',
        fromCache: true,
        partial: true,
        minsanteCount: pharmacies.length,
        osmCount: 0,
        fetchedAt: new Date().toISOString(),
        radiusKm: query.radiusKm ?? DEFAULT_RADIUS_KM,
      },
    };
  }

  private async loadCatalog(): Promise<Pharmacy[]> {
    const cached = memoryCache.get<Pharmacy[]>('catalog:v1');
    if (cached) {
      return cached;
    }

    if (this.catalog) {
      return this.catalog;
    }

    const candidates = [
      path.resolve(__dirname, '../../../src/assets/data/pharmacies.json'),
      path.resolve(process.cwd(), '../src/assets/data/pharmacies.json'),
      path.resolve(process.cwd(), 'src/assets/data/pharmacies.json'),
    ];

    let raw: Pharmacy[] = [];
    for (const file of candidates) {
      if (fs.existsSync(file)) {
        raw = JSON.parse(fs.readFileSync(file, 'utf8')) as Pharmacy[];
        break;
      }
    }

    this.catalog = raw
      .filter((p) => p?.id && p.name && Number.isFinite(p.lat) && Number.isFinite(p.lng))
      .map((p) => ({ ...p, source: 'minsante' as const }));

    memoryCache.set('catalog:v1', this.catalog, CATALOG_TTL_MS);
    return this.catalog;
  }

  private async loadOsm(
    lat: number,
    lng: number,
    radiusKm: number,
    city: 'yaounde' | 'douala' | 'nearby'
  ): Promise<{ pharmacies: Pharmacy[]; fromCache: boolean }> {
    const cacheKey =
      city === 'nearby'
        ? `osm:near:${lat.toFixed(3)}:${lng.toFixed(3)}:${radiusKm}`
        : `osm:city:${city}`;

    const stale = memoryCache.getStale<Pharmacy[]>(cacheKey, OSM_STALE_MS);
    if (stale?.fresh) {
      return { pharmacies: stale.value, fromCache: true };
    }

    if (stale && !stale.fresh) {
      void this.refreshOsm(cacheKey, lat, lng, radiusKm, city);
      return { pharmacies: stale.value, fromCache: true };
    }

    const pharmacies = await this.fetchOsm(lat, lng, radiusKm, city);
    if (pharmacies.length) {
      memoryCache.set(cacheKey, pharmacies, OSM_TTL_MS);
    }
    return { pharmacies, fromCache: false };
  }

  private async refreshOsm(
    cacheKey: string,
    lat: number,
    lng: number,
    radiusKm: number,
    city: 'yaounde' | 'douala' | 'nearby'
  ): Promise<void> {
    try {
      const pharmacies = await this.fetchOsm(lat, lng, radiusKm, city);
      if (pharmacies.length) {
        memoryCache.set(cacheKey, pharmacies, OSM_TTL_MS);
      }
    } catch (error) {
      console.warn('[pharmacy] background refresh failed', error);
    }
  }

  private async fetchOsm(
    lat: number,
    lng: number,
    radiusKm: number,
    city: 'yaounde' | 'douala' | 'nearby'
  ): Promise<Pharmacy[]> {
    if (city === 'yaounde' || city === 'douala') {
      const b = CITY_BOUNDS[city];
      return fetchOsmPharmaciesInBBox(b.south, b.west, b.north, b.east);
    }
    return fetchOsmPharmaciesNearby(lat, lng, radiusKm);
  }

  private filterCatalog(
    catalog: Pharmacy[],
    city: 'yaounde' | 'douala' | 'nearby'
  ): Pharmacy[] {
    if (city === 'nearby') {
      return catalog;
    }
    const needle = city === 'yaounde' ? 'yaoundé' : 'douala';
    return catalog.filter((p) => p.city?.toLowerCase() === needle);
  }

  private withComputedFlags(pharmacy: Pharmacy, lat: number, lng: number): Pharmacy {
    return {
      ...pharmacy,
      distanceMeters: haversineDistance(lat, lng, pharmacy.lat, pharmacy.lng),
      isOpen24h: pharmacy.isOpen24h ?? isOpen24h(pharmacy.openingHours),
      isOpenNow: pharmacy.isOpenNow ?? isOpenNow(pharmacy.openingHours),
      isOnCall: pharmacy.isOnCall ?? isOnCallPharmacy(pharmacy),
    };
  }

  private applyClientFilters(pharmacies: Pharmacy[], query: PharmacyQuery): Pharmacy[] {
    let result = pharmacies;

    if (query.maxDistanceKm != null) {
      const maxM = query.maxDistanceKm * 1000;
      result = result.filter((p) => (p.distanceMeters ?? 0) <= maxM);
    }

    if (query.onCall) {
      result = result.filter((p) => p.isOnCall);
    }

    if (query.openNow) {
      result = result.filter((p) => p.isOpenNow);
    }

    if (query.open24h) {
      result = result.filter((p) => p.isOpen24h);
    }

    if (query.q?.trim()) {
      const q = query.q.trim().toLowerCase();
      result = result.filter((p) => {
        const haystack = [p.name, p.city, p.district, p.address].filter(Boolean).join(' ').toLowerCase();
        return haystack.includes(q);
      });
    }

    return result;
  }

  private merge(
    minsante: Pharmacy[],
    osm: Pharmacy[]
  ): {
    pharmacies: Pharmacy[];
    source: PharmacySource | 'none';
    minsanteCount: number;
    osmCount: number;
  } {
    if (!minsante.length && !osm.length) {
      return { pharmacies: [], source: 'none', minsanteCount: 0, osmCount: 0 };
    }
    if (!osm.length) {
      return {
        pharmacies: minsante,
        source: 'minsante',
        minsanteCount: minsante.length,
        osmCount: 0,
      };
    }
    if (!minsante.length) {
      return { pharmacies: osm, source: 'osm', minsanteCount: 0, osmCount: osm.length };
    }

    const usedOsm = new Set<string>();
    const merged: Pharmacy[] = [];

    for (const local of minsante) {
      const match = osm.find(
        (candidate) =>
          !usedOsm.has(candidate.id) &&
          haversineDistance(local.lat, local.lng, candidate.lat, candidate.lng) < MERGE_DISTANCE_M
      );

      if (match) {
        usedOsm.add(match.id);
        merged.push({
          ...match,
          ...local,
          id: local.id,
          phone: local.phone || match.phone,
          openingHours: local.openingHours || match.openingHours,
          address: local.address || match.address,
          photos: local.photos?.length ? local.photos : match.photos,
          osmId: match.osmId,
          osmType: match.osmType,
          source: 'merged',
          isOnCall: local.isOnCall || match.isOnCall,
          isOpen24h: local.isOpen24h || match.isOpen24h,
          isOpenNow: local.isOpenNow ?? match.isOpenNow,
          distanceMeters: local.distanceMeters ?? match.distanceMeters,
        });
      } else {
        merged.push(local);
      }
    }

    for (const candidate of osm) {
      if (!usedOsm.has(candidate.id)) {
        merged.push(candidate);
      }
    }

    return {
      pharmacies: merged,
      source: 'merged',
      minsanteCount: minsante.length,
      osmCount: osm.length,
    };
  }
}

export const pharmacyService = new PharmacyService();
