import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';

import { AuthService } from './auth.service';

@Component({
  selector: 'app-historical-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './historical-page.component.html',
  styleUrls: ['./historical-page.component.css']
})
export class HistoricalPageComponent {
  private readonly authService = inject(AuthService);

  get signedInProvider(): string {
    return this.authService.getProviderName();
  }
}
