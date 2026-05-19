import { computed, Injectable, signal } from '@angular/core';
import { AppUser } from '../models/event.model';

interface ClientRegistration {
  name: string;
  email: string;
  password: string;
  phone: string;
}

interface AuthResponse {
  user: AppUser | null;
  error?: string;
}

@Injectable({ providedIn: 'root' })
export class AuthStore {
  private readonly currentUser = signal<AppUser | null>(null);

  readonly authError = signal<string | null>(null);
  readonly isReady = signal(false);
  readonly demoUsers: AppUser[] = [];
  readonly user = computed(() => this.currentUser());
  readonly isLoggedIn = computed(() => this.user() !== null);

  constructor() {
    void this.loadCurrentUser();
  }

  async loadCurrentUser(): Promise<AppUser | null> {
    try {
      const response = await fetch('/api/auth/me', { credentials: 'include' });
      const payload = (await response.json()) as AuthResponse;
      this.currentUser.set(payload.user);
      return payload.user;
    } catch {
      this.currentUser.set(null);
      return null;
    } finally {
      this.isReady.set(true);
    }
  }

  async login(email: string, password: string): Promise<boolean> {
    this.authError.set(null);

    const response = await fetch('/api/auth/login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const payload = (await response.json()) as AuthResponse;
    if (!response.ok || !payload.user) {
      this.authError.set(this.authMessage(payload.error, 'Credenziali non valide.'));
      this.currentUser.set(null);
      return false;
    }

    this.currentUser.set(payload.user);
    return true;
  }

  async registerClient(input: ClientRegistration): Promise<boolean> {
    this.authError.set(null);

    const response = await fetch('/api/auth/register', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    const payload = (await response.json()) as AuthResponse;
    if (!response.ok || !payload.user) {
      this.authError.set(this.authMessage(payload.error, 'Registrazione non riuscita.'));
      this.currentUser.set(null);
      return false;
    }

    this.currentUser.set(payload.user);
    return true;
  }

  async logout(): Promise<void> {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    });
    this.currentUser.set(null);
  }

  private authMessage(error: string | undefined, fallback: string): string {
    const messages: Record<string, string> = {
      ACCOUNT_ALREADY_EXISTS:
        'Esiste gia un account con questa email. Accedi con la password corretta.',
      INVALID_CREDENTIALS: 'Email o password non corretti.',
      MISSING_CREDENTIALS: 'Inserisci email e password.',
      MISSING_FIELDS: 'Compila tutti i campi richiesti.',
    };

    return error ? (messages[error] ?? error) : fallback;
  }
}
