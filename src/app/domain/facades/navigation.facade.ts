import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { GeoPoint } from '../../core/models/geo-point.model';
import { Pharmacy } from '../../core/models/pharmacy.model';
import { RouteResult } from '../../core/models/route.model';
import { GeolocationService } from '../../core/services/geolocation.service';
import { haversineDistance, remainingRouteDistance } from '../utils/distance.util';

const ARRIVAL_THRESHOLD_METERS = 40;
const MIN_MOVEMENT_FOR_SPEED_METERS = 3;
const MIN_SPEED_MPS = 0.8;
const MAX_SPEED_MPS = 40;
const SPEED_SMOOTHING_FACTOR = 0.35;

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
  private lastTrackedPosition: GeoPoint | null = null;
  private lastTrackedAt = 0;
  private currentSpeedMps: number | null = null;

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
    this.stopNavigation();
    this.activeRoute = route;
    this.totalRouteDistance = route.distanceMeters;
    this.totalRouteDuration = route.durationSeconds;
    this.destinationSubject.next(pharmacy);
    this.navigatingSubject.next(true);

    const currentPosition = await this.geolocation.getCurrentPosition();
    this.currentPositionSubject.next(currentPosition);
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
    this.lastTrackedPosition = null;
    this.lastTrackedAt = 0;
    this.currentSpeedMps = null;
  }

  isNavigating(): boolean {
    return this.navigatingSubject.value;
  }

  private updateProgress(position: GeoPoint, pharmacy: Pharmacy): void {
    const destination = { lat: pharmacy.lat, lng: pharmacy.lng };
    const remainingDistance = this.activeRoute?.geometry.length
      ? remainingRouteDistance(position, this.activeRoute.geometry)
      : haversineDistance(position, destination);
    const speedMps = this.updateTrackedSpeed(position);
    const fallbackAverageSpeed =
      this.totalRouteDistance > 0 && this.totalRouteDuration > 0
        ? this.totalRouteDistance / this.totalRouteDuration
        : null;
    const effectiveSpeedMps = this.resolveEffectiveSpeed(speedMps, fallbackAverageSpeed);
    const remainingDuration = effectiveSpeedMps
      ? Math.max(remainingDistance / effectiveSpeedMps, 0)
      : this.estimateDurationFromRouteRatio(remainingDistance);

    this.remainingDistanceSubject.next(remainingDistance);
    this.remainingDurationSubject.next(remainingDuration);

    if (remainingDistance <= ARRIVAL_THRESHOLD_METERS) {
      this.stopNavigation();
    }
  }

  private updateTrackedSpeed(position: GeoPoint): number | null {
    const now = Date.now();
    const previousPosition = this.lastTrackedPosition;
    const previousTime = this.lastTrackedAt;

    this.lastTrackedPosition = position;
    this.lastTrackedAt = now;

    if (!previousPosition || !previousTime || now <= previousTime) {
      return this.currentSpeedMps;
    }

    const movedMeters = haversineDistance(previousPosition, position);
    const elapsedSeconds = (now - previousTime) / 1000;
    if (elapsedSeconds <= 0 || movedMeters < MIN_MOVEMENT_FOR_SPEED_METERS) {
      return this.currentSpeedMps;
    }

    const instantSpeed = movedMeters / elapsedSeconds;
    const boundedSpeed = Math.min(Math.max(instantSpeed, MIN_SPEED_MPS), MAX_SPEED_MPS);
    this.currentSpeedMps =
      this.currentSpeedMps == null
        ? boundedSpeed
        : this.currentSpeedMps * (1 - SPEED_SMOOTHING_FACTOR) +
          boundedSpeed * SPEED_SMOOTHING_FACTOR;

    return this.currentSpeedMps;
  }

  private resolveEffectiveSpeed(
    trackedSpeedMps: number | null,
    fallbackAverageSpeedMps: number | null
  ): number | null {
    if (trackedSpeedMps && trackedSpeedMps >= MIN_SPEED_MPS) {
      return trackedSpeedMps;
    }

    if (fallbackAverageSpeedMps && fallbackAverageSpeedMps > 0) {
      return fallbackAverageSpeedMps;
    }

    return null;
  }

  private estimateDurationFromRouteRatio(remainingDistance: number): number {
    const ratio =
      this.totalRouteDistance > 0
        ? Math.min(remainingDistance / this.totalRouteDistance, 1)
        : 1;

    return Math.max(this.totalRouteDuration * ratio, 0);
  }
}
