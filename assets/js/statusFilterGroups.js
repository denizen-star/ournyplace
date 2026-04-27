/**
 * Shortlist “Filters” drawer: how listing statuses are grouped in the UI.
 * Invariant: every value in `NyhomeStatus.STATUS_ORDER` appears in exactly one group.
 * Keep in sync when adding/removing statuses in `apartmentStatus.js` / `lib/apartmentStatus.js`.
 */
(function (global) {
  var GROUPS = [
    { id: 'discovery', label: 'Discovery & shortlist', statuses: ['new', 'evaluating', 'shortlisted'] },
    { id: 'tours', label: 'Tours', statuses: ['tour_scheduled', 'toured'] },
    { id: 'finalist', label: 'Finalist', statuses: ['finalist'] },
    { id: 'application', label: 'Application & lease', statuses: ['applying', 'applied', 'approved', 'lease_review', 'signed'] },
    { id: 'closed', label: 'Closed', statuses: ['rejected', 'blacklisted', 'archived'] },
  ];

  function allStatusesInGroups() {
    var out = [];
    for (var i = 0; i < GROUPS.length; i++) {
      var sts = GROUPS[i].statuses;
      for (var j = 0; j < (sts && sts.length); j++) {
        out.push(sts[j]);
      }
    }
    return out;
  }

  /**
   * Compare GROUPS to the canonical `STATUS_ORDER` (dev sanity check).
   * Logs warnings only on mismatch, duplicate, or missing status.
   */
  function assertComplete(statusOrder) {
    if (!Array.isArray(statusOrder)) return;
    var fromGroups = allStatusesInGroups();
    if (fromGroups.length !== statusOrder.length) {
      console.warn(
        '[nyhome] status filter groups: length mismatch (groups: ' + fromGroups.length + ', order: ' + statusOrder.length + ')'
      );
    }
    var orderSet = new Set(statusOrder);
    var seen = new Set();
    for (var a = 0; a < fromGroups.length; a++) {
      var s = fromGroups[a];
      if (!orderSet.has(s)) {
        console.warn('[nyhome] status filter groups: status not in STATUS_ORDER: ' + s);
      }
      if (seen.has(s)) {
        console.warn('[nyhome] status filter groups: duplicate in groups: ' + s);
      }
      seen.add(s);
    }
    for (var o = 0; o < statusOrder.length; o++) {
      var st = statusOrder[o];
      if (fromGroups.indexOf(st) < 0) {
        console.warn('[nyhome] status filter groups: missing from a section: ' + st);
      }
    }
  }

  global.NyhomeStatusFilterGroups = {
    GROUPS: GROUPS,
    assertComplete: assertComplete,
  };
})(typeof self !== 'undefined' ? self : this);
