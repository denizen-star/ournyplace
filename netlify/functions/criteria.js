const { saveCriterion, deleteCriterion } = require('../../lib/apartmentRepository');
const { json, parseBody, numberOrNull, stringOrNull } = require('../../lib/http');

exports.handler = async (event) => {
  try {
    const body = parseBody(event);
    if (!body) return json(400, { error: 'Invalid request body' });

    if (event.httpMethod === 'POST') {
      const label = stringOrNull(body.label);
      if (!label) return json(400, { error: 'label is required' });
      const id = await saveCriterion(label, stringOrNull(body.definition), numberOrNull(body.weight) || 1);
      return json(200, { success: true, id });
    }

    if (event.httpMethod === 'DELETE') {
      const id = numberOrNull(body.id);
      if (!id) return json(400, { error: 'id is required' });
      await deleteCriterion(id);
      return json(200, { success: true });
    }

    return json(405, { error: 'Method not allowed' });
  } catch (err) {
    console.error('[criteria] Error:', err.message);
    return json(500, { error: 'Something went wrong' });
  }
};
