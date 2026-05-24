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
    name: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    phone: ['', [Validators.required, Validators.pattern(/^\+?[0-9 ]{8,18}$/)]],
    birthDate: ['', [Validators.required, this.minimumAgeValidator(13)]],
    password: [
      '',
      [
        Validators.required,
        Validators.minLength(8),
        Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/),
      ],
    ],
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
      this.registerError.set(
        'Controlla email, telefono, data di nascita e password. La password deve avere almeno 8 caratteri, una maiuscola, una minuscola e un numero.',
      );
      return;
    }

    const created = await this.auth.registerClient(this.registerForm.getRawValue());
    if (!created) {
      this.registerError.set(this.auth.authError() || 'Esiste gia un account con questa email.');
      return;
    }

    this.registerForm.reset({ name: '', email: '', phone: '', birthDate: '', password: '' });
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

  ticketStatusLabel(ticket: Ticket): string {
    const labels: Record<Ticket['paymentStatus'], string> = {
      accepted: 'Accettato',
      cancelled: 'Cancellato',
      paid: 'Accettato',
      pending: 'In attesa',
      refunded: 'Rimborsato',
      rejected: 'Rifiutato',
    };
    return labels[ticket.paymentStatus];
  }

  isTicketAccepted(ticket: Ticket): boolean {
    return ticket.paymentStatus === 'accepted' || ticket.paymentStatus === 'paid';
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

  private minimumAgeValidator(age: number) {
    return (control: { value: string }) => {
      if (!control.value) return null;

      const birthDate = new Date(`${control.value}T00:00:00`);
      if (Number.isNaN(birthDate.getTime())) return { minimumAge: true };

      const limit = new Date();
      limit.setFullYear(limit.getFullYear() - age);
      return birthDate <= limit ? null : { minimumAge: true };
    };
  }
}
