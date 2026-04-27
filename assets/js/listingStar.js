/**
 * Listing "star" tier: 0 = none, 1 = Peter, 2 = Kerv, 3 = both.
 * Persisted as `listing_star` on `nyp_apartments` (NULL or 1–3).
 *
 * Fills use **hex in inline `style` on the path** (same hues as `app.css` :root). SVG `var()`
 * in attributes is unreliable across browsers; stylesheet-only fills can lose to `currentColor`.
 */
(function (global) {
  /* Keep in sync with :root --peter / --kerv / --muted in app.css */
  var FILL_PETER = '#f15b9a';
  var FILL_KERV = '#0fb8a9';
  /** 50% mix of Peter + Kerv (sRGB) — matches color-mix intent where unsupported */
  var FILL_BOTH = '#8089a1';
  var STROKE_EMPTY = '#6b7280';

  function escapeAttr(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch];
    });
  }

  function normalizeTier(apartment) {
    if (!apartment) return 0;
    var v =
      apartment.listing_star != null && apartment.listing_star !== ''
        ? apartment.listing_star
        : apartment.listingStar != null && apartment.listingStar !== ''
          ? apartment.listingStar
          : null;
    if (v === true) return 1;
    if (v === false) return 0;
    if (typeof v === 'bigint') v = Number(v);
    var n = Number(v);
    if (!Number.isFinite(n)) return 0;
    if (n === 0) return 0;
    if (n < 1 || n > 3) return 0;
    return Math.round(n);
  }

  function tierLabel(tier) {
    if (tier === 1) return 'Peter star';
    if (tier === 2) return 'Kerv star';
    if (tier === 3) return 'Both starred';
    return 'No star';
  }

  /** Next value to store in DB: null clears; 1–3 sets tier. */
  function cycleDbValue(currentTier) {
    var t = currentTier;
    if (t === 0 || t == null) return 1;
    if (t === 1) return 2;
    if (t === 2) return 3;
    return null;
  }

  function pathPaintStyle(tier) {
    var t = tier === 1 || tier === 2 || tier === 3 ? tier : 0;
    if (t === 0) {
      return 'fill:none;stroke:' + STROKE_EMPTY + ';stroke-width:1.35;stroke-linejoin:round';
    }
    if (t === 1) return 'fill:' + FILL_PETER + ';stroke:none';
    if (t === 2) return 'fill:' + FILL_KERV + ';stroke:none';
    return 'fill:' + FILL_BOTH + ';stroke:none';
  }

  function starSvg(tier) {
    return (
      '<svg class="listing-star-icon" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
      '<path class="listing-star-path" style="' +
      pathPaintStyle(tier) +
      '" d="M12 2.5l2.8 7.1h7.4l-5.9 4.3 2.3 7.1L12 16.8 5.4 20.9l2.3-7.1L1.8 9.6h7.4z"></path>' +
      '</svg>'
    );
  }

  /**
   * @param {object} apartment
   * @param {{ extraClass?: string, wrapClass?: string }} [opts]
   */
  function displayHtml(apartment, opts) {
    var o = opts || {};
    var tier = normalizeTier(apartment);
    var cls =
      'listing-star listing-star--display listing-star--tier-' +
      tier +
      (o.extraClass ? ' ' + o.extraClass : '');
    var label = tierLabel(tier);
    var inner = starSvg(tier);
    var wrapCls = o.wrapClass ? ' ' + o.wrapClass : '';
    return (
      '<span class="listing-star-wrap listing-star-wrap--display' + wrapCls + '">' +
      '<span class="' +
      cls +
      '" role="img" aria-label="' +
      escapeAttr(label) +
      '">' +
      inner +
      '</span></span>'
    );
  }

  /**
   * Read-only star: render only when tier 1–3 (finalist, next actions, details, admin — not Cards).
   */
  function displayHtmlIfStarred(apartment, opts) {
    if (normalizeTier(apartment) < 1) return '';
    return displayHtml(apartment, opts);
  }

  function buttonHtml(apartment) {
    var id = apartment && apartment.id;
    var tier = normalizeTier(apartment);
    var cls = 'listing-star listing-star--btn listing-star--tier-' + tier;
    var label = 'Star favorite. ' + tierLabel(tier) + '. Click to cycle Peter, Kerv, both, or off.';
    return (
      '<span class="listing-star-wrap listing-star-wrap--btn">' +
      '<button type="button" class="' +
      cls +
      '" data-listing-star-cycle="' +
      escapeAttr(String(id)) +
      '" aria-label="' +
      escapeAttr(label) +
      '">' +
      starSvg(tier) +
      '</button></span>'
    );
  }

  global.NyhomeListingStar = {
    normalizeTier: normalizeTier,
    tierLabel: tierLabel,
    cycleDbValue: cycleDbValue,
    displayHtml: displayHtml,
    displayHtmlIfStarred: displayHtmlIfStarred,
    buttonHtml: buttonHtml,
  };
})(typeof self !== 'undefined' ? self : this);
