const { isPrimaryCriterionForPartner } = require('./criteriaCompact');

function isValidNumericVote(v) {
  if (v == null) return false;
  const n = Number(v);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0 || n > 5) return false;
  return true;
}

/**
 * Both partners scored every active criterion with a numeric 0–5 (not N/A / NULL),
 * or — when `compactVoting` — every criterion each partner lists as primary for them.
 * Mirrors client `details.js` / server `calculateScores` gating for "Avg" readiness.
 */
function isBothPartnersVotingComplete(criteria, ratings, compactVoting) {
  if (!Array.isArray(criteria) || criteria.length === 0) return false;
  const rk = ratings && ratings.kerv ? ratings.kerv : {};
  const rp = ratings && ratings.peter ? ratings.peter : {};
  if (!compactVoting) {
    for (let i = 0; i < criteria.length; i++) {
      const cid = criteria[i].id;
      if (!isValidNumericVote(rk[cid]) || !isValidNumericVote(rp[cid])) return false;
    }
    return true;
  }
  for (let i = 0; i < criteria.length; i++) {
    const c = criteria[i];
    const cid = c.id;
    if (isPrimaryCriterionForPartner(c, 'kerv') && !isValidNumericVote(rk[cid])) return false;
    if (isPrimaryCriterionForPartner(c, 'peter') && !isValidNumericVote(rp[cid])) return false;
  }
  return true;
}

module.exports = {
  isBothPartnersVotingComplete,
};
