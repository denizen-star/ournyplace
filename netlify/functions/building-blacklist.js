const { json, parseBody, numberOrNull, stringOrNull, deleteRequestId } = require('../../lib/http');
const { parseListingText } = require('../../lib/listingTextParse');
const {
  listBuildingBlacklist,
  createBlacklistEntry,
  updateBlacklistEntry,
  deleteBlacklistEntry,
} = require('../../lib/buildingBlacklistRepository');

exports.handler = async (event) => {
  try {
    if (event.httpMethod === 'GET') {
      const entries = await listBuildingBlacklist();
      return json(200, { entries });
    }

    const body = parseBody(event);
    if (!body) return json(400, { error: 'Invalid request body' });

    if (event.httpMethod === 'POST') {
      let address = stringOrNull(body.address);
      const rawPaste = stringOrNull(body.rawPaste);
      if (!address && rawPaste) {
        const parsed = parseListingText(rawPaste);
        if (parsed && parsed.address) address = parsed.address;
      }
      if (!address) {
        return json(400, {
          error: 'Provide a street address or paste listing text that includes a detectable address line.',
        });
      }
      const notes = stringOrNull(body.notes);
      const id = await createBlacklistEntry({
        address,
        notes,
        sourceApartmentId: numberOrNull(body.sourceApartmentId),
      });
      return json(200, { success: true, id });
    }

    if (event.httpMethod === 'PUT') {
      const id = numberOrNull(body.id);
      if (!id) return json(400, { error: 'id is required' });
      await updateBlacklistEntry(id, {
        displayAddress: stringOrNull(body.displayAddress),
        notes: stringOrNull(body.notes),
      });
      return json(200, { success: true });
    }

    if (event.httpMethod === 'DELETE') {
      const id = deleteRequestId(event, body);
      if (!id) return json(400, { error: 'id is required' });
      await deleteBlacklistEntry(id);
      return json(200, { success: true });
    }

    return json(405, { error: 'Method not allowed' });
  } catch (err) {
    if (err.code === 'DUPLICATE_BLACKLIST') {
      return json(409, { error: err.message, code: err.code });
    }
    if (err.code === 'INVALID_ADDRESS') {
      return json(400, { error: err.message, code: err.code });
    }
    console.error('[building-blacklist] Error:', err.message);
    return json(500, { error: 'Something went wrong' });
  }
};
