import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { Pharmacy, PharmacySource } from '../../core/models/pharmacy.model';

export interface PharmacyApiMeta {
  total: number;
  source: PharmacySource | 'none';
  fromCache: boolean;
  partial: boolean;
  minsanteCount: number;
  osmCount: number;
  fetchedAt: string;
  radiusKm: number;
}

export interface PharmacyApiResponse {
  pharmacies: Pharmacy[];
  meta: PharmacyApiMeta;
}

export interface PharmacyApiQuery {
  lat: number;
  lng: number;
  radiusKm?: number;
  city?: 'nearby' | 'yaounde' | 'douala';
  onCall?: boolean;
  openNow?: boolean;
  open24h?: boolean;
  maxDistanceKm?: number;
  q?: string;
  limit?: number;
  partial?: boolean;
}

@Injectable({ providedIn: 'root' })
export class LokapharmApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl;

  getPharmacies(query: PharmacyApiQuery): Observable<PharmacyApiResponse> {
    let params = new HttpParams()
      .set('lat', String(query.lat))
      .set('lng', String(query.lng));

    if (query.radiusKm != null) {
      params = params.set('radiusKm', String(query.radiusKm));
    }
    if (query.city) {
      params = params.set('city', query.city);
    }
    if (query.onCall) {
      params = params.set('onCall', '1');
    }
    if (query.openNow) {
      params = params.set('openNow', '1');
    }
    if (query.open24h) {
      params = params.set('open24h', '1');
    }
    if (query.maxDistanceKm != null) {
      params = params.set('maxDistanceKm', String(query.maxDistanceKm));
    }
    if (query.q) {
      params = params.set('q', query.q);
    }
    if (query.limit != null) {
      params = params.set('limit', String(query.limit));
    }
    if (query.partial) {
      params = params.set('partial', '1');
    }

    return this.http.get<PharmacyApiResponse>(`${this.baseUrl}/api/pharmacies`, { params });
  }

  getPharmacyById(id: string, lat: number, lng: number): Observable<Pharmacy> {
    const params = new HttpParams().set('lat', String(lat)).set('lng', String(lng));
    return this.http
      .get<{ pharmacy: Pharmacy }>(`${this.baseUrl}/api/pharmacies/${encodeURIComponent(id)}`, {
        params,
      })
      .pipe(map((response) => response.pharmacy));
  }
}
