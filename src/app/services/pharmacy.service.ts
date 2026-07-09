import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { CacheService } from '../core/services/cache.service';
import { Pharmacy, PharmacyWithDistance } from '../models/pharmacy.model';

/** Géométrie GeoJSON LineString (coordonnées [longitude, latitude]). */
export interface RouteGeoJsonLineString {
  type: 'LineString';
  coordinates: [number, number][];
}

/** Résultat OSRM — distance, durée et géométrie GeoJSON pour Leaflet. */
export interface PharmacyRouteResult {
  distanceMeters: number;
  durationSeconds: number;
  geoJson: RouteGeoJsonLineString;
  /** Points convertis pour Leaflet ({ lat, lng }). */
  geometry: Array<{ lat: number; lng: number }>;
}

export interface NearbyPharmaciesResult {
  pharmacies: PharmacyWithDistance[];
  fromCache: boolean;
}

export type PharmacyCityFilter = 'all' | 'Yaoundé' | 'Douala';

interface OsrmRouteResponse {
  routes?: Array<{
    distance: number;
    duration: number;
    geometry: RouteGeoJsonLineString;
  }>;
}

/**
 * Catalogue local mis en cache sur l'appareil (Ionic Storage).
 *
 * Stratégie réseau Cameroun (connexion instable) :
 * 1. Au premier lancement : téléchargement HTTP → stockage local.
 * 2. Lancements suivants : lecture immédiate du cache (mode hors-ligne).
 * 3. Si le cache a plus de 7 jours : affichage stale + rafraîchissement silencieux en arrière-plan.
 * 4. Si le réseau échoue : on conserve le dernier catalogue connu.
 */
const CATALOG_CACHE_KEY = 'Lokapharm_pharmacies_catalog_v1';
const CATALOG_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const STALE_OK_MS = 30 * 24 * 60 * 60 * 1000;

const EARTH_RADIUS_METERS = 6_371_000;

@Injectable({ providedIn: 'root' })
export class PharmacyService {
  constructor(
    private readonly http: HttpClient,
    private readonly cache: CacheService
  ) {}

  /**
   * Récupère les pharmacies locales, trie par distance (Haversine) et applique un filtre ville optionnel.
   */
  getNearbyPharmacies(
    userLat: number,
    userLng: number,
    cityFilter: PharmacyCityFilter = 'all'
  ): Observable<NearbyPharmaciesResult> {
    return this.loadCatalog().pipe(
      map((catalogResult) => {
        const filtered = this.filterByCity(catalogResult.pharmacies, cityFilter);
        const withDistance = filtered.map((pharmacy) => ({
          ...pharmacy,
          distance_meters: this.haversineDistance(userLat, userLng, pharmacy.latitude, pharmacy.longitude),
        }));

        withDistance.sort((a, b) => a.distance_meters - b.distance_meters);

        return {
          pharmacies: withDistance,
          fromCache: catalogResult.fromCache,
        } satisfies NearbyPharmaciesResult;
      })
    );
  }

  /**
   * Calcule un itinéraire via l'API publique OSRM (gratuite).
   * Retourne distance, durée et géométrie GeoJSON pour le tracé Leaflet.
   */
  getRoute(
    userLat: number,
    userLng: number,
    pharmaLat: number,
    pharmaLng: number
  ): Observable<PharmacyRouteResult> {
    const coords = `${userLng},${userLat};${pharmaLng},${pharmaLat}`;
    const url = `${environment.osrmApi}/route/v1/driving/${coords}`;

    return this.http
      .get<OsrmRouteResponse>(url, {
        params: {
          overview: 'full',
          geometries: 'geojson',
          steps: 'false',
          alternatives: 'false',
        },
      })
      .pipe(
        map((response) => {
          const route = response.routes?.[0];
          if (!route?.geometry?.coordinates?.length) {
            throw new Error('Aucun itinéraire OSRM trouvé');
          }

          return {
            distanceMeters: route.distance,
            durationSeconds: route.duration,
            geoJson: route.geometry,
            geometry: route.geometry.coordinates.map(([lng, lat]) => ({ lat, lng })),
          } satisfies PharmacyRouteResult;
        })
      );
  }

  /** Force le rechargement du catalogue depuis le back-end / JSON embarqué. */
  refreshCatalog(): Observable<Pharmacy[]> {
    return this.fetchCatalogFromNetwork().pipe(
      tap((pharmacies) => this.cache.set(CATALOG_CACHE_KEY, pharmacies).subscribe())
    );
  }

  private loadCatalog(): Observable<{ pharmacies: Pharmacy[]; fromCache: boolean }> {
    return this.cache.getTimestamp(CATALOG_CACHE_KEY).pipe(
      switchMap((timestamp) => {
        const ageMs = timestamp ? Date.now() - timestamp : Number.POSITIVE_INFINITY;
        const hasCache = timestamp !== null;

        return this.cache.get<Pharmacy[]>(CATALOG_CACHE_KEY).pipe(
          switchMap((cached) => {
            if (cached?.length && ageMs < CATALOG_TTL_MS) {
              return of({ pharmacies: cached, fromCache: true });
            }

            if (cached?.length && ageMs < STALE_OK_MS) {
              this.fetchCatalogFromNetwork()
                .pipe(
                  tap((fresh) => this.cache.set(CATALOG_CACHE_KEY, fresh).subscribe()),
                  catchError(() => of(null))
                )
                .subscribe();

              return of({ pharmacies: cached, fromCache: true });
            }

            if (cached?.length) {
              return this.fetchCatalogFromNetwork().pipe(
                map((fresh) => ({ pharmacies: fresh, fromCache: false })),
                tap((result) => this.cache.set(CATALOG_CACHE_KEY, result.pharmacies).subscribe()),
                catchError(() => of({ pharmacies: cached, fromCache: true }))
              );
            }

            return this.fetchCatalogFromNetwork().pipe(
              map((fresh) => ({ pharmacies: fresh, fromCache: false })),
              tap((result) => {
                if (result.pharmacies.length) {
                  this.cache.set(CATALOG_CACHE_KEY, result.pharmacies).subscribe();
                }
              }),
              catchError((error) => {
                if (hasCache && cached?.length) {
                  return of({ pharmacies: cached, fromCache: true });
                }
                return throwError(() => error);
              })
            );
          })
        );
      })
    );
  }

  private fetchCatalogFromNetwork(): Observable<Pharmacy[]> {
    return this.http.get<Pharmacy[]>(environment.pharmaciesApi).pipe(
      map((items) => items.filter((item) => this.isValidPharmacy(item)))
    );
  }

  private filterByCity(pharmacies: Pharmacy[], cityFilter: PharmacyCityFilter): Pharmacy[] {
    if (cityFilter === 'all') {
      return pharmacies;
    }

    const normalized = cityFilter.toLowerCase();
    return pharmacies.filter((pharmacy) => pharmacy.city.toLowerCase() === normalized);
  }

  private isValidPharmacy(item: Pharmacy): boolean {
    return Boolean(
      item?.id &&
        item.name &&
        Number.isFinite(item.latitude) &&
        Number.isFinite(item.longitude)
    );
  }

  /** Distance à vol d'oiseau (formule de Haversine). */
  private haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const rLat1 = toRad(lat1);
    const rLat2 = toRad(lat2);

    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(rLat1) * Math.cos(rLat2) * Math.sin(dLng / 2) ** 2;

    return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(a));
  }
}
