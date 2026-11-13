import { Injectable, signal } from '@angular/core';

interface AuthSession {
  provider: string;
  authenticatedAt: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly storageKey = 'williamsport-flights-auth';
  readonly isAuthenticated = signal(this.hasStoredSession());

  loginWithOAuth(provider: string): void {
    const session: AuthSession = {
      provider,
      authenticatedAt: new Date().toISOString()
    };

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(this.storageKey, JSON.stringify(session));
    }

    this.isAuthenticated.set(true);
  }

  logout(): void {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(this.storageKey);
    }

    this.isAuthenticated.set(false);
  }

  getProviderName(): string {
    if (typeof window === 'undefined') {
      return 'OAuth account';
    }

    const stored = window.localStorage.getItem(this.storageKey);
    if (!stored) {
      return 'OAuth account';
    }

    try {
      const session = JSON.parse(stored) as Partial<AuthSession>;
      return session.provider ?? 'OAuth account';
    } catch {
      return 'OAuth account';
    }
  }

  private hasStoredSession(): boolean {
    if (typeof window === 'undefined') {
      return false;
    }

    const stored = window.localStorage.getItem(this.storageKey);
    if (!stored) {
      return false;
    }

    try {
      const session = JSON.parse(stored) as Partial<AuthSession>;
      return !!session.provider;
    } catch {
      return false;
    }
  }
}
