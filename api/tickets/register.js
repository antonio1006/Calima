const { json, methodNotAllowed } = require('../_lib/http');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res);
  return json(res, 403, { error: 'REGISTRATION_DISABLED' });
};
