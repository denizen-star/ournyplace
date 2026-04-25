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
  'archived',
];

const ALLOWED = new Set(STATUS_ORDER);

function normalizeStatus(input) {
  const s = String(input == null ? '' : input).trim();
  return ALLOWED.has(s) ? s : 'new';
}

/** First 11 values: prev/next navigation (excludes terminal rejected / archived) */
const STATUS_NAV = STATUS_ORDER.filter(function (s) {
  return s !== 'rejected' && s !== 'archived';
});

module.exports = {
  normalizeStatus,
  STATUS_ORDER,
  STATUS_NAV,
};
