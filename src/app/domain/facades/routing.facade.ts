import { Injectable } from '@angular/core';
import { BehaviorSubject, from, Observable, of } from 'rxjs';
import { catchError, finalize, map, switchMap, tap } from 'rxjs/operators';
import { GeoPoint } from '../../core/models/geo-point.model';
import { RouteProfile, RouteResult } from '../../core/models/route.model';
import { GeolocationService } from '../../core/services/geolocation.service';
import { OsrmApiService } from '../../data/api/osrm-api.service';
import { buildPreviewRoute, buildRouteCacheKey } from '../utils/route.util';

const ROUTE_CACHE_TTL_MS = 10 * 60 * 1000;

interface CachedRoute {
  route: RouteResult;
  timestamp: number;
}

@Injectable({ providedIn: 'root' })
export class RoutingFacade {
  private readonly routeSubject = new BehaviorSubject<RouteResult | null>(null);
  private readonly loadingSubject = new BehaviorSubject<boolean>(false);
  private readonly profileSubject = new BehaviorSubject<RouteProfile>('driving');
  private readonly routeCache = new Map<string, CachedRoute>();

  readonly route$ = this.routeSubject.asObservable();
  readonly loading$ = this.loadingSubject.asObservable();
  readonly profile$ = this.profileSubject.asObservable();

  constructor(
    private readonly osrmApi: OsrmApiService,
    private readonly geolocation: GeolocationService
  ) {}

  calculateRoute(destination: GeoPoint, profile?: RouteProfile): Observable<RouteResult> {
    const selectedProfile = profile ?? this.profileSubject.value;
    this.profileSubject.next(selectedProfile);
    this.loadingSubject.next(true);

    return from(this.resolveOrigin()).pipe(
      switchMap((origin) => {
        const cacheKey = buildRouteCacheKey(origin, destination, selectedProfile);
        const cached = this.getCachedRoute(cacheKey);
        if (cached) {
          this.routeSubject.next(cached);
          this.loadingSubject.next(false);
          return of(cached);
        }

        const preview = buildPreviewRoute(origin, destination, selectedProfile);
        this.routeSubject.next(preview);

        return this.osrmApi
          .getRoute(origin, destination, selectedProfile)
          .pipe(
            map(
              (route) =>
                ({
                  distanceMeters: route.distanceMeters,
                  durationSeconds: route.durationSeconds,
                  geometry: route.geometry,
                  profile: selectedProfile,
                  isPreview: false,
                }) satisfies RouteResult
            ),
            tap((resolved) => {
              this.rememberRoute(cacheKey, resolved);
              this.routeSubject.next(resolved);
            }),
            catchError(() => {
              this.routeSubject.next(preview);
              return of(preview);
            }),
            finalize(() => this.loadingSubject.next(false))
          );
      })
    );
  }

  clearRoute(): void {
    this.routeSubject.next(null);
    this.loadingSubject.next(false);
  }

  setProfile(profile: RouteProfile): void {
    this.profileSubject.next(profile);
  }

  private async resolveOrigin(): Promise<GeoPoint> {
    return this.geolocation.getLastKnownPosition() ?? (await this.geolocation.getFastPosition());
  }

  private getCachedRoute(cacheKey: string): RouteResult | null {
    const cached = this.routeCache.get(cacheKey);
    if (!cached) {
      return null;
    }

    if (Date.now() - cached.timestamp > ROUTE_CACHE_TTL_MS) {
      this.routeCache.delete(cacheKey);
      return null;
    }

    return cached.route;
  }

  private rememberRoute(cacheKey: string, route: RouteResult): void {
    this.routeCache.set(cacheKey, {
      route,
      timestamp: Date.now(),
    });
  }
}
