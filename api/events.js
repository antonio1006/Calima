const { json, methodNotAllowed } = require('./_lib/http');
const { buildStats, toAppEvent } = require('./_lib/mappers');
const { adminClient } = require('./_lib/supabase');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res);

  try {
    const supabase = adminClient();
    const { data: events, error: eventsError } = await supabase
      .from('events')
      .select('*')
      .eq('is_published', true)
      .order('event_date', { ascending: true });

    if (eventsError) throw eventsError;

    const eventIds = events.map((event) => event.id);
    const { data: tickets, error: ticketsError } = eventIds.length
      ? await supabase
          .from('tickets')
          .select('event_id, payment_status, checked_in')
          .in('event_id', eventIds)
      : { data: [], error: null };

    if (ticketsError) throw ticketsError;

    const stats = buildStats(events, tickets || []);
    return json(res, 200, {
      events: events.map((event) => toAppEvent(event, stats.get(event.id))),
    });
  } catch (error) {
    return json(res, error.statusCode || 500, { error: error.message || 'EVENTS_FAILED' });
  }
};
