import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { GoogleLoginProvider, SocialAuthService } from '@abacritt/angularx-social-login';

import { environment } from '../environments/environment';
import { AuthService } from './auth.service';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './login-page.component.html',
  styleUrls: ['./login-page.component.css']
})
export class LoginPageComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly socialAuthService = inject(SocialAuthService);
  isSigningIn = false;
  errorMessage = '';

  async loginWithGoogle(): Promise<void> {
    if (!environment.googleClientId || environment.googleClientId.startsWith('YOUR_')) {
      this.errorMessage = 'Google sign-in is not configured. Add your Google OAuth client ID to the environment file.';
      return;
    }

    this.errorMessage = '';
    this.isSigningIn = true;

    try {
      await this.socialAuthService.signIn(GoogleLoginProvider.PROVIDER_ID);
      this.authService.loginWithOAuth('Google');
      await this.router.navigateByUrl('/history');
    } catch (error: unknown) {
      console.error('Google sign-in failed:', error);
      this.errorMessage = 'Google sign-in failed. Check the OAuth client ID and authorized JavaScript origins, then try again.';
    } finally {
      this.isSigningIn = false;
    }
  }
}
