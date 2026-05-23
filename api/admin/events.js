const { json, methodNotAllowed, readJson } = require('../_lib/http');
const { buildStats, toAppEvent, toDbEvent } = require('../_lib/mappers');
const { adminClient, requireAdmin } = require('../_lib/supabase');

async function persistImage(supabase, image) {
  if (!image || !image.startsWith('data:image/')) {
    return image || '/calima-event-cover.svg';
  }

  const match = image.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) {
    return '/calima-event-cover.svg';
  }

  const contentType = match[1];
  const extension = contentType.split('/')[1].replace('jpeg', 'jpg').replace('svg+xml', 'svg');
  const fileName = `events/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
  const buffer = Buffer.from(match[2], 'base64');
  const bucket = process.env.SUPABASE_EVENT_IMAGES_BUCKET || 'eventi';

  const { error } = await supabase.storage
    .from(bucket)
    .upload(fileName, buffer, { contentType, upsert: true });

  if (error) {
    throw new Error(`STORAGE_UPLOAD_FAILED: ${error.message}`);
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(fileName);
  return data.publicUrl;
}

async function listEvents(supabase) {
  const { data: events, error: eventsError } = await supabase
    .from('events')
    .select('*')
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
  return events.map((event) => toAppEvent(event, stats.get(event.id)));
}

module.exports = async function handler(req, res) {
  if (!['GET', 'POST', 'PATCH', 'DELETE'].includes(req.method)) return methodNotAllowed(res);

  try {
    await requireAdmin(req);
    const supabase = adminClient();

    if (req.method === 'GET') {
      return json(res, 200, { events: await listEvents(supabase) });
    }

    const body = await readJson(req);

    if (req.method === 'POST') {
      const { data, error } = await supabase
        .from('events')
        .insert({
          name: 'Nuovo evento',
          event_date: new Date().toISOString().slice(0, 10),
          event_time: '20:00',
          city: 'Milano',
          venue: 'Location',
          capacity: 100,
          price_cents: 0,
          image_path: '/calima-logo.webp',
          description: 'Descrizione evento.',
          is_published: true,
        })
        .select('*')
        .single();

      if (error) throw error;
      return json(res, 201, { event: toAppEvent(data) });
    }

    if (req.method === 'PATCH') {
      const event = body.event;
      if (!event?.id) {
        return json(res, 400, { error: 'MISSING_EVENT' });
      }

      const payload = toDbEvent(event);
      payload.image_path = await persistImage(supabase, payload.image_path);

      const { data, error } = await supabase
        .from('events')
        .update(payload)
        .eq('id', event.id)
        .select('*')
        .single();

      if (error) throw error;
      return json(res, 200, { event: toAppEvent(data) });
    }

    if (req.method === 'DELETE') {
      const id = body.id;
      if (!id) {
        return json(res, 400, { error: 'MISSING_EVENT_ID' });
      }

      const { error } = await supabase.from('events').delete().eq('id', id);
      if (error) throw error;
      return json(res, 200, { ok: true });
    }
  } catch (error) {
    return json(res, error.statusCode || 500, { error: error.message || 'ADMIN_EVENTS_FAILED' });
  }
};
