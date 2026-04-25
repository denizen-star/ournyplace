var NyhomeAPI = (function () {
  var APARTMENTS_CACHE_KEY = 'nyhome-apartments-cache';

  function _json(res) {
    if (!res.ok) throw new Error(String(res.status));
    return res.json();
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

  function getApartments() {
    return _get('/api/apartments').then(function (data) {
      try { localStorage.setItem(APARTMENTS_CACHE_KEY, JSON.stringify(data)); } catch (e) {}
      return data;
    }).catch(function () {
      try {
        var cached = localStorage.getItem(APARTMENTS_CACHE_KEY);
        if (cached) return JSON.parse(cached);
      } catch (e) {}
      return { apartments: [], criteria: [] };
    });
  }

  function saveApartment(payload) {
    return _send('/api/apartments', payload.id ? 'PUT' : 'POST', payload);
  }

  function deleteApartment(id) {
    return _send('/api/apartments', 'DELETE', { id: id });
  }

  function saveCriterion(payload) {
    return _send('/api/criteria', 'POST', payload);
  }

  function deleteCriterion(id) {
    return _send('/api/criteria', 'DELETE', { id: id });
  }

  function saveRating(payload) {
    return _send('/api/ratings', 'POST', payload);
  }

  function saveVisit(payload) {
    return _send('/api/visits', 'POST', payload);
  }

  function saveApplication(payload) {
    return _send('/api/applications', 'POST', payload);
  }

  return {
    getApartments: getApartments,
    saveApartment: saveApartment,
    deleteApartment: deleteApartment,
    saveCriterion: saveCriterion,
    deleteCriterion: deleteCriterion,
    saveRating: saveRating,
    saveVisit: saveVisit,
    saveApplication: saveApplication,
  };
})();
