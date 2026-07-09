import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, shareReplay, finalize } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { GeoPoint } from '../../core/models/geo-point.model';
import { RouteProfile, RouteResult } from '../../core/models/route.model';

interface OsrmRouteResponse {
  routes?: Array<{
    distance: number;
    duration: number;
    geometry: {
      coordinates: [number, number][];
    };
  }>;
}

@Injectable({ providedIn: 'root' })
export class OsrmApiService {
  private readonly inFlight = new Map<string, Observable<RouteResult>>();

  constructor(private readonly http: HttpClient) {}

  getRoute(
    origin: GeoPoint,
    destination: GeoPoint,
    profile: RouteProfile = 'driving'
  ): Observable<RouteResult> {
    const cacheKey = `${profile}:${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;
    const existing = this.inFlight.get(cacheKey);
    if (existing) {
      return existing;
    }

    const coords = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;
    const url = `${environment.osrmApi}/route/v1/${profile}/${coords}`;

    const request$ = this.http
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
          if (!route) {
            throw new Error('Aucun itinéraire trouvé');
          }

          return {
            distanceMeters: route.distance,
            durationSeconds: route.duration,
            geometry: route.geometry.coordinates.map(([lng, lat]) => ({ lat, lng })),
            profile,
            isPreview: false,
          } satisfies RouteResult;
        }),
        shareReplay(1),
        finalize(() => this.inFlight.delete(cacheKey))
      );

    this.inFlight.set(cacheKey, request$);
    return request$;
  }
}
