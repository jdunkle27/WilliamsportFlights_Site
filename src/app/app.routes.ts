import { Routes } from '@angular/router';

import { authGuard } from './auth.guard';
import { FlightDashboardComponent } from './flight-dashboard.component';
import { HistoricalPageComponent } from './historical-page.component';
import { LoginPageComponent } from './login-page.component';

export const routes: Routes = [
  { path: '', component: FlightDashboardComponent },
  { path: 'login', component: LoginPageComponent },
  { path: 'history', component: HistoricalPageComponent, canActivate: [authGuard] },
  { path: '**', redirectTo: '' }
];
