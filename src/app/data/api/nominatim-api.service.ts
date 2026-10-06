import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { forkJoin, Observable, of } from 'rxjs';
import { catchError, finalize, map, shareReplay, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { APP_CONFIG } from '../../core/constants/app-config';
import { Pharmacy } from '../../core/models/pharmacy.model';
import { toLocationGridKey } from '../../core/constants/cameroon-bounds';
import { parseOsmId } from '../../domain/utils/pharmacy-details.util';

export interface NominatimAddress {
  suburb?: string;
  neighbourhood?: string;
  quarter?: string;
  residential?: string;
  hamlet?: string;
  locality?: string;
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  city_district?: string;
  county?: string;
  state?: string;
  road?: string;
  house_number?: string;
  postcode?: string;
  country?: string;
}

export interface NominatimPlace {
  address?: NominatimAddress;
  display_name?: string;
  extratags?: Record<string, string>;
}

export interface NominatimEnrichment {
  district?: string;
  city?: string;
  address?: string;
  postcode?: string;
  fullAddress?: string;
  phone?: string;
  website?: string;
  openingHours?: string;
}

const CACHE_TTL_MS = 30 * 60 * 1000;

@Injectable({ providedIn: 'root' })
export class NominatimApiService {
  private readonly baseUrl = environment.nominatimApi;
  private readonly enrichmentCache = new Map<string, NominatimEnrichment>();
  private readonly inFlight = new Map<string, Observable<NominatimEnrichment>>();

  constructor(private readonly http: HttpClient) {}

  enrichPharmacy(pharmacy: Pharmacy): Observable<NominatimEnrichment> {
    if (pharmacy.district?.trim() && pharmacy.city?.trim() && pharmacy.address?.trim()) {
      return of({});
    }

    const parsed = parseOsmId(pharmacy.id);
    const cacheKey = parsed
      ? `osm:${parsed.type}:${parsed.id}`
      : `geo:${toLocationGridKey(pharmacy.lat, pharmacy.lng)}`;

    const cached = this.enrichmentCache.get(cacheKey);
    if (cached) {
      return of(cached);
    }

    const existing = this.inFlight.get(cacheKey);
    if (existing) {
      return existing;
    }

    const lookup$ = parsed
      ? this.lookupOsmElement(parsed.type, parsed.id)
      : of<NominatimPlace | null>(null);
    const reverse$ = this.reverseGeocode(pharmacy.lat, pharmacy.lng);

    const request$ = forkJoin({
      lookup: lookup$,
      reverse: reverse$,
    }).pipe(
      map(({ lookup, reverse }) =>
        this.mergeEnrichments(
          this.mapPlaceToEnrichment(lookup),
          this.mapPlaceToEnrichment(reverse)
        )
      ),
      map((enrichment) => this.ensureMinimumLocation(enrichment, pharmacy.lat, pharmacy.lng)),
      tap((enrichment) => this.enrichmentCache.set(cacheKey, enrichment)),
      catchError(() => of(this.ensureMinimumLocation({}, pharmacy.lat, pharmacy.lng))),
      shareReplay(1)
    );

    this.inFlight.set(cacheKey, request$);
    return request$.pipe(tap({ finalize: () => this.inFlight.delete(cacheKey) }));
  }

  /** Géocodage inverse uniquement (coordonnées → quartier / ville). */
  reverseGeocodeLocation(lat: number, lng: number): Observable<NominatimEnrichment> {
    const cacheKey = `geo:${toLocationGridKey(lat, lng)}`;
    const cached = this.enrichmentCache.get(cacheKey);
    if (cached) {
      return of(cached);
    }

    return this.reverseGeocode(lat, lng).pipe(
      map((place) => {
        const enrichment = this.ensureMinimumLocation(this.mapPlaceToEnrichment(place), lat, lng);
        this.enrichmentCache.set(cacheKey, enrichment);
        return enrichment;
      }),
      catchError(() => of(this.ensureMinimumLocation({}, lat, lng)))
    );
  }

  enrichFromPlace(place: NominatimPlace | null): NominatimEnrichment {
    return this.mapPlaceToEnrichment(place);
  }

  private withNominatimParams(params: HttpParams): HttpParams {
    return params.set('email', APP_CONFIG.supportEmail);
  }

  private reverseGeocode(lat: number, lng: number, zoom = 18): Observable<NominatimPlace | null> {
    const params = this.withNominatimParams(
      new HttpParams()
        .set('lat', lat.toString())
        .set('lon', lng.toString())
        .set('format', 'json')
        .set('addressdetails', '1')
        .set('extratags', '1')
        .set('zoom', zoom.toString())
        .set('accept-language', 'fr')
    );

    return this.http
      .get<NominatimPlace>(`${this.baseUrl}/reverse`, {
        params,
        headers: { 'Accept-Language': 'fr' },
      })
      .pipe(catchError(() => of(null)));
  }

  private lookupOsmElement(
    osmType: 'node' | 'way' | 'relation',
    osmId: number
  ): Observable<NominatimPlace | null> {
    const prefix = osmType === 'node' ? 'N' : osmType === 'way' ? 'W' : 'R';
    const params = this.withNominatimParams(
      new HttpParams()
        .set('osm_ids', `${prefix}${osmId}`)
        .set('format', 'json')
        .set('addressdetails', '1')
        .set('extratags', '1')
        .set('accept-language', 'fr')
    );

    return this.http
      .get<NominatimPlace[]>(`${this.baseUrl}/lookup`, {
        params,
        headers: { 'Accept-Language': 'fr' },
      })
      .pipe(
        map((results) => results[0] ?? null),
        catchError(() => of(null))
      );
  }

  private hasCompleteLocation(pharmacy: Pharmacy): boolean {
    return Boolean(pharmacy.district?.trim() && pharmacy.city?.trim());
  }

  private ensureMinimumLocation(
    enrichment: NominatimEnrichment,
    lat: number,
    lng: number
  ): NominatimEnrichment {
    const result = { ...enrichment };

    if (!result.city) {
      result.city = this.inferCityFromCoordinates(lat, lng);
    }

    if (!result.fullAddress && (result.address || result.district || result.city)) {
      result.fullAddress = [result.address, result.district, result.city, 'Cameroun']
        .filter(Boolean)
        .join(', ');
    }

    if (!result.fullAddress) {
      result.fullAddress = `${lat.toFixed(5)}°, ${lng.toFixed(5)}° — Cameroun`;
    }

    return result;
  }

  private inferCityFromCoordinates(lat: number, lng: number): string | undefined {
    if (lat >= 3.72 && lat <= 3.92 && lng >= 11.42 && lng <= 11.58) {
      return 'Yaoundé';
    }

    if (lat >= 4.0 && lat <= 4.12 && lng >= 9.65 && lng <= 9.78) {
      return 'Douala';
    }

    return undefined;
  }

  private mergeEnrichments(...items: NominatimEnrichment[]): NominatimEnrichment {
    const merged: NominatimEnrichment = {};

    for (const item of items) {
      for (const [key, value] of Object.entries(item) as Array<
        [keyof NominatimEnrichment, string | undefined]
      >) {
        if (value && !merged[key]) {
          merged[key] = value;
        }
      }
    }

    return merged;
  }

  private mapPlaceToEnrichment(place: NominatimPlace | null): NominatimEnrichment {
    if (!place?.address) {
      return {};
    }

    const address = place.address;
    const extratags = place.extratags ?? {};

    return {
      district: this.pickDistrict(address),
      city: this.pickCity(address),
      address: this.buildStreetAddress(address),
      postcode: address.postcode,
      fullAddress: place.display_name,
      phone: extratags['phone'] ?? extratags['contact:phone'] ?? extratags['contact:mobile'],
      website: extratags['website'] ?? extratags['contact:website'],
      openingHours: extratags['opening_hours'],
    };
  }

  private pickDistrict(address: NominatimAddress): string | undefined {
    return (
      address.suburb ??
      address.neighbourhood ??
      address.quarter ??
      address.city_district ??
      address.residential ??
      address.hamlet ??
      address.locality ??
      address.municipality
    );
  }

  private pickCity(address: NominatimAddress): string | undefined {
    return address.city ?? address.town ?? address.village ?? address.municipality ?? address.county;
  }

  private buildStreetAddress(address: NominatimAddress): string | undefined {
    const streetLine = [address.house_number, address.road].filter(Boolean).join(' ').trim();
    return streetLine || address.road || undefined;
  }
}
