import { AfterViewInit, Component, DestroyRef, ElementRef, inject, NgZone, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';

interface Aircraft {
  hex: string;
  tailnumber: string | null;
  longitude: number | null;
  latitude: number | null;
  altitude: number | null;
  velocity: number | null;
  rotation: number | null;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './app.component.html'
})
export class AppComponent implements AfterViewInit {
  @ViewChild('mapContainer') mapContainer!: ElementRef<HTMLDivElement>;

  aircraft: Aircraft[] = [];
  filterText = '';
  lastUpdated: Date | null = null;
  isLoading = true;
  isRefreshing = false;
  errorMessage = '';
  selectedAircraftHex: string | null = null;
  private refreshInterval: number | undefined;
  private readonly destroyRef = inject(DestroyRef);
  private readonly ngZone = inject(NgZone);
  private map: import('leaflet').Map | null = null;
  private markerLayer: import('leaflet').LayerGroup | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      queueMicrotask(() => {
        void this.loadAircraft();
        this.refreshInterval = window.setInterval(() => void this.loadAircraft(), 5000);
      });
    }

    this.destroyRef.onDestroy(() => {
      if (this.refreshInterval !== undefined && typeof window !== 'undefined') {
        window.clearInterval(this.refreshInterval);
      }

      if (this.map) {
        this.map.remove();
        this.map = null;
      }
    });
  }

  ngAfterViewInit(): void {
    if (typeof window === 'undefined') return;
    void this.initializeMap();
  }

  get filteredAircraft(): Aircraft[] {
    const query = this.filterText.trim().toLowerCase();
    if (!query) return this.aircraft;

    return this.aircraft.filter((item) =>
      [item.hex, item.tailnumber ?? '', item.latitude, item.longitude]
        .some((value) => String(value ?? '').toLowerCase().includes(query))
    );
  }

  get positionedAircraft(): Aircraft[] {
    return this.aircraft.filter((item) => item.latitude !== null && item.longitude !== null);
  }

  get selectedAircraft(): Aircraft | null {
    return this.positionedAircraft.find((item) => item.hex === this.selectedAircraftHex)
      ?? this.positionedAircraft[0]
      ?? null;
  }

  get mapBounds(): { minLat: number; maxLat: number; minLon: number; maxLon: number } {
    const positioned = this.positionedAircraft;
    if (positioned.length === 0) {
      return {
        minLat: 41.0,
        maxLat: 41.45,
        minLon: -77.6,
        maxLon: -76.8
      };
    }

    const latitudes = positioned.map((item) => item.latitude as number);
    const longitudes = positioned.map((item) => item.longitude as number);
    const minLat = Math.min(...latitudes);
    const maxLat = Math.max(...latitudes);
    const minLon = Math.min(...longitudes);
    const maxLon = Math.max(...longitudes);
    const latitudePadding = Math.max((maxLat - minLat) * 0.2, 0.02);
    const longitudePadding = Math.max((maxLon - minLon) * 0.2, 0.02);

    return {
      minLat: minLat - latitudePadding,
      maxLat: maxLat + latitudePadding,
      minLon: minLon - longitudePadding,
      maxLon: maxLon + longitudePadding,
    };
  }

  get positionedCount(): number {
    return this.positionedAircraft.length;
  }

  get connectionState(): 'connecting' | 'live' | 'offline' {
    if (this.errorMessage) return 'offline';
    return this.lastUpdated ? 'live' : 'connecting';
  }

  get connectionLabel(): string {
    return {
      connecting: 'Connecting',
      live: 'Live feed',
      offline: 'Feed offline'
    }[this.connectionState];
  }

  mapPosition(item: Aircraft): { x: number; y: number } {
    const { minLat, maxLat, minLon, maxLon } = this.mapBounds;
    const x = ((item.longitude as number - minLon) / (maxLon - minLon || 1)) * 100;
    const y = ((maxLat - (item.latitude as number)) / (maxLat - minLat || 1)) * 100;

    return {
      x: Math.min(96, Math.max(4, x)),
      y: Math.min(96, Math.max(4, y)),
    };
  }

  private async initializeMap(): Promise<void> {
    if (typeof window === 'undefined' || !this.mapContainer) return;

    if (this.map) {
      return;
    }

    const L = await import('leaflet');

    this.map = L.map(this.mapContainer.nativeElement, {
      center: [41.24, -77.0],
      zoom: 9,
      zoomControl: true,
      scrollWheelZoom: true,
      dragging: true,
      worldCopyJump: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(this.map);

    this.markerLayer = L.layerGroup().addTo(this.map);
    await this.refreshMapMarkers();
  }

  private async refreshMapMarkers(): Promise<void> {
    if (!this.map || !this.markerLayer) return;

    const L = await import('leaflet');
    const positioned = this.positionedAircraft;
    this.markerLayer.clearLayers();

    if (positioned.length === 0) {
      this.map.setView([41.24, -77.0], 9, { animate: false });
      return;
    }

    const bounds = positioned
      .filter((item) => item.latitude !== null && item.longitude !== null)
      .map((item) => [item.latitude as number, item.longitude as number] as [number, number]);

    bounds.forEach(([lat, lon]) => {
      const plane = this.positionedAircraft.find((item) => item.latitude === lat && item.longitude === lon);
      const isSelected = plane !== undefined && this.selectedAircraftHex === plane.hex;
      const markerIcon = L.divIcon({
        className: isSelected ? 'aircraft-marker selected' : 'aircraft-marker',
        html: `
          <div class="aircraft-marker ${isSelected ? 'selected' : ''}" style="transform: rotate(${plane?.rotation ?? 0}deg)">
            <svg viewBox="0 0 32 32" aria-hidden="true">
              <path d="M4 16L11 11L15 2L17 11L28 16L17 21L15 30L11 21L4 16Z" />
            </svg>
          </div>
        `,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
        popupAnchor: [0, -11],
      });

      const marker = L.marker([lat, lon], { icon: markerIcon });
      if (plane) {
        marker.bindPopup(`${plane.tailnumber || 'Unknown aircraft'}<br>${plane.hex.toUpperCase()}<br>${plane.altitude ?? '--'} ft`);
        marker.on('click', () => this.selectAircraft(plane.hex));
      }

      marker.addTo(this.markerLayer!);
    });

    const mapBounds = L.latLngBounds(bounds);
    this.map.fitBounds(mapBounds.pad(0.35), { maxZoom: 11, animate: false });
  }

  selectAircraft(hex: string): void {
    this.selectedAircraftHex = hex;
  }

  refreshNow(): void {
    void this.loadAircraft();
  }

  private syncSelectedAircraft(): void {
    const hasSelection = this.selectedAircraftHex && this.positionedAircraft.some((item) => item.hex === this.selectedAircraftHex);
    if (!hasSelection && this.positionedAircraft.length > 0) {
      this.selectedAircraftHex = this.positionedAircraft[0].hex;
    }
    if (this.positionedAircraft.length === 0) {
      this.selectedAircraftHex = null;
    }
  }

  private async loadAircraft(): Promise<void> {
    if (typeof window === 'undefined' || this.isRefreshing) return;

    this.isRefreshing = true;
    try {
      const response = await fetch(this.getAircraftUrl());
      if (!response.ok) throw new Error(`Aircraft API returned ${response.status}`);

      const aircraft = await response.json() as Aircraft[];
      this.ngZone.run(() => {
        this.aircraft = aircraft;
        this.lastUpdated = new Date();
        this.errorMessage = '';
        this.syncSelectedAircraft();
        void this.refreshMapMarkers();
      });
    } catch {
      this.ngZone.run(() => {
        this.errorMessage = 'Aircraft feed is unavailable';
      });
    } finally {
      this.ngZone.run(() => {
        this.isLoading = false;
        this.isRefreshing = false;
      });
    }
  }

  private getAircraftUrl(): string {
    return '/aircraft';
  }
}
