const { getApartmentPayload, getApartmentById, saveApartment, deleteApartment } = require('../../lib/apartmentRepository');
const { normalizeStatus } = require('../../lib/apartmentStatus');
const { json, parseBody, toCents, numberOrNull, stringOrNull, deleteRequestId } = require('../../lib/http');
const { sendListingAddedEmail } = require('../../lib/listingAddedMailer');

exports.handler = async (event) => {
  try {
    if (event.httpMethod === 'GET') {
      const qs = event.queryStringParameters || {};
      const rawId = qs.id;
      if (rawId != null && String(rawId).trim() !== '') {
        const detail = await getApartmentById(rawId);
        if (!detail) return json(404, { error: 'Apartment not found' });
        return json(200, {
          criteria: detail.criteria,
          neighborhoods: detail.neighborhoods,
          apartment: detail.apartment,
        });
      }
      return json(200, await getApartmentPayload());
    }

    const body = parseBody(event);
    if (!body) return json(400, { error: 'Invalid request body' });

    if (event.httpMethod === 'POST' || event.httpMethod === 'PUT') {
      const address = stringOrNull(body.address);
      if (!address) return json(400, { error: 'address is required' });

      const ignoreBlacklist = Boolean(body.ignoreBlacklist);

      const id = await saveApartment({
        id: numberOrNull(body.id),
        address,
        aptNumber: stringOrNull(body.aptNumber),
        neighborhood: stringOrNull(body.neighborhood),
        rentCents: toCents(body.rent),
        netEffectiveCents: toCents(body.netEffective),
        brokerFeeCents: toCents(body.brokerFee),
        depositCents: toCents(body.deposit),
        amenitiesFeesCents: toCents(body.amenitiesFees),
        totalMoveInCents: toCents(body.totalMoveIn),
        bedrooms: numberOrNull(body.bedrooms),
        bathrooms: numberOrNull(body.bathrooms),
        squareFeet: numberOrNull(body.squareFeet),
        unitFeatures: Array.isArray(body.unitFeatures) ? body.unitFeatures.map(stringOrNull).filter(Boolean) : [],
        amenities: Array.isArray(body.amenities) ? body.amenities.map(stringOrNull).filter(Boolean) : [],
        moveInDate: stringOrNull(body.moveInDate),
        listingUrl: stringOrNull(body.listingUrl),
        sourceUrl: stringOrNull(body.sourceUrl),
        importStatus: stringOrNull(body.importStatus) || 'manual',
        status: normalizeStatus(stringOrNull(body.status)),
        notes: stringOrNull(body.notes),
        listingStar: (() => {
          const raw = body.listingStar;
          if (raw === null || raw === undefined || raw === '') return null;
          const n = Number(raw);
          if (!Number.isFinite(n) || n < 1 || n > 3) return null;
          return n;
        })(),
        imageUrls: Array.isArray(body.imageUrls) ? body.imageUrls.map(stringOrNull).filter(Boolean) : [],
        touredData: body.touredData != null && typeof body.touredData === 'object' ? body.touredData : null,
        ignoreBlacklist,
      });
      const incomingId = numberOrNull(body.id);
      if (event.httpMethod === 'POST' && (!incomingId || incomingId <= 0)) {
        sendListingAddedEmail(id).catch((e) => console.error('[apartments] listing-added email', e));
      }
      return json(200, { success: true, id });
    }

    if (event.httpMethod === 'DELETE') {
      const id = deleteRequestId(event, body);
      if (!id) return json(400, { error: 'id is required' });
      await deleteApartment(id);
      return json(200, { success: true });
    }

    return json(405, { error: 'Method not allowed' });
  } catch (err) {
    if (err.code === 'DUPLICATE_LISTING') {
      return json(409, { error: err.message, code: err.code, existingId: err.existingId });
    }
    if (err.code === 'BLACKLISTED') {
      return json(409, {
        error: err.message,
        code: err.code,
        blacklistId: err.blacklistId,
        displayAddress: err.displayAddress,
      });
    }
    console.error('[apartments] Error:', err.message);
    if (err.code === 'INVALID_TOURED_DATA') {
      return json(400, { error: err.message, code: err.code });
    }
    if (typeof err.message === 'string' && /Unknown column ['`]?listing_star/i.test(err.message)) {
      return json(500, {
        code: 'MISSING_LISTING_STAR_COLUMN',
        error: 'Database is missing listing_star. Run npm run migrate against DATABASE_URL.',
      });
    }
    if (typeof err.message === 'string' && /Unknown column ['`]?toured_data/i.test(err.message)) {
      return json(500, {
        code: 'MISSING_TOURED_DATA_COLUMN',
        error: 'Database is missing toured_data. Run npm run migrate against DATABASE_URL.',
      });
    }
    return json(500, { error: 'Something went wrong' });
  }
};
