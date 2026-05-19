const { json, methodNotAllowed } = require('../_lib/http');
const { currentProfile, toAppUser } = require('../_lib/supabase');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res);

  try {
    const profile = await currentProfile(req);
    return json(res, 200, { user: profile ? toAppUser(profile) : null });
  } catch (error) {
    return json(res, 200, { user: null });
  }
};
