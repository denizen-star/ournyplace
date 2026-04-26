/**
 * Single source of truth for apartment `status` allow-list (matches DB and ORDER BY).
 * Keep in sync with /assets/js/apartmentStatus.js (public bundle).
 */
const STATUS_ORDER = [
  'new',
  'evaluating',
  'shortlisted',
  'tour_scheduled',
  'toured',
  'finalist',
  'applying',
  'applied',
  'approved',
  'lease_review',
  'signed',
  'rejected',
  'blacklisted',
  'archived',
];

const ALLOWED = new Set(STATUS_ORDER);

function normalizeStatus(input) {
  const s = String(input == null ? '' : input).trim();
  return ALLOWED.has(s) ? s : 'new';
}

/** First segment: prev/next navigation (excludes terminal statuses) */
const STATUS_NAV = STATUS_ORDER.filter(function (s) {
  return s !== 'rejected' && s !== 'archived' && s !== 'blacklisted';
});

module.exports = {
  normalizeStatus,
  STATUS_ORDER,
  STATUS_NAV,
};
