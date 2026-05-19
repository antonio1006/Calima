const { json, methodNotAllowed, readJson, setSessionCookie } = require('../_lib/http');
const { sendWelcomeEmail } = require('../_lib/email');
const { adminClient, anonClient, toAppUser } = require('../_lib/supabase');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res);

  try {
    const body = await readJson(req);
    const name = String(body.name || '').trim();
    const email = String(body.email || '')
      .trim()
      .toLowerCase();
    const phone = String(body.phone || '').trim();
    const password = String(body.password || '');

    if (!name || !email || !password) {
      return json(res, 400, { error: 'MISSING_FIELDS' });
    }

    const supabase = adminClient();
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: name,
        phone,
        role: 'client',
      },
    });

    if (authError || !authData.user) {
      return json(res, 409, { error: 'ACCOUNT_ALREADY_EXISTS' });
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .insert({
        auth_user_id: authData.user.id,
        full_name: name,
        email,
        phone,
        role: 'client',
      })
      .select('id, auth_user_id, full_name, email, phone, role')
      .single();

    if (profileError) {
      throw profileError;
    }

    const auth = anonClient();
    const { data: sessionData, error: sessionError } = await auth.auth.signInWithPassword({
      email,
      password,
    });

    if (sessionError || !sessionData.session) {
      throw sessionError || new Error('SESSION_NOT_CREATED');
    }

    await sendWelcomeEmail({ email, name });
    setSessionCookie(res, sessionData.session.access_token);
    return json(res, 201, { user: toAppUser(profile) });
  } catch (error) {
    return json(res, error.statusCode || 500, { error: error.message || 'REGISTRATION_FAILED' });
  }
};
