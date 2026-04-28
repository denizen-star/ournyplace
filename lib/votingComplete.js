/**
 * Both partners scored every active criterion with a numeric 0–5 (not N/A / NULL).
 * Mirrors client `details.js` / server `calculateScores` gating for "Avg" readiness.
 */
function isBothPartnersVotingComplete(criteria, ratings) {
  if (!Array.isArray(criteria) || criteria.length === 0) return false;
  const rk = ratings && ratings.kerv ? ratings.kerv : {};
  const rp = ratings && ratings.peter ? ratings.peter : {};
  for (let i = 0; i < criteria.length; i++) {
    const cid = criteria[i].id;
    const vk = rk[cid];
    const vp = rp[cid];
    if (vk == null || vp == null) return false;
    const nk = Number(vk);
    const np = Number(vp);
    if (!Number.isFinite(nk) || !Number.isFinite(np)) return false;
    if (!Number.isInteger(nk) || nk < 0 || nk > 5) return false;
    if (!Number.isInteger(np) || np < 0 || np > 5) return false;
  }
  return true;
}

module.exports = {
  isBothPartnersVotingComplete,
};
