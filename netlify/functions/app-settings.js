const { json, parseBody } = require('../../lib/http');
const { getCompactVoting, setCompactVoting } = require('../../lib/appSettingsRepository');

exports.handler = async (event) => {
  try {
    if (event.httpMethod === 'GET') {
      const compactVoting = await getCompactVoting();
      return json(200, { compactVoting });
    }

    if (event.httpMethod === 'PUT') {
      const body = parseBody(event);
      if (!body || typeof body.compactVoting !== 'boolean') {
        return json(400, { error: 'compactVoting (boolean) is required' });
      }
      await setCompactVoting(body.compactVoting);
      return json(200, { success: true, compactVoting: body.compactVoting });
    }

    return json(405, { error: 'Method not allowed' });
  } catch (err) {
    console.error('[app-settings]', err.message);
    return json(500, { error: 'Something went wrong' });
  }
};
