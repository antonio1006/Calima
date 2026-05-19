const { json, methodNotAllowed, readJson, setSessionCookie } = require('../_lib/http');
const { sendWelcomeEmail } = require('../_lib/email');
const { adminClient, anonClient, profileForAuthUser, toAppUser } = require('../_lib/supabase');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res);

  try {
    const body = await readJson(req);
    const name = String(body.name || '').trim();
    const email = String(body.email || '')
      .trim()
      .toLowerCase();
    const phone = String(body.phone || '').trim();
    const birthDate = String(body.birthDate || '');
    const password = String(body.password || '');

    const validationError = validateRegistration({ name, email, phone, birthDate, password });
    if (validationError) {
      return json(res, 400, { error: validationError });
    }

    if (!name || !email || !password || !birthDate) {
      return json(res, 400, { error: 'MISSING_FIELDS' });
    }

    const supabase = adminClient();
    let authUser = null;
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: name,
        phone,
        birth_date: birthDate,
        role: 'client',
      },
    });

    if (authError || !authData.user) {
      const existingSession = await anonClient().auth.signInWithPassword({ email, password });
      if (existingSession.error || !existingSession.data.user) {
        return json(res, 409, {
          error: 'ACCOUNT_ALREADY_EXISTS',
          detail: authError?.message,
        });
      }

      authUser = existingSession.data.user;
    } else {
      authUser = authData.user;
    }

    const profile = await profileForAuthUser(supabase, {
      ...authUser,
      email,
      user_metadata: {
        ...(authUser.user_metadata || {}),
        full_name: name,
        phone,
        birth_date: birthDate,
        role: authUser.user_metadata?.role || 'client',
      },
    });

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

function validateRegistration({ name, email, phone, birthDate, password }) {
  if (!name || name.length < 2 || !email || !phone || !birthDate || !password) {
    return 'MISSING_FIELDS';
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return 'INVALID_EMAIL';
  }

  if (!/^\+?[0-9 ]{8,18}$/.test(phone)) {
    return 'INVALID_PHONE';
  }

  if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(password)) {
    return 'WEAK_PASSWORD';
  }

  const parsedDate = new Date(`${birthDate}T00:00:00`);
  if (Number.isNaN(parsedDate.getTime())) {
    return 'INVALID_BIRTH_DATE';
  }

  const limit = new Date();
  limit.setFullYear(limit.getFullYear() - 13);
  if (parsedDate > limit) {
    return 'MINIMUM_AGE';
  }

  return null;
}
