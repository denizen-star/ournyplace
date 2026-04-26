/**
 * Normalized keys for blacklist (building-only, no unit) and duplicate listing checks (building + unit).
 */

const TOKEN_MAP = {
  st: 'street',
  street: 'street',
  ave: 'avenue',
  av: 'avenue',
  avenue: 'avenue',
  blvd: 'boulevard',
  boulevard: 'boulevard',
  rd: 'road',
  road: 'road',
  dr: 'drive',
  drive: 'drive',
  ln: 'lane',
  lane: 'lane',
  ct: 'court',
  court: 'court',
  pl: 'place',
  place: 'place',
  pkwy: 'parkway',
  parkway: 'parkway',
  ter: 'terrace',
  terrace: 'terrace',
  hwy: 'highway',
  highway: 'highway',
};

function rawTokens(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[#.,;]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
}

function expandToken(t) {
  const x = t.replace(/\.$/, '');
  return TOKEN_MAP[x] || x;
}

function normalizeBuildingKey(address) {
  return rawTokens(address)
    .map(expandToken)
    .join(' ');
}

function normalizeApt(apt) {
  return String(apt || '')
    .toLowerCase()
    .replace(/#/g, '')
    .replace(/\s+/g, '')
    .trim();
}

/** Same listing identity: normalized street + normalized unit (building blacklist ignores unit). */
function normalizeListingKey(address, aptNumber) {
  const b = normalizeBuildingKey(address);
  const a = normalizeApt(aptNumber);
  return `${b}|${a}`;
}

module.exports = {
  normalizeBuildingKey,
  normalizeListingKey,
};
