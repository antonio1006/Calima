import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { EventItem } from '../../models/event.model';
import { EventStore } from '../../services/event-store';

@Component({
  selector: 'app-admin-page',
  imports: [CurrencyPipe, DatePipe, ReactiveFormsModule, RouterLink],
  templateUrl: './admin-page.html',
  styleUrl: './admin-page.css',
})
export class AdminPage {
  private readonly formBuilder = inject(FormBuilder);
  readonly store = inject(EventStore);

  readonly screen = signal<'list' | 'detail'>('list');
  readonly isSaving = signal(false);
  readonly saveMessage = signal<string | null>(null);
  readonly selectedEventId = signal('');
  readonly selectedEvent = computed(() => {
    const events = this.store.events();
    const selectedId = this.selectedEventId() || events[0]?.id;
    return events.find((event) => event.id === selectedId) ?? events[0];
  });

  readonly eventForm = this.formBuilder.nonNullable.group({
    id: [''],
    name: ['', Validators.required],
    date: ['', Validators.required],
    time: ['', Validators.required],
    city: ['', Validators.required],
    venue: ['', Validators.required],
    capacity: [1, [Validators.required, Validators.min(1)]],
    price: [0, [Validators.required, Validators.min(0)]],
    image: [''],
    description: ['', Validators.required],
  });

  constructor() {
    void this.store.refreshEvents(true);
    effect(() => {
      const firstEvent = this.store.events()[0];
      if (!this.selectedEventId() && firstEvent) {
        this.selectedEventId.set(firstEvent.id);
        this.setFormEvent(firstEvent);
      }
    });
  }

  selectEvent(event: EventItem): void {
    this.selectedEventId.set(event.id);
    this.setFormEvent(event);
    this.screen.set('detail');
  }

  backToList(): void {
    this.screen.set('list');
  }

  async createEvent(): Promise<void> {
    this.saveMessage.set(null);
    const event = await this.store.createEvent();
    if (!event) return;
    this.selectEvent(event);
  }

  async saveEvent(): Promise<void> {
    this.saveMessage.set(null);

    if (this.eventForm.invalid) {
      this.eventForm.markAllAsTouched();
      this.saveMessage.set('Controlla i campi obbligatori prima di salvare.');
      return;
    }

    this.isSaving.set(true);
    const event = await this.store.saveEvent(this.eventForm.getRawValue());
    this.isSaving.set(false);

    if (event) {
      this.setFormEvent(event);
      this.saveMessage.set('Evento salvato correttamente.');
      return;
    }

    this.saveMessage.set(this.store.error() || 'Salvataggio non riuscito.');
  }

  updateImage(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.addEventListener('load', () => {
      const image = typeof reader.result === 'string' ? reader.result : '';
      if (image) {
        this.eventForm.patchValue({ image });
      }
    });
    reader.readAsDataURL(file);
  }

  async deleteSelectedEvent(): Promise<void> {
    this.saveMessage.set(null);
    const event = this.selectedEvent();
    if (!event) return;

    const deleted = await this.store.deleteEvent(event.id);
    if (!deleted) return;

    const next = this.store.events()[0];
    if (next) {
      this.setFormEvent(next);
      this.selectedEventId.set(next.id);
      this.screen.set('list');
      return;
    }

    this.eventForm.reset();
    this.selectedEventId.set('');
    this.screen.set('list');
  }

  private setFormEvent(event: EventItem): void {
    this.eventForm.setValue({
      id: event.id,
      name: event.name,
      date: event.date,
      time: event.time,
      city: event.city,
      venue: event.venue,
      capacity: event.capacity,
      price: event.price,
      image: event.image,
      description: event.description,
    });
  }
}
