/**
 * Shared apartment “search haystack” for header search on shortlist and admin.
 * Each page passes its own formatters so chip label maps can differ without
 * duplicating the field list (title, address, status, features, etc.).
 */
(function (global) {
  var NyhomeApartmentSearch = {};

  /**
   * @param {object} apartment — listing row from GET /api/apartments
   * @param {function(string): string} formatStatusLabel
   * @param {function(string): string} formatListingChipLabel
   * @returns {string} lowercase, space-joined tokens for substring matching
   */
  NyhomeApartmentSearch.haystackForApartment = function (apartment, formatStatusLabel, formatListingChipLabel) {
    var parts = [
      apartment.title,
      apartment.neighborhood,
      apartment.address,
      apartment.apt_number,
      formatStatusLabel(apartment.status),
    ];
    (apartment.unit_features || []).forEach(function (slug) {
      if (!slug) return;
      parts.push(slug, formatListingChipLabel(slug));
    });
    (apartment.amenities || []).forEach(function (slug) {
      if (!slug) return;
      parts.push(slug, formatListingChipLabel(slug));
    });
    return parts
      .filter(function (p) {
        return p != null && String(p).trim() !== '';
      })
      .map(function (p) {
        return String(p).toLowerCase();
      })
      .join(' ');
  };

  global.NyhomeApartmentSearch = NyhomeApartmentSearch;
})(typeof globalThis !== 'undefined' ? globalThis : window);
