const { saveVisit, deleteVisit } = require('../../lib/apartmentRepository');
const { json, parseBody, numberOrNull, stringOrNull } = require('../../lib/http');

exports.handler = async (event) => {
  try {
    if (event.httpMethod === 'POST') {
      const body = parseBody(event);
      if (!body) return json(400, { error: 'Invalid request body' });

      const apartmentId = numberOrNull(body.apartmentId);
      if (!apartmentId) return json(400, { error: 'apartmentId is required' });

      const id = await saveVisit({
        apartmentId,
        visitAt: stringOrNull(body.visitAt),
        schedulingNotes: body.schedulingNotes !== undefined ? stringOrNull(body.schedulingNotes) : undefined,
        touredNotes: stringOrNull(body.touredNotes),
        notes: stringOrNull(body.notes), // legacy fallback consumed by saveVisit
        outcome: stringOrNull(body.outcome),
      });
      return json(200, { success: true, id });
    }

    if (event.httpMethod === 'DELETE') {
      const qs = event.queryStringParameters || {};
      const apartmentId = numberOrNull(qs.apartmentId);
      if (!apartmentId) return json(400, { error: 'apartmentId is required' });
      await deleteVisit(apartmentId);
      return json(200, { success: true });
    }

    return json(405, { error: 'Method not allowed' });
  } catch (err) {
    console.error('[visits] Error:', err.message);
    return json(500, { error: 'Something went wrong' });
  }
};
