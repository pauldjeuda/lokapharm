import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { IonModal, ViewDidEnter, ViewWillEnter, ViewWillLeave } from '@ionic/angular';
import * as L from 'leaflet';
import { combineLatest, Subscription } from 'rxjs';
import { distinctUntilChanged, throttleTime } from 'rxjs/operators';
import { DEFAULT_CENTER } from '../core/constants/cameroon-bounds';
import { GeoPoint } from '../core/models/geo-point.model';
import { Pharmacy, PharmacyDetails } from '../core/models/pharmacy.model';
import { RouteResult } from '../core/models/route.model';
import { MapViewMode, MapViewSettings } from '../core/models/map-view.model';
import { GeolocationService } from '../core/services/geolocation.service';
import { HapticsService } from '../core/services/haptics.service';
import { PermissionService } from '../core/services/permission.service';
import { MapLayersService } from '../core/services/map-layers.service';
import { findClosestRouteIndex } from '../domain/utils/distance.util';
import { NavigationFacade } from '../domain/facades/navigation.facade';
import { PharmacyFacade, PharmacyFilter, DataSourceLabel } from '../domain/facades/pharmacy.facade';
import { RoutingFacade } from '../domain/facades/routing.facade';

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
  @ViewChild('pharmacySheetModal') pharmacySheetModal?: IonModal;

  readonly sheetBreakpoints = [0.18, 0.28, 0.38, 0.82];
  readonly listBreakpoint = 0.38;
  readonly detailBreakpoint = 0.28;
  readonly collapseBreakpoint = 0.18;

  searchQuery = '';
  activeFilter: PharmacyFilter = 'nearby';
  isSheetOpen = true;
  sheetInitialBreakpoint = 0.38;
  currentSheetBreakpoint = 0.38;
  fabBottomOffset = 'calc(42vh + 16px)';
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
  mapModesOpen = false;
  mapSettings: MapViewSettings = { mode: 'explore', traffic: false, labels: true };
  favoriteIds = new Set<string>();

  readonly filters: Array<{ id: PharmacyFilter; label: string; icon: string }> = [
    { id: 'nearby', label: 'Proche', icon: 'locate' },
    { id: 'yaounde', label: 'Yaoundé', icon: 'business' },
    { id: 'douala', label: 'Douala', icon: 'boat' },
  ];

  get isDetailView(): boolean {
    return Boolean(this.selectedPharmacy);
  }

  get activePharmacy(): Pharmacy | null {
    return this.pharmacyDetails ?? this.selectedPharmacy;
  }

  private map?: L.Map;
  private userMarker?: L.CircleMarker;
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

  private readonly pharmacyIconDefault = this.createPharmacyIcon(false);
  private readonly pharmacyIconSelected = this.createPharmacyIcon(true);
  private readonly TRAVELED_THROTTLE_MS = 800;
  private readonly POSITION_THROTTLE_MS = 600;

  constructor(
    public readonly pharmacyFacade: PharmacyFacade,
    private readonly routingFacade: RoutingFacade,
    private readonly navigationFacade: NavigationFacade,
    private readonly geolocation: GeolocationService,
    private readonly haptics: HapticsService,
    private readonly permissionService: PermissionService,
    private readonly mapLayers: MapLayersService
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
      })
    );

    this.subscriptions.add(
      this.pharmacyFacade.selectedPharmacy$.subscribe((pharmacy) => {
        const previousId = this.selectedPharmacy?.id ?? null;
        this.selectedPharmacy = pharmacy;
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
      this.mapLayers.settings$.subscribe((settings) => {
        this.mapSettings = settings;
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
 codex/refactoriser-cycle-de-vie-leaflet-et-rxjs
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

  onSearchChange(event: CustomEvent): void {
    this.searchQuery = event.detail.value ?? '';
    this.pharmacyFacade.setSearchQuery(this.searchQuery);
  }

  setFilter(filter: PharmacyFilter): void {
    if (this.activeFilter !== filter) {
      void this.haptics.impactLight();
    }

    this.activeFilter = filter;
    this.pharmacyFacade.setFilter(filter);
  }

  onRefresh(event: CustomEvent): void {
    const refresher = event.target as HTMLIonRefresherElement;
    this.pharmacyFacade.refreshPharmacies(this.activeFilter).subscribe({
      complete: () => refresher.complete(),
      error: () => refresher.complete(),
    });
  }

  selectPharmacy(pharmacy: Pharmacy): void {
    if (this.isNavigating) {
      return;
    }

    this.isSheetOpen = true;
    this.routeFrameFittedFor = null;
    this.clearRouteLayers();

    this.pharmacyFacade.selectPharmacy(pharmacy);
    this.calculateRoute(pharmacy);
    this.pharmacyFacade.loadPharmacyDetails(pharmacy).subscribe();
    void this.expandSheetTo(this.detailBreakpoint);
  }

  clearSelection(): void {
    if (this.isNavigating) {
      this.stopNavigation();
    }

    this.pharmacyFacade.selectPharmacy(null);
    this.routingFacade.clearRoute();
    this.clearRouteLayers();
    void this.expandSheetTo(this.listBreakpoint);
  }

  onSheetBreakpointChange(event: CustomEvent<{ breakpoint: number }>): void {
    const breakpoint = event.detail.breakpoint;
    this.currentSheetBreakpoint = breakpoint;
    this.updateFabOffset(breakpoint);

    if (this.isDetailView && breakpoint <= this.collapseBreakpoint + 0.01) {
      this.pharmacyFacade.selectPharmacy(null);
      this.routingFacade.clearRoute();
      this.clearRouteLayers();
      void this.expandSheetTo(this.listBreakpoint);
    }
  }

  callPharmacy(phone: string): void {
    window.open(`tel:${phone.replace(/\s+/g, '')}`, '_self');
  }

  openMapModes(): void {
    this.mapModesOpen = true;
  }

  closeMapModes(): void {
    this.mapModesOpen = false;
  }

  onMapModeChange(mode: MapViewMode): void {
    this.mapLayers.setMode(mode);
  }

  onTrafficToggle(enabled: boolean): void {
    this.mapLayers.setTraffic(enabled);
  }

  onLabelsToggle(enabled: boolean): void {
    this.mapLayers.setLabels(enabled);
  }

  recenterOnUser(): void {
    this.geolocation.recenter().subscribe((position) => {
      this.map?.setView([position.lat, position.lng], 15, { animate: true });
      this.updateUserMarker(position.lat, position.lng);
    });
  }

  calculateRoute(pharmacy: Pharmacy): void {
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

  async startNavigation(pharmacy: Pharmacy): Promise<void> {
    if (this.routeLoading) {
      return;
    }

    if (!this.currentRoute) {
      this.routingFacade.calculateRoute({ lat: pharmacy.lat, lng: pharmacy.lng }).subscribe({
        next: async (route) => {
          this.pharmacyFacade.selectPharmacy({
            ...pharmacy,
            distanceMeters: route.distanceMeters,
            durationSeconds: route.durationSeconds,
          });
          await this.navigationFacade.startNavigation(pharmacy, route);
          void this.haptics.impactLight();
        },
      });
      return;
    }

    await this.navigationFacade.startNavigation(pharmacy, this.currentRoute);
    void this.haptics.impactLight();
  }

  stopNavigation(): void {
    this.navigationFacade.stopNavigation();
    this.traveledLayer?.remove();
    this.traveledLayer = undefined;
  }

  toggleFavorite(pharmacy: Pharmacy, event?: Event): void {
    event?.stopPropagation();
    const isAddingFavorite = !this.isFavorite(pharmacy);
    this.pharmacyFacade.toggleFavorite(pharmacy);
    if (isAddingFavorite) {
      void this.haptics.notifySuccess();
    }
  }

  isFavorite(pharmacy: Pharmacy): boolean {
    return this.favoriteIds.has(pharmacy.id);
  }

  trackByPharmacyId(_index: number, pharmacy: Pharmacy): string {
    return pharmacy.id;
  }

  private initMap(): void {
    this.map = L.map(this.mapContainer.nativeElement, {
      zoomControl: false,
      attributionControl: true,
      preferCanvas: true,
    }).setView([DEFAULT_CENTER.lat, DEFAULT_CENTER.lng], 13);

    this.mapLayers.attachMap(this.map);
    L.control.zoom({ position: 'bottomright' }).addTo(this.map);
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

    if (!this.userMarker) {
      this.userMarker = L.circleMarker([lat, lng], {
        radius: 10,
        color: '#ffffff',
        weight: 3,
        fillColor: '#1a73e8',
        fillOpacity: 1,
      }).addTo(this.map);
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
        existing.setIcon(isSelected ? this.pharmacyIconSelected : this.pharmacyIconDefault);
        continue;
      }

      const marker = L.marker([pharmacy.lat, pharmacy.lng], {
        icon: isSelected ? this.pharmacyIconSelected : this.pharmacyIconDefault,
      }).addTo(this.map);

      marker.on('click', () => this.onMarkerClick(pharmacy.id));
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
      this.pharmacyMarkers.get(previousId)?.setIcon(this.pharmacyIconDefault);
    }

    if (nextId) {
      this.pharmacyMarkers.get(nextId)?.setIcon(this.pharmacyIconSelected);
    }
  }

  private clearPharmacyMarkers(): void {
    for (const marker of this.pharmacyMarkers.values()) {
      marker.off('click');
      marker.remove();
    }
    this.pharmacyMarkers.clear();
  }

  private createPharmacyIcon(selected: boolean): L.DivIcon {
    return L.divIcon({
      className: 'pharmacy-marker',
      html: `<div class="marker-pin ${selected ? 'selected' : ''}"></div>`,
      iconSize: [30, 30],
      iconAnchor: [15, 30],
    });
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
      color: '#7eb8f7',
      weight: 5,
      opacity: 0.5,
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
        className: 'route-path route-path-main route-path-enter',
        color: '#4285f4',
        weight: 5.5,
        opacity: 0.95,
        lineCap: 'round',
        lineJoin: 'round',
        smoothFactor: 1.25,
      }).addTo(this.map);

      requestAnimationFrame(() => {
        this.routeMainLayer?.getElement()?.classList.remove('route-path-enter');
      });
      return;
    }

    this.routeOutlineLayer?.setLatLngs(latLngs);
    this.routeMainLayer.setLatLngs(latLngs);
  }

  private fadeOutPreview(): void {
    if (!this.routePreviewLayer) {
      return;
    }

    const element = this.routePreviewLayer.getElement() as SVGPathElement | undefined;
    if (element) {
      element.classList.add('route-path-fade-out');
    }

    this.clearPreviewTimer();
    this.previewFadeTimer = setTimeout(() => {
      this.routePreviewLayer?.remove();
      this.routePreviewLayer = undefined;
      this.previewFadeTimer = undefined;
    }, 480);
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
    const sheetHeight = Math.max(this.currentSheetBreakpoint, this.detailBreakpoint);
    const bottomPadding = Math.round(90 + sheetHeight * 220);
    const topPadding = Math.round(96 + Math.max(0, (0.38 - sheetHeight) * 120));

    this.map.flyToBounds(bounds, {
      paddingTopLeft: L.point(28, topPadding),
      paddingBottomRight: L.point(28, bottomPadding),
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

  private async expandSheetTo(breakpoint: number): Promise<void> {
    this.currentSheetBreakpoint = breakpoint;
    this.updateFabOffset(breakpoint);

    const modal = this.pharmacySheetModal;
    if (!modal) {
      return;
    }

    await modal.setCurrentBreakpoint(breakpoint);
  }

  private updateFabOffset(breakpoint: number): void {
    const sheetHeightVh = Math.round(breakpoint * 100);
    this.fabBottomOffset = `calc(${sheetHeightVh}vh + 16px)`;
  }
}
