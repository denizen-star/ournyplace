/**
 * Google Maps search links from listing location fields (no API key).
 * Query matches the human-readable location line (street · unit · neighborhood).
 */
var NyhomeGoogleMaps = (function () {
  var MAPS_SEARCH_BASE = 'https://www.google.com/maps/search/?api=1&query=';

  function locationLine(apartment) {
    var addr = apartment.address && String(apartment.address).trim();
    var unitRaw = apartment.apt_number && String(apartment.apt_number).trim();
    var hood = apartment.neighborhood && String(apartment.neighborhood).trim();
    var parts = [];
    if (addr) parts.push(addr);
    if (unitRaw) {
      var uCore = unitRaw.replace(/^#/, '');
      if (uCore && (!addr || addr.indexOf(uCore) === -1)) {
        parts.push(unitRaw.indexOf('#') === 0 ? unitRaw : '#' + uCore);
      }
    }
    if (hood) parts.push(hood);
    return parts.join(' · ');
  }

  function mapsSearchUrl(apartment) {
    var addr = apartment.address && String(apartment.address).trim();
    if (!addr) return '';
    var q = locationLine(apartment);
    if (!q) return '';
    return MAPS_SEARCH_BASE + encodeURIComponent(q);
  }

  function escapeAttr(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch];
    });
  }

  function mapsIconSvg() {
    return (
      '<svg class="nyhome-maps-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">' +
      '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>' +
      '<circle cx="12" cy="10" r="3" stroke="currentColor" stroke-width="2"></circle>' +
      '</svg>'
    );
  }

  /**
   * @param {object} apartment
   * @param {function(string): string} [escapeAttrFn]
   */
  function linkHtml(apartment, escapeAttrFn) {
    var esc = typeof escapeAttrFn === 'function' ? escapeAttrFn : escapeAttr;
    var href = mapsSearchUrl(apartment);
    var icon = mapsIconSvg();
    if (href) {
      return (
        '<a class="nyhome-maps-link" href="' +
        esc(href) +
        '" target="_blank" rel="noreferrer" aria-label="Open in Google Maps">' +
        icon +
        '</a>'
      );
    }
    return (
      '<span class="nyhome-maps-link nyhome-maps-link--disabled" role="img" aria-label="Add a street address to open in Maps" title="Add a street address to open in Maps">' +
      icon +
      '</span>'
    );
  }

  return {
    locationLine: locationLine,
    mapsSearchUrl: mapsSearchUrl,
    linkHtml: linkHtml,
  };
})();
