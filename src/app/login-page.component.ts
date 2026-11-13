import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { SocialAuthService, SocialLoginModule } from '@abacritt/angularx-social-login';

import { environment } from '../environments/environment';
import { AuthService } from './auth.service';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [CommonModule, RouterLink, SocialLoginModule],
  templateUrl: './login-page.component.html',
  styleUrls: ['./login-page.component.css']
})
export class LoginPageComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly socialAuthService = inject(SocialAuthService);
  private readonly destroyRef = inject(DestroyRef);
  readonly isGoogleConfigured = !!environment.googleClientId
    && !environment.googleClientId.startsWith('YOUR_');

  ngOnInit(): void {
    this.socialAuthService.authState
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((user) => {
        if (!user) {
          return;
        }

      this.authService.loginWithOAuth('Google');
        void this.router.navigateByUrl('/history');
      });
  }
}
