export type TicketStatus = 'paid' | 'pending' | 'accepted' | 'rejected' | 'cancelled' | 'refunded';
export type UserRole = 'admin';
export type TicketPaymentMethod = 'pos' | 'cash';
export type TicketEntryMode = 'list' | 'walk_in';

export interface EventItem {
  id: string;
  name: string;
  date: string;
  time: string;
  city: string;
  venue: string;
  capacity: number;
  price: number;
  walkInPrice: number;
  image: string;
  description: string;
  stats?: EventStats;
}

export interface Ticket {
  id: string;
  eventId: string;
  firstName: string;
  lastName: string;
  birthDate?: string;
  email?: string;
  phone?: string;
  paymentStatus: TicketStatus;
  paymentMethod?: TicketPaymentMethod;
  entryMode: TicketEntryMode;
  checkedIn: boolean;
  cashConfirmed: boolean;
  createdAt: string;
}

export interface AppUser {
  id: string;
  name: string;
  email: string;
  password: string;
  role: UserRole;
  phone: string;
  birthDate?: string;
}

export interface EventStats {
  sold: number;
  checkedIn: number;
  revenue: number;
  remaining: number;
}
