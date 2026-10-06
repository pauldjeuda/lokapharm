import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { GeoPoint } from '../../core/models/geo-point.model';
import { RouteProfile, RouteResult, RouteStep } from '../../core/models/route.model';

interface BackendRouteResponse {
  distanceMeters: number;
  durationSeconds: number;
  coordinates: GeoPoint[];
  steps: RouteStep[];
  profile: RouteProfile;
}

@Injectable({ providedIn: 'root' })
export class LokapharmRouteApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl;

  getRoute(origin: GeoPoint, destination: GeoPoint, profile: RouteProfile = 'driving'): Observable<RouteResult> {
    const params = new HttpParams()
      .set('fromLat', String(origin.lat))
      .set('fromLng', String(origin.lng))
      .set('toLat', String(destination.lat))
      .set('toLng', String(destination.lng))
      .set('profile', profile);

    return this.http.get<BackendRouteResponse>(`${this.baseUrl}/api/route`, { params }).pipe(
      map((response) => ({
        distanceMeters: response.distanceMeters,
        durationSeconds: response.durationSeconds,
        geometry: response.coordinates ?? [],
        profile: response.profile ?? profile,
        steps: response.steps ?? [],
        isPreview: false,
      }))
    );
  }
}
