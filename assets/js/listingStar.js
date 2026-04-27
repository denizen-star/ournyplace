/**
 * Listing “star” tier: 0 = none, 1 = Peter, 2 = Kerv, 3 = both (50/50 color mix in CSS).
 * Persisted as `listing_star` on `nyp_apartments` (NULL or 1–3).
 */
(function (global) {
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
    if (v === false || v === 0) return 0;
    var n = Number(v);
    if (!Number.isFinite(n) || n < 1 || n > 3) return 0;
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

  /**
   * Inline paint so tier colors always win over UA defaults / weak CSS (SVG fill cascade is easy to break).
   */
  function starSvg(tier) {
    var t = tier === 1 || tier === 2 || tier === 3 ? tier : 0;
    var pathStyle;
    if (t === 0) {
      pathStyle = 'fill:none;stroke:var(--muted);stroke-width:1.35;stroke-linejoin:round';
    } else if (t === 1) {
      pathStyle = 'fill:var(--peter);stroke:none';
    } else if (t === 2) {
      pathStyle = 'fill:var(--kerv);stroke:none';
    } else {
      pathStyle = 'fill:color-mix(in srgb, var(--peter) 50%, var(--kerv) 50%);stroke:none';
    }
    return (
      '<svg class="listing-star-icon" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
      '<path class="listing-star-path" style="' +
      pathStyle +
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
    buttonHtml: buttonHtml,
  };
})(typeof self !== 'undefined' ? self : this);
