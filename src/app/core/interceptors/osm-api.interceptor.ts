import { Injectable } from '@angular/core';
import {
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
} from '@angular/common/http';
import { Capacitor } from '@capacitor/core';
import { Observable } from 'rxjs';
import { APP_USER_AGENT } from '../constants/app-config';

const OSM_API_HOSTS = [
  'nominatim.openstreetmap.org',
  'overpass-api.de',
  'overpass.kumi.systems',
];

@Injectable()
export class OsmApiInterceptor implements HttpInterceptor {
  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    if (!OSM_API_HOSTS.some((host) => req.url.includes(host))) {
      return next.handle(req);
    }

    const headers: Record<string, string> = {
      'Accept-Language': 'fr',
    };

    // User-Agent est interdit dans le navigateur (XHR) ; OK en WebView native Capacitor.
    if (Capacitor.isNativePlatform()) {
      headers['User-Agent'] = APP_USER_AGENT;
    }

    return next.handle(req.clone({ setHeaders: headers }));
  }
}
