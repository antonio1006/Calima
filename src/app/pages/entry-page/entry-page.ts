import { DatePipe } from '@angular/common';
import { Component, OnDestroy, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Ticket, TicketEntryMode, TicketPaymentMethod } from '../../models/event.model';
import { EventStore } from '../../services/event-store';

type EntryFilter = 'all' | 'missing' | 'entered';
type EntryModeView = 'list' | 'cash';

@Component({
  selector: 'app-entry-page',
  imports: [DatePipe, FormsModule, RouterLink],
  templateUrl: './entry-page.html',
  styleUrl: './entry-page.css',
})
export class EntryPage implements OnDestroy {
  readonly store = inject(EventStore);
  private readonly refreshTimer = window.setInterval(() => {
    const eventId = this.selectedEvent()?.id;
    if (eventId) {
      void this.store.loadEventTickets(eventId);
    }
  }, 4000);

  readonly selectedEventId = signal('');
  readonly searchTerm = signal('');
  readonly filter = signal<EntryFilter>('missing');
  readonly mode = signal<EntryModeView>('list');
  readonly isSaving = signal(false);
  readonly message = signal<string | null>(null);

  readonly selectedEvent = computed(() => {
    const events = this.store.events();
    const selectedId = this.selectedEventId() || events[0]?.id;
    return events.find((event) => event.id === selectedId) ?? events[0];
  });

  readonly eventTickets = computed(() => {
    const eventId = this.selectedEvent()?.id;
    if (!eventId) return [];
    return this.store.tickets().filter((ticket) => ticket.eventId === eventId);
  });

  readonly enteredCount = computed(
    () => this.eventTickets().filter((ticket) => ticket.checkedIn).length,
  );
  readonly missingCount = computed(() =>
    Math.max(0, this.eventTickets().length - this.enteredCount()),
  );
  readonly cashTickets = computed(() => this.eventTickets().filter((ticket) => ticket.checkedIn));

  readonly filteredTickets = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const filter = this.filter();

    return this.eventTickets().filter((ticket) => {
      if (filter === 'missing' && ticket.checkedIn) return false;
      if (filter === 'entered' && !ticket.checkedIn) return false;
      if (!term) return true;

      const haystack = [ticket.firstName, ticket.lastName, ticket.email, ticket.phone, ticket.id]
        .join(' ')
        .toLowerCase();

      return haystack.includes(term);
    });
  });

  constructor() {
    void this.store.refreshEvents(true);
    effect(() => {
      const firstEvent = this.store.events()[0];
      if (!this.selectedEventId() && firstEvent) {
        this.selectedEventId.set(firstEvent.id);
      }
    });
    effect(() => {
      const eventId = this.selectedEvent()?.id;
      if (eventId) {
        void this.store.loadEventTickets(eventId);
      }
    });
  }

  ngOnDestroy(): void {
    window.clearInterval(this.refreshTimer);
  }

  selectEvent(eventId: string): void {
    this.selectedEventId.set(eventId);
    this.searchTerm.set('');
    this.message.set(null);
  }

  setFilter(filter: EntryFilter): void {
    this.filter.set(filter);
  }

  setMode(mode: EntryModeView): void {
    this.mode.set(mode);
    this.message.set(null);
    this.searchTerm.set('');
  }

  async toggleCheckIn(ticket: Ticket, checkedIn: boolean): Promise<void> {
    this.message.set(null);
    this.isSaving.set(true);
    const updated = await this.store.adminSetTicketCheckIn(ticket.id, checkedIn);
    this.isSaving.set(false);

    if (!updated) {
      this.message.set(this.store.error() || 'Aggiornamento ingresso non riuscito.');
      return;
    }

    this.message.set(
      checkedIn
        ? `${updated.firstName} ${updated.lastName} segnato come entrato.`
        : `Ingresso annullato per ${updated.firstName} ${updated.lastName}.`,
    );
  }

  async setPaymentMethod(ticket: Ticket, paymentMethod: TicketPaymentMethod): Promise<void> {
    this.message.set(null);
    this.isSaving.set(true);
    const updated = await this.store.adminSetTicketCashData(ticket.id, { paymentMethod });
    this.isSaving.set(false);

    if (!updated) {
      this.message.set(this.store.error() || 'Aggiornamento pagamento non riuscito.');
      return;
    }

    this.message.set(
      `${updated.firstName} ${updated.lastName}: pagamento ${this.paymentLabel(paymentMethod)}.`,
    );
  }

  async setEntryMode(ticket: Ticket, entryMode: TicketEntryMode): Promise<void> {
    this.message.set(null);
    this.isSaving.set(true);
    const updated = await this.store.adminSetTicketCashData(ticket.id, { entryMode });
    this.isSaving.set(false);

    if (!updated) {
      this.message.set(this.store.error() || 'Aggiornamento ingresso non riuscito.');
      return;
    }

    this.message.set(
      `${updated.firstName} ${updated.lastName}: ingresso ${this.entryModeLabel(entryMode)}.`,
    );
  }

  paymentLabel(paymentMethod: TicketPaymentMethod): string {
    return paymentMethod === 'pos' ? 'POS' : 'Contanti';
  }

  entryModeLabel(entryMode: TicketEntryMode): string {
    return entryMode === 'list' ? 'Lista' : 'Fuori Lista';
  }
}
