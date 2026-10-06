import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Pharmacy } from '../../core/models/pharmacy.model';
import { CacheService } from '../../core/services/cache.service';

export interface VisitRecord {
  id: string;
  pharmacyId: string;
  pharmacyName: string;
  address?: string;
  city?: string;
  photoUrl?: string;
  visitedAt: string;
  distanceMeters?: number;
  durationSeconds?: number;
  hasReview: boolean;
}

const VISITS_KEY = 'Lokapharm_visits_v1';
const MAX_VISITS = 50;

@Injectable({ providedIn: 'root' })
export class VisitHistoryFacade {
  private readonly visitsSubject = new BehaviorSubject<VisitRecord[]>([]);
  readonly visits$ = this.visitsSubject.asObservable();

  constructor(private readonly cache: CacheService) {
    this.load();
  }

  recordVisit(
    pharmacy: Pharmacy,
    meta?: { distanceMeters?: number; durationSeconds?: number }
  ): void {
    const visits = [...this.visitsSubject.value];
    const record: VisitRecord = {
      id: `${pharmacy.id}-${Date.now()}`,
      pharmacyId: pharmacy.id,
      pharmacyName: pharmacy.name,
      address: pharmacy.address || pharmacy.district,
      city: pharmacy.city,
      photoUrl: pharmacy.photos?.[0],
      visitedAt: new Date().toISOString(),
      distanceMeters: meta?.distanceMeters ?? pharmacy.distanceMeters,
      durationSeconds: meta?.durationSeconds ?? pharmacy.durationSeconds,
      hasReview: false,
    };

    visits.unshift(record);
    const trimmed = visits.slice(0, MAX_VISITS);
    this.visitsSubject.next(trimmed);
    this.cache.set(VISITS_KEY, trimmed).subscribe();
  }

  markReviewed(visitId: string): void {
    const next = this.visitsSubject.value.map((visit) =>
      visit.id === visitId ? { ...visit, hasReview: true } : visit
    );
    this.visitsSubject.next(next);
    this.cache.set(VISITS_KEY, next).subscribe();
  }

  clear(): void {
    this.visitsSubject.next([]);
    this.cache.set(VISITS_KEY, []).subscribe();
  }

  private load(): void {
    this.cache.get<VisitRecord[]>(VISITS_KEY).subscribe({
      next: (visits) => this.visitsSubject.next(visits ?? []),
      error: () => this.visitsSubject.next([]),
    });
  }
}
