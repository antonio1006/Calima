const { createClient } = require('@supabase/supabase-js');
const { getCookie } = require('./http');

function readEnv(name, fallbackName) {
  return process.env[name] || (fallbackName ? process.env[fallbackName] : '');
}

function requiredEnv(name, fallbackName) {
  const value = readEnv(name, fallbackName);
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

function adminClient() {
  return createClient(requiredEnv('SUPABASE_URL'), requiredEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: {
      persistSession: false,
    },
  });
}

function anonClient() {
  return createClient(
    requiredEnv('SUPABASE_URL'),
    requiredEnv('SUPABASE_ANON_KEY', 'SUPABASE_PUBLISHABLE_KEY'),
    {
      auth: {
        persistSession: false,
      },
    },
  );
}

async function profileForAuthUser(supabase, user) {
  const email = String(user.email || '')
    .trim()
    .toLowerCase();
  const metadata = user.user_metadata || {};
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, auth_user_id, full_name, email, phone, birth_date, role')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (profile) {
    return profile;
  }

  const { data: emailProfile, error: emailProfileError } = await supabase
    .from('profiles')
    .select('id, auth_user_id, full_name, email, phone, birth_date, role')
    .eq('email', email)
    .maybeSingle();

  if (emailProfileError) {
    throw emailProfileError;
  }

  if (emailProfile) {
    const { data: linked, error: linkError } = await supabase
      .from('profiles')
      .update({
        auth_user_id: user.id,
        full_name: emailProfile.full_name || metadata.full_name || email,
        phone: emailProfile.phone || metadata.phone || '',
        birth_date: emailProfile.birth_date || metadata.birth_date || null,
      })
      .eq('id', emailProfile.id)
      .select('id, auth_user_id, full_name, email, phone, birth_date, role')
      .single();

    if (linkError) {
      throw linkError;
    }

    return linked;
  }

  const { data: created, error: createError } = await supabase
    .from('profiles')
    .insert({
      auth_user_id: user.id,
      full_name: metadata.full_name || email,
      email,
      phone: metadata.phone || '',
      birth_date: metadata.birth_date || null,
      role: metadata.role || 'client',
    })
    .select('id, auth_user_id, full_name, email, phone, birth_date, role')
    .single();

  if (createError) {
    throw createError;
  }

  return created;
}

function toAppUser(profile) {
  return {
    id: profile.id,
    name: profile.full_name,
    email: profile.email,
    password: '',
    role: profile.role,
    phone: profile.phone || '',
    birthDate: profile.birth_date || undefined,
  };
}

async function currentProfile(req) {
  const token = getCookie(req, 'calima_session');
  if (!token) return null;

  const auth = anonClient();
  const { data, error } = await auth.auth.getUser(token);
  if (error || !data.user) return null;

  const supabase = adminClient();
  return profileForAuthUser(supabase, data.user);
}

async function requireAdmin(req) {
  const profile = await currentProfile(req);
  if (!profile || profile.role !== 'admin') {
    const error = new Error('FORBIDDEN');
    error.statusCode = 403;
    throw error;
  }

  return profile;
}

module.exports = {
  adminClient,
  anonClient,
  currentProfile,
  profileForAuthUser,
  requireAdmin,
  toAppUser,
};
