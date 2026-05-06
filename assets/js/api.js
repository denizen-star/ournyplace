var NyhomeAPI = (function () {
  var APARTMENTS_CACHE_KEY = 'nyhome-apartments-cache';

  function _json(res) {
    return res.json().catch(function () {
      return {};
    }).then(function (data) {
      if (!res.ok) {
        var err = new Error(data.error || res.statusText || String(res.status));
        err.status = res.status;
        err.code = data.code;
        err.payload = data;
        throw err;
      }
      return data;
    });
  }

  function _get(url) {
    return fetch(url).then(_json);
  }

  function _send(url, method, body) {
    return fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
    }).then(_json);
  }

  function getApartmentsCache() {
    try {
      var raw = localStorage.getItem(APARTMENTS_CACHE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return null;
  }

  /** Optional: keep localStorage in sync when client corrects a row (e.g. listing_star merge after save). */
  function setApartmentsCache(data) {
    try {
      localStorage.setItem(APARTMENTS_CACHE_KEY, JSON.stringify(data));
    } catch (e) {}
  }

  /**
   * Patch one listing row inside `nyhome-apartments-cache` (ratings, scores, scores-complete flag).
   * Keeps bulk list + shortlist in sync after `/details` refetch or a successful vote POST.
   */
  function mergeApartmentIntoCache(apartment) {
    if (!apartment || apartment.id == null) return;
    try {
      var raw = localStorage.getItem(APARTMENTS_CACHE_KEY);
      if (!raw) return;
      var data = JSON.parse(raw);
      var list = data.apartments || [];
      var idStr = String(apartment.id);
      for (var i = 0; i < list.length; i++) {
        if (String(list[i].id) !== idStr) continue;
        if (apartment.ratings != null) {
          list[i].ratings = JSON.parse(JSON.stringify(apartment.ratings));
        }
        if (apartment.scores != null) {
          list[i].scores = JSON.parse(JSON.stringify(apartment.scores));
        }
        if (Object.prototype.hasOwnProperty.call(apartment, 'listing_scores_complete_email_sent')) {
          list[i].listing_scores_complete_email_sent = apartment.listing_scores_complete_email_sent;
        }
        localStorage.setItem(APARTMENTS_CACHE_KEY, JSON.stringify(data));
        return;
      }
    } catch (e) {}
  }

  function getApartments() {
    return _get('/api/apartments').then(function (data) {
      try { localStorage.setItem(APARTMENTS_CACHE_KEY, JSON.stringify(data)); } catch (e) {}
      return data;
    }).catch(function () {
      try {
        var cached = localStorage.getItem(APARTMENTS_CACHE_KEY);
        if (cached) return JSON.parse(cached);
      } catch (e) {}
      return { apartments: [], criteria: [], compactVoting: false };
    });
  }

  /** Full row for one id (includes data:image URLs). Bulk GET strips inline images to stay under Netlify response limits. */
  function getApartment(id) {
    return _get('/api/apartments?id=' + encodeURIComponent(String(id)));
  }

  function saveApartment(payload) {
    var id = Number(payload && payload.id);
    var method = Number.isFinite(id) && id > 0 ? 'PUT' : 'POST';
    return _send('/api/apartments', method, payload);
  }

  function deleteApartment(id) {
    var nid = Number(id);
    if (!Number.isFinite(nid) || nid <= 0) {
      return Promise.reject(new Error('Invalid apartment id'));
    }
    return _send('/api/apartments?id=' + encodeURIComponent(String(nid)), 'DELETE', {});
  }

  function saveCriterion(payload) {
    return _send('/api/criteria', 'POST', payload);
  }

  function updateCriterion(payload) {
    return _send('/api/criteria', 'PUT', payload);
  }

  function reorderCriteria(orderedIds) {
    return _send('/api/criteria', 'PUT', { orderedIds: orderedIds });
  }

  function deleteCriterion(id) {
    var nid = Number(id);
    if (!Number.isFinite(nid) || nid <= 0) {
      return Promise.reject(new Error('Invalid criterion id'));
    }
    return _send('/api/criteria?id=' + encodeURIComponent(String(nid)), 'DELETE', {});
  }

  function saveRating(payload) {
    return _send('/api/ratings', 'POST', payload);
  }

  function saveVisit(payload) {
    return _send('/api/visits', 'POST', payload);
  }

  function deleteVisit(apartmentId) {
    var nid = Number(apartmentId);
    if (!Number.isFinite(nid) || nid <= 0) {
      return Promise.reject(new Error('Invalid apartment id'));
    }
    return _send('/api/visits?apartmentId=' + encodeURIComponent(String(nid)), 'DELETE', {});
  }

  function saveApplication(payload) {
    return _send('/api/applications', 'POST', payload);
  }

  function getBuildingBlacklist() {
    return _get('/api/building-blacklist');
  }

  function createBuildingBlacklist(payload) {
    return _send('/api/building-blacklist', 'POST', payload);
  }

  function updateBuildingBlacklist(payload) {
    return _send('/api/building-blacklist', 'PUT', payload);
  }

  function deleteBuildingBlacklist(id) {
    var nid = Number(id);
    if (!Number.isFinite(nid) || nid <= 0) {
      return Promise.reject(new Error('Invalid blacklist id'));
    }
    return _send('/api/building-blacklist?id=' + encodeURIComponent(String(nid)), 'DELETE', {});
  }

  function sendListingScoresEmail(payload) {
    return _send('/api/listing-scores-email', 'POST', payload || {});
  }

  /** POST pipeline summary email (Netlify `pipeline-digest-email`). See `.env.example`. */
  function sendPipelineDigestEmail(payload) {
    return _send('/api/pipeline-digest-email', 'POST', payload || {});
  }

  /** GET analytics payload: pulse KPIs + rollup + transitions + activityByDay for the given period.
   *  period: 'today' | 'yesterday' | '7d' | '30d' | 'all' (default 'today'). */
  function getAdminAnalytics(period) {
    var url = '/api/admin-analytics';
    if (period && period !== 'today') url += '?period=' + encodeURIComponent(period);
    return _get(url);
  }

  function getAppSettings() {
    return _get('/api/app-settings');
  }

  function saveAppSettings(payload) {
    return _send('/api/app-settings', 'PUT', payload || {});
  }

  return {
    getApartmentsCache: getApartmentsCache,
    setApartmentsCache: setApartmentsCache,
    mergeApartmentIntoCache: mergeApartmentIntoCache,
    getApartments: getApartments,
    getApartment: getApartment,
    saveApartment: saveApartment,
    deleteApartment: deleteApartment,
    getBuildingBlacklist: getBuildingBlacklist,
    createBuildingBlacklist: createBuildingBlacklist,
    updateBuildingBlacklist: updateBuildingBlacklist,
    deleteBuildingBlacklist: deleteBuildingBlacklist,
    sendPipelineDigestEmail: sendPipelineDigestEmail,
    sendListingScoresEmail: sendListingScoresEmail,
    getAdminAnalytics: getAdminAnalytics,
    getAppSettings: getAppSettings,
    saveAppSettings: saveAppSettings,
    saveCriterion: saveCriterion,
    updateCriterion: updateCriterion,
    reorderCriteria: reorderCriteria,
    deleteCriterion: deleteCriterion,
    saveRating: saveRating,
    saveVisit: saveVisit,
    deleteVisit: deleteVisit,
    saveApplication: saveApplication,
  };
})();
