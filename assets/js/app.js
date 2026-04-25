(function () {
  var listEl = document.getElementById('apartment-list');
  var summaryEl = document.getElementById('summary-grid');
  var filterEl = document.getElementById('status-filter');
  var sortRootEl = document.getElementById('shortlist-sort');
  var viewRootEl = document.getElementById('shortlist-view');

  var SORT_STORAGE_KEY = 'nyhomeShortlistSort';
  var VIEW_STORAGE_KEY = 'nyhomeShortlistView';
  var VALID_SORTS = { workflow: 1, avg: 1, peter: 1, kerv: 1, updated: 1 };
  var VALID_VIEWS = { cards: 1, finalist: 1 };
  var activeFilters = new Set();
  var allApartments = [];
  var sortMode = 'workflow';
  var viewMode = 'cards';
  var finalistFlyoutEl = null;
  var finalistFlyoutHideTimer = null;
  var finalistFlyoutGlobalsBound = false;

  document.addEventListener('DOMContentLoaded', boot);

  function boot() {
    initShortlistView();
    initShortlistSort();
    NyhomeAPI.getApartments().then(render).catch(function () {
      listEl.innerHTML = '<div class="empty-state">Could not load apartments yet.</div>';
    });
  }

  function initShortlistView() {
    if (!viewRootEl) return;
    var savedV;
    try {
      savedV = localStorage.getItem(VIEW_STORAGE_KEY);
    } catch (e) {
      savedV = null;
    }
    if (savedV && VALID_VIEWS[savedV]) {
      viewMode = savedV;
    }
    syncShortlistViewUi();
    viewRootEl.querySelectorAll('[data-shortlist-view]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var mode = btn.getAttribute('data-shortlist-view');
        if (mode === viewMode || !VALID_VIEWS[mode]) return;
        viewMode = mode;
        try {
          localStorage.setItem(VIEW_STORAGE_KEY, viewMode);
        } catch (e) {}
        syncShortlistViewUi();
        if (allApartments.length) applyFilters();
      });
    });
  }

  function syncShortlistViewUi() {
    if (!viewRootEl) return;
    viewRootEl.querySelectorAll('[data-shortlist-view]').forEach(function (btn) {
      var mode = btn.getAttribute('data-shortlist-view');
      var on = mode === viewMode;
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    if (sortRootEl) {
      if (viewMode === 'finalist') {
        sortRootEl.classList.add('shortlist-sort--hidden');
        sortRootEl.setAttribute('aria-hidden', 'true');
      } else {
        sortRootEl.classList.remove('shortlist-sort--hidden');
        sortRootEl.setAttribute('aria-hidden', 'false');
      }
    }
  }

  function initShortlistSort() {
    if (!sortRootEl) return;
    var saved;
    try {
      saved = localStorage.getItem(SORT_STORAGE_KEY);
    } catch (e) {
      saved = null;
    }
    if (saved && VALID_SORTS[saved]) {
      sortMode = saved;
    }
    syncShortlistSortUi();

    sortRootEl.querySelectorAll('[data-shortlist-sort]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var mode = btn.getAttribute('data-shortlist-sort');
        if (mode === sortMode || !VALID_SORTS[mode]) return;
        sortMode = mode;
        try {
          localStorage.setItem(SORT_STORAGE_KEY, sortMode);
        } catch (e) {}
        syncShortlistSortUi();
        if (allApartments.length && viewMode === 'cards') applyFilters();
      });
    });
  }

  function syncShortlistSortUi() {
    if (!sortRootEl) return;
    sortRootEl.querySelectorAll('[data-shortlist-sort]').forEach(function (btn) {
      var mode = btn.getAttribute('data-shortlist-sort');
      var on = mode === sortMode;
      btn.setAttribute('aria-checked', on ? 'true' : 'false');
    });
  }

  function updatedAtMs(apt) {
    if (!apt || !apt.updated_at) return 0;
    var t = Date.parse(apt.updated_at);
    return isNaN(t) ? 0 : t;
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

  function scoreNumber(apt, key) {
    var s = apt && apt.scores;
    if (!s) return null;
    var v = s[key];
    if (v == null) return null;
    var n = Number(v);
    return isNaN(n) ? null : n;
  }

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

  function sortForDisplay(list) {
    var cmp;
    if (sortMode === 'updated') cmp = compareLastUpdated;
    else if (sortMode === 'avg') cmp = compareScoreDesc('combined');
    else if (sortMode === 'peter') cmp = compareScoreDesc('peter');
    else if (sortMode === 'kerv') cmp = compareScoreDesc('kerv');
    else cmp = compareWorkflowDesc;
    return list.slice().sort(cmp);
  }

  /** Finalist list: Avg (desc) then workflow (desc), same as sort options 2 then 1 in the public shortlist help text. */
  function sortForFinalist(list) {
    var byAvg = compareScoreDesc('combined');
    return list.slice().sort(function (a, b) {
      var c = byAvg(a, b);
      if (c !== 0) return c;
      return compareWorkflowDesc(a, b);
    });
  }

  function formatOneDecimal(n) {
    if (n == null) return null;
    var x = Number(n);
    if (isNaN(x)) return null;
    return x % 1 === 0 ? x.toFixed(1) : String(x);
  }

  function formatScorePctForLine(v) {
    if (v == null) return '—%';
    var n = Number(v);
    if (isNaN(n)) return '—%';
    return Math.round(n) + '%';
  }

  function ensureFinalistFlyoutGlobals() {
    if (finalistFlyoutGlobalsBound) return;
    finalistFlyoutGlobalsBound = true;
    function hideF() {
      hideFinalistFlyout();
    }
    window.addEventListener('scroll', hideF, true);
    window.addEventListener('resize', hideF);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') hideF();
    });
  }

  function ensureFinalistFlyout() {
    if (finalistFlyoutEl) {
      return finalistFlyoutEl;
    }
    ensureFinalistFlyoutGlobals();
    var el = document.createElement('div');
    el.id = 'nyhome-finalist-flyout';
    el.className = 'shortlist-finalist-flyout';
    el.setAttribute('role', 'img');
    el.setAttribute('aria-hidden', 'true');
    el.style.display = 'none';
    el.innerHTML = '<img class="vibe-thumb-img" src="" alt="" draggable="false">';
    el.addEventListener('pointerenter', function () {
      if (finalistFlyoutHideTimer) {
        clearTimeout(finalistFlyoutHideTimer);
        finalistFlyoutHideTimer = null;
      }
    });
    el.addEventListener('pointerleave', function () {
      scheduleHideFinalistFlyout(30);
    });
    document.body.appendChild(el);
    finalistFlyoutEl = el;
    return el;
  }

  function showFinalistFlyout(wrap) {
    var small = wrap.querySelector('.nyhome-listing-thumb');
    if (!small) return;
    var src = small.getAttribute('src');
    if (!src) return;
    var el = ensureFinalistFlyout();
    var big = el.querySelector('img');
    big.src = src;
    big.alt = 'Listing photo preview';
    var r = wrap.getBoundingClientRect();
    var w = 300;
    var h = 300;
    var pad = 10;
    var left = r.right + pad;
    var top = r.top + r.height / 2 - h / 2;
    if (left + w > window.innerWidth - pad) {
      left = r.left - w - pad;
    }
    if (left < pad) {
      left = pad;
    }
    if (top < pad) {
      top = pad;
    }
    if (top + h > window.innerHeight - pad) {
      top = window.innerHeight - pad - h;
    }
    el.style.left = left + 'px';
    el.style.top = top + 'px';
    el.style.display = 'block';
    if (finalistFlyoutHideTimer) {
      clearTimeout(finalistFlyoutHideTimer);
      finalistFlyoutHideTimer = null;
    }
  }

  function scheduleHideFinalistFlyout(ms) {
    if (finalistFlyoutHideTimer) {
      clearTimeout(finalistFlyoutHideTimer);
    }
    var delay = ms == null ? 50 : ms;
    finalistFlyoutHideTimer = setTimeout(function () {
      finalistFlyoutHideTimer = null;
      hideFinalistFlyout();
    }, delay);
  }

  function hideFinalistFlyout() {
    if (finalistFlyoutEl) {
      finalistFlyoutEl.style.display = 'none';
    }
    if (finalistFlyoutHideTimer) {
      clearTimeout(finalistFlyoutHideTimer);
      finalistFlyoutHideTimer = null;
    }
  }

  function wireListingThumbHovers() {
    if (!listEl) return;
    listEl.querySelectorAll('.nyhome-listing-thumb-wrap').forEach(function (wrap) {
      wrap.addEventListener('pointerenter', function () {
        showFinalistFlyout(wrap);
      });
      wrap.addEventListener('pointerleave', function (e) {
        var rel = e.relatedTarget;
        if (rel && finalistFlyoutEl && (rel === finalistFlyoutEl || finalistFlyoutEl.contains(rel))) {
          return;
        }
        scheduleHideFinalistFlyout(60);
      });
    });
  }

  /** Shared markup for shortlist cards + Finalist table (hover flyout uses .nyhome-listing-thumb-wrap). */
  function listingThumbsMarkup(apartment) {
    var urls = (apartment.images || []).map(function (i) {
      return i && i.image_url;
    }).filter(Boolean).slice(0, 3);
    if (urls.length === 0) return '';
    return (
      '<span class="nyhome-listing-thumbs" aria-hidden="true">' +
      urls.map(function (url) {
        return '<span class="nyhome-listing-thumb-wrap" tabindex="-1">' +
          '<img class="nyhome-listing-thumb" src="' + escapeAttr(url) + '" alt="" loading="lazy" decoding="async" draggable="false">' +
          '</span>';
      }).join('') +
      '</span>'
    );
  }

  function finalistScoreSpan(scoreKey, value) {
    var pct = formatScorePctForLine(value);
    var empty = value == null || isNaN(Number(value));
    var cls = 'shortlist-finalist-c shortlist-finalist-c--score shortlist-finalist-c--right';
    var inner = '<span class="shortlist-finalist-pct shortlist-finalist-pct--' + escapeAttr(scoreKey) +
      (empty ? ' shortlist-finalist-pct--empty' : '') + '">' + escapeHtml(pct) + '</span>';
    return '<span class="' + cls + '">' + inner + '</span>';
  }

  function buildFinalistRowInnerHtml(apartment, ord) {
    var t = (apartment.title || 'Untitled apartment').trim();
    var h = (apartment.neighborhood || '').trim();
    var place = h ? t + ' ' + h : t;
    var rentCell = apartment.rent_cents
      ? formatMoney(apartment.rent_cents) + '/mo'
      : 'TBD';
    var netCell = apartment.net_effective_cents
      ? formatMoney(apartment.net_effective_cents) + '/mo'
      : '—';
    var moveInCell = apartment.total_move_in_cents != null
      ? formatMoney(apartment.total_move_in_cents)
      : '—';
    var bStr = formatOneDecimal(apartment.bedrooms);
    var bathStr = formatOneDecimal(apartment.bathrooms);
    var bedBath = (bStr == null ? '—' : bStr + ' bed') + ' ' + (bathStr == null ? '—' : bathStr + ' bath');
    var s = apartment.scores || {};
    var status = NyhomeStatus.normalizeStatus(apartment.status || 'new');
    var label = formatStatusLabel(status);
    return (
      '<span class="shortlist-finalist-c shortlist-finalist-c--ord">' + escapeHtml(String(ord)) + '</span>' +
      '<span class="shortlist-finalist-c shortlist-finalist-c--place">' +
        '<span class="shortlist-finalist-place-row">' +
        '<span class="shortlist-finalist-place-txt">' + escapeHtml(place) + '</span>' +
        listingThumbsMarkup(apartment) +
        '</span></span>' +
      '<span class="shortlist-finalist-c shortlist-finalist-c--money shortlist-finalist-c--right">' + escapeHtml(rentCell) + '</span>' +
      '<span class="shortlist-finalist-c shortlist-finalist-c--money shortlist-finalist-c--right">' + escapeHtml(netCell) + '</span>' +
      '<span class="shortlist-finalist-c shortlist-finalist-c--money shortlist-finalist-c--right">' + escapeHtml(moveInCell) + '</span>' +
      '<span class="shortlist-finalist-c shortlist-finalist-c--bed">' + escapeHtml(bedBath) + '</span>' +
      finalistScoreSpan('combined', s.combined) +
      finalistScoreSpan('kerv', s.kerv) +
      finalistScoreSpan('peter', s.peter) +
      '<span class="shortlist-finalist-c shortlist-finalist-c--status">' +
        '<span class="status-pill ' + NyhomeStatus.statusClass(status) + ' shortlist-finalist-pill">' + escapeHtml(label) + '</span>' +
      '</span>'
    );
  }

  function render(data) {
    allApartments = data.apartments || [];
    renderSummary(allApartments);
    renderFilterBar(allApartments);

    if (allApartments.length === 0) {
      listEl.classList.remove('card-list--finalist');
      listEl.innerHTML = '<div class="empty-state">No apartments yet. Add the first one in Manage.</div>';
      hideFinalistFlyout();
      return;
    }

    applyFilters();
  }

  function renderSummary(apartments) {
    var active = apartments.filter(function (a) { return a.status !== 'archived' && a.status !== 'rejected'; });
    var finalists = apartments.filter(function (a) { return a.status === 'finalist'; });
    var applied = apartments.filter(function (a) { return ['applied', 'approved', 'lease_review', 'signed'].includes(a.status); });
    var best = apartments.slice().sort(function (a, b) {
      return (b.scores.combined || 0) - (a.scores.combined || 0);
    })[0];

    summaryEl.innerHTML =
      summaryCard(active.length, 'active options') +
      summaryCard(finalists.length, 'finalists') +
      summaryCard(applied.length, 'applications') +
      summaryCard(best && best.scores.combined ? Math.round(best.scores.combined) : '-', 'top avg score', 'summary-value--vote-combined');
  }

  function summaryCard(value, label, valueClass) {
    var valueCls = 'summary-value' + (valueClass ? ' ' + valueClass : '');
    return '<article class="summary-card"><span class="' + valueCls + '">' + escapeHtml(value) + '</span><span class="summary-label">' + escapeHtml(label) + '</span></article>';
  }

  function renderFilterBar(apartments) {
    if (!filterEl) return;

    var existingDetails = filterEl.querySelector('.status-filter-details');
    var isOpen = existingDetails ? existingDetails.open : false;

    var counts = {};
    NyhomeStatus.STATUS_ORDER.forEach(function (s) { counts[s] = 0; });
    apartments.forEach(function (a) {
      var s = NyhomeStatus.normalizeStatus(a.status);
      counts[s] = (counts[s] || 0) + 1;
    });

    var btns = NyhomeStatus.STATUS_ORDER.map(function (status) {
      var count = counts[status] || 0;
      var isActive = activeFilters.has(status);
      var isEmpty = count === 0;
      var cls = 'status-filter-btn' + (isActive ? ' active' : '') + (isEmpty ? ' empty' : '');
      return '<button type="button" class="' + cls + '" data-filter-status="' + escapeAttr(status) + '" aria-pressed="' + isActive + '">' +
        '<img src="/assets/img/' + escapeAttr(status) + '.png" alt="' + escapeAttr(formatStatusLabel(status)) + '" width="80" height="80">' +
        '<span class="status-filter-count">' + count + '</span>' +
        '<span class="status-filter-label">' + escapeHtml(formatStatusLabel(status)) + '</span>' +
      '</button>';
    }).join('');

    var hasClear = activeFilters.size > 0;
    var activeSummary = hasClear ? ' <span class="status-filter-active-summary">(' + activeFilters.size + ' selected)</span>' : '';

    filterEl.innerHTML =
      '<div class="status-filter-bar">' +
        '<details class="status-filter-details"' + (isOpen ? ' open' : '') + '>' +
          '<summary class="status-filter-header">' +
            '<span class="status-filter-title">Filter by status' + activeSummary + '</span>' +
            '<span class="status-filter-chevron" aria-hidden="true"></span>' +
          '</summary>' +
          '<div class="status-filter-body">' +
            '<div class="status-filter-scroll">' + btns + '</div>' +
            (hasClear ? '<a href="#" class="status-filter-clear">Clear</a>' : '') +
          '</div>' +
        '</details>' +
      '</div>';

    filterEl.querySelectorAll('[data-filter-status]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var status = btn.getAttribute('data-filter-status');
        if (activeFilters.has(status)) {
          activeFilters.delete(status);
        } else {
          activeFilters.add(status);
        }
        renderFilterBar(allApartments);
        applyFilters();
      });
    });

    var clearLink = filterEl.querySelector('.status-filter-clear');
    if (clearLink) {
      clearLink.addEventListener('click', function (e) {
        e.preventDefault();
        activeFilters.clear();
        renderFilterBar(allApartments);
        applyFilters();
      });
    }
  }

  function applyFilters() {
    var visible = activeFilters.size === 0
      ? allApartments
      : allApartments.filter(function (a) {
          return activeFilters.has(NyhomeStatus.normalizeStatus(a.status));
        });

    listEl.classList.toggle('card-list--finalist', viewMode === 'finalist');
    listEl.innerHTML = '';
    hideFinalistFlyout();
    if (visible.length === 0) {
      listEl.innerHTML = '<div class="empty-state">No apartments match the selected filters.</div>';
      return;
    }
    if (viewMode === 'finalist') {
      renderFinalistList(visible);
      return;
    }
    sortForDisplay(visible).forEach(function (apartment) {
      listEl.appendChild(renderApartmentCard(apartment));
    });
    wireListingThumbHovers();
  }

  function renderFinalistList(visible) {
    var sorted = sortForFinalist(visible);
    var h =
      '<div class="shortlist-finalist-c shortlist-finalist-c--ord shortlist-finalist-c--h">#</div>' +
      '<div class="shortlist-finalist-c shortlist-finalist-c--h">Listing</div>' +
      '<div class="shortlist-finalist-c shortlist-finalist-c--h shortlist-finalist-c--right">Rent</div>' +
      '<div class="shortlist-finalist-c shortlist-finalist-c--h shortlist-finalist-c--right">Net eff.</div>' +
      '<div class="shortlist-finalist-c shortlist-finalist-c--h shortlist-finalist-c--right shortlist-finalist-c--h-move" title="Total move-in amount">Move-in</div>' +
      '<div class="shortlist-finalist-c shortlist-finalist-c--h">Beds / baths</div>' +
      '<div class="shortlist-finalist-c shortlist-finalist-c--h shortlist-finalist-c--right">Avg</div>' +
      '<div class="shortlist-finalist-c shortlist-finalist-c--h shortlist-finalist-c--right">Kerv</div>' +
      '<div class="shortlist-finalist-c shortlist-finalist-c--h shortlist-finalist-c--right">Peter</div>' +
      '<div class="shortlist-finalist-c shortlist-finalist-c--h">Status</div>';
    var body = sorted.map(function (apartment, i) {
      var ord = i + 1;
      var href = apartment.id != null ? '/details/?id=' + encodeURIComponent(apartment.id) : '#';
      return '<a class="shortlist-finalist-line shortlist-finalist-cols" href="' + escapeAttr(href) + '">' +
        buildFinalistRowInnerHtml(apartment, ord) + '</a>';
    }).join('');
    listEl.innerHTML =
      '<div class="shortlist-finalist-wrap" role="region" aria-label="Finalist list, sorted by Avg then workflow">' +
        '<div class="shortlist-finalist-header shortlist-finalist-cols" role="row">' + h + '</div>' +
        '<div class="shortlist-finalist-body">' + body + '</div>' +
      '</div>';
    wireListingThumbHovers();
  }

  function renderApartmentCard(apartment) {
    var article = document.createElement('article');
    var status = NyhomeStatus.normalizeStatus(apartment.status || 'new');
    article.className = 'apartment-card listing-status-' + status.replace(/_/g, '-');

    article.innerHTML =
      '<div class="apartment-body">' +
        '<div class="card-topline">' +
          '<div>' +
            '<h2 class="apartment-title">' + escapeHtml(apartment.title || 'Untitled apartment') + '</h2>' +
            '<div class="apartment-location muted">' + escapeHtml([apartment.neighborhood, apartment.address].filter(Boolean).join(' · ')) + '</div>' +
          '</div>' +
          '<div class="card-topright">' +
            scoreChip(apartment.scores && apartment.scores.combined) +
            '<img class="card-status-badge" src="/assets/img/' + escapeAttr(status) + '.png" alt="" aria-hidden="true" width="48" height="48">' +
          '</div>' +
        '</div>' +
        '<div class="card-status-container">' +
          renderFacts(apartment) +
        '</div>' +
        renderScoresAndThumbs(apartment) +
        renderNextActions(apartment) +
        (apartment.notes ? '<div class="card-notes">' + escapeHtml(apartment.notes) + '</div>' : '') +
        renderActions(apartment) +
      '</div>';

    return article;
  }

  function scoreChip(value) {
    if (value == null) {
      return '<span class="pill score-chip score-chip--empty">Score -</span>';
    }

    return '<span class="pill score-chip score-chip--combined">' + Math.round(value) + '%</span>';
  }

  function formatStatusLabel(status) {
    return String(status || 'new')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, function (ch) { return ch.toUpperCase(); });
  }

  function renderFacts(apartment) {
    var facts = [];
    if (apartment.rent_cents) facts.push(formatMoney(apartment.rent_cents) + '/mo');
    if (apartment.bedrooms != null) facts.push(apartment.bedrooms + ' bed');
    if (apartment.bathrooms != null) facts.push(apartment.bathrooms + ' bath');
    if (apartment.square_feet) facts.push(apartment.square_feet + ' sq ft');
    if (apartment.move_in_date) facts.push('Move-in ' + apartment.move_in_date);
    return facts.map(function (f) { return '<span class="pill">' + escapeHtml(f) + '</span>'; }).join('');
  }

  function renderScores(scores) {
    return '<div class="score-grid">' +
      scoreBox('combined', 'Avg', scores.combined) +
      scoreBox('kerv', 'Kerv', scores.kerv) +
      scoreBox('peter', 'Peter', scores.peter) +
    '</div>';
  }

  function renderScoresAndThumbs(apartment) {
    var scores = renderScores(apartment.scores || {});
    var thumbs = listingThumbsMarkup(apartment);
    if (!thumbs) return scores;
    return (
      '<div class="card-score-thumbs-row">' +
      scores +
      '<div class="card-listing-thumbs">' + thumbs + '</div>' +
      '</div>'
    );
  }

  function scoreBox(voteKey, label, value) {
    return '<div class="score-box score-box--vote-' + voteKey + '"><span class="muted">' + escapeHtml(label) + '</span><span class="score-box-value">' + (value != null ? Math.round(value) + '%' : '-') + '</span></div>';
  }

  function renderActions(apartment) {
    return '<div class="card-actions">' +
      actionLink('Details', apartment.id ? '/details/?id=' + encodeURIComponent(apartment.id) : '') +
      actionLink('Listing', apartment.listing_url, true) +
    '</div>';
  }

  function actionLink(label, href, external) {
    if (!href) {
      var noListing = label === 'Listing' ? ' link-button--no-listing' : '';
      return '<span class="link-button action-disabled' + noListing + '" aria-disabled="true">' + escapeHtml(label) + '</span>';
    }

    return '<a class="link-button" href="' + escapeAttr(href) + '"' +
      (external ? ' target="_blank" rel="noreferrer"' : '') +
      '>' + escapeHtml(label) + '</a>';
  }

  function renderNextActions(apartment) {
    var bits = [];
    if (apartment.next_visit) bits.push('Tour: ' + apartment.next_visit.visit_at);
    if (apartment.application && apartment.application.status) bits.push('Application: ' + apartment.application.status);
    return bits.length ? '<div class="card-meta">' + bits.map(function (bit) { return '<span>' + escapeHtml(bit) + '</span>'; }).join('') + '</div>' : '';
  }

  function formatMoney(cents) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format((Number(cents) || 0) / 100);
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch];
    });
  }

  function escapeAttr(value) {
    return escapeHtml(value);
  }
})();
