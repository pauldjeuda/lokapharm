import { Injectable } from '@angular/core';
import { Geolocation, Position } from '@capacitor/geolocation';
import { BehaviorSubject, Observable } from 'rxjs';
import { DEFAULT_CENTER } from '../constants/cameroon-bounds';
import { GeoPoint } from '../models/geo-point.model';

@Injectable({ providedIn: 'root' })
export class GeolocationService {
  private readonly positionSubject = new BehaviorSubject<GeoPoint | null>(null);
  private liveWatchId: string | null = null;
  private browserWatchId: number | null = null;

  readonly position$ = this.positionSubject.asObservable();

  async requestPermission(): Promise<boolean> {
    try {
      const status = await Geolocation.requestPermissions();
      return status.location === 'granted' || status.coarseLocation === 'granted';
    } catch {
      return this.requestBrowserPermission();
    }
  }

  /** Position rapide : cache navigateur ou centre par défaut (pas d'attente GPS longue). */
  getFastPosition(): Promise<GeoPoint> {
    const lastKnown = this.positionSubject.value;
    if (lastKnown) {
      return Promise.resolve(lastKnown);
    }

    return this.getBrowserPosition({ maximumAge: 300_000, timeout: 4_000 }).catch(() =>
      Promise.resolve(DEFAULT_CENTER)
    );
  }

  watchPosition(): Observable<GeoPoint> {
    return new Observable<GeoPoint>((subscriber) => {
      let fastPosition: GeoPoint | null = null;

      void this.getFastPosition()
        .then((position) => {
          fastPosition = position;
          this.positionSubject.next(position);
          subscriber.next(position);

          void this.getCurrentPosition()
            .then((precise) => {
              if (!this.isSamePoint(position, precise)) {
                subscriber.next(precise);
              }
              subscriber.complete();
            })
            .catch(() => subscriber.complete());
        })
        .catch(() => {
          void this.getCurrentPosition()
            .then((precise) => {
              this.positionSubject.next(precise);
              if (!fastPosition || !this.isSamePoint(fastPosition, precise)) {
                subscriber.next(precise);
              }
              subscriber.complete();
            })
            .catch((error) => subscriber.error(error));
        });
    });
  }

  startLiveTracking(onPosition: (position: GeoPoint) => void): Promise<void> {
    this.stopLiveTracking();

    return Geolocation.watchPosition(
      { enableHighAccuracy: true, timeout: 10000 },
      (position, error) => {
        if (error) {
          return;
        }

        if (!position) {
          return;
        }

        const point = this.mapPosition(position);
        this.positionSubject.next(point);
        onPosition(point);
      }
    )
      .then((watchId) => {
        this.liveWatchId = watchId;
      })
      .catch(() => {
        this.startBrowserLiveTracking(onPosition);
      });
  }

  stopLiveTracking(): void {
    if (this.liveWatchId) {
      void Geolocation.clearWatch({ id: this.liveWatchId });
      this.liveWatchId = null;
    }

    if (this.browserWatchId != null) {
      navigator.geolocation.clearWatch(this.browserWatchId);
      this.browserWatchId = null;
    }
  }

  getCurrentPosition(): Promise<GeoPoint> {
    return Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 8000,
    })
      .then((position) => {
        const point = this.mapPosition(position);
        this.positionSubject.next(point);
        return point;
      })
      .catch(() => this.getBrowserPosition({ enableHighAccuracy: true, timeout: 8000 }));
  }

  recenter(): Observable<GeoPoint> {
    return new Observable<GeoPoint>((subscriber) => {
      void this.getCurrentPosition()
        .then((position) => {
          subscriber.next(position);
          subscriber.complete();
        })
        .catch((error) => subscriber.error(error));
    });
  }

  getLastKnownPosition(): GeoPoint | null {
    return this.positionSubject.value;
  }

  private isSamePoint(a: GeoPoint, b: GeoPoint): boolean {
    return Math.abs(a.lat - b.lat) < 0.00001 && Math.abs(a.lng - b.lng) < 0.00001;
  }

  private mapPosition(position: Position): GeoPoint {
    return {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
    };
  }

  private startBrowserLiveTracking(onPosition: (position: GeoPoint) => void): void {
    if (!navigator.geolocation) {
      return;
    }

    this.browserWatchId = navigator.geolocation.watchPosition(
      (position) => {
        const point = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        this.positionSubject.next(point);
        onPosition(point);
      },
      () => undefined,
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 }
    );
  }

  private async getBrowserPosition(options?: PositionOptions): Promise<GeoPoint> {
    if (!navigator.geolocation) {
      return DEFAULT_CENTER;
    }

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const point = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          this.positionSubject.next(point);
          resolve(point);
        },
        () => resolve(DEFAULT_CENTER),
        {
          enableHighAccuracy: false,
          maximumAge: 120_000,
          timeout: 8_000,
          ...options,
        }
      );
    });
  }

  private async requestBrowserPermission(): Promise<boolean> {
    try {
      const position = await this.getBrowserPosition({ timeout: 4_000 });
      return position !== DEFAULT_CENTER;
    } catch {
      return false;
    }
  }
}
