import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, finalize, map, shareReplay, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { CAMEROON_BOUNDS } from '../../core/constants/cameroon-bounds';
import { Pharmacy } from '../../core/models/pharmacy.model';
import { mapTagsToPharmacy, mergePharmacy } from '../../domain/utils/pharmacy-details.util';
import { NominatimApiService } from './nominatim-api.service';
import { WikidataApiService } from './wikidata-api.service';

interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

interface OverpassResponse {
  elements?: OverpassElement[];
}

const NEARBY_RADIUS_KM = 8;
const OVERPASS_TIMEOUT_S = 18;

@Injectable({ providedIn: 'root' })
export class OsmOverpassApiService {
  private readonly inFlight = new Map<string, Observable<Pharmacy[]>>();
  private readonly detailInFlight = new Map<string, Observable<Pharmacy>>();
  private readonly detailCache = new Map<string, Pharmacy>();

  constructor(
    private readonly http: HttpClient,
    private readonly nominatim: NominatimApiService,
    private readonly wikidata: WikidataApiService
  ) {}

  getPharmaciesNearby(lat: number, lng: number, radiusKm = NEARBY_RADIUS_KM): Observable<Pharmacy[]> {
    const radiusMeters = Math.round(radiusKm * 1000);
    const query = `
      [out:json][timeout:${OVERPASS_TIMEOUT_S}];
      (
        nwr["amenity"="pharmacy"](around:${radiusMeters},${lat},${lng});
        nwr["healthcare"="pharmacy"](around:${radiusMeters},${lat},${lng});
      );
      out center tags;
    `.trim();

    return this.runCachedQuery(`nearby:${lat.toFixed(3)}:${lng.toFixed(3)}:${radiusKm}`, query);
  }

  getPharmaciesInBBox(
    south: number,
    west: number,
    north: number,
    east: number
  ): Observable<Pharmacy[]> {
    const query = `
      [out:json][timeout:${OVERPASS_TIMEOUT_S}];
      (
        nwr["amenity"="pharmacy"](${south},${west},${north},${east});
        nwr["healthcare"="pharmacy"](${south},${west},${north},${east});
      );
      out center tags;
    `.trim();

    return this.runCachedQuery(`bbox:${south}:${west}:${north}:${east}`, query);
  }

  getPharmacyDetails(pharmacy: Pharmacy): Observable<Pharmacy> {
    const cached = this.detailCache.get(pharmacy.id);
    if (cached) {
      return of(cached);
    }

    const inFlight = this.detailInFlight.get(pharmacy.id);
    if (inFlight) {
      return inFlight;
    }

    const request$ = this.fetchPharmacyDetails(pharmacy).pipe(
      tap((merged) => this.detailCache.set(pharmacy.id, merged)),
      shareReplay(1),
      finalize(() => this.detailInFlight.delete(pharmacy.id))
    );

    this.detailInFlight.set(pharmacy.id, request$);
    return request$;
  }

  enrichPhotos(pharmacy: Pharmacy): Observable<Pharmacy> {
    return this.attachWikidataPhoto(pharmacy);
  }

  private fetchPharmacyDetails(pharmacy: Pharmacy): Observable<Pharmacy> {
    return this.nominatim.enrichPharmacy(pharmacy).pipe(
      map((geo) =>
        mergePharmacy(pharmacy, {
          district: geo.district,
          city: geo.city,
          address: geo.address ?? this.shortAddressFromDisplayName(geo.fullAddress),
          postcode: geo.postcode,
          phone: geo.phone,
          website: geo.website,
          openingHours: geo.openingHours,
        })
      ),
      catchError(() => of(pharmacy))
    );
  }

  private attachWikidataPhoto(pharmacy: Pharmacy): Observable<Pharmacy> {
    if (!pharmacy.wikidata) {
      return of(pharmacy);
    }

    const hasRealPhoto = (pharmacy.photos ?? []).some(
      (photo) => !photo.includes('staticmap.openstreetmap.de')
    );
    if (hasRealPhoto) {
      return of(pharmacy);
    }

    return this.wikidata.getImageUrl(pharmacy.wikidata).pipe(
      map((imageUrl) => {
        if (!imageUrl) {
          return pharmacy;
        }

        const enriched = mergePharmacy(pharmacy, {
          photos: [imageUrl, ...(pharmacy.photos ?? [])],
        });
        this.detailCache.set(pharmacy.id, enriched);
        return enriched;
      }),
      catchError(() => of(pharmacy))
    );
  }

  private runCachedQuery(cacheKey: string, query: string): Observable<Pharmacy[]> {
    const existing = this.inFlight.get(cacheKey);
    if (existing) {
      return existing;
    }

    const request$ = this.queryOverpass(environment.overpassApi, query).pipe(
      catchError(() => this.queryOverpass(environment.overpassApiFallback, query)),
      catchError(() => of([])),
      shareReplay(1),
      finalize(() => this.inFlight.delete(cacheKey))
    );

    this.inFlight.set(cacheKey, request$);
    return request$;
  }

  private queryOverpass(url: string, query: string): Observable<Pharmacy[]> {
    const body = new HttpParams().set('data', query);
    const headers = new HttpHeaders({
      'Content-Type': 'application/x-www-form-urlencoded',
    });

    return this.http.post<OverpassResponse>(url, body.toString(), { headers }).pipe(
      map((response) => this.mapElements(response.elements ?? []))
    );
  }

  private mapElements(elements: OverpassElement[]): Pharmacy[] {
    const pharmacies: Pharmacy[] = [];

    for (const element of elements) {
      const pharmacy = this.mapElement(element);
      if (pharmacy && this.isValidPharmacy(pharmacy)) {
        pharmacies.push(pharmacy);
      }
    }

    return this.deduplicatePharmacies(pharmacies);
  }

  private mapElement(element: OverpassElement): Pharmacy | null {
    const tags = element.tags ?? {};
    if (!this.isPharmacyTags(tags)) {
      return null;
    }

    const lat = element.lat ?? element.center?.lat;
    const lng = element.lon ?? element.center?.lon;

    if (lat == null || lng == null) {
      return null;
    }

    return mapTagsToPharmacy(element.type, element.id, lat, lng, tags);
  }

  private isPharmacyTags(tags: Record<string, string>): boolean {
    return tags['amenity'] === 'pharmacy' || tags['healthcare'] === 'pharmacy';
  }

  private isValidPharmacy(pharmacy: Pharmacy): boolean {
    return (
      pharmacy.lat >= CAMEROON_BOUNDS.south &&
      pharmacy.lat <= CAMEROON_BOUNDS.north &&
      pharmacy.lng >= CAMEROON_BOUNDS.west &&
      pharmacy.lng <= CAMEROON_BOUNDS.east
    );
  }

  private deduplicatePharmacies(pharmacies: Pharmacy[]): Pharmacy[] {
    const seen = new Map<string, Pharmacy>();

    for (const pharmacy of pharmacies) {
      seen.set(pharmacy.id, pharmacy);
    }

    return Array.from(seen.values());
  }

  private shortAddressFromDisplayName(displayName?: string): string | undefined {
    if (!displayName) {
      return undefined;
    }

    return displayName
      .split(',')
      .slice(0, 3)
      .map((part) => part.trim())
      .filter(Boolean)
      .join(', ');
  }
}
