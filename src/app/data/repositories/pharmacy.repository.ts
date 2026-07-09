import { Injectable } from '@angular/core';
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
import { toCorePharmacies } from '../../models/pharmacy.mapper';
import { PharmacyCityFilter, PharmacyService } from '../../services/pharmacy.service';
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

@Injectable({ providedIn: 'root' })
export class PharmacyRepository {
  constructor(
    private readonly pharmacyService: PharmacyService,
    private readonly osmApi: OsmOverpassApiService,
    private readonly cache: CacheService
  ) {}

  /**
   * Charge d'abord le catalogue local (rapide / offline), puis enrichit avec OSM.
   */
  getPharmacies(lat: number, lng: number, area: PharmacySearchArea = 'nearby'): Observable<PharmacyLoadResult> {
    const cityFilter = this.mapAreaToCityFilter(area);

    return this.pharmacyService.getNearbyPharmacies(lat, lng, cityFilter).pipe(
      switchMap((local) => {
        const localCore = toCorePharmacies(local.pharmacies);
        const localMerged = mergePharmacySources(localCore, []);
        const fastResult = this.toLoadResult(localMerged, local.fromCache, true);

        const osmEnrichment$ = this.getOsmPharmacies(lat, lng, area).pipe(
          map((osm) => {
            const merged = mergePharmacySources(localCore, osm.pharmacies);
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

  private mapAreaToCityFilter(area: PharmacySearchArea): PharmacyCityFilter {
    if (area === 'yaounde') {
      return 'Yaoundé';
    }

    if (area === 'douala') {
      return 'Douala';
    }

    return 'all';
  }
}
