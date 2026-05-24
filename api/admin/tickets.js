const { json, methodNotAllowed, readJson } = require('../_lib/http');
const { toAppTicket } = require('../_lib/mappers');
const { adminClient, requireAdmin } = require('../_lib/supabase');

const ACTIVE_STATUSES = ['accepted', 'paid'];
const MUTABLE_STATUSES = ['pending', 'accepted', 'rejected', 'cancelled'];

module.exports = async function handler(req, res) {
  if (!['GET', 'POST', 'PATCH', 'DELETE'].includes(req.method)) return methodNotAllowed(res);

  try {
    await requireAdmin(req);
    const supabase = adminClient();

    if (req.method === 'GET') {
      const eventId = String(req.query.eventId || '');
      if (!eventId) return json(res, 400, { error: 'MISSING_EVENT_ID' });

      const { data, error } = await supabase
        .from('tickets')
        .select('*')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return json(res, 200, { tickets: (data || []).map(toAppTicket) });
    }

    const body = await readJson(req);

    if (req.method === 'POST') {
      const input = normalizeTicketInput(body);
      if (!isCompleteTicketInput(input)) return json(res, 400, { error: 'MISSING_FIELDS' });

      const duplicate = await findActiveTicketByEmail(supabase, input.eventId, input.email);
      if (duplicate) return json(res, 409, { error: 'TICKET_ALREADY_EXISTS' });

      const capacity = await checkCapacity(supabase, input.eventId, null);
      if (!capacity.ok) return json(res, capacity.status, { error: capacity.error });

      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', input.email)
        .maybeSingle();

      const { data, error } = await supabase
        .from('tickets')
        .insert({
          event_id: input.eventId,
          profile_id: profile?.id || null,
          first_name: input.firstName,
          last_name: input.lastName,
          birth_date: input.birthDate,
          email: input.email,
          phone: input.phone,
          payment_status: 'accepted',
        })
        .select('*')
        .single();

      if (error) throw error;
      return json(res, 201, { ticket: toAppTicket(data) });
    }

    if (req.method === 'PATCH') {
      const id = String(body.id || '');
      const status = String(body.status || '');
      if (!id || !MUTABLE_STATUSES.includes(status)) {
        return json(res, 400, { error: 'INVALID_TICKET_STATUS' });
      }

      const current = await findTicketByPublicId(supabase, id);
      if (!current) return json(res, 404, { error: 'TICKET_NOT_FOUND' });

      if (status === 'accepted' && !ACTIVE_STATUSES.includes(current.payment_status)) {
        const capacity = await checkCapacity(supabase, current.event_id, current.id);
        if (!capacity.ok) return json(res, capacity.status, { error: capacity.error });
      }

      const payload = {
        payment_status: status,
        checked_in: status === 'accepted' ? current.checked_in : false,
        checked_in_at: status === 'accepted' ? current.checked_in_at : null,
      };

      const { data, error } = await supabase
        .from('tickets')
        .update(payload)
        .eq('id', current.id)
        .select('*')
        .single();

      if (error) throw error;
      return json(res, 200, { ticket: toAppTicket(data) });
    }

    if (req.method === 'DELETE') {
      const id = String(body.id || '');
      if (!id) return json(res, 400, { error: 'MISSING_TICKET_ID' });

      const current = await findTicketByPublicId(supabase, id);
      if (!current) return json(res, 404, { error: 'TICKET_NOT_FOUND' });

      const { error } = await supabase.from('tickets').delete().eq('id', current.id);
      if (error) throw error;
      return json(res, 200, { ok: true });
    }
  } catch (error) {
    return json(res, error.statusCode || 500, { error: error.message || 'ADMIN_TICKETS_FAILED' });
  }
};

function normalizeTicketInput(body) {
  return {
    eventId: String(body.eventId || ''),
    firstName: String(body.firstName || '').trim(),
    lastName: String(body.lastName || '').trim(),
    birthDate: String(body.birthDate || ''),
    email: String(body.email || '')
      .trim()
      .toLowerCase(),
    phone: String(body.phone || '').trim(),
  };
}

function isCompleteTicketInput(input) {
  return (
    input.eventId &&
    input.firstName &&
    input.lastName &&
    input.birthDate &&
    input.email &&
    input.phone
  );
}

async function findTicketByPublicId(supabase, id) {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    id,
  );
  const query = supabase.from('tickets').select('*').limit(1);
  const { data, error } = await (isUuid ? query.eq('id', id) : query.eq('public_code', id));

  if (error) throw error;
  return data?.[0] || null;
}

async function findActiveTicketByEmail(supabase, eventId, email) {
  const { data, error } = await supabase
    .from('tickets')
    .select('id')
    .eq('event_id', eventId)
    .eq('email', email)
    .in('payment_status', ['pending', ...ACTIVE_STATUSES])
    .limit(1);

  if (error) throw error;
  return data?.[0] || null;
}

async function checkCapacity(supabase, eventId, excludedTicketId) {
  const { data: event, error: eventError } = await supabase
    .from('events')
    .select('capacity')
    .eq('id', eventId)
    .single();

  if (eventError || !event) {
    return { ok: false, status: 404, error: 'EVENT_NOT_FOUND' };
  }

  let countQuery = supabase
    .from('tickets')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', eventId)
    .in('payment_status', ACTIVE_STATUSES);

  if (excludedTicketId) {
    countQuery = countQuery.neq('id', excludedTicketId);
  }

  const { count, error: countError } = await countQuery;
  if (countError) throw countError;

  if ((count || 0) >= event.capacity) {
    return { ok: false, status: 409, error: 'EVENT_SOLD_OUT' };
  }

  return { ok: true };
}
