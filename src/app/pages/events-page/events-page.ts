import { CurrencyPipe, DatePipe } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  ViewChild,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { EventItem } from '../../models/event.model';
import { EventStore } from '../../services/event-store';

@Component({
  selector: 'app-events-page',
  imports: [CurrencyPipe, DatePipe, ReactiveFormsModule, RouterLink],
  templateUrl: './events-page.html',
  styleUrl: './events-page.css',
})
export class EventsPage {
  private readonly formBuilder = inject(FormBuilder);
  @ViewChild('heroVideo') private readonly heroVideo?: ElementRef<HTMLVideoElement>;

  readonly store = inject(EventStore);
  readonly isRegistering = signal(false);
  readonly registerMessage = signal<string | null>(null);
  readonly registerSucceeded = signal(false);

  readonly events = this.store.events;
  readonly mainEvent = computed(() => this.events()[0]);
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
      const event = this.mainEvent();
      if (event && !this.registrationForm.controls.eventId.value) {
        this.registrationForm.patchValue({ eventId: event.id });
      }
    });
  }

  ngAfterViewInit(): void {
    this.playHeroVideo();
    window.setTimeout(() => this.playHeroVideo(), 350);
  }

  selectEvent(event: EventItem): void {
    this.registrationForm.patchValue({ eventId: event.id });
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

  playHeroVideo(): void {
    const video = this.heroVideo?.nativeElement;
    if (!video) return;

    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.setAttribute('muted', '');
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');

    const playAttempt = video.play();
    if (playAttempt) {
      playAttempt.catch(() => {
        // Safari can still reject autoplay in low-power or strict privacy modes.
      });
    }
  }
}
