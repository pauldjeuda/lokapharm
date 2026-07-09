import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { GeoPoint } from '../../core/models/geo-point.model';
import { Pharmacy } from '../../core/models/pharmacy.model';
import { RouteResult } from '../../core/models/route.model';
import { GeolocationService } from '../../core/services/geolocation.service';
import { haversineDistance, remainingRouteDistance } from '../utils/distance.util';

const ARRIVAL_THRESHOLD_METERS = 40;

@Injectable({ providedIn: 'root' })
export class NavigationFacade implements OnDestroy {
  private readonly navigatingSubject = new BehaviorSubject<boolean>(false);
  private readonly destinationSubject = new BehaviorSubject<Pharmacy | null>(null);
  private readonly remainingDistanceSubject = new BehaviorSubject<number | null>(null);
  private readonly remainingDurationSubject = new BehaviorSubject<number | null>(null);
  private readonly currentPositionSubject = new BehaviorSubject<GeoPoint | null>(null);

  private activeRoute: RouteResult | null = null;
  private totalRouteDistance = 0;
  private totalRouteDuration = 0;

  readonly navigating$ = this.navigatingSubject.asObservable();
  readonly destination$ = this.destinationSubject.asObservable();
  readonly remainingDistance$ = this.remainingDistanceSubject.asObservable();
  readonly remainingDuration$ = this.remainingDurationSubject.asObservable();
  readonly currentPosition$ = this.currentPositionSubject.asObservable();

  constructor(private readonly geolocation: GeolocationService) {}

  ngOnDestroy(): void {
    this.stopNavigation();
  }

  async startNavigation(pharmacy: Pharmacy, route: RouteResult): Promise<void> {
    this.activeRoute = route;
    this.totalRouteDistance = route.distanceMeters;
    this.totalRouteDuration = route.durationSeconds;
    this.destinationSubject.next(pharmacy);
    this.navigatingSubject.next(true);

    const currentPosition = await this.geolocation.getCurrentPosition();
    this.updateProgress(currentPosition, pharmacy);

    await this.geolocation.startLiveTracking((position) => {
      this.currentPositionSubject.next(position);
      this.updateProgress(position, pharmacy);
    });
  }

  stopNavigation(): void {
    this.geolocation.stopLiveTracking();
    this.navigatingSubject.next(false);
    this.destinationSubject.next(null);
    this.remainingDistanceSubject.next(null);
    this.remainingDurationSubject.next(null);
    this.currentPositionSubject.next(null);
    this.activeRoute = null;
    this.totalRouteDistance = 0;
    this.totalRouteDuration = 0;
  }

  isNavigating(): boolean {
    return this.navigatingSubject.value;
  }

  private updateProgress(position: GeoPoint, pharmacy: Pharmacy): void {
    const destination = { lat: pharmacy.lat, lng: pharmacy.lng };
    const remainingDistance = this.activeRoute?.geometry.length
      ? remainingRouteDistance(position, this.activeRoute.geometry)
      : haversineDistance(position, destination);

    const ratio =
      this.totalRouteDistance > 0
        ? Math.min(remainingDistance / this.totalRouteDistance, 1)
        : 1;

    const remainingDuration = Math.max(this.totalRouteDuration * ratio, 0);

    this.remainingDistanceSubject.next(remainingDistance);
    this.remainingDurationSubject.next(remainingDuration);

    if (remainingDistance <= ARRIVAL_THRESHOLD_METERS) {
      this.stopNavigation();
    }
  }
}
