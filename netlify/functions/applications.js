const { saveApplication } = require('../../lib/apartmentRepository');
const { json, parseBody, numberOrNull, stringOrNull } = require('../../lib/http');

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

    const body = parseBody(event);
    if (!body) return json(400, { error: 'Invalid request body' });

    const apartmentId = numberOrNull(body.apartmentId);
    if (!apartmentId) return json(400, { error: 'apartmentId is required' });

    const id = await saveApplication({
      apartmentId,
      status: stringOrNull(body.status),
      brokerName: stringOrNull(body.brokerName),
      brokerContact: stringOrNull(body.brokerContact),
      deadlineAt: stringOrNull(body.deadlineAt),
      notes: stringOrNull(body.notes),
    });
    return json(200, { success: true, id });
  } catch (err) {
    console.error('[applications] Error:', err.message);
    return json(500, { error: 'Something went wrong' });
  }
};
