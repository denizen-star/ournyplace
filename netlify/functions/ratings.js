const { saveRating, getApartmentById, setListingScoresCompleteEmailSent } = require('../../lib/apartmentRepository');
const { json, parseBody, numberOrNull, stringOrNull } = require('../../lib/http');
const { sendListingScoresCompleteEmail } = require('../../lib/listingAddedMailer');
const { isBothPartnersVotingComplete } = require('../../lib/votingComplete');

const ALLOWED_PARTNERS = new Set(['kerv', 'peter']);

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

    const body = parseBody(event);
    if (!body) return json(400, { error: 'Invalid request body' });

    const apartmentId = numberOrNull(body.apartmentId);
    const criterionId = numberOrNull(body.criterionId);
    const partnerKey = stringOrNull(body.partnerKey);
    if (!apartmentId || !criterionId || !partnerKey) {
      return json(400, { error: 'apartmentId, partnerKey, and criterionId are required' });
    }
    if (!Object.prototype.hasOwnProperty.call(body, 'score')) {
      return json(400, { error: 'score is required (0–5 or null for N/A)' });
    }
    if (!ALLOWED_PARTNERS.has(partnerKey)) {
      return json(400, { error: 'partnerKey must be kerv or peter' });
    }
    let score;
    if (body.score === null) {
      score = null;
    } else {
      const n = numberOrNull(body.score);
      if (n == null || !Number.isInteger(n) || n < 0 || n > 5) {
        return json(400, { error: 'score must be an integer from 0 to 5, or null for N/A' });
      }
      score = n;
    }

    const voteChanged = await saveRating({
      apartmentId,
      partnerKey,
      criterionId,
      score,
      notes: stringOrNull(body.notes),
    });

    const out = { success: true };
    try {
      const data = await getApartmentById(apartmentId);
      if (data) {
        out.ratings = data.apartment.ratings;
        out.scores = data.apartment.scores;
        if (voteChanged) {
          const complete = isBothPartnersVotingComplete(
            data.criteria,
            data.apartment.ratings,
            Boolean(data.compactVoting)
          );
          if (!complete) {
            await setListingScoresCompleteEmailSent(apartmentId, false);
          } else {
            const sentFlag = data.apartment.listing_scores_complete_email_sent;
            const alreadySent = sentFlag === true || sentFlag === 1 || sentFlag === '1';
            if (!alreadySent) {
              const r = await sendListingScoresCompleteEmail(apartmentId, { auto: true });
              if (r.sent) out.scoresCompleteEmailSent = true;
            }
          }
        }
      }
    } catch (e) {
      console.error('[ratings] refresh apartment after vote', e);
    }
    return json(200, out);
  } catch (err) {
    console.error('[ratings] Error:', err.message);
    return json(500, { error: 'Something went wrong' });
  }
};
