import { CurrencyPipe } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Ticket, UserRole } from '../../models/event.model';
import { AuthStore } from '../../services/auth-store';
import { EventStore } from '../../services/event-store';

@Component({
  selector: 'app-access-page',
  imports: [CurrencyPipe, ReactiveFormsModule, RouterLink],
  templateUrl: './access-page.html',
  styleUrl: './access-page.css',
})
export class AccessPage {
  private readonly formBuilder = inject(FormBuilder);
  readonly auth = inject(AuthStore);
  readonly store = inject(EventStore);

  readonly hasLoginError = signal(false);
  readonly registerError = signal<string | null>(null);

  readonly loginForm = this.formBuilder.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  readonly registerForm = this.formBuilder.nonNullable.group({
    name: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    phone: ['', Validators.required],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  readonly userTickets = computed(() => {
    const user = this.auth.user();
    if (!user || user.role !== 'client') return [];
    return this.store.ticketsForEmail(user.email);
  });

  constructor() {
    effect(() => {
      const user = this.auth.user();
      if (user?.role === 'client') {
        void this.store.loadTicketsForEmail(user.email);
      }
    });
  }

  async login(): Promise<void> {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    const value = this.loginForm.getRawValue();
    this.hasLoginError.set(!(await this.auth.login(value.email, value.password)));
  }

  async createAccount(): Promise<void> {
    this.registerError.set(null);

    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    const created = await this.auth.registerClient(this.registerForm.getRawValue());
    if (!created) {
      this.registerError.set(this.auth.authError() || 'Esiste gia un account con questa email.');
      return;
    }

    this.registerForm.reset({ name: '', email: '', phone: '', password: '' });
  }

  async logout(): Promise<void> {
    this.hasLoginError.set(false);
    this.registerError.set(null);
    await this.auth.logout();
    this.loginForm.reset({ email: '', password: '' });
  }

  roleLabel(role: UserRole): string {
    const labels: Record<UserRole, string> = {
      client: 'Cliente',
      scanner: 'Scanner',
      admin: 'Admin',
    };
    return labels[role];
  }

  eventName(ticket: Ticket): string {
    return this.store.findEvent(ticket.eventId)?.name ?? 'Evento';
  }

  ticketPrice(ticket: Ticket): number {
    return this.store.findEvent(ticket.eventId)?.price ?? 0;
  }

  privileges(role: UserRole): string[] {
    if (role === 'admin') {
      return [
        'Creare e modificare eventi',
        'Controllare vendite e capienza',
        'Gestire la futura lista invitati',
        'Supervisionare scanner e accessi',
      ];
    }

    if (role === 'scanner') {
      return [
        'Scansionare QR code',
        'Confermare o rifiutare ingressi',
        'Vedere solo le informazioni necessarie al check-in',
      ];
    }

    return ['Vedere i biglietti acquistati', 'Controllare dati personali e stato pagamento'];
  }
}
