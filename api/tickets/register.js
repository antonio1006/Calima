const { sendTicketEmail } = require('../_lib/email');
const { json, methodNotAllowed, readJson } = require('../_lib/http');
const { toAppEvent, toAppTicket } = require('../_lib/mappers');
const { adminClient, currentProfile } = require('../_lib/supabase');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res);

  try {
    const body = await readJson(req);
    const input = {
      eventId: String(body.eventId || ''),
      firstName: String(body.firstName || '').trim(),
      lastName: String(body.lastName || '').trim(),
      birthDate: String(body.birthDate || ''),
      email: String(body.email || '')
        .trim()
        .toLowerCase(),
      phone: String(body.phone || '').trim(),
    };

    if (
      !input.eventId ||
      !input.firstName ||
      !input.lastName ||
      !input.birthDate ||
      !input.email ||
      !input.phone
    ) {
      return json(res, 400, { error: 'MISSING_FIELDS' });
    }

    const profile = await currentProfile(req);
    if (!profile) {
      return json(res, 401, { error: 'LOGIN_REQUIRED' });
    }

    if (input.email !== profile.email) {
      return json(res, 400, { error: 'EMAIL_MISMATCH' });
    }

    const supabase = adminClient();
    const { data: ticketRow, error: ticketError } = await supabase.rpc('create_ticket_atomic', {
      p_event_id: input.eventId,
      p_profile_id: profile.id,
      p_first_name: input.firstName,
      p_last_name: input.lastName,
      p_birth_date: input.birthDate,
      p_email: input.email,
      p_phone: input.phone,
    });

    if (ticketError) {
      return json(res, 409, { error: normalizeTicketError(ticketError.message) });
    }

    const { data: eventRow, error: eventError } = await supabase
      .from('events')
      .select('*')
      .eq('id', input.eventId)
      .single();

    if (eventError) throw eventError;

    const ticketRecord = Array.isArray(ticketRow) ? ticketRow[0] : ticketRow;
    if (!ticketRecord) {
      throw new Error('TICKET_NOT_CREATED');
    }

    const ticket = toAppTicket(ticketRecord);
    const event = toAppEvent(eventRow);
    const email = await sendTicketEmail({ ticket, event });

    return json(res, 201, { ticket, email });
  } catch (error) {
    return json(res, error.statusCode || 500, { error: error.message || 'TICKET_FAILED' });
  }
};

function normalizeTicketError(message = '') {
  if (message.includes('EVENT_NOT_FOUND')) {
    return 'EVENT_NOT_FOUND';
  }

  if (message.includes('EVENT_SOLD_OUT')) {
    return 'EVENT_SOLD_OUT';
  }

  if (message.includes('TICKET_ALREADY_EXISTS')) {
    return 'TICKET_ALREADY_EXISTS';
  }

  if (message.includes('invalid input syntax for type uuid')) {
    return 'INVALID_EVENT_ID';
  }

  return message || 'TICKET_FAILED';
}
