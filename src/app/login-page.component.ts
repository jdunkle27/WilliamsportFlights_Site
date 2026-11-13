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
  isAuthenticating = false;
  errorMessage = '';

  ngOnInit(): void {
    this.socialAuthService.authState
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((user) => {
        if (!user) {
          return;
        }

        if (!user.idToken) {
          this.errorMessage = 'Google did not return an ID token. Please try signing in again.';
          return;
        }

        void this.finishGoogleSignIn(user.idToken);
      });
  }

  private async finishGoogleSignIn(idToken: string): Promise<void> {
    this.isAuthenticating = true;
    this.errorMessage = '';

    try {
      const response = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ idToken })
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) {
        throw new Error(result.error || 'Google sign-in could not be completed');
      }

      this.authService.loginWithOAuth('Google');
      await this.router.navigateByUrl('/history');
    } catch (error: unknown) {
      console.error('Google sign-in failed:', error);
      this.errorMessage = error instanceof Error ? error.message : 'Google sign-in failed';
    } finally {
      this.isAuthenticating = false;
    }
  }
}
