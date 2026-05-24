function moneyToCents(value) {
  return Math.round(Number(value || 0) * 100);
}

function centsToMoney(value) {
  return Number(value || 0) / 100;
}

function toImageUrl(value) {
  if (!value) return '/calima-logo.webp';
  if (value.startsWith('http') || value.startsWith('/') || value.startsWith('data:image/')) {
    return value;
  }

  return `/${value}`;
}

function toAppEvent(row, stats) {
  return {
    id: row.id,
    name: row.name,
    date: row.event_date,
    time: String(row.event_time || '').slice(0, 5),
    city: row.city,
    venue: row.venue,
    capacity: row.capacity,
    price: centsToMoney(row.price_cents),
    image: toImageUrl(row.image_path),
    description: row.description,
    stats,
  };
}

function toDbEvent(event) {
  return {
    name: event.name,
    event_date: event.date,
    event_time: event.time,
    city: event.city,
    venue: event.venue,
    capacity: Number(event.capacity),
    price_cents: moneyToCents(event.price),
    image_path: event.image || '/calima-logo.webp',
    description: event.description,
    is_published: true,
  };
}

function toAppTicket(row) {
  return {
    id: row.public_code || row.id,
    eventId: row.event_id,
    firstName: row.first_name,
    lastName: row.last_name,
    birthDate: row.birth_date,
    email: row.email,
    phone: row.phone,
    paymentStatus: row.payment_status,
    checkedIn: row.checked_in,
    createdAt: row.created_at,
  };
}

function buildStats(events, tickets) {
  const stats = new Map();
  const activeStatuses = new Set(['accepted', 'paid']);

  for (const event of events) {
    stats.set(event.id, {
      sold: 0,
      checkedIn: 0,
      revenue: 0,
      remaining: event.capacity,
    });
  }

  for (const ticket of tickets) {
    const item = stats.get(ticket.event_id);
    const event = events.find((candidate) => candidate.id === ticket.event_id);
    if (!item || !event || !activeStatuses.has(ticket.payment_status)) continue;

    item.sold += 1;
    item.checkedIn += ticket.checked_in ? 1 : 0;
    item.revenue += ticket.payment_status === 'paid' ? centsToMoney(event.price_cents) : 0;
    item.remaining = Math.max(0, event.capacity - item.sold);
  }

  return stats;
}

module.exports = {
  buildStats,
  toAppEvent,
  toAppTicket,
  toDbEvent,
};
