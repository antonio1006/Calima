export type TicketStatus = 'paid' | 'pending' | 'cancelled' | 'refunded';
export type UserRole = 'client' | 'scanner' | 'admin';

export interface EventItem {
  id: string;
  name: string;
  date: string;
  time: string;
  city: string;
  venue: string;
  capacity: number;
  price: number;
  image: string;
  description: string;
  stats?: EventStats;
}

export interface Ticket {
  id: string;
  eventId: string;
  firstName: string;
  lastName: string;
  birthDate: string;
  email: string;
  phone: string;
  paymentStatus: TicketStatus;
  checkedIn: boolean;
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
