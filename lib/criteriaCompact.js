/**
 * Per-partner primary criteria when compact voting is on (exact `nyp_criteria.label` values).
 * Keep in sync with `assets/js/criteriaCompact.js` for Nyhome frontend.
 */

const PETER_PRIMARY_LABELS = new Set([
  'Building location',
  'Transit Access',
  'Storage',
  'Natural Light',
  'Unit Layout',
  'Laundry',
]);

const KERV_PRIMARY_LABELS = new Set([
  'Building location',
  'Transit Access',
  'Financials',
  'Bedroom location',
  'Noise Profile',
  'Unit Layout',
]);

function criterionLabel(criterion) {
  return criterion && criterion.label != null ? String(criterion.label).trim() : '';
}

function isPrimaryCriterionForPartner(criterion, partnerKey) {
  const label = criterionLabel(criterion);
  if (!label) return false;
  if (partnerKey === 'peter') return PETER_PRIMARY_LABELS.has(label);
  if (partnerKey === 'kerv') return KERV_PRIMARY_LABELS.has(label);
  return false;
}

/** True if this row is in at least one partner’s compact set (for shared UI sections). */
function isPrimaryForAnyPartner(criterion) {
  return isPrimaryCriterionForPartner(criterion, 'peter') || isPrimaryCriterionForPartner(criterion, 'kerv');
}

/** Criteria used to compute one partner’s weighted % when compact voting is on. */
function criteriaForPartnerScoring(criteria, partnerKey, compactVoting) {
  const list = Array.isArray(criteria) ? criteria : [];
  if (!compactVoting) return list;
  return list.filter((c) => isPrimaryCriterionForPartner(c, partnerKey));
}

module.exports = {
  isPrimaryCriterionForPartner,
  isPrimaryForAnyPartner,
  criteriaForPartnerScoring,
};
