const { saveRating } = require('../../lib/apartmentRepository');
const { json, parseBody, numberOrNull, stringOrNull } = require('../../lib/http');

const ALLOWED_PARTNERS = new Set(['kerv', 'peter']);

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

    const body = parseBody(event);
    if (!body) return json(400, { error: 'Invalid request body' });

    const apartmentId = numberOrNull(body.apartmentId);
    const criterionId = numberOrNull(body.criterionId);
    const score = numberOrNull(body.score);
    const partnerKey = stringOrNull(body.partnerKey);
    if (!apartmentId || !criterionId || !partnerKey || score == null) {
      return json(400, { error: 'apartmentId, partnerKey, criterionId, and score are required' });
    }
    if (!ALLOWED_PARTNERS.has(partnerKey)) {
      return json(400, { error: 'partnerKey must be kerv or peter' });
    }
    if (!Number.isInteger(score) || score < 0 || score > 5) {
      return json(400, { error: 'score must be an integer from 0 to 5' });
    }

    await saveRating({
      apartmentId,
      partnerKey,
      criterionId,
      score,
      notes: stringOrNull(body.notes),
    });
    return json(200, { success: true });
  } catch (err) {
    console.error('[ratings] Error:', err.message);
    return json(500, { error: 'Something went wrong' });
  }
};
