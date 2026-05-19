const { json, methodNotAllowed } = require('../_lib/http');
const { toAppTicket } = require('../_lib/mappers');
const { adminClient, currentProfile } = require('../_lib/supabase');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res);

  try {
    const profile = await currentProfile(req);
    if (!profile) {
      return json(res, 401, { error: 'UNAUTHORIZED' });
    }

    const email = profile.role === 'admin' ? req.query.email || profile.email : profile.email;
    const { data, error } = await adminClient()
      .from('tickets')
      .select('*')
      .eq('email', String(email).trim().toLowerCase())
      .order('created_at', { ascending: false });

    if (error) throw error;

    return json(res, 200, { tickets: (data || []).map(toAppTicket) });
  } catch (error) {
    return json(res, error.statusCode || 500, { error: error.message || 'TICKETS_FAILED' });
  }
};
