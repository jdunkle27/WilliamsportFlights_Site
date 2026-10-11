import { afterNextRender, Component, DestroyRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';

interface Aircraft {
  hex: string;
  tailnumber: string | null;
  longitude: number | null;
  latitude: number | null;
  altitude: number | null;
  velocity: number | null;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './app.component.html'
})
export class AppComponent {
  aircraft: Aircraft[] = [];
  filterText = '';
  lastUpdated: Date | null = null;
  isLoading = true;
  isRefreshing = false;
  errorMessage = '';
  private refreshInterval: number | undefined;
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    afterNextRender(() => {
      void this.loadAircraft();
      this.refreshInterval = window.setInterval(() => void this.loadAircraft(), 5000);
    });

    this.destroyRef.onDestroy(() => {
      if (this.refreshInterval !== undefined) {
        window.clearInterval(this.refreshInterval);
      }
    });
  }

  get filteredAircraft(): Aircraft[] {
    const query = this.filterText.trim().toLowerCase();
    if (!query) return this.aircraft;

    return this.aircraft.filter((item) =>
      [item.hex, item.tailnumber ?? '', item.latitude, item.longitude]
        .some((value) => String(value ?? '').toLowerCase().includes(query))
    );
  }

  get positionedCount(): number {
    return this.aircraft.filter((item) => item.latitude !== null && item.longitude !== null).length;
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

  refreshNow(): void {
    void this.loadAircraft();
  }

  private async loadAircraft(): Promise<void> {
    if (this.isRefreshing) return;

    this.isRefreshing = true;
    try {
      const response = await fetch('/aircraft');
      if (!response.ok) throw new Error(`Aircraft API returned ${response.status}`);

      this.aircraft = await response.json() as Aircraft[];
      this.lastUpdated = new Date();
      this.errorMessage = '';
    } catch {
      this.errorMessage = 'Aircraft feed is unavailable';
    } finally {
      this.isLoading = false;
      this.isRefreshing = false;
    }
  }
}
