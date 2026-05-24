import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { EventStore } from '../../services/event-store';

@Component({
  selector: 'app-event-detail-page',
  imports: [CurrencyPipe, DatePipe, ReactiveFormsModule, RouterLink],
  templateUrl: './event-detail-page.html',
  styleUrl: './event-detail-page.css',
})
export class EventDetailPage {
  private readonly formBuilder = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  readonly store = inject(EventStore);

  readonly isRegistering = signal(false);
  readonly registerMessage = signal<string | null>(null);
  readonly registerSucceeded = signal(false);
  readonly eventId = computed(() => this.route.snapshot.paramMap.get('id') ?? '');
  readonly event = computed(() => this.store.findEvent(this.eventId()));
  readonly fallbackImage = '/calima-logo.webp';

  readonly registrationForm = this.formBuilder.nonNullable.group({
    eventId: ['', Validators.required],
    firstName: ['', Validators.required],
    lastName: ['', Validators.required],
    birthDate: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    phone: ['', Validators.required],
  });

  constructor() {
    effect(() => {
      const event = this.event();
      if (event) {
        this.registrationForm.patchValue({ eventId: event.id });
      }
    });
  }

  async register(): Promise<void> {
    this.registerMessage.set(null);
    this.registerSucceeded.set(false);

    if (this.registrationForm.invalid) {
      this.registrationForm.markAllAsTouched();
      this.registerMessage.set('Compila tutti i campi richiesti.');
      return;
    }

    this.isRegistering.set(true);
    const ticket = await this.store.createTicket(this.registrationForm.getRawValue());
    this.isRegistering.set(false);

    if (!ticket) {
      this.registerMessage.set(this.store.error() || 'Registrazione non riuscita.');
      return;
    }

    this.registrationForm.reset({
      eventId: ticket.eventId,
      firstName: '',
      lastName: '',
      birthDate: '',
      email: '',
      phone: '',
    });
    this.registerSucceeded.set(true);
    this.registerMessage.set(`Richiesta inviata. L'admin dovra approvarla prima dell'ingresso.`);
  }

  useFallbackImage(event: Event): void {
    const image = event.target as HTMLImageElement;
    if (image.src.includes(this.fallbackImage)) return;

    image.src = this.fallbackImage;
  }
}
