import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import * as L from 'leaflet';
import { MapViewMode, MapViewSettings } from '../models/map-view.model';

const DEFAULT_SETTINGS: MapViewSettings = {
  mode: 'explore',
  traffic: false,
  labels: true,
};

@Injectable({ providedIn: 'root' })
export class MapLayersService {
  private map?: L.Map;
  private baseLayer?: L.TileLayer;
  private labelsLayer?: L.TileLayer;
  private transitLayer?: L.TileLayer;
  private trafficLayer?: L.TileLayer;

  private readonly settingsSubject = new BehaviorSubject<MapViewSettings>({
    ...DEFAULT_SETTINGS,
  });

  readonly settings$ = this.settingsSubject.asObservable();

  attachMap(map: L.Map): void {
    if (this.map === map && this.baseLayer && map.hasLayer(this.baseLayer)) {
      return;
    }

    this.clearLayers();
    this.map = map;
    this.applySettings(this.settingsSubject.value);
  }

  detachMap(): void {
    this.clearLayers();
    this.map = undefined;
  }

  getSettings(): MapViewSettings {
    return this.settingsSubject.value;
  }

  setMode(mode: MapViewMode): void {
    this.updateSettings({ mode });
  }

  setTraffic(enabled: boolean): void {
    this.updateSettings({ traffic: enabled });
  }

  setLabels(enabled: boolean): void {
    this.updateSettings({ labels: enabled });
  }

  private updateSettings(partial: Partial<MapViewSettings>): void {
    const next = { ...this.settingsSubject.value, ...partial };
    this.settingsSubject.next(next);
    this.applySettings(next);
  }

  private applySettings(settings: MapViewSettings): void {
    if (!this.map) {
      return;
    }

    this.clearLayers();

    this.baseLayer = L.tileLayer(this.getBaseUrl(settings.mode), {
      maxZoom: 19,
      attribution: this.getAttribution(settings.mode),
      updateWhenIdle: true,
      keepBuffer: 2,
    }).addTo(this.map);

    if (settings.mode === 'transit') {
      this.transitLayer = L.tileLayer(
        'https://{s}.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png',
        {
          maxZoom: 19,
          opacity: 0.55,
          attribution: '&copy; OpenRailwayMap',
        }
      ).addTo(this.map);
    }

    if (settings.mode === 'satellite' && settings.labels) {
      this.labelsLayer = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
        {
          maxZoom: 19,
          opacity: 0.85,
          attribution: '&copy; Esri',
        }
      ).addTo(this.map);
    }

    if (settings.traffic && settings.mode === 'driving') {
      this.trafficLayer = L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}.png',
        {
          maxZoom: 19,
          opacity: 0.35,
          attribution: '&copy; CARTO',
        }
      ).addTo(this.map);
    }
  }

  private getBaseUrl(mode: MapViewMode): string {
    switch (mode) {
      case 'driving':
        return 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png';
      case 'transit':
        return 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png';
      case 'satellite':
        return 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
      case 'explore':
      default:
        return 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    }
  }

  private getAttribution(mode: MapViewMode): string {
    switch (mode) {
      case 'driving':
      case 'transit':
        return '&copy; OpenStreetMap &copy; CARTO';
      case 'satellite':
        return '&copy; Esri &copy; OpenStreetMap';
      default:
        return '&copy; OpenStreetMap';
    }
  }

  private clearLayers(): void {
    for (const layer of [this.baseLayer, this.labelsLayer, this.transitLayer, this.trafficLayer]) {
      layer?.remove();
    }

    this.baseLayer = undefined;
    this.labelsLayer = undefined;
    this.transitLayer = undefined;
    this.trafficLayer = undefined;
  }
}
