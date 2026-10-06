import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { ViewDidEnter, ViewWillEnter, ViewWillLeave } from '@ionic/angular';
import * as L from 'leaflet';
import { combineLatest, Subscription } from 'rxjs';
import { distinctUntilChanged, throttleTime } from 'rxjs/operators';
import { DEFAULT_CENTER } from '../core/constants/cameroon-bounds';
import { GeoPoint } from '../core/models/geo-point.model';
import { Pharmacy, PharmacyDetails } from '../core/models/pharmacy.model';
import { RouteResult } from '../core/models/route.model';
import { GeolocationService } from '../core/services/geolocation.service';
import { HapticsService } from '../core/services/haptics.service';
import { PermissionService } from '../core/services/permission.service';
import { MapLayersService } from '../core/services/map-layers.service';
import { findClosestRouteIndex } from '../domain/utils/distance.util';
import { NavigationFacade } from '../domain/facades/navigation.facade';
import { PharmacyFacade, PharmacyFilter, DataSourceLabel } from '../domain/facades/pharmacy.facade';
import { RoutingFacade } from '../domain/facades/routing.facade';
import { MapFiltersState } from '../shared/components/filters-sheet/filters-sheet.component';
import { Router } from '@angular/router';

@Component({
  selector: 'app-tab1',
  templateUrl: 'tab1.page.html',
  styleUrls: ['tab1.page.scss'],
  standalone: false,
})
export class Tab1Page
  implements OnInit, AfterViewInit, OnDestroy, ViewWillEnter, ViewDidEnter, ViewWillLeave
{
  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef<HTMLDivElement>;

  searchQuery = '';
  activeFilter: PharmacyFilter = 'nearby';
  fabBottomOffset = 'calc(100px + 120px)';
  selectedPharmacy: Pharmacy | null = null;
  pharmacyDetails: PharmacyDetails | null = null;
  detailsLoading = false;
  currentRoute: RouteResult | null = null;
  pharmacies: Pharmacy[] = [];
  loading = false;
  routeLoading = false;
  isNavigating = false;
  remainingDistance: number | null = null;
  remainingDuration: number | null = null;
  dataSource: DataSourceLabel = 'Aucune';
  fromCache = false;
  filtersOpen = false;
  mapFilters: MapFiltersState = {
    onCall: false,
    open24h: false,
    maxDistanceKm: null,
    sortBy: 'distance',
  };
  favoriteIds = new Set<string>();

  get activePharmacy(): Pharmacy | null {
    return this.pharmacyDetails ?? this.selectedPharmacy;
  }

  private map?: L.Map;
  private userMarker?: L.Marker;
  private pharmacyMarkers = new Map<string, L.Marker>();
  private routeOutlineLayer?: L.Polyline;
  private routeMainLayer?: L.Polyline;
  private routePreviewLayer?: L.Polyline;
  private traveledLayer?: L.Polyline;
  private routeFrameFittedFor: string | null = null;
  private previewFadeTimer?: ReturnType<typeof setTimeout>;
  private invalidateSizeFrame?: number;
  private lastTraveledUpdate = 0;
  private mapActive = false;
  private subscriptions = new Subscription();
  private positionSubscription?: Subscription;
  private readonly TRAVELED_THROTTLE_MS = 800;
  private readonly POSITION_THROTTLE_MS = 600;

  constructor(
    public readonly pharmacyFacade: PharmacyFacade,
    private readonly routingFacade: RoutingFacade,
    private readonly navigationFacade: NavigationFacade,
    private readonly geolocation: GeolocationService,
    private readonly haptics: HapticsService,
    private readonly permissionService: PermissionService,
    private readonly mapLayers: MapLayersService,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    void this.permissionService.requestLocationAccess();

    this.subscriptions.add(
      this.pharmacyFacade.loading$.subscribe((loading) => {
        this.loading = loading;
      })
    );

    this.subscriptions.add(
      this.pharmacyFacade.filteredPharmacies$.subscribe((pharmacies) => {
        this.pharmacies = pharmacies;
        if (this.mapActive) {
          this.renderPharmacyMarkers(pharmacies);
        }
        this.updateFabOffset();
      })
    );

    this.subscriptions.add(
      this.pharmacyFacade.selectedPharmacy$.subscribe((pharmacy) => {
        const previousId = this.selectedPharmacy?.id ?? null;
        this.selectedPharmacy = pharmacy;
        this.updateFabOffset();
        if (this.mapActive && previousId !== (pharmacy?.id ?? null)) {
          this.updateMarkerSelection(previousId, pharmacy?.id ?? null);
        }
      })
    );

    this.subscriptions.add(
      this.pharmacyFacade.favoriteIds$.subscribe((ids) => {
        this.favoriteIds = ids;
      })
    );

    this.subscriptions.add(
      combineLatest([this.routingFacade.route$, this.routingFacade.loading$]).subscribe(
        ([route, loading]) => {
          this.currentRoute = route;
          this.routeLoading = loading;
          if (this.mapActive) {
            this.drawRoute(route);
          }
        }
      )
    );

    this.subscriptions.add(
      this.navigationFacade.navigating$.subscribe((navigating) => {
        this.isNavigating = navigating;
        document.body.classList.toggle('navigation-active', navigating);
      })
    );

    this.subscriptions.add(
      this.navigationFacade.remainingDistance$.subscribe((distance) => {
        this.remainingDistance = distance;
      })
    );

    this.subscriptions.add(
      this.navigationFacade.remainingDuration$.subscribe((duration) => {
        this.remainingDuration = duration;
      })
    );

    this.subscriptions.add(
      this.pharmacyFacade.pharmacyDetails$.subscribe((details) => {
        this.pharmacyDetails = details;
      })
    );

    this.subscriptions.add(
      this.pharmacyFacade.detailsLoading$.subscribe((loading) => {
        this.detailsLoading = loading;
      })
    );

    this.subscriptions.add(
      this.pharmacyFacade.dataSource$.subscribe((source) => {
        this.dataSource = source;
      })
    );

    this.subscriptions.add(
      this.pharmacyFacade.fromCache$.subscribe((fromCache) => {
        this.fromCache = fromCache;
      })
    );

    this.subscriptions.add(
      this.pharmacyFacade.loadPharmacies().subscribe((pharmacies) => {
        if (!this.map) {
          return;
        }

        const position = this.geolocation.getLastKnownPosition();
        if (position) {
          this.map.setView([position.lat, position.lng], 14, { animate: true });
        } else if (pharmacies.length) {
          this.fitMapToPharmacies(pharmacies);
        }
      })
    );
  }

  ngAfterViewInit(): void {
    this.initMap();
  }

  ionViewWillEnter(): void {
    this.mapActive = true;
    this.startPositionUpdates();
    if (this.map) {
      this.mapLayers.attachMap(this.map);
      this.renderPharmacyMarkers(this.pharmacies);
      this.drawRoute(this.currentRoute);
    }
  }

  ionViewDidEnter(): void {
    if (!this.map) {
      return;
    }

    this.cancelInvalidateSize();
    this.invalidateSizeFrame = requestAnimationFrame(() => {
      this.map?.invalidateSize({ animate: false });
      this.invalidateSizeFrame = undefined;
    });
  }

  ionViewWillLeave(): void {
    this.mapActive = false;
    this.stopPositionUpdates();
    this.clearPreviewTimer();
    this.cancelInvalidateSize();
    this.clearPharmacyMarkers();
    this.userMarker?.remove();
    this.userMarker = undefined;
    this.mapLayers.detachMap();
  }

  ngOnDestroy(): void {
    this.stopPositionUpdates();
    this.subscriptions.unsubscribe();
    if (this.isNavigating) {
      this.navigationFacade.stopNavigation();
    }
    this.clearRouteLayers();
    this.clearPharmacyMarkers();
    this.userMarker?.remove();
    this.userMarker = undefined;
    this.cancelInvalidateSize();
    this.mapLayers.detachMap();
    this.map?.remove();
    this.map = undefined;
  }

  onSearchInput(value: string): void {
    this.searchQuery = value ?? '';
    this.pharmacyFacade.setSearchQuery(this.searchQuery);
  }

  callPharmacy(phone: string): void {
    window.open(`tel:${phone.replace(/\s+/g, '')}`, '_self');
  }

  openFilters(): void {
    this.filtersOpen = true;
  }

  closeFilters(): void {
    this.filtersOpen = false;
  }

  applyMapFilters(filters: MapFiltersState): void {
    this.mapFilters = filters;
    this.pharmacyFacade.setMapFilters(filters);
    this.filtersOpen = false;
  }

  toggleQuickFilter(kind: 'onCall' | 'open24h' | 'near5'): void {
    if (kind === 'onCall') {
      this.mapFilters = { ...this.mapFilters, onCall: !this.mapFilters.onCall };
    } else if (kind === 'open24h') {
      this.mapFilters = { ...this.mapFilters, open24h: !this.mapFilters.open24h };
    } else {
      this.mapFilters = {
        ...this.mapFilters,
        maxDistanceKm: this.mapFilters.maxDistanceKm === 5 ? null : 5,
      };
    }
    this.pharmacyFacade.setMapFilters(this.mapFilters);
  }

  openPharmacyDetail(): void {
    const pharmacy = this.activePharmacy;
    if (!pharmacy) return;
    void this.router.navigate(['/pharmacy', pharmacy.id]);
  }

  openRoutePreview(): void {
    const pharmacy = this.activePharmacy;
    if (!pharmacy) return;
    this.routingFacade.calculateRoute(pharmacy).subscribe({
      next: () => void this.router.navigate(['/route', pharmacy.id]),
    });
  }

  clearSelection(): void {
    if (this.isNavigating) {
      this.navigationFacade.stopNavigation();
    }
    this.pharmacyFacade.selectPharmacy(null);
    this.routingFacade.clearRoute();
    this.clearRouteLayers();
    this.updateFabOffset();
  }

  recenterOnUser(): void {
    this.geolocation.recenter().subscribe((position) => {
      this.map?.setView([position.lat, position.lng], 15, { animate: true });
      this.updateUserMarker(position.lat, position.lng);
    });
  }

  selectPharmacy(pharmacy: Pharmacy): void {
    if (this.isNavigating) {
      return;
    }

    this.routeFrameFittedFor = null;
    this.clearRouteLayers();
    this.pharmacyFacade.selectPharmacy(pharmacy);
    this.calculateRoute(pharmacy);
    this.pharmacyFacade.loadPharmacyDetails(pharmacy).subscribe();
    this.updateFabOffset();
  }

  private calculateRoute(pharmacy: Pharmacy): void {
    this.routingFacade.calculateRoute({ lat: pharmacy.lat, lng: pharmacy.lng }).subscribe({
      next: (route) => {
        this.pharmacyFacade.selectPharmacy({
          ...pharmacy,
          distanceMeters: route.distanceMeters,
          durationSeconds: route.durationSeconds,
        });
      },
    });
  }

  private initMap(): void {
    this.map = L.map(this.mapContainer.nativeElement, {
      zoomControl: false,
      attributionControl: true,
      preferCanvas: true,
    }).setView([DEFAULT_CENTER.lat, DEFAULT_CENTER.lng], 13);

    this.mapLayers.attachMap(this.map);
    this.map.on('click', () => {
      if (this.selectedPharmacy && !this.isNavigating) {
        this.clearSelection();
      }
    });
  }

  private startPositionUpdates(): void {
    this.stopPositionUpdates();
    this.positionSubscription = combineLatest([
      this.navigationFacade.currentPosition$,
      this.pharmacyFacade.userPosition$,
      this.navigationFacade.navigating$,
    ])
      .pipe(
        throttleTime(this.POSITION_THROTTLE_MS, undefined, { leading: true, trailing: true }),
        distinctUntilChanged(
          ([aPos, uPos, aNav], [bPos, bPos2, bNav]) =>
            aNav === bNav &&
            aPos?.lat === bPos?.lat &&
            aPos?.lng === bPos?.lng &&
            uPos?.lat === bPos2?.lat &&
            uPos?.lng === bPos2?.lng
        )
      )
      .subscribe(([navPosition, userPosition, navigating]) => {
        const position = navigating ? navPosition ?? userPosition : userPosition;
        if (!position) {
          return;
        }

        this.updateUserMarker(position.lat, position.lng);
        if (navigating) {
          this.followUser(position);
          this.updateTraveledRoute(position);
        }
      });
  }

  private stopPositionUpdates(): void {
    this.positionSubscription?.unsubscribe();
    this.positionSubscription = undefined;
  }

  private cancelInvalidateSize(): void {
    if (this.invalidateSizeFrame !== undefined) {
      cancelAnimationFrame(this.invalidateSizeFrame);
      this.invalidateSizeFrame = undefined;
    }
  }

  private updateUserMarker(lat: number, lng: number): void {
    if (!this.map) {
      return;
    }

    const icon = L.divIcon({
      className: 'user-location-marker',
      html: `<div class="user-location-dot"></div>`,
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    });

    if (!this.userMarker) {
      this.userMarker = L.marker([lat, lng], { icon, zIndexOffset: 1000 }).addTo(this.map);
      return;
    }

    this.userMarker.setLatLng([lat, lng]);
  }

  private followUser(position: GeoPoint): void {
    this.map?.panTo([position.lat, position.lng], { animate: true, duration: 0.8 });
  }

  private renderPharmacyMarkers(pharmacies: Pharmacy[]): void {
    if (!this.map) {
      return;
    }

    const visibleIds = new Set(pharmacies.map((pharmacy) => pharmacy.id));

    for (const [id, marker] of this.pharmacyMarkers.entries()) {
      if (!visibleIds.has(id)) {
        marker.off('click');
        marker.remove();
        this.pharmacyMarkers.delete(id);
      }
    }

    for (const pharmacy of pharmacies) {
      const isSelected = this.selectedPharmacy?.id === pharmacy.id;
      const existing = this.pharmacyMarkers.get(pharmacy.id);

      if (existing) {
        existing.setIcon(this.createPharmacyIcon(pharmacy, isSelected));
        continue;
      }

      const marker = L.marker([pharmacy.lat, pharmacy.lng], {
        icon: this.createPharmacyIcon(pharmacy, isSelected),
      }).addTo(this.map);

      marker.on('click', (event) => {
        L.DomEvent.stopPropagation(event);
        this.onMarkerClick(pharmacy.id);
      });
      this.pharmacyMarkers.set(pharmacy.id, marker);
    }
  }

  private onMarkerClick(pharmacyId: string): void {
    const pharmacy = this.pharmacies.find((item) => item.id === pharmacyId);
    if (pharmacy) {
      void this.haptics.impactLight();
      this.selectPharmacy(pharmacy);
    }
  }

  private updateMarkerSelection(previousId: string | null, nextId: string | null): void {
    if (previousId && previousId !== nextId) {
      const prev = this.pharmacies.find((p) => p.id === previousId);
      if (prev) {
        this.pharmacyMarkers.get(previousId)?.setIcon(this.createPharmacyIcon(prev, false));
      }
    }

    if (nextId) {
      const next = this.pharmacies.find((p) => p.id === nextId) ?? this.selectedPharmacy;
      if (next) {
        this.pharmacyMarkers.get(nextId)?.setIcon(this.createPharmacyIcon(next, true));
      }
    }
  }

  private clearPharmacyMarkers(): void {
    for (const marker of this.pharmacyMarkers.values()) {
      marker.off('click');
      marker.remove();
    }
    this.pharmacyMarkers.clear();
  }

  private createPharmacyIcon(pharmacy: Pharmacy, selected: boolean): L.DivIcon {
    const onCall = Boolean(pharmacy.isOnCall);
    const showLabel = selected;
    const label = showLabel
      ? `<div class="loka-marker__label">${this.escapeHtml(pharmacy.name)}</div>`
      : '';
    const classes = [
      'loka-marker',
      onCall ? 'loka-marker--garde' : 'loka-marker--normal',
      selected ? 'loka-marker--selected' : '',
    ]
      .filter(Boolean)
      .join(' ');

    const glyph = `<svg class="loka-marker__glyph" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M19 3H5c-1.1 0-2 .9-2 2v2c0 .55.45 1 1 1h1v11c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V8h1c.55 0 1-.45 1-1V5c0-1.1-.9-2-2-2zm-2 15H7V8h10v10zm-2.5-6h-2v-2h-1v2h-2v1h2v2h1v-2h2v-1z"/></svg>`;

    return L.divIcon({
      className: 'pharmacy-marker',
      html: `<div class="${classes}">
        <div class="loka-marker__icon">${glyph}</div>
        ${label}
      </div>`,
      iconSize: [32, showLabel ? 56 : 40],
      iconAnchor: [16, showLabel ? 56 : 40],
    });
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  private drawRoute(route: RouteResult | null): void {
    if (!this.map) {
      return;
    }

    if (!route?.geometry.length) {
      this.clearRouteLayers();
      return;
    }

    const latLngs = route.geometry.map((point) => [point.lat, point.lng] as [number, number]);

    if (route.isPreview) {
      this.renderPreviewRoute(latLngs);
      this.fitRouteFrame(latLngs);
      return;
    }

    this.renderMainRoute(latLngs);
    this.fadeOutPreview();
    this.fitRouteFrame(latLngs);
  }

  private renderPreviewRoute(latLngs: L.LatLngExpression[]): void {
    if (!this.map) {
      return;
    }

    if (this.routePreviewLayer) {
      this.routePreviewLayer.setLatLngs(latLngs);
      return;
    }

    this.routePreviewLayer = L.polyline(latLngs, {
      className: 'route-path route-path-preview',
      color: '#fc8f34',
      weight: 5,
      opacity: 0.55,
      dashArray: '8 14',
      lineCap: 'round',
      lineJoin: 'round',
      smoothFactor: 1.5,
    }).addTo(this.map);
  }

  private renderMainRoute(latLngs: L.LatLngExpression[]): void {
    if (!this.map) {
      return;
    }

    if (!this.routeMainLayer) {
      this.routeOutlineLayer = L.polyline(latLngs, {
        className: 'route-path route-path-outline',
        color: '#ffffff',
        weight: 10,
        opacity: 0.9,
        lineCap: 'round',
        lineJoin: 'round',
        smoothFactor: 1.25,
      }).addTo(this.map);

      this.routeMainLayer = L.polyline(latLngs, {
        className: 'route-path route-path-main',
        color: '#944a00',
        weight: 5.5,
        opacity: 0.95,
        lineCap: 'round',
        lineJoin: 'round',
        smoothFactor: 1.25,
      }).addTo(this.map);
      return;
    }

    this.routeOutlineLayer?.setLatLngs(latLngs);
    this.routeMainLayer.setLatLngs(latLngs);
  }

  private fadeOutPreview(): void {
    if (!this.routePreviewLayer) {
      return;
    }

    this.clearPreviewTimer();
    this.previewFadeTimer = setTimeout(() => {
      this.routePreviewLayer?.remove();
      this.routePreviewLayer = undefined;
      this.previewFadeTimer = undefined;
    }, 200);
  }

  private clearPreviewTimer(): void {
    if (this.previewFadeTimer) {
      clearTimeout(this.previewFadeTimer);
      this.previewFadeTimer = undefined;
    }
  }

  private fitRouteFrame(latLngs: L.LatLngExpression[]): void {
    if (!this.map || this.isNavigating || latLngs.length < 2) {
      return;
    }

    const pharmacyId = this.selectedPharmacy?.id;
    if (!pharmacyId || this.routeFrameFittedFor === pharmacyId) {
      return;
    }

    this.routeFrameFittedFor = pharmacyId;
    const bounds = L.latLngBounds(latLngs);

    this.map.flyToBounds(bounds, {
      paddingTopLeft: L.point(28, 120),
      paddingBottomRight: L.point(28, 220),
      maxZoom: 16,
      duration: 0.85,
      easeLinearity: 0.22,
    });
  }

  private updateTraveledRoute(position: GeoPoint): void {
    if (!this.map || !this.currentRoute?.geometry.length) {
      return;
    }

    const now = Date.now();
    if (now - this.lastTraveledUpdate < this.TRAVELED_THROTTLE_MS) {
      return;
    }
    this.lastTraveledUpdate = now;

    const route = this.currentRoute.geometry;
    const closestIndex = findClosestRouteIndex(position, route);
    const traveledPoints = route
      .slice(0, closestIndex + 1)
      .map((point) => [point.lat, point.lng] as [number, number]);
    traveledPoints.push([position.lat, position.lng]);

    if (!this.traveledLayer) {
      this.traveledLayer = L.polyline(traveledPoints, {
        className: 'route-path route-path-traveled',
        color: '#9aa0a6',
        weight: 6,
        opacity: 0.85,
        lineCap: 'round',
        lineJoin: 'round',
        smoothFactor: 1.25,
      }).addTo(this.map);
      return;
    }

    this.traveledLayer.setLatLngs(traveledPoints);
  }

  private clearRouteLayers(): void {
    this.clearPreviewTimer();
    this.routeOutlineLayer?.remove();
    this.routeMainLayer?.remove();
    this.routePreviewLayer?.remove();
    this.traveledLayer?.remove();
    this.routeOutlineLayer = undefined;
    this.routeMainLayer = undefined;
    this.routePreviewLayer = undefined;
    this.traveledLayer = undefined;
    this.routeFrameFittedFor = null;
    this.lastTraveledUpdate = 0;
  }

  private fitMapToPharmacies(pharmacies: Pharmacy[]): void {
    if (!this.map || !pharmacies.length) {
      return;
    }

    const bounds = L.latLngBounds(pharmacies.map((pharmacy) => [pharmacy.lat, pharmacy.lng]));
    this.map.fitBounds(bounds.pad(0.2));
  }

  private updateFabOffset(): void {
    this.fabBottomOffset = this.selectedPharmacy
      ? 'calc(100px + 140px)'
      : 'calc(100px + 24px)';
  }
}
