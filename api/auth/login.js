const { json, methodNotAllowed, readJson, setSessionCookie } = require('../_lib/http');
const { adminClient, anonClient, profileForAuthUser, toAppUser } = require('../_lib/supabase');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res);

  try {
    const body = await readJson(req);
    const email = String(body.email || '')
      .trim()
      .toLowerCase();
    const password = String(body.password || '');

    if (!email || !password) {
      return json(res, 400, { error: 'MISSING_CREDENTIALS' });
    }

    const auth = anonClient();
    const { data, error } = await auth.auth.signInWithPassword({ email, password });
    if (error || !data.session || !data.user) {
      return json(res, 401, { error: 'INVALID_CREDENTIALS' });
    }

    const profile = await profileForAuthUser(adminClient(), data.user);
    setSessionCookie(res, data.session.access_token);
    return json(res, 200, { user: toAppUser(profile) });
  } catch (error) {
    return json(res, error.statusCode || 500, { error: error.message || 'LOGIN_FAILED' });
  }
};
