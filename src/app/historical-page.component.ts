import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { AuthService } from './auth.service';

interface HistoryObservation {
  observationId: number;
  icaoHex: string;
  tailNum: string | null;
  flightId: number | null;
  observationTime: string;
  latitude: number;
  longitude: number;
  altitude: number | null;
  velocity: number | null;
}

@Component({
  selector: 'app-historical-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './historical-page.component.html',
  styleUrls: ['./historical-page.component.css']
})
export class HistoricalPageComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  observations: HistoryObservation[] = [];
  searchTerm = '';
  loading = false;
  errorMessage = '';

  get signedInProvider(): string {
    return this.authService.getProviderName();
  }

  ngOnInit(): void {
    void this.loadHistory();
  }

  search(): void {
    void this.loadHistory();
  }

  private async loadHistory(): Promise<void> {
    this.loading = true;
    this.errorMessage = '';
    const params = new URLSearchParams({ limit: '100' });
    const query = this.searchTerm.trim();
    if (query) {
      params.set('q', query);
    }

    try {
      const response = await fetch(`/api/history?${params.toString()}`, { credentials: 'include' });
      if (response.status === 401) {
        this.authService.logout();
        await this.router.navigateByUrl('/login');
        return;
      }
      if (!response.ok) {
        throw new Error('Historical data is unavailable');
      }

      const result = await response.json() as { observations: HistoryObservation[] };
      this.observations = result.observations;
    } catch (error: unknown) {
      console.error('Historical data request failed:', error);
      this.errorMessage = 'Could not load historical flight data. Check the database connection and try again.';
    } finally {
      this.loading = false;
    }
  }
}
