function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

function parseBody(event) {
  try {
    return JSON.parse(event.body || '{}');
  } catch {
    return null;
  }
}

function toCents(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number * 100) : null;
}

function numberOrNull(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function stringOrNull(value) {
  if (value == null) return null;
  const string = String(value).trim();
  return string || null;
}

/** DELETE bodies are often stripped by API gateways; prefer ?id= on the client with JSON body as fallback. */
function deleteRequestId(event, body) {
  const qs = event.queryStringParameters || {};
  const fromBody = body ? numberOrNull(body.id) : null;
  const fromQs = numberOrNull(qs.id);
  return fromBody ?? fromQs ?? null;
}

module.exports = { json, parseBody, toCents, numberOrNull, stringOrNull, deleteRequestId };
