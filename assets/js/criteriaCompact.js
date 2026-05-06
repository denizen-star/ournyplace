/**
 * Mirrors `lib/criteriaCompact.js` — keep label lists identical.
 * @global NyhomeCriteriaCompact
 */
var NyhomeCriteriaCompact = (function () {
  var PETER_PRIMARY_LABELS = {
    'Building location': 1,
    'Transit Access': 1,
    Storage: 1,
    'Natural Light': 1,
    'Unit Layout': 1,
    Laundry: 1,
  };
  var KERV_PRIMARY_LABELS = {
    'Building location': 1,
    'Transit Access': 1,
    Financials: 1,
    'Bedroom location': 1,
    'Noise Profile': 1,
    'Unit Layout': 1,
  };

  function labelOf(criterion) {
    return criterion && criterion.label != null ? String(criterion.label).trim() : '';
  }

  function isPrimaryCriterionForPartner(criterion, partnerKey) {
    var label = labelOf(criterion);
    if (!label) return false;
    if (partnerKey === 'peter') return Object.prototype.hasOwnProperty.call(PETER_PRIMARY_LABELS, label);
    if (partnerKey === 'kerv') return Object.prototype.hasOwnProperty.call(KERV_PRIMARY_LABELS, label);
    return false;
  }

  function isPrimaryForAnyPartner(criterion) {
    return isPrimaryCriterionForPartner(criterion, 'peter') || isPrimaryCriterionForPartner(criterion, 'kerv');
  }

  function criteriaForPartnerScoring(criteria, partnerKey, compactVoting) {
    var list = Array.isArray(criteria) ? criteria : [];
    if (!compactVoting) return list;
    return list.filter(function (c) {
      return isPrimaryCriterionForPartner(c, partnerKey);
    });
  }

  return {
    isPrimaryCriterionForPartner: isPrimaryCriterionForPartner,
    isPrimaryForAnyPartner: isPrimaryForAnyPartner,
    criteriaForPartnerScoring: criteriaForPartnerScoring,
  };
})();
