/**
 * Client allow-list for apartment status (class names + API payload).
 * Keep in sync with /lib/apartmentStatus.js
 */
(function (global) {
  var STATUS_ORDER = [
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
  var SET = new Set(STATUS_ORDER);
  var STATUS_NAV = STATUS_ORDER.filter(function (s) {
    return s !== 'rejected' && s !== 'archived';
  });

  function normalizeStatus(input) {
    var s = String(input == null ? '' : input).trim();
    return SET.has(s) ? s : 'new';
  }

  function statusClass(status) {
    return 'status-' + normalizeStatus(status).replace(/_/g, '-');
  }

  global.NyhomeStatus = {
    normalizeStatus: normalizeStatus,
    statusClass: statusClass,
    STATUS_ORDER: STATUS_ORDER,
    STATUS_NAV: STATUS_NAV,
  };
})(typeof self !== 'undefined' ? self : this);
