import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { concat, EMPTY, Observable, of } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import {
  CITY_BOUNDS,
  toLocationGridKey,
} from '../../core/constants/cameroon-bounds';
import { Pharmacy, PharmacySource } from '../../core/models/pharmacy.model';
import { CacheService } from '../../core/services/cache.service';
import {
  mergePharmacySources,
  MergedPharmacySourcesResult,
} from '../../domain/utils/pharmacy-merge.util';
import { sortByDistance } from '../../domain/utils/distance.util';
import { OsmOverpassApiService } from '../api/osm-overpass-api.service';
import { MOCK_PHARMACIES } from '../mock/mock-pharmacies';

export type PharmacySearchArea = 'nearby' | 'yaounde' | 'douala';

export interface PharmacyLoadResult {
  pharmacies: Pharmacy[];
  source: PharmacySource | 'demo' | 'none';
  fromCache: boolean;
  partial?: boolean;
  minsanteCount?: number;
  osmCount?: number;
  mergedCount?: number;
}

const OSM_CACHE_PREFIX = 'pharmacies_osm_v2';
const OSM_STALE_OK_MS = 5 * 60 * 1000;
const CATALOG_CACHE_KEY = 'Lokapharm_pharmacies_catalog_v1';
const CATALOG_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const CATALOG_STALE_OK_MS = 30 * 24 * 60 * 60 * 1000;

@Injectable({ providedIn: 'root' })
export class PharmacyRepository {
  private readonly http = inject(HttpClient);
  private readonly osmApi = inject(OsmOverpassApiService);
  private readonly cache = inject(CacheService);

  /**
   * Charge d'abord le catalogue local (rapide / offline), puis enrichit avec OSM.
   */
  getPharmacies(lat: number, lng: number, area: PharmacySearchArea = 'nearby'): Observable<PharmacyLoadResult> {
    return this.getLocalPharmacies(lat, lng, area).pipe(
      switchMap((local) => {
        const localMerged = mergePharmacySources(local.pharmacies, []);
        const fastResult = this.toLoadResult(localMerged, local.fromCache, true);

        const osmEnrichment$ = this.getOsmPharmacies(lat, lng, area).pipe(
          map((osm) => {
            const merged = mergePharmacySources(local.pharmacies, osm.pharmacies);
            return this.toLoadResult(merged, local.fromCache && osm.fromCache, false);
          }),
          catchError(() => EMPTY)
        );

        return concat(of(fastResult), osmEnrichment$);
      }),
      catchError(() => {
        if (environment.useDemoData) {
          return of({
            pharmacies: MOCK_PHARMACIES,
            source: 'demo',
            fromCache: false,
          } satisfies PharmacyLoadResult);
        }

        return of({
          pharmacies: [],
          source: 'none',
          fromCache: false,
        } satisfies PharmacyLoadResult);
      })
    );
  }

  private getLocalPharmacies(
    lat: number,
    lng: number,
    area: PharmacySearchArea
  ): Observable<{ pharmacies: Pharmacy[]; fromCache: boolean }> {
    return this.loadCatalog().pipe(
      map((catalog) => {
        const pharmacies = this.filterCatalogByArea(catalog.pharmacies, area)
          .map((pharmacy) => ({
            ...pharmacy,
            distanceMeters: this.haversineDistance(lat, lng, pharmacy.lat, pharmacy.lng),
            source: 'minsante' as const,
          }))
          .sort((first, second) => (first.distanceMeters ?? 0) - (second.distanceMeters ?? 0));

        return { pharmacies, fromCache: catalog.fromCache };
      })
    );
  }

  private loadCatalog(): Observable<{ pharmacies: Pharmacy[]; fromCache: boolean }> {
    return this.cache.getTimestamp(CATALOG_CACHE_KEY).pipe(
      switchMap((timestamp) => {
        const ageMs = timestamp ? Date.now() - timestamp : Number.POSITIVE_INFINITY;

        return this.cache.get<Pharmacy[]>(CATALOG_CACHE_KEY).pipe(
          switchMap((cached) => {
            if (cached?.length && ageMs < CATALOG_TTL_MS) {
              return of({ pharmacies: cached, fromCache: true });
            }

            if (cached?.length && ageMs < CATALOG_STALE_OK_MS) {
              this.fetchCatalog().pipe(
                tap((fresh) => this.cache.set(CATALOG_CACHE_KEY, fresh).subscribe()),
                catchError(() => of([]))
              ).subscribe();
              return of({ pharmacies: cached, fromCache: true });
            }

            return this.fetchCatalog().pipe(
              map((pharmacies) => ({ pharmacies, fromCache: false })),
              tap((result) => this.cache.set(CATALOG_CACHE_KEY, result.pharmacies).subscribe()),
              catchError(() => cached?.length
                ? of({ pharmacies: cached, fromCache: true })
                : EMPTY)
            );
          })
        );
      })
    );
  }

  private fetchCatalog(): Observable<Pharmacy[]> {
    return this.http.get<Pharmacy[]>(environment.pharmaciesApi).pipe(
      map((pharmacies) => pharmacies.filter((pharmacy) => this.isValidPharmacy(pharmacy)))
    );
  }

  private toLoadResult(
    merged: MergedPharmacySourcesResult,
    fromCache: boolean,
    partial: boolean
  ): PharmacyLoadResult {
    if (merged.pharmacies.length) {
      return {
        pharmacies: sortByDistance(merged.pharmacies),
        source: merged.source === 'none' ? 'none' : merged.source,
        fromCache,
        partial,
        minsanteCount: merged.minsanteCount,
        osmCount: merged.osmCount,
        mergedCount: merged.mergedCount,
      };
    }

    if (!partial && environment.useDemoData) {
      return {
        pharmacies: MOCK_PHARMACIES,
        source: 'demo',
        fromCache: false,
        partial: false,
      };
    }

    return {
      pharmacies: [],
      source: 'none',
      fromCache,
      partial,
    };
  }

  private getOsmPharmacies(
    lat: number,
    lng: number,
    area: PharmacySearchArea
  ): Observable<{ pharmacies: Pharmacy[]; fromCache: boolean }> {
    const cacheKey = this.buildOsmCacheKey(lat, lng, area);

    return this.cache.getTimestamp(cacheKey).pipe(
      switchMap((timestamp) => {
        const ageMs = timestamp ? Date.now() - timestamp : Number.POSITIVE_INFINITY;
        const isFresh = ageMs < OSM_STALE_OK_MS;

        return this.cache.get<Pharmacy[]>(cacheKey).pipe(
          switchMap((cached) => {
            if (cached?.length && isFresh) {
              return of({ pharmacies: cached, fromCache: true });
            }

            if (cached?.length) {
              this.fetchOsmAndCache(lat, lng, area, cacheKey).subscribe();
              return of({ pharmacies: cached, fromCache: true });
            }

            return this.fetchOsmAndCache(lat, lng, area, cacheKey);
          })
        );
      }),
      catchError(() => this.fetchOsmAndCache(lat, lng, area, cacheKey))
    );
  }

  private fetchOsmAndCache(
    lat: number,
    lng: number,
    area: PharmacySearchArea,
    cacheKey: string
  ): Observable<{ pharmacies: Pharmacy[]; fromCache: boolean }> {
    const source$ =
      area === 'yaounde' || area === 'douala'
        ? this.fetchOsmCity(area)
        : this.osmApi.getPharmaciesNearby(lat, lng);

    return source$.pipe(
      map((pharmacies) => ({ pharmacies, fromCache: false })),
      tap((result) => {
        if (result.pharmacies.length) {
          this.cache.set(cacheKey, result.pharmacies).subscribe();
        }
      }),
      catchError(() => of({ pharmacies: [], fromCache: false }))
    );
  }

  private fetchOsmCity(area: 'yaounde' | 'douala'): Observable<Pharmacy[]> {
    const bounds = CITY_BOUNDS[area];
    return this.osmApi.getPharmaciesInBBox(bounds.south, bounds.west, bounds.north, bounds.east);
  }

  private buildOsmCacheKey(lat: number, lng: number, area: PharmacySearchArea): string {
    if (area === 'yaounde' || area === 'douala') {
      return `${OSM_CACHE_PREFIX}_${area}`;
    }

    return `${OSM_CACHE_PREFIX}_${toLocationGridKey(lat, lng)}`;
  }

  private filterCatalogByArea(pharmacies: Pharmacy[], area: PharmacySearchArea): Pharmacy[] {
    if (area === 'nearby') {
      return pharmacies;
    }

    const city = area === 'yaounde' ? 'yaoundé' : 'douala';
    return pharmacies.filter((pharmacy) => pharmacy.city?.toLowerCase() === city);
  }

  private isValidPharmacy(pharmacy: Pharmacy): boolean {
    return Boolean(
      pharmacy?.id &&
      pharmacy.name &&
      Number.isFinite(pharmacy.lat) &&
      Number.isFinite(pharmacy.lng)
    );
  }

  private haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
    const deltaLat = toRadians(lat2 - lat1);
    const deltaLng = toRadians(lng2 - lng1);
    const originLat = toRadians(lat1);
    const destinationLat = toRadians(lat2);
    const a = Math.sin(deltaLat / 2) ** 2 +
      Math.cos(originLat) * Math.cos(destinationLat) * Math.sin(deltaLng / 2) ** 2;

    return 2 * 6_371_000 * Math.asin(Math.sqrt(a));
  }
}
