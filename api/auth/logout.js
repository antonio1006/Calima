const { clearSessionCookie, json, methodNotAllowed } = require('../_lib/http');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res);

  clearSessionCookie(res);
  return json(res, 200, { ok: true });
};
