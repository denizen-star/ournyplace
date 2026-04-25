const { saveCriterion, deleteCriterion, updateCriterion, reorderCriteria } = require('../../lib/apartmentRepository');
const { json, parseBody, numberOrNull, stringOrNull } = require('../../lib/http');

exports.handler = async (event) => {
  try {
    const body = parseBody(event);
    if (!body) return json(400, { error: 'Invalid request body' });

    if (event.httpMethod === 'POST') {
      const label = stringOrNull(body.label);
      if (!label) return json(400, { error: 'label is required' });
      const w = numberOrNull(body.weight);
      const id = await saveCriterion(label, stringOrNull(body.definition), w == null ? 1 : w);
      return json(200, { success: true, id });
    }

    if (event.httpMethod === 'PUT') {
      if (Array.isArray(body.orderedIds)) {
        const ids = body.orderedIds.map((x) => numberOrNull(x)).filter((id) => id != null && id > 0);
        if (!ids.length) return json(400, { error: 'orderedIds must be a non-empty array of ids' });
        await reorderCriteria(ids);
        return json(200, { success: true });
      }
      const id = numberOrNull(body.id);
      if (!id) return json(400, { error: 'id is required' });
      const label = stringOrNull(body.label);
      if (!label) return json(400, { error: 'label is required' });
      const weight = numberOrNull(body.weight);
      await updateCriterion(id, label, stringOrNull(body.definition), weight == null ? 1 : weight);
      return json(200, { success: true });
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
