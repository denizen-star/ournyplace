const { saveVisit } = require('../../lib/apartmentRepository');
const { json, parseBody, numberOrNull, stringOrNull } = require('../../lib/http');

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

    const body = parseBody(event);
    if (!body) return json(400, { error: 'Invalid request body' });

    const apartmentId = numberOrNull(body.apartmentId);
    if (!apartmentId) return json(400, { error: 'apartmentId is required' });

    const id = await saveVisit({
      apartmentId,
      visitAt: stringOrNull(body.visitAt),
      notes: stringOrNull(body.notes),
      outcome: stringOrNull(body.outcome),
    });
    return json(200, { success: true, id });
  } catch (err) {
    console.error('[visits] Error:', err.message);
    return json(500, { error: 'Something went wrong' });
  }
};
