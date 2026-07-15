const { json, methodNotAllowed, readJson } = require('../_lib/http');
const { toAppTicket } = require('../_lib/mappers');
const { adminClient, requireAdmin } = require('../_lib/supabase');

const ACTIVE_STATUSES = ['accepted', 'paid'];
const MUTABLE_STATUSES = ['pending', 'accepted', 'rejected', 'cancelled'];
const PAYMENT_METHODS = ['pos', 'cash'];
const ENTRY_MODES = ['list', 'walk_in'];

module.exports = async function handler(req, res) {
  if (!['GET', 'POST', 'PATCH', 'DELETE'].includes(req.method)) return methodNotAllowed(res);

  try {
    const adminProfile = await requireAdmin(req);
    const supabase = adminClient();

    if (req.method === 'GET') {
      const eventId = String(req.query.eventId || '');
      if (!eventId) return json(res, 400, { error: 'MISSING_EVENT_ID' });

      const { data, error } = await supabase
        .from('tickets')
        .select('*')
        .eq('event_id', eventId)
        .in('payment_status', ACTIVE_STATUSES)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return json(res, 200, { tickets: (data || []).map(toAppTicket) });
    }

    const body = await readJson(req);

    if (req.method === 'POST') {
      const input = normalizeTicketInput(body);
      if (!isCompleteTicketInput(input)) return json(res, 400, { error: 'MISSING_FIELDS' });
      if (!ENTRY_MODES.includes(input.entryMode)) {
        return json(res, 400, { error: 'INVALID_ENTRY_MODE' });
      }

      const capacity = await checkCapacity(supabase, input.eventId, null);
      if (!capacity.ok) return json(res, capacity.status, { error: capacity.error });

      const { data, error } = await supabase
        .from('tickets')
        .insert({
          event_id: input.eventId,
          profile_id: null,
          first_name: input.firstName,
          last_name: input.lastName,
          birth_date: null,
          email: null,
          phone: null,
          payment_status: 'accepted',
          entry_mode: input.entryMode,
          checked_in: input.checkedIn,
          checked_in_at: input.checkedIn ? new Date().toISOString() : null,
          checked_in_by: input.checkedIn ? adminProfile.id : null,
          cash_confirmed: false,
        })
        .select('*')
        .single();

      if (error) throw error;
      return json(res, 201, { ticket: toAppTicket(data) });
    }

    if (req.method === 'PATCH') {
      const id = String(body.id || '');
      const hasStatus = body.status !== undefined;
      const hasCheckedIn = typeof body.checkedIn === 'boolean';
      const hasPaymentMethod = body.paymentMethod !== undefined;
      const hasEntryMode = body.entryMode !== undefined;
      const hasCashConfirmed = typeof body.cashConfirmed === 'boolean';
      const status = hasStatus ? String(body.status || '') : '';
      const paymentMethod = hasPaymentMethod ? String(body.paymentMethod || '') : '';
      const entryMode = hasEntryMode ? String(body.entryMode || '') : '';
      if (
        !id ||
        (!hasStatus && !hasCheckedIn && !hasPaymentMethod && !hasEntryMode && !hasCashConfirmed)
      ) {
        return json(res, 400, { error: 'MISSING_TICKET_UPDATE' });
      }

      if (hasStatus && !MUTABLE_STATUSES.includes(status)) {
        return json(res, 400, { error: 'INVALID_TICKET_STATUS' });
      }

      if (hasPaymentMethod && !PAYMENT_METHODS.includes(paymentMethod)) {
        return json(res, 400, { error: 'INVALID_PAYMENT_METHOD' });
      }

      if (hasEntryMode && !ENTRY_MODES.includes(entryMode)) {
        return json(res, 400, { error: 'INVALID_ENTRY_MODE' });
      }

      const current = await findTicketByPublicId(supabase, id);
      if (!current) return json(res, 404, { error: 'TICKET_NOT_FOUND' });

      const nextStatus = hasStatus ? status : current.payment_status;
      const nextIsActive = ACTIVE_STATUSES.includes(nextStatus);

      if (nextStatus === 'accepted' && !ACTIVE_STATUSES.includes(current.payment_status)) {
        const capacity = await checkCapacity(supabase, current.event_id, current.id);
        if (!capacity.ok) return json(res, capacity.status, { error: capacity.error });
      }

      if (hasCheckedIn && !nextIsActive) {
        return json(res, 409, { error: 'TICKET_NOT_ACCEPTED' });
      }

      const nextCheckedIn = nextIsActive
        ? hasCheckedIn
          ? body.checkedIn
          : current.checked_in
        : false;
      const nextPaymentMethod = hasPaymentMethod ? paymentMethod : current.payment_method;
      const nextEntryMode = hasEntryMode ? entryMode : current.entry_mode || 'list';
      const nextCashConfirmed =
        nextIsActive && nextCheckedIn
          ? hasCashConfirmed
            ? body.cashConfirmed
            : Boolean(current.cash_confirmed)
          : false;

      if (nextCashConfirmed && !nextPaymentMethod) {
        return json(res, 400, { error: 'TICKET_CASH_INCOMPLETE' });
      }

      const payload = {
        payment_status: nextStatus,
        payment_method: nextPaymentMethod,
        entry_mode: nextEntryMode,
        checked_in: nextCheckedIn,
        checked_in_at: nextCheckedIn ? current.checked_in_at || new Date().toISOString() : null,
        checked_in_by: nextCheckedIn ? adminProfile.id : null,
        cash_confirmed: nextCashConfirmed,
        cash_confirmed_at: nextCashConfirmed
          ? current.cash_confirmed_at || new Date().toISOString()
          : null,
        cash_confirmed_by: nextCashConfirmed ? current.cash_confirmed_by || adminProfile.id : null,
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
    entryMode: String(body.entryMode || 'list'),
    checkedIn: typeof body.checkedIn === 'boolean' ? body.checkedIn : false,
  };
}

function isCompleteTicketInput(input) {
  return input.eventId && input.firstName && input.lastName;
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
