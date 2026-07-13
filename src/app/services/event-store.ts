import { computed, Injectable, signal } from '@angular/core';
import { EventItem, EventStats, Ticket, TicketStatus } from '../models/event.model';

interface AppState {
  events: EventItem[];
  tickets: Ticket[];
}

interface EventsResponse {
  events: EventItem[];
}

interface TicketResponse {
  ticket: Ticket;
}

interface TicketsResponse {
  tickets: Ticket[];
}

const emptyStats: EventStats = {
  checkedIn: 0,
  remaining: 0,
  revenue: 0,
  sold: 0,
};

@Injectable({ providedIn: 'root' })
export class EventStore {
  private readonly state = signal<AppState>({ events: [], tickets: [] });

  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);
  readonly events = computed(() => this.state().events);
  readonly tickets = computed(() => this.state().tickets);
  readonly totalTickets = computed(() =>
    this.events().reduce((total, event) => total + this.statsFor(event.id).sold, 0),
  );
  readonly totalRevenue = computed(() =>
    this.events().reduce((total, event) => total + this.statsFor(event.id).revenue, 0),
  );

  constructor() {
    void this.refreshEvents();
  }

  async refreshEvents(admin = false): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);

    try {
      const response = await fetch(admin ? '/api/admin/events' : '/api/events', {
        credentials: 'include',
      });
      const payload = await this.readPayload<EventsResponse>(response);
      if (!response.ok) {
        throw new Error(payload.error || 'Impossibile caricare gli eventi.');
      }

      this.state.update((state) => ({ ...state, events: payload.events || [] }));
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Errore caricamento eventi.');
    } finally {
      this.isLoading.set(false);
    }
  }

  findEvent(eventId: string): EventItem | undefined {
    return this.state().events.find((event) => event.id === eventId);
  }

  ticketsForEmail(email: string): Ticket[] {
    const normalized = email.trim().toLowerCase();
    return this.state().tickets.filter((ticket) => ticket.email.toLowerCase() === normalized);
  }

  async loadTicketsForEmail(email: string): Promise<void> {
    if (!email) return;

    try {
      const response = await fetch(`/api/tickets/by-email?email=${encodeURIComponent(email)}`, {
        credentials: 'include',
      });
      const payload = await this.readPayload<{ tickets?: Ticket[] }>(response);
      if (!response.ok) {
        this.error.set(payload.error || 'Impossibile caricare i ticket.');
        return;
      }

      this.state.update((state) => ({ ...state, tickets: payload.tickets || [] }));
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Impossibile caricare i ticket.');
    }
  }

  statsFor(eventId: string): EventStats {
    const event = this.findEvent(eventId);
    if (event?.stats) {
      return event.stats;
    }

    const tickets = this.state().tickets.filter((ticket) => ticket.eventId === eventId);
    const activeTickets = tickets.filter((ticket) => this.isAcceptedTicket(ticket.paymentStatus));
    const revenue = activeTickets.reduce(
      (total, ticket) => total + (ticket.paymentStatus === 'paid' ? (event?.price ?? 0) : 0),
      0,
    );

    return {
      sold: activeTickets.length,
      checkedIn: activeTickets.filter((ticket) => ticket.checkedIn).length,
      revenue,
      remaining: Math.max(0, (event?.capacity ?? 0) - activeTickets.length),
    };
  }

  async createTicket(
    input: Pick<Ticket, 'eventId' | 'firstName' | 'lastName' | 'birthDate' | 'email' | 'phone'>,
  ): Promise<Ticket | null> {
    this.error.set(null);

    try {
      const response = await fetch('/api/tickets/register', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const payload = await this.readPayload<TicketResponse>(response);
      if (!response.ok) {
        this.error.set(this.ticketErrorMessage(payload.error));
        return null;
      }

      this.state.update((state) => ({ ...state, tickets: [payload.ticket, ...state.tickets] }));
      await this.refreshEvents();
      return payload.ticket;
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Registrazione non riuscita.');
      return null;
    }
  }

  async loadEventTickets(eventId: string): Promise<void> {
    if (!eventId) return;

    try {
      const response = await fetch(`/api/admin/tickets?eventId=${encodeURIComponent(eventId)}`, {
        credentials: 'include',
      });
      const payload = await this.readPayload<TicketsResponse>(response);
      if (!response.ok) {
        this.error.set(this.adminErrorMessage(payload.error));
        return;
      }

      this.state.update((state) => ({
        ...state,
        tickets: [
          ...(payload.tickets || []),
          ...state.tickets.filter((ticket) => ticket.eventId !== eventId),
        ],
      }));
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Impossibile caricare la lista.');
    }
  }

  async adminAddTicket(
    input: Pick<Ticket, 'eventId' | 'firstName' | 'lastName' | 'birthDate' | 'email' | 'phone'>,
  ): Promise<Ticket | null> {
    this.error.set(null);

    try {
      const response = await fetch('/api/admin/tickets', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const payload = await this.readPayload<TicketResponse>(response);
      if (!response.ok || !payload.ticket) {
        this.error.set(this.ticketErrorMessage(payload.error));
        return null;
      }

      this.state.update((state) => ({ ...state, tickets: [payload.ticket, ...state.tickets] }));
      await this.refreshEvents(true);
      return payload.ticket;
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Aggiunta in lista non riuscita.');
      return null;
    }
  }

  async adminUpdateTicketStatus(ticketId: string, status: TicketStatus): Promise<Ticket | null> {
    this.error.set(null);

    try {
      const response = await fetch('/api/admin/tickets', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: ticketId, status }),
      });
      const payload = await this.readPayload<TicketResponse>(response);
      if (!response.ok || !payload.ticket) {
        this.error.set(this.ticketErrorMessage(payload.error));
        return null;
      }

      this.state.update((state) => ({
        ...state,
        tickets: state.tickets.map((ticket) =>
          ticket.id === payload.ticket?.id ? payload.ticket : ticket,
        ),
      }));
      await this.refreshEvents(true);
      return payload.ticket;
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Aggiornamento lista non riuscito.');
      return null;
    }
  }

  async adminSetTicketCheckIn(ticketId: string, checkedIn: boolean): Promise<Ticket | null> {
    this.error.set(null);

    try {
      const response = await fetch('/api/admin/tickets', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: ticketId, checkedIn }),
      });
      const payload = await this.readPayload<TicketResponse>(response);
      if (!response.ok || !payload.ticket) {
        this.error.set(this.ticketErrorMessage(payload.error));
        return null;
      }

      this.state.update((state) => ({
        ...state,
        tickets: state.tickets.map((ticket) =>
          ticket.id === payload.ticket?.id ? payload.ticket : ticket,
        ),
      }));
      await this.refreshEvents(true);
      return payload.ticket;
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Conteggio ingresso non riuscito.');
      return null;
    }
  }

  async adminDeleteTicket(ticketId: string): Promise<boolean> {
    this.error.set(null);

    try {
      const response = await fetch('/api/admin/tickets', {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: ticketId }),
      });
      const payload = await this.readPayload(response);
      if (!response.ok) {
        this.error.set(this.ticketErrorMessage(payload.error));
        return false;
      }

      this.state.update((state) => ({
        ...state,
        tickets: state.tickets.filter((ticket) => ticket.id !== ticketId),
      }));
      await this.refreshEvents(true);
      return true;
    } catch (error) {
      this.error.set(
        error instanceof Error ? error.message : 'Rimozione dalla lista non riuscita.',
      );
      return false;
    }
  }

  async saveEvent(event: EventItem): Promise<EventItem | null> {
    this.error.set(null);

    try {
      const response = await fetch('/api/admin/events', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event }),
      });
      const payload = await this.readPayload<{ event?: EventItem }>(response);
      if (!response.ok || !payload.event) {
        this.error.set(this.adminErrorMessage(payload.error));
        return null;
      }

      this.state.update((state) => ({
        ...state,
        events: state.events.map((item) => (item.id === payload.event?.id ? payload.event : item)),
      }));
      return payload.event;
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Salvataggio evento non riuscito.');
      return null;
    }
  }

  async createEvent(): Promise<EventItem | null> {
    this.error.set(null);

    try {
      const response = await fetch('/api/admin/events', {
        method: 'POST',
        credentials: 'include',
      });
      const payload = await this.readPayload<{ event?: EventItem }>(response);
      if (!response.ok || !payload.event) {
        this.error.set(this.adminErrorMessage(payload.error));
        return null;
      }

      this.state.update((state) => ({ ...state, events: [...state.events, payload.event!] }));
      return payload.event;
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Creazione evento non riuscita.');
      return null;
    }
  }

  async deleteEvent(eventId: string): Promise<boolean> {
    this.error.set(null);

    try {
      const response = await fetch('/api/admin/events', {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: eventId }),
      });
      const payload = await this.readPayload(response);
      if (!response.ok) {
        this.error.set(this.adminErrorMessage(payload.error));
        return false;
      }

      this.state.update((state) => ({
        ...state,
        events: state.events.filter((event) => event.id !== eventId),
      }));
      return true;
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Eliminazione evento non riuscita.');
      return false;
    }
  }

  private async readPayload<T = Record<string, never>>(
    response: Response,
  ): Promise<T & { error?: string }> {
    const text = await response.text();
    if (!text) return {} as T & { error?: string };

    try {
      return JSON.parse(text) as T & { error?: string };
    } catch {
      return {
        error: response.ok
          ? 'Risposta non valida dal server.'
          : `Errore server ${response.status}.`,
      } as T & { error?: string };
    }
  }

  private adminErrorMessage(error?: string): string {
    if (error === 'FORBIDDEN') {
      return 'Sessione admin scaduta o permessi insufficienti. Esci e rientra con un account admin.';
    }

    return error || 'Operazione admin non riuscita.';
  }

  private ticketErrorMessage(error?: string): string {
    const messages: Record<string, string> = {
      EMAIL_MISMATCH: 'Usa la stessa email del tuo account Calima.',
      EVENT_NOT_FOUND: 'Evento non trovato o non ancora pubblicato.',
      EVENT_SOLD_OUT: 'I posti per questo evento sono terminati.',
      INVALID_EVENT_ID: 'Evento non valido. Ricarica la pagina e riprova.',
      INVALID_TICKET_STATUS: 'Stato lista non valido.',
      LOGIN_REQUIRED: 'Accedi con un account autorizzato.',
      MISSING_TICKET_UPDATE: 'Scegli quale modifica applicare alla persona.',
      MISSING_FIELDS: 'Compila tutti i campi richiesti.',
      TICKET_ALREADY_EXISTS: 'Questa persona e gia in lista per questo evento.',
      TICKET_NOT_ACCEPTED: "Puoi segnare l'ingresso solo per persone accettate in lista.",
      TICKET_NOT_FOUND: 'Persona non trovata in lista.',
      TICKET_NOT_CREATED: 'Non siamo riusciti a creare il ticket.',
    };

    return error ? (messages[error] ?? error) : 'Registrazione non riuscita.';
  }

  private isAcceptedTicket(status: TicketStatus): boolean {
    return status === 'accepted' || status === 'paid';
  }
}
