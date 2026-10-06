import { Injectable } from '@angular/core';
import { GeolocationService } from './geolocation.service';

/** Demande GPS sans modal superflu — l’écran Stitch `/location-permission` suffit. */
@Injectable({ providedIn: 'root' })
export class PermissionService {
  constructor(private readonly geolocation: GeolocationService) {}

  requestLocationAccess(): Promise<boolean> {
    return this.geolocation.requestPermission();
  }
}
