import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { GoogleLoginProvider, SocialAuthService } from '@abacritt/angularx-social-login';

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

  loginWith(provider: string): void {
    if (provider === 'Google') {
      this.socialAuthService
        .signIn(GoogleLoginProvider.PROVIDER_ID)
        .then(() => {
          this.authService.loginWithOAuth('Google');
          this.router.navigateByUrl('/history');
        })
        .catch((error) => console.error('Google sign-in failed:', error));
      return;
    }

    this.authService.loginWithOAuth(provider);
    this.router.navigateByUrl('/history');
  }
}
