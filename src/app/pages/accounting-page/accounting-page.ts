import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Ticket, TicketPaymentMethod } from '../../models/event.model';
import { EventStore } from '../../services/event-store';

@Component({
  selector: 'app-accounting-page',
  imports: [CurrencyPipe, DatePipe, FormsModule, RouterLink],
  templateUrl: './accounting-page.html',
  styleUrl: './accounting-page.css',
})
export class AccountingPage {
  readonly store = inject(EventStore);
  readonly selectedEventId = signal('');
  readonly listDeduction = signal(0);

  readonly selectedEvent = computed(() => {
    const selectedId = this.selectedEventId();
    if (!selectedId) return undefined;
    return this.store.events().find((event) => event.id === selectedId);
  });

  readonly eventTickets = computed(() => {
    const eventId = this.selectedEvent()?.id;
    if (!eventId) return [];
    return this.store.tickets().filter((ticket) => ticket.eventId === eventId);
  });

  readonly confirmedTickets = computed(() =>
    this.eventTickets().filter((ticket) => ticket.checkedIn && ticket.cashConfirmed),
  );
  readonly listTickets = computed(() =>
    this.confirmedTickets().filter((ticket) => ticket.entryMode === 'list'),
  );
  readonly walkInTickets = computed(() =>
    this.confirmedTickets().filter((ticket) => ticket.entryMode === 'walk_in'),
  );
  readonly listGross = computed(
    () => this.listTickets().length * (this.selectedEvent()?.price ?? 0),
  );
  readonly listDeductionTotal = computed(() =>
    Math.min(this.listGross(), this.listTickets().length * this.listDeduction()),
  );
  readonly listNet = computed(() => Math.max(0, this.listGross() - this.listDeductionTotal()));
  readonly walkInTotal = computed(
    () => this.walkInTickets().length * (this.selectedEvent()?.walkInPrice ?? 0),
  );
  readonly totalRevenue = computed(() => this.listNet() + this.walkInTotal());
  readonly posRevenue = computed(() => this.totalByPaymentMethod('pos'));
  readonly cashRevenue = computed(() => this.totalByPaymentMethod('cash'));

  constructor() {
    void this.store.refreshEvents(true);
    effect(() => {
      const eventId = this.selectedEvent()?.id;
      if (eventId) {
        void this.store.loadEventTickets(eventId);
      }
    });
  }

  selectEvent(eventId: string): void {
    this.selectedEventId.set(eventId);
    this.listDeduction.set(0);
  }

  clearEvent(): void {
    this.selectedEventId.set('');
    this.listDeduction.set(0);
  }

  updateListDeduction(value: string | number): void {
    const amount = Number(value);
    this.listDeduction.set(Number.isFinite(amount) ? Math.max(0, amount) : 0);
  }

  ticketAmount(ticket: Ticket): number {
    const event = this.selectedEvent();
    if (!event) return 0;

    if (ticket.entryMode === 'walk_in') {
      return event.walkInPrice;
    }

    return Math.max(0, event.price - this.listDeduction());
  }

  private totalByPaymentMethod(paymentMethod: TicketPaymentMethod): number {
    return this.confirmedTickets()
      .filter((ticket) => ticket.paymentMethod === paymentMethod)
      .reduce((total, ticket) => total + this.ticketAmount(ticket), 0);
  }
}
