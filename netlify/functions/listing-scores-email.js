const { getApartmentById } = require('../../lib/apartmentRepository');
const { json, parseBody, numberOrNull } = require('../../lib/http');
const { sendListingScoresCompleteEmail } = require('../../lib/listingAddedMailer');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  const body = parseBody(event) || {};
  const apartmentId = numberOrNull(body.id);
  if (!apartmentId) {
    return json(400, { error: 'id is required' });
  }

  const data = await getApartmentById(apartmentId);
  if (!data || !data.apartment) {
    return json(404, { error: 'Apartment not found' });
  }

  const result = await sendListingScoresCompleteEmail(apartmentId, { manual: true });
  if (result.error) {
    return json(500, { error: result.error });
  }
  if (!result.sent) {
    return json(400, {
      error:
        result.reason === 'incomplete'
          ? 'Both partners must score every criterion (no N/A) before sending.'
          : 'Email not configured (set NYHOME_SMTP_* and NYHOME_EMAIL_TO) or send failed.',
      code: result.reason === 'incomplete' ? 'INCOMPLETE_SCORES' : 'EMAIL_SKIPPED',
    });
  }
  return json(200, { success: true, to: result.to, subject: result.subject });
};
