/**
 * NyhomeShortlistSort — shared apartment comparators used by both the shortlist (app.js)
 * and the admin Saved apartments list (admin.js).
 *
 * Depends on: NyhomeStatus (apartmentStatus.js) — must be loaded first.
 * Optional: NyhomeListingStar (listingStar.js) — used by compareListingStarSort when available.
 */
var NyhomeShortlistSort = (function () {

  function updatedAtMs(apt) {
    if (!apt || !apt.updated_at) return 0;
    var t = Date.parse(apt.updated_at);
    return isNaN(t) ? 0 : t;
  }

  function scoreNumber(apt, key) {
    var s = apt && apt.scores;
    if (!s) return null;
    var v = s[key];
    if (v == null) return null;
    var n = Number(v);
    return isNaN(n) ? null : n;
  }

  function compareWorkflowDesc(a, b) {
    var sa = NyhomeStatus.normalizeStatus(a.status);
    var sb = NyhomeStatus.normalizeStatus(b.status);
    var ia = NyhomeStatus.STATUS_ORDER.indexOf(sa);
    var ib = NyhomeStatus.STATUS_ORDER.indexOf(sb);
    if (ia < 0) ia = 0;
    if (ib < 0) ib = 0;
    if (ia !== ib) return ib - ia;
    return updatedAtMs(b) - updatedAtMs(a);
  }

  function compareLastUpdated(a, b) {
    return updatedAtMs(b) - updatedAtMs(a);
  }

  /** Returns a comparator that sorts by score[key] descending, updated_at as tiebreaker. */
  function compareScoreDesc(key) {
    return function (a, b) {
      var na = scoreNumber(a, key);
      var nb = scoreNumber(b, key);
      if (na != null && nb != null) {
        if (nb !== na) return nb - na;
      } else if (na != null && nb == null) return -1;
      else if (na == null && nb != null) return 1;
      return updatedAtMs(b) - updatedAtMs(a);
    };
  }

  /**
   * Star sort: higher listing_star tier first (3 → 0), then workflow as tiebreaker.
   * Falls back to workflow sort when NyhomeListingStar is not loaded.
   */
  function compareListingStarSort(a, b) {
    if (typeof NyhomeListingStar === 'undefined') {
      return compareWorkflowDesc(a, b);
    }
    var ta = NyhomeListingStar.normalizeTier(a);
    var tb = NyhomeListingStar.normalizeTier(b);
    if (tb !== ta) return tb - ta;
    return compareWorkflowDesc(a, b);
  }

  /**
   * Sort list matching the card grid order for the given sortMode value.
   * sortMode: 'workflow' | 'avg' | 'peter' | 'kerv' | 'updated' | 'star'
   * Any unrecognised value falls back to workflow.
   */
  function sortForDisplay(list, sortMode) {
    var cmp;
    if (sortMode === 'updated') cmp = compareLastUpdated;
    else if (sortMode === 'avg') cmp = compareScoreDesc('combined');
    else if (sortMode === 'peter') cmp = compareScoreDesc('peter');
    else if (sortMode === 'kerv') cmp = compareScoreDesc('kerv');
    else if (sortMode === 'star') cmp = compareListingStarSort;
    else cmp = compareWorkflowDesc;
    return list.slice().sort(cmp);
  }

  /**
   * Ranked sort: Stars tier desc (3→0), then Avg desc, then workflow desc.
   * Used when sortMode === 'ranked' on both the table view and the admin list.
   */
  function sortForFinalist(list) {
    var byAvg = compareScoreDesc('combined');
    return list.slice().sort(function (a, b) {
      // Stars first: tier 3 (both) → 2 (Kerv) → 1 (Peter) → 0 (none)
      if (typeof NyhomeListingStar !== 'undefined') {
        var ta = NyhomeListingStar.normalizeTier(a);
        var tb = NyhomeListingStar.normalizeTier(b);
        if (tb !== ta) return tb - ta;
      }
      var c = byAvg(a, b);
      if (c !== 0) return c;
      return compareWorkflowDesc(a, b);
    });
  }

  return {
    updatedAtMs: updatedAtMs,
    scoreNumber: scoreNumber,
    compareWorkflowDesc: compareWorkflowDesc,
    compareLastUpdated: compareLastUpdated,
    compareScoreDesc: compareScoreDesc,
    compareListingStarSort: compareListingStarSort,
    sortForDisplay: sortForDisplay,
    sortForFinalist: sortForFinalist,
  };
})();
