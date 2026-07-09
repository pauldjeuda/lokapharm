import { Injectable } from '@angular/core';
import { BehaviorSubject, combineLatest, Observable, of, Subject } from 'rxjs';
import {
  catchError,
  debounceTime,
  distinctUntilChanged,
  map,
  shareReplay,
  switchMap,
  takeUntil,
  tap,
} from 'rxjs/operators';
import { CITY_BOUNDS } from '../../core/constants/cameroon-bounds';
import { GeoPoint } from '../../core/models/geo-point.model';
import { Pharmacy, PharmacyDetails } from '../../core/models/pharmacy.model';
import { GeolocationService } from '../../core/services/geolocation.service';
import { NominatimApiService, NominatimEnrichment } from '../../data/api/nominatim-api.service';
import { OsmOverpassApiService } from '../../data/api/osm-overpass-api.service';
import { haversineDistance, sortByDistance } from '../utils/distance.util';
import {
  buildFullAddress,
  formatCoordinatesAddress,
  formatOpeningHours,
  isOpenNow,
  mergePharmacy,
  needsGeocodedLocation,
  shortenDisplayName,
} from '../utils/pharmacy-details.util';
import { PharmacyRepository, PharmacyLoadResult } from '../../data/repositories/pharmacy.repository';

export type PharmacyFilter = 'nearby' | 'yaounde' | 'douala';
export type DataSourceLabel =
  | 'MINSANTE + OpenStreetMap'
  | 'MINSANTE / DPML'
  | 'OpenStreetMap'
  | 'Démonstration'
  | 'Aucune';

@Injectable({ providedIn: 'root' })
export class PharmacyFacade {
  private readonly rawPharmaciesSubject = new BehaviorSubject<Pharmacy[]>([]);
  private readonly userPositionSubject = new BehaviorSubject<GeoPoint | null>(null);
  private readonly selectedSubject = new BehaviorSubject<Pharmacy | null>(null);
  private readonly loadingSubject = new BehaviorSubject<boolean>(false);
  private readonly searchSubject = new BehaviorSubject<string>('');
  private readonly filterSubject = new BehaviorSubject<PharmacyFilter>('nearby');
  private readonly favoritesSubject = new BehaviorSubject<Pharmacy[]>([]);
  private readonly dataSourceSubject = new BehaviorSubject<DataSourceLabel>('Aucune');
  private readonly fromCacheSubject = new BehaviorSubject<boolean>(false);
  private readonly detailsLoadingSubject = new BehaviorSubject<boolean>(false);
  private readonly pharmacyDetailsSubject = new BehaviorSubject<PharmacyDetails | null>(null);
  private readonly loadCancel$ = new Subject<void>();
  private readonly detailsCancel$ = new Subject<void>();

  readonly pharmacies$ = combineLatest([
    this.rawPharmaciesSubject,
    this.userPositionSubject,
  ]).pipe(
    map(([pharmacies, position]) => this.withDistances(pharmacies, position)),
    shareReplay(1)
  );

  readonly selectedPharmacy$ = this.selectedSubject.asObservable();
  readonly loading$ = this.loadingSubject.asObservable();
  readonly searchQuery$ = this.searchSubject.asObservable();
  readonly filter$ = this.filterSubject.asObservable();
  readonly favorites$ = this.favoritesSubject.asObservable();
  readonly favoriteIds$ = this.favorites$.pipe(
    map((items) => new Set(items.map((item) => item.id))),
    shareReplay(1)
  );
  readonly userPosition$ = this.userPositionSubject.asObservable();
  readonly dataSource$ = this.dataSourceSubject.asObservable();
  readonly fromCache$ = this.fromCacheSubject.asObservable();
  readonly detailsLoading$ = this.detailsLoadingSubject.asObservable();
  readonly pharmacyDetails$ = this.pharmacyDetailsSubject.asObservable();

  readonly filteredPharmacies$ = combineLatest([
    this.pharmacies$,
    this.searchSubject.pipe(debounceTime(300), distinctUntilChanged()),
    this.filter$,
  ]).pipe(map(([pharmacies, query]) => this.applyFilters(pharmacies, query)));

  constructor(
    private readonly repository: PharmacyRepository,
    private readonly geolocation: GeolocationService,
    private readonly nominatim: NominatimApiService,
    private readonly osmApi: OsmOverpassApiService
  ) {
    this.loadFavorites();

    this.geolocation.position$.subscribe((position) => {
      if (position) {
        this.userPositionSubject.next(position);
      }
    });
  }

  loadPharmacies(position?: GeoPoint, area?: PharmacyFilter): Observable<Pharmacy[]> {
    this.loadCancel$.next();
    this.loadingSubject.next(true);
    const filter = area ?? this.filterSubject.value;

    const source$ = position ? of(position) : this.geolocation.watchPosition();

    return source$.pipe(
      takeUntil(this.loadCancel$),
      tap((userPosition) => this.userPositionSubject.next(userPosition)),
      switchMap((userPosition) => {
        const queryPosition = this.resolveQueryPosition(userPosition, filter);

        return this.repository.getPharmacies(queryPosition.lat, queryPosition.lng, filter).pipe(
          takeUntil(this.loadCancel$),
          tap((result) => {
            this.rawPharmaciesSubject.next(result.pharmacies);
            this.dataSourceSubject.next(this.mapSourceLabel(result.source, result.partial));
            this.fromCacheSubject.next(result.fromCache);
            if (!result.partial) {
              this.loadingSubject.next(false);
            }
          }),
          map((result) => result.pharmacies)
        );
      }),
      catchError(() => {
        this.loadingSubject.next(false);
        return of([]);
      })
    );
  }

  selectPharmacy(pharmacy: Pharmacy | null): void {
    this.selectedSubject.next(pharmacy);
    if (!pharmacy) {
      this.pharmacyDetailsSubject.next(null);
    }
  }

  loadPharmacyDetails(pharmacy: Pharmacy): Observable<PharmacyDetails> {
    this.detailsCancel$.next();
    this.detailsLoadingSubject.next(true);
    this.selectedSubject.next(pharmacy);

    const position = this.userPositionSubject.value;
    const withDistance = position
      ? {
          ...pharmacy,
          distanceMeters: haversineDistance(position, pharmacy),
        }
      : pharmacy;

    this.pharmacyDetailsSubject.next(this.toPharmacyDetails(withDistance));

    const location$ = needsGeocodedLocation(withDistance)
      ? this.nominatim.enrichPharmacy(withDistance).pipe(
          map((geo) => this.applyLocationEnrichment(withDistance, geo)),
          tap((enriched) => this.patchPharmacyInCatalog(enriched)),
          catchError(() => of(withDistance))
        )
      : of(withDistance);

    return location$.pipe(
      takeUntil(this.detailsCancel$),
      switchMap((located) => {
        const geoSnapshot = this.buildGeoSnapshot(located);
        const locatedDetails = this.toPharmacyDetails(located, geoSnapshot);
        this.pharmacyDetailsSubject.next(locatedDetails);
        this.selectedSubject.next(located);

        if (!this.shouldEnrichExtrasFromOsm(located)) {
          this.detailsLoadingSubject.next(false);
          return of(locatedDetails);
        }

        return this.osmApi.getPharmacyDetails(located).pipe(
          takeUntil(this.detailsCancel$),
          switchMap((detailed) => {
            const withExtras = mergePharmacy(located, detailed);
            const details = this.toPharmacyDetails(withExtras, geoSnapshot);
            this.pharmacyDetailsSubject.next(details);
            this.selectedSubject.next(withExtras);
            this.patchPharmacyInCatalog(withExtras);
            this.detailsLoadingSubject.next(false);

            return this.osmApi.enrichPhotos(withExtras).pipe(
              map((withPhotos) => {
                const enriched = this.toPharmacyDetails(withPhotos, geoSnapshot);
                this.pharmacyDetailsSubject.next(enriched);
                this.selectedSubject.next(withPhotos);
                this.patchPharmacyInCatalog(withPhotos);
                return enriched;
              }),
              catchError(() => of(details))
            );
          }),
          catchError(() => {
            this.detailsLoadingSubject.next(false);
            return of(locatedDetails);
          })
        );
      }),
      catchError(() => {
        const fallback = this.toPharmacyDetails(withDistance);
        this.pharmacyDetailsSubject.next(fallback);
        this.selectedSubject.next(withDistance);
        this.detailsLoadingSubject.next(false);
        return of(fallback);
      })
    );
  }

  setSearchQuery(query: string): void {
    this.searchSubject.next(query.trim().toLowerCase());
  }

  setFilter(filter: PharmacyFilter): void {
    if (this.filterSubject.value === filter) {
      return;
    }

    this.filterSubject.next(filter);
    this.loadPharmacies(undefined, filter).subscribe();
  }

  refreshPharmacies(area?: PharmacyFilter): Observable<Pharmacy[]> {
    return this.loadPharmacies(undefined, area ?? this.filterSubject.value);
  }

  toggleFavorite(pharmacy: Pharmacy): void {
    const favorites = [...this.favoritesSubject.value];
    const index = favorites.findIndex((item) => item.id === pharmacy.id);

    if (index >= 0) {
      favorites.splice(index, 1);
    } else {
      favorites.push(pharmacy);
    }

    this.favoritesSubject.next(favorites);
    localStorage.setItem('lokaphar_favorites', JSON.stringify(favorites));
  }

  isFavorite(pharmacy: Pharmacy): boolean {
    return this.favoritesSubject.value.some((item) => item.id === pharmacy.id);
  }

  getSelectedPharmacy(): Pharmacy | null {
    return this.selectedSubject.value;
  }

  private withDistances(pharmacies: Pharmacy[], position: GeoPoint | null): Pharmacy[] {
    if (!position) {
      return sortByDistance(pharmacies);
    }

    return sortByDistance(
      pharmacies.map((pharmacy) => ({
        ...pharmacy,
        distanceMeters: haversineDistance(position, pharmacy),
      }))
    );
  }

  private applyFilters(pharmacies: Pharmacy[], query: string): Pharmacy[] {
    if (!query) {
      return pharmacies;
    }

    return pharmacies.filter((pharmacy) => {
      const haystack = [pharmacy.name, pharmacy.city, pharmacy.district, pharmacy.address]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }

  private resolveQueryPosition(position: GeoPoint, filter: PharmacyFilter): GeoPoint {
    if (filter === 'yaounde') {
      return CITY_BOUNDS.yaounde.center;
    }

    if (filter === 'douala') {
      return CITY_BOUNDS.douala.center;
    }

    return position;
  }

  private loadFavorites(): void {
    try {
      const raw = localStorage.getItem('lokaphar_favorites');
      this.favoritesSubject.next(raw ? JSON.parse(raw) : []);
    } catch {
      this.favoritesSubject.next([]);
    }
  }

  private mapSourceLabel(
    source: PharmacyLoadResult['source'],
    partial?: boolean
  ): DataSourceLabel {
    if (partial && source === 'minsante') {
      return 'MINSANTE / DPML';
    }

    switch (source) {
      case 'merged':
        return 'MINSANTE + OpenStreetMap';
      case 'minsante':
        return 'MINSANTE / DPML';
      case 'osm':
        return 'OpenStreetMap';
      case 'demo':
        return 'Démonstration';
      default:
        return 'Aucune';
    }
  }

  private shouldEnrichExtrasFromOsm(pharmacy: Pharmacy): boolean {
    return (
      pharmacy.source === 'osm' ||
      pharmacy.source === 'merged' ||
      pharmacy.id.startsWith('osm-') ||
      Boolean(pharmacy.osmId)
    );
  }

  private applyLocationEnrichment(pharmacy: Pharmacy, geo: NominatimEnrichment): Pharmacy {
    return mergePharmacy(pharmacy, {
      district: pharmacy.district || geo.district,
      city: pharmacy.city || geo.city,
      address:
        pharmacy.address ||
        geo.address ||
        shortenDisplayName(geo.fullAddress, 2),
      postcode: pharmacy.postcode || geo.postcode,
      phone: pharmacy.phone || geo.phone,
      website: pharmacy.website || geo.website,
      openingHours: pharmacy.openingHours || geo.openingHours,
    });
  }

  private buildGeoSnapshot(pharmacy: Pharmacy): NominatimEnrichment {
    return {
      district: pharmacy.district,
      city: pharmacy.city,
      address: pharmacy.address,
      fullAddress: buildFullAddress(pharmacy) || undefined,
    };
  }

  private patchPharmacyInCatalog(pharmacy: Pharmacy): void {
    const pharmacies = this.rawPharmaciesSubject.value;
    const index = pharmacies.findIndex((item) => item.id === pharmacy.id);

    if (index < 0) {
      return;
    }

    const next = [...pharmacies];
    next[index] = { ...next[index], ...pharmacy };
    this.rawPharmaciesSubject.next(next);
  }

  private toPharmacyDetails(pharmacy: Pharmacy, geo?: NominatimEnrichment): PharmacyDetails {
    const fullAddress = this.resolveFullAddress(pharmacy, geo);

    return {
      ...pharmacy,
      fullAddress,
      isOpenNow: isOpenNow(pharmacy.openingHours),
      openingHoursSummary: formatOpeningHours(pharmacy.openingHours),
    };
  }

  private resolveFullAddress(pharmacy: Pharmacy, geo?: NominatimEnrichment): string {
    const built = buildFullAddress(pharmacy);
    if (built && built !== 'Cameroun') {
      return built;
    }

    const fromGeo = shortenDisplayName(geo?.fullAddress) || geo?.fullAddress;
    if (fromGeo) {
      return fromGeo;
    }

    return formatCoordinatesAddress(pharmacy.lat, pharmacy.lng);
  }
}
