(function () {
  var listEl = document.getElementById('apartment-list');
  var summaryEl = document.getElementById('summary-grid');
  var filterEl = document.getElementById('status-filter');
  var sortRootEl = document.getElementById('shortlist-sort');
  var viewRootEl = document.getElementById('shortlist-view');

  var SORT_STORAGE_KEY = 'nyhomeShortlistSort';
  var VIEW_STORAGE_KEY = 'nyhomeShortlistView';
  var PUBLIC_BASE_STORAGE_KEY = 'nyhomePublicBaseUrl';
  var NA_LAYOUT_STORAGE_KEY = 'nyhomeNextActionsLayout';
  var NA_OMIT_TOUR_KEY = 'nyhomeNextActionsOmitTour';
  var NA_OMIT_DEADLINE_KEY = 'nyhomeNextActionsOmitDeadline';
  var NA_OMIT_MOVEIN_KEY = 'nyhomeNextActionsOmitMoveIn';
  var NA_CAL_DENSITY_KEY = 'nyhomeNextActionsCalendarDensity';
  var VALID_SORTS = { workflow: 1, avg: 1, peter: 1, kerv: 1, updated: 1, star: 1, ranked: 1 };
  var VALID_VIEWS = { cards: 1, finalist: 1, 'next-actions': 1 };
  var VALID_NA_LAYOUTS = { list: 1, calendar: 1 };
  var VALID_NA_CAL_DENSITY = { summary: 1, details: 1, prospect: 1 };
  /** Next actions: list vs calendar (calendar = day-grouped agenda). */
  var naLayoutMode = 'list';
  /** Calendar card density: summary (banner row), details (spec + checklist), prospect (same + Notes &amp; details). */
  var naCalendarDensity = 'prospect';
  /** When true, only include listings that have the corresponding date (AND when multiple checked). */
  var naOmitTour = false;
  var naOmitDeadline = false;
  var naOmitMoveIn = false;

  var LISTING_CHIP_LABELS = {
    dishwasher: 'Dishwasher',
    'washer-dryer': 'W/D',
    storage: 'Storage',
    views: 'Views',
    doorman: 'Doorman',
    highrise: 'Highrise',
    midrise: 'Midrise',
    lowrise: 'Lowrise',
    'new-construction': 'New construction',
    renovated: 'Renovated',
    walkup: 'Walkup',
    pool: 'Pool',
    sauna: 'Sauna',
    'laundry-room': 'Laundry room',
    suites: 'Suites',
    'roof-deck': 'Roof deck',
    'common-areas': 'Common areas',
    'subway-lines': 'Subway lines',
  };

  /** Full checklist shown on every calendar listing (order = tour-day worksheet). */
  var NA_UNIT_FEATURE_ORDER = ['dishwasher', 'washer-dryer', 'storage', 'views'];
  var NA_AMENITY_ORDER = [
    'doorman',
    'highrise',
    'midrise',
    'lowrise',
    'walkup',
    'new-construction',
    'renovated',
    'pool',
    'sauna',
    'laundry-room',
    'suites',
    'roof-deck',
    'common-areas',
    'subway-lines',
  ];

  var CAL_TRAVEL_MS = 30 * 60 * 1000;
  var CAL_TOUR_MS = 30 * 60 * 1000;
  var CAL_DEBRIEF_MS = 30 * 60 * 1000;
  var CAL_SLOT_MS = 30 * 60 * 1000;
  /** Summary calendar: vertical timeline height scale (px per minute). */
  var NA_TIMELINE_PX_PER_MIN = 3.05;
  var NA_TIMELINE_MIN_HEIGHT = 132;
  var activeFilters = new Set();
  /** When true, show only listings where at least one partner has no score rollup. */
  var extraFilterNotVoted = false;
  /** When true, show only listings with missing or invalid listing_url. */
  var extraFilterLinkMissing = false;
  /** If non-empty, only listings whose trimmed neighborhood is in the set. */
  var hoodFilter = new Set();
  var allApartments = [];
  var sortMode = 'workflow';
  var viewMode = 'cards';
  var finalistFlyoutEl = null;
  var finalistFlyoutHideTimer = null;
  var finalistFlyoutGlobalsBound = false;
  /** Source row while duplicate bottom sheet is open (shortlist). */
  var dupSheetSourceApartment = null;
  /** Mobile Cards: Sort by panel stays open after user expands it until they leave Cards. */
  var sortPanelUserOpened = false;
  /** Apartment shown in tour worksheet overlay. */
  var tourScreenApartment = null;
  document.addEventListener('DOMContentLoaded', boot);

  /** Bottom nav + mobile shell — match Option A (header VIEW hidden, FAB + sort collapse). */
  var MOBILE_WIDTH_MAX = 720;

  function getStoredPublicBaseUrl() {
    try {
      var u = localStorage.getItem(PUBLIC_BASE_STORAGE_KEY);
      return u && String(u).trim() ? String(u).trim().replace(/\/+$/, '') : '';
    } catch (e) {
      return '';
    }
  }

  function sendPipelineDigestFromShortlist(triggerEl) {
    var base =
      getStoredPublicBaseUrl() ||
      (window.location && window.location.origin ? window.location.origin.replace(/\/+$/, '') : '');
    var el = triggerEl || null;
    var old = el && el.textContent;
    if (el) {
      el.disabled = true;
      el.textContent = 'Sending…';
    }
    NyhomeAPI.sendPipelineDigestEmail({ publicBaseUrl: base })
      .then(function (res) {
        var subj = res.subject || 'OK';
        if (typeof NyhomeUiFeedback !== 'undefined' && NyhomeUiFeedback.showToast) {
          NyhomeUiFeedback.showToast('Digest sent: ' + subj);
        } else {
          window.alert('Digest sent: ' + subj);
        }
      })
      .catch(function (err) {
        var msg = err.message || 'Send failed';
        if (typeof NyhomeUiFeedback !== 'undefined' && NyhomeUiFeedback.alert) {
          return NyhomeUiFeedback.alert(msg, { title: 'Email digest' });
        }
        window.alert(msg);
      })
      .then(function () {
        if (el) {
          el.disabled = false;
          if (old != null) el.textContent = old;
        }
      });
  }

  function initPipelineDigestUi() {
    var shortlistBtn = document.getElementById('nyhome-shortlist-send-digest');
    if (shortlistBtn) {
      shortlistBtn.addEventListener('click', function () {
        sendPipelineDigestFromShortlist(shortlistBtn);
      });
    }
  }

  function isShortlistMobile() {
    return typeof window.matchMedia === 'function' && window.matchMedia('(max-width: ' + MOBILE_WIDTH_MAX + 'px)').matches;
  }

  /** PLAN-mobile Step 2 — shared by header segment + Option A bottom nav (`01-cards.html`). */
  function setShortlistView(mode) {
    if (!VALID_VIEWS[mode] || mode === viewMode) return;
    if (mode === 'cards') sortPanelUserOpened = false;
    viewMode = mode;
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, viewMode);
    } catch (e) {}
    if (mode === 'next-actions' && isShortlistMobile()) {
      naLayoutMode = 'calendar';
      naCalendarDensity = 'summary';
      saveNextActionsPrefs();
    }
    syncShortlistViewUi();
    if (allApartments.length) applyFilters();
  }

  function initMobileBottomNav() {
    if (document.getElementById('nyhome-mobile-bottom-nav')) return;
    var nav = document.createElement('nav');
    nav.id = 'nyhome-mobile-bottom-nav';
    nav.className = 'm-bottom-nav';
    nav.setAttribute('aria-label', 'Shortlist views');
    nav.innerHTML =
      '<button type="button" class="m-nav-btn" data-shortlist-view="cards" aria-controls="apartment-list">' +
      '<span class="m-nav-icon" aria-hidden="true">▦</span><span class="m-nav-label">Cards</span></button>' +
      '<button type="button" class="m-nav-btn" data-shortlist-view="next-actions" aria-controls="apartment-list">' +
      '<span class="m-nav-icon" aria-hidden="true">\u25A3</span><span class="m-nav-label">Next actions</span></button>';
    document.body.appendChild(nav);
    nav.querySelectorAll('[data-shortlist-view]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        setShortlistView(btn.getAttribute('data-shortlist-view'));
      });
    });
  }

  function isFiltersDrawerOpen() {
    var d = document.getElementById('filters-drawer');
    return !!(d && !d.hasAttribute('hidden'));
  }

  function setFiltersDrawerOpen(open) {
    var drawer = document.getElementById('filters-drawer');
    var fab = document.getElementById('filters-drawer-toggle');
    if (!drawer || !fab) return;
    if (open) {
      drawer.removeAttribute('hidden');
      fab.setAttribute('aria-expanded', 'true');
      document.body.classList.add('filters-drawer--open');
      drawer.setAttribute('aria-hidden', 'false');
    } else {
      drawer.setAttribute('hidden', '');
      fab.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('filters-drawer--open');
      drawer.setAttribute('aria-hidden', 'true');
    }
  }

  function initFiltersDrawer() {
    var fab = document.getElementById('filters-drawer-toggle');
    if (!fab) return;
    fab.addEventListener('click', function (e) {
      e.stopPropagation();
      setFiltersDrawerOpen(!isFiltersDrawerOpen());
    });
    document.addEventListener('click', function (e) {
      var t = e.target;
      if (t && t.closest && t.closest('[data-filters-close]')) {
        e.preventDefault();
        setFiltersDrawerOpen(false);
      }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && isFiltersDrawerOpen()) {
        setFiltersDrawerOpen(false);
      }
    });
  }

  function boot() {
    if (typeof NyhomeStatusFilterGroups !== 'undefined' && typeof NyhomeStatus !== 'undefined') {
      try {
        NyhomeStatusFilterGroups.assertComplete(NyhomeStatus.STATUS_ORDER);
      } catch (e) {}
    }
    initFiltersDrawer();
    initMobileBottomNav();
    initShortlistView();
    initShortlistSort();
    initPipelineDigestUi();
    initNextActionsPrefs();
    applyMobileNextActionsDefaults();
    initMobileSortCollapse();
    /** First paint waits for `/api/apartments`: no synchronous `render(cached)` — avoids stale counts/cards flash. Offline: `getApartments()` resolves with last cached payload from api.js fallback. */
    if (summaryEl) {
      summaryEl.innerHTML = '';
    }
    if (listEl) {
      listEl.innerHTML = '<div class="empty-state">Loading&hellip;</div>';
    }
    NyhomeAPI.getApartments()
      .then(render)
      .catch(function (err) {
        console.error('[nyhome-shortlist] load', err);
        if (allApartments && allApartments.length) {
          return;
        }
        if (listEl) {
          listEl.innerHTML = '<div class="empty-state">Could not load apartments yet.</div>';
        }
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
        setShortlistView(btn.getAttribute('data-shortlist-view'));
      });
    });
  }

  function syncShortlistViewUi() {
    if (viewRootEl) {
      viewRootEl.querySelectorAll('[data-shortlist-view]').forEach(function (btn) {
        var mode = btn.getAttribute('data-shortlist-view');
        var on = mode === viewMode;
        btn.setAttribute('aria-selected', on ? 'true' : 'false');
      });
    }
    var mNav = document.getElementById('nyhome-mobile-bottom-nav');
    if (mNav) {
      mNav.querySelectorAll('.m-nav-btn[data-shortlist-view]').forEach(function (btn) {
        var mode = btn.getAttribute('data-shortlist-view');
        var on = mode === viewMode;
        btn.classList.toggle('m-nav-btn--active', on);
        if (on) btn.setAttribute('aria-current', 'page');
        else btn.removeAttribute('aria-current');
      });
    }
    if (sortRootEl) {
      if (viewMode === 'next-actions') {
        sortRootEl.classList.add('shortlist-sort--hidden');
        sortRootEl.setAttribute('aria-hidden', 'true');
      } else {
        sortRootEl.classList.remove('shortlist-sort--hidden');
        sortRootEl.setAttribute('aria-hidden', 'false');
      }
    }
    syncMobileSortPanel();
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
        if (allApartments.length && (viewMode === 'cards' || viewMode === 'finalist')) applyFilters();
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

  function loadStoredBool(key) {
    try {
      return localStorage.getItem(key) === '1';
    } catch (e) {
      return false;
    }
  }

  function initNextActionsPrefs() {
    var l;
    try {
      l = localStorage.getItem(NA_LAYOUT_STORAGE_KEY);
    } catch (e) {
      l = null;
    }
    if (l && VALID_NA_LAYOUTS[l]) {
      naLayoutMode = l;
    } else {
      naLayoutMode = 'list';
    }
    naOmitTour = loadStoredBool(NA_OMIT_TOUR_KEY);
    naOmitDeadline = loadStoredBool(NA_OMIT_DEADLINE_KEY);
    naOmitMoveIn = loadStoredBool(NA_OMIT_MOVEIN_KEY);
    var d;
    try {
      d = localStorage.getItem(NA_CAL_DENSITY_KEY);
    } catch (e) {
      d = null;
    }
    if (d && VALID_NA_CAL_DENSITY[d]) {
      naCalendarDensity = d;
    } else {
      naCalendarDensity = 'prospect';
    }
  }

  /** On mobile Next actions, prefer calendar layout after restore (per-row density stays in localStorage). */
  function applyMobileNextActionsDefaults() {
    if (!isShortlistMobile() || viewMode !== 'next-actions') return;
    if (naLayoutMode !== 'calendar') {
      naLayoutMode = 'calendar';
      saveNextActionsPrefs();
    }
  }

  function syncMobileSortPanel() {
    var toggle = document.getElementById('shortlist-sort-mobile-toggle');
    var panel = document.getElementById('shortlist-sort-panel');
    if (!toggle || !panel) return;
    var hint = toggle.querySelector('.shortlist-sort-mobile-toggle-hint');
    var sortHidden = sortRootEl && sortRootEl.classList.contains('shortlist-sort--hidden');
    if (!isShortlistMobile() || (viewMode !== 'cards' && viewMode !== 'finalist') || sortHidden) {
      toggle.setAttribute('hidden', '');
      panel.removeAttribute('hidden');
      if (hint) hint.textContent = 'Show';
      return;
    }
    toggle.removeAttribute('hidden');
    if (!sortPanelUserOpened) {
      panel.setAttribute('hidden', '');
      toggle.setAttribute('aria-expanded', 'false');
      if (hint) hint.textContent = 'Show';
    } else {
      panel.removeAttribute('hidden');
      toggle.setAttribute('aria-expanded', 'true');
      if (hint) hint.textContent = 'Hide';
    }
  }

  function initMobileSortCollapse() {
    var toggle = document.getElementById('shortlist-sort-mobile-toggle');
    var panel = document.getElementById('shortlist-sort-panel');
    if (!toggle || !panel) return;
    toggle.addEventListener('click', function (e) {
      e.preventDefault();
      var willOpen = panel.hasAttribute('hidden');
      if (willOpen) sortPanelUserOpened = true;
      else sortPanelUserOpened = false;
      var hint = toggle.querySelector('.shortlist-sort-mobile-toggle-hint');
      if (willOpen) {
        panel.removeAttribute('hidden');
        toggle.setAttribute('aria-expanded', 'true');
        if (hint) hint.textContent = 'Hide';
      } else {
        panel.setAttribute('hidden', '');
        toggle.setAttribute('aria-expanded', 'false');
        if (hint) hint.textContent = 'Show';
      }
    });
  }

  function saveNextActionsPrefs() {
    try {
      localStorage.setItem(NA_LAYOUT_STORAGE_KEY, naLayoutMode);
      localStorage.setItem(NA_OMIT_TOUR_KEY, naOmitTour ? '1' : '');
      localStorage.setItem(NA_OMIT_DEADLINE_KEY, naOmitDeadline ? '1' : '');
      localStorage.setItem(NA_OMIT_MOVEIN_KEY, naOmitMoveIn ? '1' : '');
      localStorage.setItem(NA_CAL_DENSITY_KEY, naCalendarDensity);
    } catch (e) {}
  }

  function hasMoveInDate(apartment) {
    return !!(apartment && apartment.move_in_date && String(apartment.move_in_date).trim());
  }

  function compareWorkflowDesc(a, b) {
    return NyhomeShortlistSort.compareWorkflowDesc(a, b);
  }

  function compareLastUpdated(a, b) {
    return NyhomeShortlistSort.compareLastUpdated(a, b);
  }

  function scoreNumber(apt, key) {
    return NyhomeShortlistSort.scoreNumber(apt, key);
  }

  function listingUrlIsMissingOrInvalid(raw) {
    if (raw == null) return true;
    var s = String(raw).trim();
    if (!s) return true;
    var t = s.toLowerCase();
    if (t === 'n/a' || t === 'na' || t === 'none' || t === 'nada' || t === 'tbd' || t === '—' || t === '-' || t === 'pending') {
      return true;
    }
    var candidate = s;
    if (!/^[a-z+.-]+:\/\//i.test(s)) {
      candidate = 'https://' + s;
    }
    try {
      var u = new URL(candidate);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return true;
      var host = (u.hostname || '').toLowerCase();
      if (host.length < 3) return true;
      return false;
    } catch (e) {
      return true;
    }
  }

  function distinctNeighborhoods(apartments) {
    var out = [];
    var seen = {};
    (apartments || []).forEach(function (a) {
      var n = a && a.neighborhood && String(a.neighborhood).trim();
      if (n && !seen[n]) {
        seen[n] = 1;
        out.push(n);
      }
    });
    out.sort(function (a, b) {
      return a.localeCompare(b, undefined, { sensitivity: 'base' });
    });
    return out;
  }

  function pruneHoodFilter() {
    var valid = new Set();
    allApartments.forEach(function (a) {
      var n = a.neighborhood && String(a.neighborhood).trim();
      if (n) valid.add(n);
    });
    Array.from(hoodFilter).forEach(function (h) {
      if (!valid.has(h)) hoodFilter.delete(h);
    });
  }

  function apartmentPassesExtraFilters(a) {
    if (extraFilterNotVoted) {
      if (scoreNumber(a, 'kerv') != null && scoreNumber(a, 'peter') != null) {
        return false;
      }
    }
    if (extraFilterLinkMissing) {
      if (!listingUrlIsMissingOrInvalid(a.listing_url)) {
        return false;
      }
    }
    if (hoodFilter.size > 0) {
      var n = a.neighborhood && String(a.neighborhood).trim();
      if (!n || !hoodFilter.has(n)) return false;
    }
    return true;
  }

  function compareScoreDesc(key) {
    return NyhomeShortlistSort.compareScoreDesc(key);
  }

  /** Sort card grid using the current sortMode. Delegates to shared NyhomeShortlistSort. */
  function sortForDisplay(list) {
    return NyhomeShortlistSort.sortForDisplay(list, sortMode);
  }

  /** Ranked sort: Avg desc then workflow desc. Delegates to shared NyhomeShortlistSort. */
  function sortForFinalist(list) {
    return NyhomeShortlistSort.sortForFinalist(list);
  }

  /** Listing appears in Next actions if it has a tour, application deadline, and/or move-in date. */
  function qualifiesNextActions(apartment) {
    if (!apartment) return false;
    if (apartment.next_visit) return true;
    if (apartment.application && apartment.application.deadline_at) return true;
    if (hasMoveInDate(apartment)) return true;
    return false;
  }

  /** When any “only include” toggle is on, listing must satisfy every checked requirement. */
  function passesNextActionsOmitFilters(apartment) {
    if (!qualifiesNextActions(apartment)) return false;
    if (!naOmitTour && !naOmitDeadline && !naOmitMoveIn) return true;
    if (naOmitTour && !(apartment.next_visit && apartment.next_visit.visit_at)) return false;
    if (naOmitDeadline && !(apartment.application && apartment.application.deadline_at)) return false;
    if (naOmitMoveIn && !hasMoveInDate(apartment)) return false;
    return true;
  }

  function wireNaOmitCheckboxes(scope) {
    if (!scope || !scope.querySelectorAll) return;
    scope.querySelectorAll('input[type="checkbox"][data-na-omit]').forEach(function (el) {
      el.addEventListener('change', function () {
        var k = el.getAttribute('data-na-omit');
        var on = el.checked;
        if (k === 'tour') naOmitTour = on;
        else if (k === 'deadline') naOmitDeadline = on;
        else if (k === 'movein') naOmitMoveIn = on;
        saveNextActionsPrefs();
        renderFilterBar(allApartments);
        if (allApartments.length && viewMode === 'next-actions') applyFilters();
      });
    });
  }

  function formatListingChipLabel(slug) {
    var s = String(slug || '');
    if (Object.prototype.hasOwnProperty.call(LISTING_CHIP_LABELS, s)) {
      return LISTING_CHIP_LABELS[s];
    }
    return s.replace(/-/g, ' ').replace(/\b\w/g, function (ch) { return ch.toUpperCase(); });
  }

  function placeholderDash() {
    return '—';
  }

  function formatMoneyOrDash(cents) {
    if (cents == null || cents === '') return placeholderDash();
    return formatMoney(cents);
  }

  function formatRentNetOrDash(cents) {
    if (cents == null || cents === '') return placeholderDash();
    return formatMoney(cents) + '/mo';
  }

  /** Inline on calendar banner after status: Avg | Kerv | Peter (pipe-separated). */
  function nextActionsBannerScoresInlineHtml(scores) {
    var s = scores || {};
    function pct(key) {
      var v = s[key];
      if (v == null || isNaN(Number(v))) return placeholderDash();
      return Math.round(Number(v)) + '%';
    }
    return (
      '<span class="shortlist-na-banner-scores" aria-label="Listing scores">' +
      '<span class="shortlist-na-banner-score shortlist-na-banner-score--avg">Avg: <span class="shortlist-na-banner-score-val">' +
      escapeHtml(pct('combined')) +
      '</span></span>' +
      '<span class="shortlist-na-meta-sep" aria-hidden="true">|</span>' +
      '<span class="shortlist-na-banner-score shortlist-na-banner-score--kerv">Kerv: <span class="shortlist-na-banner-score-val">' +
      escapeHtml(pct('kerv')) +
      '</span></span>' +
      '<span class="shortlist-na-meta-sep" aria-hidden="true">|</span>' +
      '<span class="shortlist-na-banner-score shortlist-na-banner-score--peter">Peter: <span class="shortlist-na-banner-score-val">' +
      escapeHtml(pct('peter')) +
      '</span></span>' +
      '</span>'
    );
  }

  /** Printed-tour style: pen in dashed box beside the rent/fee chips column. */
  function nextActionsScratchPadHtml() {
    return (
      '<div class="shortlist-na-comments-pad" aria-label="Area for handwritten notes">' +
      '<span class="shortlist-na-comments-pad-inner">' +
      '<svg class="shortlist-na-comments-pad-pen" width="14" height="14" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">' +
      '<path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a.996.996 0 000-1.41l-2.34-2.34a1 1 0 00-1.42 0l-1.83 1.83 3.75 3.75 1.84-1.83z"/>' +
      '</svg>' +
      '</span></div>'
    );
  }

  function nextActionsFeatureChecklist(apartment) {
    var ufSet = new Set((apartment.unit_features || []).map(String));
    var amSet = new Set((apartment.amenities || []).map(String));
    function item(slug, set) {
      var on = set.has(slug);
      return (
        '<span class="shortlist-na-check-item' +
        (on ? ' shortlist-na-check-item--yes' : ' shortlist-na-check-item--no') +
        '" title="' +
        escapeAttr(on ? 'Marked yes on listing' : 'Not marked — confirm on visit') +
        '">' +
        '<span class="shortlist-na-check-bubble" aria-hidden="true">' +
        (on ? '\u2713' : '') +
        '</span>' +
        '<span class="shortlist-na-check-lbl">' +
        escapeHtml(formatListingChipLabel(slug)) +
        '</span></span>'
      );
    }
    var ufHtml = NA_UNIT_FEATURE_ORDER.map(function (s) {
      return item(s, ufSet);
    }).join('');
    var amHtml = NA_AMENITY_ORDER.map(function (s) {
      return item(s, amSet);
    }).join('');
    return (
      '<div class="shortlist-na-checklist" aria-label="Unit features and building amenities">' +
      '<div class="shortlist-na-checklist-col">' +
      '<span class="shortlist-na-checklist-heading">Unit features</span>' +
      '<div class="shortlist-na-check-grid">' +
      ufHtml +
      '</div></div>' +
      '<div class="shortlist-na-checklist-col">' +
      '<span class="shortlist-na-checklist-heading">Amenities</span>' +
      '<div class="shortlist-na-check-grid">' +
      amHtml +
      '</div></div>' +
      '</div>'
    );
  }

  /** Rent/fees chip row + handwritten pad column — then checklist. */
  function nextActionsListingSpecStrip(apartment) {
    var finRows = [
      { k: 'Rent', v: formatRentNetOrDash(apartment.rent_cents) },
      { k: 'Net', v: formatRentNetOrDash(apartment.net_effective_cents) },
      { k: 'Move-in', v: formatMoneyOrDash(apartment.total_move_in_cents) },
      { k: 'Broker', v: formatMoneyOrDash(apartment.broker_fee_cents) },
      { k: 'Deposit', v: formatMoneyOrDash(apartment.deposit_cents) },
      { k: 'Amen. fee', v: formatMoneyOrDash(apartment.amenities_fees_cents) },
    ];
    var finHtml = finRows
      .map(function (row) {
        return (
          '<span class="shortlist-na-fin-chip">' +
          '<span class="shortlist-na-fin-k">' +
          escapeHtml(row.k) +
          '</span> ' +
          '<span class="shortlist-na-fin-v">' +
          escapeHtml(row.v) +
          '</span></span>'
        );
      })
      .join('');
    return (
      '<div class="shortlist-na-spec-wrap">' +
      '<div class="shortlist-na-spec-strip">' +
      '<div class="shortlist-na-spec-cell shortlist-na-spec-cell--financials">' +
      '<div class="shortlist-na-fin-line" role="group" aria-label="Rent and fees">' +
      finHtml +
      '</div></div>' +
      '<div class="shortlist-na-spec-cell shortlist-na-spec-cell--scratch">' +
      nextActionsScratchPadHtml() +
      '</div>' +
      '</div>' +
      nextActionsFeatureChecklist(apartment) +
      '</div>'
    );
  }

  function renderNotesDetailsCollapsible(apartment, ev, panelId) {
    var parts = [];
    var listingUrl = apartment.listing_url && String(apartment.listing_url).trim();
    if (listingUrl) {
      parts.push(
        '<p class="shortlist-na-detail-line">' +
        '<a href="' +
        escapeAttr(listingUrl) +
        '" target="_blank" rel="noreferrer" class="shortlist-na-detail-link shortlist-na-detail-link--listing">' +
        'Listing</a></p>'
      );
    }
    var notes = apartment.notes && String(apartment.notes).trim();
    if (notes) {
      parts.push(
        '<div class="shortlist-na-detail-block"><span class="shortlist-na-detail-k">Listing notes</span>' +
        '<pre class="shortlist-na-notes-pre">' +
        escapeHtml(notes) +
        '</pre></div>'
      );
    }
    var tourNotes =
      ev.kind === 'tour' && apartment.next_visit && apartment.next_visit.notes && String(apartment.next_visit.notes).trim();
    if (tourNotes) {
      parts.push(
        '<div class="shortlist-na-detail-block"><span class="shortlist-na-detail-k">Tour notes</span>' +
        '<pre class="shortlist-na-notes-pre">' +
        escapeHtml(String(apartment.next_visit.notes)) +
        '</pre></div>'
      );
    }
    if (!parts.length) {
      parts.push(
        '<p class="shortlist-na-detail-empty muted">No listing link or notes yet. Add them in Manage or Details.</p>'
      );
    }
    var toggleLabel = 'Notes and details for ' + String(apartment.title || 'listing').trim();
    return (
      '<div class="shortlist-na-notes-card">' +
      '<button type="button" class="shortlist-na-notes-toggle" data-def-toggle data-def-for="' +
      escapeAttr(panelId) +
      '" aria-expanded="false" aria-label="' +
      escapeAttr(toggleLabel) +
      '">' +
      '<span class="shortlist-na-notes-toggle-label">Notes &amp; details</span>' +
      '<span class="shortlist-na-notes-toggle-hint muted">Show</span>' +
      '</button>' +
      '<div class="vote-criterion-def-panel shortlist-na-notes-panel" id="' +
      escapeAttr(panelId) +
      '" hidden>' +
      parts.join('') +
      '</div></div>'
    );
  }

  /** End of debrief after tour start T (30 min tour + 30 min debrief). */
  function tourBlockEndAfterStart(tourStartMs) {
    return tourStartMs + CAL_TOUR_MS + CAL_DEBRIEF_MS;
  }

  function freeSlotsBetweenMs(t0, t1) {
    var out = [];
    var gap = t1 - t0;
    var n = Math.floor(gap / CAL_SLOT_MS);
    for (var i = 0; i < n; i++) {
      if (i > 0) out.push({ type: 'hr' });
      var startMs = t0 + i * CAL_SLOT_MS;
      out.push({ type: 'free', startMs: startMs, endMs: startMs + CAL_SLOT_MS });
    }
    return out;
  }

  /**
   * Tours: 30 min travel (before visit_at) → 30 min tour (visit_at) → 30 min debrief.
   * visit_at = tour start. Other events: 30 min travel → 30 min block at sortTs → 30 min debrief; gaps = open 30 min slots.
   */
  function buildCalendarDayRows(sortedEvents) {
    var rows = [];
    var prevEnd = null;
    sortedEvents.forEach(function (ev) {
      if (ev.kind === 'tour') {
        var T = ev.sortTs;
        var travelStart = T - CAL_TRAVEL_MS;
        var blockEnd = tourBlockEndAfterStart(T);
        if (prevEnd != null && travelStart > prevEnd) {
          rows.push({ type: 'break' });
          rows.push.apply(rows, freeSlotsBetweenMs(prevEnd, travelStart));
        }
        rows.push({ type: 'travel', startMs: travelStart, endMs: T });
        rows.push({
          type: 'event',
          ev: ev,
          tourTime: { startMs: T, endMs: T + CAL_TOUR_MS },
        });
        rows.push({
          type: 'debrief',
          startMs: T + CAL_TOUR_MS,
          endMs: T + CAL_TOUR_MS + CAL_DEBRIEF_MS,
        });
        prevEnd = blockEnd;
      } else {
        var D = ev.sortTs;
        var travelStart2 = D - CAL_TRAVEL_MS;
        var eventEnd = D + CAL_SLOT_MS;
        var blockEnd2 = eventEnd + CAL_DEBRIEF_MS;
        if (prevEnd != null && travelStart2 > prevEnd) {
          rows.push({ type: 'break' });
          rows.push.apply(rows, freeSlotsBetweenMs(prevEnd, travelStart2));
        }
        rows.push({ type: 'travel', startMs: travelStart2, endMs: D });
        rows.push({ type: 'event', ev: ev });
        rows.push({
          type: 'debrief',
          startMs: eventEnd,
          endMs: blockEnd2,
        });
        prevEnd = blockEnd2;
      }
    });
    return rows;
  }

  function pushTimelineOpenSlots(t0, t1, segments) {
    var gap = t1 - t0;
    var n = Math.floor(gap / CAL_SLOT_MS);
    for (var i = 0; i < n; i++) {
      var s = t0 + i * CAL_SLOT_MS;
      segments.push({ kind: 'open', startMs: s, endMs: s + CAL_SLOT_MS, ev: null });
    }
  }

  /**
   * Segments for Summary calendar timeline: first event → last event, 30 min open gaps, purple travel/debrief, core slices for tour/deadline/move-in.
   */
  function buildDayTimelinePlan(sortedEvents) {
    var segments = [];
    var prevEnd = null;
    sortedEvents.forEach(function (ev) {
      if (ev.kind === 'tour') {
        var T = ev.sortTs;
        var travelStart = T - CAL_TRAVEL_MS;
        var blockEnd = tourBlockEndAfterStart(T);
        if (prevEnd != null && travelStart > prevEnd) {
          pushTimelineOpenSlots(prevEnd, travelStart, segments);
        }
        segments.push({ kind: 'travel', startMs: travelStart, endMs: T, ev: ev });
        segments.push({ kind: 'tour', startMs: T, endMs: T + CAL_TOUR_MS, ev: ev });
        segments.push({ kind: 'debrief', startMs: T + CAL_TOUR_MS, endMs: blockEnd, ev: ev });
        prevEnd = blockEnd;
      } else {
        var D = ev.sortTs;
        var travelStart2 = D - CAL_TRAVEL_MS;
        var eventEnd = D + CAL_SLOT_MS;
        var blockEnd2 = eventEnd + CAL_DEBRIEF_MS;
        if (prevEnd != null && travelStart2 > prevEnd) {
          pushTimelineOpenSlots(prevEnd, travelStart2, segments);
        }
        segments.push({ kind: 'travel', startMs: travelStart2, endMs: D, ev: ev });
        if (ev.kind === 'deadline') {
          segments.push({ kind: 'deadline', startMs: D, endMs: eventEnd, ev: ev });
        } else {
          segments.push({ kind: 'movein', startMs: D, endMs: eventEnd, ev: ev });
        }
        segments.push({ kind: 'debrief', startMs: eventEnd, endMs: blockEnd2, ev: ev });
        prevEnd = blockEnd2;
      }
    });
    if (!segments.length) return null;
    return {
      dayStartMs: segments[0].startMs,
      dayEndMs: segments[segments.length - 1].endMs,
      segments: segments,
    };
  }

  function renderNextActionsCalendarDaySummaryHtml(dk, sortedList) {
    var plan = buildDayTimelinePlan(sortedList);
    if (!plan) return '';
    var durMs = plan.dayEndMs - plan.dayStartMs;
    if (durMs <= 0) return '';
    var totalMin = durMs / 60000;
    var trackH = Math.max(NA_TIMELINE_MIN_HEIGHT, totalMin * NA_TIMELINE_PX_PER_MIN);
    var stepPct = (CAL_SLOT_MS / durMs) * 100;

    function pct(ms) {
      return ((ms - plan.dayStartMs) / durMs) * 100;
    }
    function hPct(ms0, ms1) {
      return ((ms1 - ms0) / durMs) * 100;
    }

    var labelChunks = [];
    for (var t = plan.dayStartMs; t < plan.dayEndMs; t += CAL_SLOT_MS) {
      var lab = new Date(t);
      if (Number.isNaN(lab.getTime())) continue;
      var timeStr = lab.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit' });
      var topPct = pct(t);
      labelChunks.push(
        '<div class="shortlist-na-tl-tick" style="top:' +
        topPct +
        '%"><span class="shortlist-na-tl-tick-label">' +
        escapeHtml(timeStr) +
        '</span></div>'
      );
    }

    var segChunks = plan.segments.map(function (seg) {
      var extra =
        seg.kind === 'travel' || seg.kind === 'debrief'
          ? ' shortlist-na-tl-seg--admin'
          : seg.kind === 'open'
            ? ' shortlist-na-tl-seg--open'
            : ' shortlist-na-tl-seg--core';
      return (
        '<div class="shortlist-na-tl-seg' +
        extra +
        '" style="top:' +
        pct(seg.startMs) +
        '%;height:' +
        hPct(seg.startMs, seg.endMs) +
        '%"></div>'
      );
    });

    var auxChunks = [];
    plan.segments.forEach(function (seg) {
      if (seg.kind !== 'travel' && seg.kind !== 'debrief') return;
      var hp = hPct(seg.startMs, seg.endMs);
      var slotH = Math.max(40, (hp / 100) * trackH);
      var range = formatCalendarSlotRange(seg.startMs, seg.endMs);
      var kindLabel = seg.kind === 'travel' ? 'Travel' : 'Debrief';
      var hint =
        seg.kind === 'travel' ? 'En route (30 min)' : 'Post-tour debrief (30 min)';
      auxChunks.push(
        '<div class="shortlist-na-tl-aux-slot" style="top:' +
        pct(seg.startMs) +
        '%;min-height:' +
        Math.round(slotH) +
        'px">' +
        '<div class="shortlist-na-tl-aux shortlist-na-tl-aux--' +
        seg.kind +
        '" role="group" aria-label="' +
        escapeAttr(kindLabel + ', ' + range) +
        '">' +
        '<span class="shortlist-na-tl-aux-kind">' +
        escapeHtml(kindLabel) +
        '</span>' +
        '<span class="shortlist-na-tl-aux-meta">' +
        escapeHtml(range) +
        '</span>' +
        '<span class="shortlist-na-tl-aux-hint">' +
        escapeHtml(hint) +
        '</span>' +
        '</div></div>'
      );
    });

    var cardChunks = [];
    sortedList.forEach(function (ev) {
      var topMs;
      var hMs;
      var tourTimeForBlock = null;
      if (ev.kind === 'tour') {
        topMs = ev.sortTs;
        hMs = CAL_TOUR_MS;
        tourTimeForBlock = { startMs: topMs, endMs: topMs + CAL_TOUR_MS };
      } else {
        topMs = ev.sortTs;
        hMs = CAL_SLOT_MS;
        tourTimeForBlock = null;
      }
      var topPctC = pct(topMs);
      var slotHpx = Math.max(52, (hMs / durMs) * trackH);
      var blockHtml = renderNextActionsEventBlock(ev, tourTimeForBlock);
      cardChunks.push(
        '<div class="shortlist-na-tl-card-slot" style="top:' +
        topPctC +
        '%;min-height:' +
        Math.round(slotHpx) +
        'px">' +
        blockHtml +
        '</div>'
      );
    });

    return (
      '<div class="shortlist-na-day-summary-shell" role="region" aria-label="Day timeline for ' +
      escapeAttr(formatCalendarDayHeading(dk)) +
      '">' +
      '<div class="shortlist-na-tl-wrap" style="height:' +
      Math.round(trackH) +
      'px;--na-tl-step-pct:' +
      stepPct +
      '%">' +
      '<div class="shortlist-na-tl-times">' +
      labelChunks.join('') +
      '</div>' +
      '<div class="shortlist-na-tl-rail" role="presentation">' +
      '<div class="shortlist-na-tl-grid"></div>' +
      segChunks.join('') +
      '</div>' +
      '<div class="shortlist-na-tl-cards">' +
      auxChunks.join('') +
      cardChunks.join('') +
      '</div>' +
      '</div></div>'
    );
  }

  function formatCalendarSlotRange(startMs, endMs) {
    var a = new Date(startMs);
    var b = new Date(endMs);
    if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return '';
    var opt = { hour: 'numeric', minute: '2-digit' };
    return a.toLocaleString('en-US', opt) + ' – ' + b.toLocaleString('en-US', opt);
  }

  function naCalendarMetaSep() {
    return '<span class="shortlist-na-meta-sep" aria-hidden="true">|</span>';
  }

  /** One-line subtitle under banner: street (+ unit), neighborhood — e.g. "213 Ash …, Fort Greene". */
  function formatCalendarSubtitleAddress(apartment) {
    var addr = apartment.address && String(apartment.address).trim();
    var unit = apartment.apt_number && String(apartment.apt_number).trim();
    var hood = apartment.neighborhood && String(apartment.neighborhood).trim();
    var line = '';
    if (addr) {
      line = addr;
      if (unit) {
        var uCore = unit.replace(/^#/, '');
        if (uCore && line.indexOf(uCore) === -1) {
          line += unit.indexOf('#') === 0 ? ' ' + unit : ' #' + uCore;
        }
      }
    } else if (unit) {
      line = unit.indexOf('#') === 0 ? unit : '#' + unit.replace(/^#/, '');
    }
    if (hood) {
      return line ? line + ', ' + hood : hood;
    }
    return line;
  }

  function renderCalendarFreeSlotRow(row) {
    var range = formatCalendarSlotRange(row.startMs, row.endMs);
    return (
      '<div class="shortlist-na-slot-row shortlist-na-slot-row--free" role="presentation">' +
      '<div class="shortlist-na-slot-banner">' +
      '<span class="shortlist-na-slot-kind">Open</span>' +
      naCalendarMetaSep() +
      '<span class="shortlist-na-slot-range">' +
      escapeHtml(range) +
      '</span></div>' +
      '<div class="shortlist-na-slot-sub muted"><span class="shortlist-na-slot-free-label">30 min · not booked</span></div>' +
      '</div>'
    );
  }

  function renderCalendarTravelRow(row) {
    var range = formatCalendarSlotRange(row.startMs, row.endMs);
    return (
      '<div class="shortlist-na-slot-row shortlist-na-slot-row--travel" role="presentation">' +
      '<div class="shortlist-na-slot-banner">' +
      '<span class="shortlist-na-slot-kind">Travel</span>' +
      naCalendarMetaSep() +
      '<span class="shortlist-na-slot-range">' +
      escapeHtml(range) +
      '</span></div>' +
      '<div class="shortlist-na-slot-sub muted">' +
      '<span class="shortlist-na-travel-label">En route (30 min)</span>' +
      '</div></div>'
    );
  }

  function renderCalendarDebriefRow(row) {
    var range = formatCalendarSlotRange(row.startMs, row.endMs);
    return (
      '<div class="shortlist-na-slot-row shortlist-na-slot-row--debrief" role="presentation">' +
      '<div class="shortlist-na-slot-banner">' +
      '<span class="shortlist-na-slot-kind">Debrief</span>' +
      naCalendarMetaSep() +
      '<span class="shortlist-na-slot-range">' +
      escapeHtml(range) +
      '</span></div>' +
      '<div class="shortlist-na-slot-sub">' +
      '<span class="shortlist-na-debrief-label">Post-tour debrief (30 min)</span>' +
      '</div></div>'
    );
  }

  function renderCalendarAgendaBreak() {
    return '<div class="shortlist-na-agenda-break" role="separator" aria-hidden="true"></div>';
  }

  function buildCalendarPrintTocHtml(apartments) {
    var events = collectNextActionEvents(apartments);
    if (!events.length) return '';
    var byDay = {};
    events.forEach(function (ev) {
      var k = ev.dayKey;
      if (!byDay[k]) byDay[k] = [];
      byDay[k].push(ev);
    });
    var dayKeys = Object.keys(byDay).sort();
    var chunks = [];
    var rowNum = 0;
    dayKeys.forEach(function (dk) {
      var list = byDay[dk].slice().sort(function (a, b) {
        return a.sortTs - b.sortTs;
      });
      chunks.push(
        '<section class="shortlist-na-toc-day-block">' +
        '<h3 class="shortlist-na-toc-day-heading">' +
        escapeHtml(formatCalendarDayHeading(dk)) +
        '</h3>' +
        '<table class="shortlist-na-toc-table">' +
        '<thead><tr>' +
        '<th class="shortlist-na-toc-th shortlist-na-toc-th--num" scope="col">#</th>' +
        '<th class="shortlist-na-toc-th shortlist-na-toc-th--time" scope="col">When</th>' +
        '<th class="shortlist-na-toc-th shortlist-na-toc-th--type" scope="col">Type</th>' +
        '<th class="shortlist-na-toc-th shortlist-na-toc-th--listing" scope="col">Listing</th>' +
        '</tr></thead><tbody>'
      );
      list.forEach(function (ev) {
        rowNum += 1;
        var apt = ev.apt;
        var title = String(apt.title || 'Untitled apartment').trim();
        var hood = (apt.neighborhood && String(apt.neighborhood).trim()) || '';
        var kindLabel =
          ev.kind === 'tour' ? 'Tour' : ev.kind === 'deadline' ? 'App deadline' : 'Move-in';
        var kindClass =
          ev.kind === 'tour' ? 'tour' : ev.kind === 'deadline' ? 'deadline' : 'movein';
        var timeStr;
        if (ev.kind === 'tour') {
          var T = ev.sortTs;
          timeStr = formatCalendarSlotRange(T - CAL_TRAVEL_MS, tourBlockEndAfterStart(T));
        } else {
          timeStr = formatEventTimeOrAllDay(ev);
        }
        var starToc =
          typeof NyhomeListingStar !== 'undefined' ? NyhomeListingStar.displayHtmlIfStarred(apt) : '';
        chunks.push(
          '<tr class="shortlist-na-toc-tr">' +
          '<td class="shortlist-na-toc-td shortlist-na-toc-td--num">' +
          escapeHtml(String(rowNum)) +
          '</td>' +
          '<td class="shortlist-na-toc-td shortlist-na-toc-td--time">' +
          escapeHtml(timeStr) +
          '</td>' +
          '<td class="shortlist-na-toc-td shortlist-na-toc-td--type">' +
          '<span class="shortlist-na-toc-badge shortlist-na-toc-badge--' +
          escapeAttr(kindClass) +
          '">' +
          escapeHtml(kindLabel) +
          '</span></td>' +
          '<td class="shortlist-na-toc-td shortlist-na-toc-td--listing">' +
          '<span class="shortlist-na-toc-titlecell">' +
          starToc +
          '<span class="shortlist-na-toc-listingname">' +
          escapeHtml(title) +
          '</span>' +
          '</span>' +
          (hood
            ? '<span class="shortlist-na-toc-hoodcell">' + escapeHtml(hood) + '</span>'
            : '') +
          '</td></tr>'
        );
      });
      chunks.push('</tbody></table></section>');
    });
    return (
      '<nav class="shortlist-na-print-toc" aria-label="Itinerary overview">' +
      '<header class="shortlist-na-print-toc-header">' +
      '<p class="shortlist-na-print-toc-eyebrow">nyhome</p>' +
      '<h2 class="shortlist-na-toc-heading">Itinerary overview</h2>' +
      '<p class="shortlist-na-print-toc-lede">Tour rows include travel, visit, and debrief windows. Other rows show the scheduled time.</p>' +
      '</header>' +
      '<div class="shortlist-na-toc-sections">' +
      chunks.join('') +
      '</div></nav>'
    );
  }

  function nextNavStatus(current) {
    var nav = NyhomeStatus.STATUS_NAV;
    var s = NyhomeStatus.normalizeStatus(current || 'new');
    if (s === 'rejected') return null;
    var i = nav.indexOf(s);
    if (i < 0 || i >= nav.length - 1) return null;
    return nav[i + 1];
  }

  function formatShortDateTime(value) {
    if (!value) return '';
    var d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value).slice(0, 16);
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  }

  function pad2(n) {
    return n < 10 ? '0' + n : String(n);
  }

  function dayKeyFromMs(ms) {
    var d = new Date(ms);
    if (Number.isNaN(d.getTime())) return null;
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function parseMoveInNoonMs(isoDate) {
    var s = String(isoDate || '').trim();
    if (!s) return NaN;
    var t = Date.parse(s + 'T12:00:00');
    return Number.isNaN(t) ? Date.parse(s) : t;
  }

  function formatCalendarDayHeading(dayKey) {
    var t = Date.parse(dayKey + 'T12:00:00');
    if (Number.isNaN(t)) return dayKey;
    return new Date(t).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  }

  function formatEventTimeOrAllDay(ev) {
    if (ev.kind === 'movein') return 'All day';
    if (Number.isNaN(ev.sortTs)) return '';
    var d = new Date(ev.sortTs);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit' });
  }

  function collectNextActionEvents(apartments) {
    var out = [];
    apartments.forEach(function (apt) {
      if (apt.next_visit && apt.next_visit.visit_at) {
        var ts = Date.parse(apt.next_visit.visit_at);
        if (!Number.isNaN(ts)) {
          var dk = dayKeyFromMs(ts);
          if (dk) out.push({ apt: apt, kind: 'tour', sortTs: ts, dayKey: dk });
        }
      }
      if (apt.application && apt.application.deadline_at) {
        var ts2 = Date.parse(apt.application.deadline_at);
        if (!Number.isNaN(ts2)) {
          var dk2 = dayKeyFromMs(ts2);
          if (dk2) out.push({ apt: apt, kind: 'deadline', sortTs: ts2, dayKey: dk2 });
        }
      }
      if (hasMoveInDate(apt)) {
        var ts3 = parseMoveInNoonMs(apt.move_in_date);
        if (!Number.isNaN(ts3)) {
          var dk3 = dayKeyFromMs(ts3);
          if (dk3) out.push({ apt: apt, kind: 'movein', sortTs: ts3, dayKey: dk3 });
        }
      }
    });
    return out;
  }

  /** Shared Next / Reject controls for next-actions list + calendar.
   * @param {{sepBeforeReject?: boolean}} opts - if true, insert a '|' divider before reject (compact banner row). */
  function nextActionsAdvanceRejectHtml(apartment, opts) {
    opts = opts || {};
    var id = apartment.id;
    var status = NyhomeStatus.normalizeStatus(apartment.status || 'new');
    var nextS = nextNavStatus(status);
    var isRejected = status === 'rejected';
    var advanceBtn;
    if (!isRejected && nextS) {
      advanceBtn =
        '<button type="button" class="secondary-btn shortlist-next-actions-advance" data-advance-status data-apartment-id="' +
        escapeAttr(String(id)) +
        '" aria-label="Move to next status">Next: ' +
        escapeHtml(formatStatusLabel(nextS)) +
        '</button>';
    } else {
      advanceBtn =
        '<button type="button" class="secondary-btn shortlist-next-actions-advance" disabled data-apartment-id="' +
        escapeAttr(String(id)) +
        '">' +
        escapeHtml(isRejected ? 'Rejected' : 'At pipeline end') +
        '</button>';
    }
    var rejectCtrl = isRejected
      ? '<span class="shortlist-next-actions-reject muted" aria-disabled="true">Rejected</span>'
      : '<button type="button" class="shortlist-next-actions-reject link-button" data-reject-apartment data-apartment-id="' +
        escapeAttr(String(id)) +
        '">Reject</button>';
    var pipe =
      opts.sepBeforeReject && !isRejected
        ? '<span class="shortlist-na-meta-sep" aria-hidden="true">|</span>'
        : '';
    return advanceBtn + pipe + rejectCtrl;
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

  function buildFinalistExpandHtml(apartment) {
    var id = apartment.id;
    var href = id != null ? '/details/?id=' + encodeURIComponent(id) : '#';
    var s = apartment.scores || {};
    var urls = (apartment.images || []).map(function (i) {
      return i && i.image_url;
    }).filter(Boolean).slice(0, 3);
    var thumbs =
      urls.length === 0
        ? ''
        : '<div class="finalist-mobile-expanded-thumbs">' +
          urls.map(function (url) {
            return (
              '<div class="finalist-mobile-expanded-thumb"><img src="' +
              escapeAttr(url) +
              '" alt="" loading="lazy"></div>'
            );
          }).join('') +
          '</div>';
    var rentV = apartment.rent_cents ? formatMoney(apartment.rent_cents) + '/mo' : '—';
    var netV = apartment.net_effective_cents ? formatMoney(apartment.net_effective_cents) + '/mo' : '—';
    var moveV = apartment.total_move_in_cents != null ? formatMoney(apartment.total_move_in_cents) : '—';
    var pct = function (v) {
      return v != null && !isNaN(Number(v)) ? Math.round(Number(v)) + '%' : '—';
    };
    return (
      thumbs +
      '<div class="finalist-mobile-expanded-stats">' +
      '<div class="finalist-mobile-stat"><span class="finalist-mobile-stat-label">Rent</span>' +
      '<span class="finalist-mobile-stat-value">' + escapeHtml(rentV) + '</span></div>' +
      '<div class="finalist-mobile-stat"><span class="finalist-mobile-stat-label">Net eff.</span>' +
      '<span class="finalist-mobile-stat-value">' + escapeHtml(netV) + '</span></div>' +
      '<div class="finalist-mobile-stat"><span class="finalist-mobile-stat-label">Move-in</span>' +
      '<span class="finalist-mobile-stat-value">' + escapeHtml(moveV) + '</span></div>' +
      '<div class="finalist-mobile-stat"><span class="finalist-mobile-stat-label">Beds</span>' +
      '<span class="finalist-mobile-stat-value">' +
      escapeHtml(apartment.bedrooms != null ? String(apartment.bedrooms) : '—') +
      '</span></div>' +
      '</div>' +
      '<div class="finalist-mobile-expanded-scores">' +
      '<div class="finalist-mobile-score finalist-mobile-score--avg"><span class="finalist-mobile-score-label">Avg</span>' +
      '<span class="finalist-mobile-score-val">' + escapeHtml(pct(s.combined)) + '</span></div>' +
      '<div class="finalist-mobile-score finalist-mobile-score--kerv"><span class="finalist-mobile-score-label">Kerv</span>' +
      '<span class="finalist-mobile-score-val">' + escapeHtml(pct(s.kerv)) + '</span></div>' +
      '<div class="finalist-mobile-score finalist-mobile-score--peter"><span class="finalist-mobile-score-label">Peter</span>' +
      '<span class="finalist-mobile-score-val">' + escapeHtml(pct(s.peter)) + '</span></div>' +
      '</div>' +
      '<div class="finalist-mobile-expanded-actions">' +
      '<a class="link-button" href="' + escapeAttr(href) + '">Details</a>' +
      actionLink('Listing', apartment.listing_url, true) +
      '</div>'
    );
  }

  function wireFinalistMobileExpand() {
    if (!listEl) return;
    listEl.querySelectorAll('.shortlist-finalist-line[data-finalist-id]').forEach(function (anchor) {
      anchor.addEventListener('click', function (e) {
        if (!isShortlistMobile()) return;
        if (e.target.closest && e.target.closest('.shortlist-finalist-external-listing')) return;
        e.preventDefault();
        e.stopPropagation();
        var cluster = anchor.closest('.shortlist-finalist-cluster');
        if (!cluster) return;
        var id = anchor.getAttribute('data-finalist-id');
        var existing = cluster.querySelector('.finalist-mobile-expanded');
        if (existing) {
          existing.remove();
          anchor.classList.remove('finalist-row--expanded');
          return;
        }
        listEl.querySelectorAll('.finalist-mobile-expanded').forEach(function (n) {
          n.remove();
        });
        listEl.querySelectorAll('.shortlist-finalist-line').forEach(function (a) {
          a.classList.remove('finalist-row--expanded');
        });
        var apt = allApartments.find(function (a) {
          return String(a.id) === String(id);
        });
        if (!apt) return;
        anchor.classList.add('finalist-row--expanded');
        var exp = document.createElement('div');
        exp.className = 'finalist-mobile-expanded';
        exp.innerHTML = buildFinalistExpandHtml(apt);
        cluster.appendChild(exp);
      });
    });
  }

  function wireCardDupButtons() {
    if (!listEl) return;
    listEl.querySelectorAll('.apt-dup-btn').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var id = btn.getAttribute('data-apartment-id');
        var apt = allApartments.find(function (a) {
          return String(a.id) === String(id);
        });
        if (apt) showDuplicateSheet(apt);
      });
    });
  }

  /** Cards only: click star cycles DB value via shared save payload + refetch. */
  function wireCardListingStars() {
    if (!listEl || typeof NyhomeListingStar === 'undefined') return;
    listEl.querySelectorAll('[data-listing-star-cycle]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var id = btn.getAttribute('data-listing-star-cycle');
        var apt = allApartments.find(function (a) {
          return String(a.id) === String(id);
        });
        if (!apt) return;
        var tier = NyhomeListingStar.normalizeTier(apt);
        var next = NyhomeListingStar.cycleDbValue(tier);
        NyhomeAPI.saveApartment(
          NyhomeApartmentPayload.apartmentToSavePayload(apt, {
            listingStar: next,
            /** Updates to existing listings at a blacklisted building should still be allowed (parity with Duplicate flow using ignore flags). Starring alone should not trap users in blacklist modal territory. */
            ignoreBlacklist: true,
          })
        )
          .then(function () {
            return NyhomeAPI.getApartments();
          })
          .then(function (data) {
            // If `listing_star` is missing on rows (stale cache / old GET), `normalizeTier` stayed 0 and every
            // save sent 1=Peter. Merge the value we just persisted so the UI and tier cycle match reality.
            var idStr = String(id);
            var merged = (data.apartments || []).map(function (a) {
              if (String(a.id) !== idStr) return a;
              var row = Object.assign({}, a);
              row.listing_star = next == null ? null : next;
              return row;
            });
            var payload = {
              apartments: merged,
              criteria: data.criteria,
              neighborhoods: data.neighborhoods,
            };
            if (typeof NyhomeAPI.setApartmentsCache === 'function') {
              NyhomeAPI.setApartmentsCache(payload);
            }
            render(payload);
          })
          .catch(function (err) {
            console.error('[nyhome-shortlist] listing star', err);
            var parts = [];
            if (err && err.message) parts.push(err.message);
            if (err && err.status) parts.push('HTTP ' + err.status);
            if (err && err.code && parts.indexOf(String(err.code)) < 0) parts.push(err.code);
            var msg = 'Could not save star:\n\n' + parts.filter(Boolean).join('\n');
            if (typeof NyhomeUiFeedback !== 'undefined' && NyhomeUiFeedback.alert) {
              NyhomeUiFeedback.alert(msg, { title: 'Could not save star' });
            } else if (window.alert) {
              window.alert(msg);
            }
          });
      });
    });
  }

  function closeDuplicateSheet() {
    dupSheetSourceApartment = null;
    var el = document.getElementById('m-dup-sheet-root');
    if (el) el.remove();
  }

  function showDuplicateSheet(apt) {
    var prev = document.getElementById('m-dup-sheet-root');
    if (prev) prev.remove();
    dupSheetSourceApartment = apt;
    var root = document.createElement('div');
    root.id = 'm-dup-sheet-root';
    root.className = 'm-dup-sheet-overlay';
    root.innerHTML =
      '<div class="m-dup-sheet" role="dialog" aria-modal="true" aria-labelledby="m-dup-sheet-title">' +
      '<div class="m-dup-sheet-handle" aria-hidden="true"></div>' +
      '<h2 class="m-dup-sheet-title" id="m-dup-sheet-title">Duplicate listing</h2>' +
      '<p class="m-dup-sheet-desc">Copying: <strong>' +
      escapeHtml(apt.title || 'Listing') +
      '</strong>. All details pre-filled—set the new unit.</p>' +
      '<label class="m-dup-label">New unit number' +
      '<input type="text" class="m-dup-input" id="m-dup-apt-input" autocomplete="off" placeholder="e.g. 14D"></label>' +
      '<div class="m-dup-actions">' +
      '<button type="button" class="secondary-btn" data-dup-cancel>Cancel</button>' +
      '<button type="button" class="primary-btn" data-dup-confirm>Duplicate and edit</button>' +
      '</div></div>';
    document.body.appendChild(root);
    var input = root.querySelector('#m-dup-apt-input');
    if (input) {
      try {
        input.focus();
      } catch (err) { /* empty */ }
    }
    root.querySelector('[data-dup-cancel]').addEventListener('click', closeDuplicateSheet);
    root.querySelector('[data-dup-confirm]').addEventListener('click', confirmDuplicateFromSheet);
    root.addEventListener('click', function (e) {
      if (e.target === root) closeDuplicateSheet();
    });
  }

  function confirmDuplicateFromSheet() {
    var apt = dupSheetSourceApartment;
    if (!apt) return;
    var input = document.getElementById('m-dup-apt-input');
    var unit = input && input.value.trim();
    if (!unit) {
      if (typeof NyhomeUiFeedback !== 'undefined' && NyhomeUiFeedback.alert) {
        NyhomeUiFeedback.alert('Enter a unit number for the duplicate.', { title: 'Duplicate listing' });
      } else if (window.alert) {
        window.alert('Enter a unit number for the duplicate.');
      }
      return;
    }
    var payload = NyhomeApartmentPayload.apartmentToSavePayload(apt, { aptNumber: unit });
    delete payload.id;
    closeDuplicateSheet();
    NyhomeSaveWorkflow.saveApartmentRespectingBlacklist(NyhomeAPI.saveApartment, function (forRetry) {
      if (forRetry) payload.ignoreBlacklist = true;
      return payload;
    })
      .then(function (res) {
        var newId = res && res.id != null ? res.id : null;
        if (newId != null) {
          window.location.href = '/details/?id=' + encodeURIComponent(newId) + '&tab=unit';
        } else {
          return NyhomeAPI.getApartments().then(render);
        }
      })
      .catch(function (err) {
        console.error('[nyhome-shortlist] duplicate', err);
        if (typeof NyhomeUiFeedback !== 'undefined' && NyhomeUiFeedback.alert) {
          NyhomeUiFeedback.alert('Could not duplicate listing.', { title: 'Duplicate listing' });
        } else if (window.alert) {
          window.alert('Could not duplicate listing.');
        }
      });
  }

  function closeTourScreen() {
    tourScreenApartment = null;
    var el = document.getElementById('m-tour-overlay');
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  function renderTourScreenHtml(apt) {
    var visit = apt.next_visit || {};
    return (
      '<div id="m-tour-overlay" role="dialog" aria-modal="true" aria-label="Tour worksheet">' +
      '<div class="m-tour-header">' +
      '<div class="m-tour-header-nav">' +
      '<button type="button" class="m-tour-back-btn" data-tour-close>Back</button>' +
      '</div>' +
      '<h2 class="m-tour-title">' +
      escapeHtml(apt.title || 'Listing') +
      '</h2>' +
      '<p class="m-tour-sub">' +
      escapeHtml((apt.neighborhood && String(apt.neighborhood).trim()) || 'Neighborhood TBD') +
      '</p>' +
      '</div>' +
      '<div class="m-tour-content">' +
      nextActionsListingSpecStrip(apt) +
      '<div class="m-tour-section">' +
      '<div class="m-tour-section-title">Tour notes</div>' +
      '<div class="m-tour-section-body">' +
      '<textarea class="m-tour-notes-area" id="m-tour-notes" rows="5" placeholder="Notes from the tour">' +
      escapeHtml(visit.notes || '') +
      '</textarea>' +
      '</div></div></div>' +
      '<div class="m-tour-action-bar">' +
      '<button type="button" class="secondary-btn" data-tour-close>Close</button>' +
      '<button type="button" class="primary-btn" data-tour-save>Save notes</button>' +
      '</div></div>'
    );
  }

  function showTourScreen(apt) {
    closeTourScreen();
    tourScreenApartment = apt;
    var wrap = document.createElement('div');
    wrap.innerHTML = renderTourScreenHtml(apt);
    var overlay = wrap.firstElementChild;
    document.body.appendChild(overlay);
    overlay.querySelectorAll('[data-tour-close]').forEach(function (b) {
      b.addEventListener('click', closeTourScreen);
    });
    var saveBtn = overlay.querySelector('[data-tour-save]');
    if (saveBtn) {
      saveBtn.addEventListener('click', function () {
        saveTourScreenNotes();
      });
    }
  }

  function saveTourScreenNotes() {
    var apt = tourScreenApartment;
    if (!apt || !apt.id) return;
    var ta = document.getElementById('m-tour-notes');
    var notes = ta ? ta.value : '';
    var visit = apt.next_visit || {};
    NyhomeAPI.saveVisit({
      apartmentId: apt.id,
      visitAt: visit.visit_at || '',
      notes: notes,
    })
      .then(function () {
        return NyhomeAPI.getApartments();
      })
      .then(render)
      .then(function () {
        closeTourScreen();
      })
      .catch(function (err) {
        console.error('[nyhome-shortlist] tour worksheet save', err);
        if (typeof NyhomeUiFeedback !== 'undefined' && NyhomeUiFeedback.alert) {
          NyhomeUiFeedback.alert('Could not save tour notes.', { title: 'Tour notes' });
        } else if (window.alert) {
          window.alert('Could not save tour notes.');
        }
      });
  }

  function wireNAToolbarToggle() {
    if (!listEl) return;
    var toggle = listEl.querySelector('.na-mobile-toolbar-toggle');
    var row = listEl.querySelector('.shortlist-next-actions-toolbar-row');
    if (!toggle || !row) return;
    if (!isShortlistMobile()) {
      row.removeAttribute('hidden');
      return;
    }
    row.setAttribute('hidden', '');
    toggle.setAttribute('aria-expanded', 'false');
    var hint = toggle.querySelector('.na-mobile-toolbar-hint');
    if (hint) hint.textContent = 'Show';
    toggle.addEventListener('click', function () {
      var open = row.hasAttribute('hidden');
      if (open) {
        row.removeAttribute('hidden');
        toggle.setAttribute('aria-expanded', 'true');
        if (hint) hint.textContent = 'Hide';
      } else {
        row.setAttribute('hidden', '');
        toggle.setAttribute('aria-expanded', 'false');
        if (hint) hint.textContent = 'Show';
      }
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
    var colAttr = scoreKey === 'combined' ? '' : ' data-finalist-col="' + escapeAttr(scoreKey) + '"';
    var inner = '<span class="shortlist-finalist-pct shortlist-finalist-pct--' + escapeAttr(scoreKey) +
      (empty ? ' shortlist-finalist-pct--empty' : '') + '">' + escapeHtml(pct) + '</span>';
    return '<span class="' + cls + '"' + colAttr + '>' + inner + '</span>';
  }

  /** One grid cell: external site. Not inside the row-to-details link(s). Column sits before Avg. */
  function finalistExternalListingCell(apartment) {
    var u = apartment.listing_url && String(apartment.listing_url).trim();
    if (u) {
      return (
        '<span class="shortlist-finalist-c shortlist-finalist-c--ext" data-finalist-col="ext">' +
        '<a class="shortlist-finalist-external-listing shortlist-finalist-ext-link" href="' +
        escapeAttr(u) +
        '" target="_blank" rel="noreferrer">Listing</a>' +
        '</span>'
      );
    }
    return (
      '<span class="shortlist-finalist-c shortlist-finalist-c--ext" data-finalist-col="ext">' +
      '<span class="shortlist-finalist-ext-missing" aria-hidden="true">—</span>' +
      '</span>'
    );
  }

  function buildFinalistRowBeforeUrlHtml(apartment, ord) {
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
    var starDisplay =
      typeof NyhomeListingStar !== 'undefined' ? NyhomeListingStar.displayHtmlIfStarred(apartment) : '';
    return (
      '<span class="shortlist-finalist-c shortlist-finalist-c--ord">' + escapeHtml(String(ord)) + '</span>' +
      '<span class="shortlist-finalist-c shortlist-finalist-c--place">' +
        '<span class="shortlist-finalist-place-row">' +
        starDisplay +
        '<span class="shortlist-finalist-place-txt">' + escapeHtml(place) + '</span>' +
        listingThumbsMarkup(apartment) +
        '</span></span>' +
      '<span class="shortlist-finalist-c shortlist-finalist-c--money shortlist-finalist-c--right" data-finalist-col="rent">' + escapeHtml(rentCell) + '</span>' +
      '<span class="shortlist-finalist-c shortlist-finalist-c--money shortlist-finalist-c--right" data-finalist-col="net">' + escapeHtml(netCell) + '</span>' +
      '<span class="shortlist-finalist-c shortlist-finalist-c--money shortlist-finalist-c--right" data-finalist-col="move">' + escapeHtml(moveInCell) + '</span>' +
      '<span class="shortlist-finalist-c shortlist-finalist-c--bed" data-finalist-col="bed">' + escapeHtml(bedBath) + '</span>'
    );
  }

  function buildFinalistRowAfterUrlHtml(apartment) {
    var s = apartment.scores || {};
    var status = NyhomeStatus.normalizeStatus(apartment.status || 'new');
    var label = formatStatusLabel(status);
    return (
      finalistScoreSpan('combined', s.combined) +
      finalistScoreSpan('kerv', s.kerv) +
      finalistScoreSpan('peter', s.peter) +
      '<span class="shortlist-finalist-c shortlist-finalist-c--status" data-finalist-col="status">' +
        '<span class="status-pill ' + NyhomeStatus.statusClass(status) + ' shortlist-finalist-pill">' + escapeHtml(label) + '</span>' +
      '</span>'
    );
  }

  function render(data) {
    allApartments = data.apartments || [];
    pruneHoodFilter();
    renderSummary(allApartments);
    renderFilterBar(allApartments);

    if (allApartments.length === 0) {
      listEl.classList.remove('card-list--finalist');
      listEl.classList.remove('card-list--next-actions');
      listEl.innerHTML = '<div class="empty-state">No apartments yet. Add the first one in Manage.</div>';
      hideFinalistFlyout();
      return;
    }

    applyFilters();
  }

  function renderSummary(apartments) {
    var groups =
      typeof NyhomeStatusFilterGroups !== 'undefined' && NyhomeStatusFilterGroups.GROUPS
        ? NyhomeStatusFilterGroups.GROUPS
        : [];
    if (!summaryEl) return;
    if (!groups.length) {
      summaryEl.innerHTML = '';
      return;
    }
    var html = groups
      .map(function (g) {
        return summaryKpiCard(
          countListingsInStatusGroup(apartments, g.statuses),
          g.label,
          g.id
        );
      })
      .join('');
    summaryEl.innerHTML = html;
  }

  /** How many loaded listings fall into a pipeline group (same buckets as the filters drawer). */
  function countListingsInStatusGroup(apartments, statuses) {
    if (!apartments || !statuses || !statuses.length) return 0;
    var n = 0;
    for (var i = 0; i < apartments.length; i++) {
      var s = NyhomeStatus.normalizeStatus(apartments[i].status);
      if (statuses.indexOf(s) >= 0) n += 1;
    }
    return n;
  }

  function summaryKpiCard(value, label, groupId) {
    return (
      '<article class="summary-card summary-kpi summary-kpi--' +
      escapeAttr(groupId) +
      '"><span class="summary-value">' +
      escapeHtml(String(value)) +
      '</span><span class="summary-label">' +
      escapeHtml(label) +
      '</span></article>'
    );
  }

  function buildStatusFilterButtonHtml(status, counts) {
    var count = counts[status] || 0;
    var isActive = activeFilters.has(status);
    var isEmpty = count === 0;
    var cls = 'status-filter-btn' + (isActive ? ' active' : '') + (isEmpty ? ' empty' : '');
    return (
      '<button type="button" class="' + cls + '" data-filter-status="' + escapeAttr(status) + '" aria-pressed="' + isActive + '">' +
      '<img src="/assets/img/' + escapeAttr(status) + '.png" alt="' + escapeAttr(formatStatusLabel(status)) + '" width="80" height="80">' +
      '<span class="status-filter-count">' + count + '</span>' +
      '<span class="status-filter-label">' + escapeHtml(formatStatusLabel(status)) + '</span>' +
      '</button>'
    );
  }

  function renderFilterBar(apartments) {
    if (!filterEl) return;

    var wasDrawerOpen = isFiltersDrawerOpen();

    var counts = {};
    NyhomeStatus.STATUS_ORDER.forEach(function (s) { counts[s] = 0; });
    apartments.forEach(function (a) {
      var s = NyhomeStatus.normalizeStatus(a.status);
      counts[s] = (counts[s] || 0) + 1;
    });

    var statusGroupsHtml = (typeof NyhomeStatusFilterGroups !== 'undefined' && NyhomeStatusFilterGroups.GROUPS
      ? NyhomeStatusFilterGroups.GROUPS
      : []
    ).map(function (g) {
      var cells = g.statuses
        .map(function (s) {
          return buildStatusFilterButtonHtml(s, counts);
        })
        .join('');
      return (
        '<section class="status-filter-group" data-status-group="' +
        escapeAttr(g.id) +
        '" aria-label="' +
        escapeAttr(g.label) +
        '">' +
        '<h3 class="status-filter-group-title">' +
        escapeHtml(g.label) +
        '</h3>' +
        '<div class="status-filter-group-chips" role="group">' +
        cells +
        '</div></section>'
      );
    }).join('');

    var hasClear = activeFilters.size > 0;
    var activeSummary = hasClear ? ' <span class="status-filter-active-summary">(' + activeFilters.size + ' selected)</span>' : '';
    var hoods = distinctNeighborhoods(apartments);
    var showHoodClear = hoodFilter.size > 0;
    var neighborhoodBlock;
    if (hoods.length === 0) {
      neighborhoodBlock =
        '<div class="status-filter-hood-block status-filter-hood-block--empty">' +
        '<span class="status-filter-hood-heading">Neighborhood</span>' +
        '<p class="status-filter-hood-empty muted">No neighborhood set on your listings yet. Add one in Manage.</p>' +
        '</div>';
    } else {
      neighborhoodBlock =
        '<div class="status-filter-hood-block">' +
        '<div class="status-filter-hood-head">' +
        '<span class="status-filter-hood-heading">Neighborhood</span>' +
        (showHoodClear
          ? '<button type="button" class="link-button status-filter-hood-clear" data-hood-clear>Clear</button>'
          : '') +
        '</div>' +
        '<div class="status-filter-hood-chips" role="group" aria-label="Filter by neighborhood. Tap a name; multiple allowed.">' +
        hoods
          .map(function (name) {
            var on = hoodFilter.has(name);
            return (
              '<button type="button" class="status-filter-pill' +
              (on ? ' active' : '') +
              '" data-hood-chip data-hood-name="' +
              escapeAttr(name) +
              '" aria-pressed="' +
              (on ? 'true' : 'false') +
              '">' +
              escapeHtml(name) +
              '</button>'
            );
          })
          .join('') +
        '</div></div>';
    }
    var extraLine =
      '<div class="status-filter-extras">' +
        '<div class="status-filter-pills" role="group" aria-label="Narrow by listing">' +
        '<button type="button" class="status-filter-pill' +
        (extraFilterNotVoted ? ' active' : '') +
        '" data-filter-pill="not-voted" aria-pressed="' +
        (extraFilterNotVoted ? 'true' : 'false') +
        '">Not voted</button>' +
        '<button type="button" class="status-filter-pill' +
        (extraFilterLinkMissing ? ' active' : '') +
        '" data-filter-pill="link-missing" aria-pressed="' +
        (extraFilterLinkMissing ? 'true' : 'false') +
        '">Link missing</button>' +
        '</div>' +
        neighborhoodBlock +
      '</div>';

    var naNextActionsDatesDrawer =
      '<section class="status-filter-na-row" aria-labelledby="status-filter-na-title">' +
      '<h3 class="status-filter-group-title" id="status-filter-na-title">Next actions</h3>' +
      '<div class="status-filter-na-checks" role="group" aria-labelledby="status-filter-na-title">' +
      '<label class="shortlist-na-check status-filter-na-label"><input type="checkbox" data-na-omit="tour"' +
      (naOmitTour ? ' checked' : '') +
      '> Tour</label>' +
      '<label class="shortlist-na-check status-filter-na-label"><input type="checkbox" data-na-omit="deadline"' +
      (naOmitDeadline ? ' checked' : '') +
      '> App deadline</label>' +
      '<label class="shortlist-na-check status-filter-na-label"><input type="checkbox" data-na-omit="movein"' +
      (naOmitMoveIn ? ' checked' : '') +
      '> Move-in</label>' +
      '</div>' +
      '</section>';

    filterEl.innerHTML =
      '<div class="filters-panel">' +
        '<div class="filters-panel-header">' +
        '<h2 class="filters-panel-title" id="filters-panel-heading">Filters' +
        activeSummary +
        '</h2>' +
        '<button type="button" class="filters-panel-close" data-filters-close aria-label="Close filters">×</button>' +
        '</div>' +
        '<div class="status-filter-body">' +
        extraLine +
        naNextActionsDatesDrawer +
        '<div class="status-filter-groups">' +
        (hasClear
          ? '<div class="status-filter-clear-wrap"><a href="#" class="status-filter-clear" data-filter-clear-link>Clear status filters</a></div>'
          : '') +
        statusGroupsHtml +
        '</div>' +
        '</div>' +
        '<div class="status-filter-digest-row">' +
        '<button type="button" class="secondary-btn" id="nyhome-drawer-send-digest">Email pipeline digest</button>' +
        '</div>' +
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

    filterEl.querySelectorAll('[data-filter-pill]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var k = btn.getAttribute('data-filter-pill');
        if (k === 'not-voted') {
          extraFilterNotVoted = !extraFilterNotVoted;
        } else if (k === 'link-missing') {
          extraFilterLinkMissing = !extraFilterLinkMissing;
        }
        renderFilterBar(allApartments);
        applyFilters();
      });
    });

    filterEl.querySelectorAll('[data-hood-chip]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var name = btn.getAttribute('data-hood-name');
        if (!name) return;
        if (hoodFilter.has(name)) {
          hoodFilter.delete(name);
        } else {
          hoodFilter.add(name);
        }
        renderFilterBar(allApartments);
        applyFilters();
      });
    });

    var hoodClear = filterEl.querySelector('[data-hood-clear]');
    if (hoodClear) {
      hoodClear.addEventListener('click', function (e) {
        e.preventDefault();
        hoodFilter.clear();
        renderFilterBar(allApartments);
        applyFilters();
      });
    }

    var digestDrawer = document.getElementById('nyhome-drawer-send-digest');
    if (digestDrawer) {
      digestDrawer.addEventListener('click', function () {
        sendPipelineDigestFromShortlist(digestDrawer);
      });
    }

    wireNaOmitCheckboxes(filterEl);

    if (wasDrawerOpen) {
      setFiltersDrawerOpen(true);
    }
  }

  function applyFilters() {
    var visible;
    if (activeFilters.size === 0) {
      visible = allApartments;
      /** Cards / Compare (finalist table): omit terminal rows until user taps them in Filters. */
      if (viewMode === 'cards' || viewMode === 'finalist') {
        visible = visible.filter(function (a) {
          var s = NyhomeStatus.normalizeStatus(a.status);
          return s !== 'rejected' && s !== 'blacklisted' && s !== 'archived';
        });
      }
    } else {
      visible = allApartments.filter(function (a) {
        return activeFilters.has(NyhomeStatus.normalizeStatus(a.status));
      });
    }

    visible = visible.filter(apartmentPassesExtraFilters);

    if (viewMode === 'next-actions') {
      visible = visible.filter(passesNextActionsOmitFilters);
    }

    listEl.classList.toggle('card-list--finalist', viewMode === 'finalist');
    listEl.classList.toggle('card-list--next-actions', viewMode === 'next-actions');
    listEl.innerHTML = '';
    hideFinalistFlyout();
    if (visible.length === 0) {
      listEl.innerHTML = '<div class="empty-state">No apartments match the selected filters.</div>';
      return;
    }
    if (viewMode === 'finalist') {
      var tableSort = sortMode === 'ranked'
        ? NyhomeShortlistSort.sortForFinalist(visible)
        : NyhomeShortlistSort.sortForDisplay(visible, sortMode);
      renderFinalistList(tableSort);
      return;
    }
    if (viewMode === 'next-actions') {
      renderNextActionsList(visible);
      return;
    }
    sortForDisplay(visible).forEach(function (apartment) {
      listEl.appendChild(renderApartmentCard(apartment));
    });
    wireListingThumbHovers();
    wireCardDupButtons();
    wireCardListingStars();
    syncMobileSortPanel();
  }

  function renderFinalistList(sorted) {
    var h =
      '<div class="shortlist-finalist-c shortlist-finalist-c--ord shortlist-finalist-c--h">#</div>' +
      '<div class="shortlist-finalist-c shortlist-finalist-c--h">Listing</div>' +
      '<div class="shortlist-finalist-c shortlist-finalist-c--h shortlist-finalist-c--right" data-finalist-col="rent">Rent</div>' +
      '<div class="shortlist-finalist-c shortlist-finalist-c--h shortlist-finalist-c--right" data-finalist-col="net">Net eff.</div>' +
      '<div class="shortlist-finalist-c shortlist-finalist-c--h shortlist-finalist-c--right shortlist-finalist-c--h-move" data-finalist-col="move" title="Total move-in amount">Move-in</div>' +
      '<div class="shortlist-finalist-c shortlist-finalist-c--h" data-finalist-col="bed">Beds / baths</div>' +
      '<div class="shortlist-finalist-c shortlist-finalist-c--h shortlist-finalist-c--h-ext" data-finalist-col="ext">URL</div>' +
      '<div class="shortlist-finalist-c shortlist-finalist-c--h shortlist-finalist-c--right">Avg</div>' +
      '<div class="shortlist-finalist-c shortlist-finalist-c--h shortlist-finalist-c--right" data-finalist-col="kerv">Kerv</div>' +
      '<div class="shortlist-finalist-c shortlist-finalist-c--h shortlist-finalist-c--right" data-finalist-col="peter">Peter</div>' +
      '<div class="shortlist-finalist-c shortlist-finalist-c--h" data-finalist-col="status">Status</div>';
    var body = sorted.map(function (apartment, i) {
      var ord = i + 1;
      var href = apartment.id != null ? '/details/?id=' + encodeURIComponent(apartment.id) : '#';
      var t = (apartment.title || 'Untitled apartment').trim();
      var lineAria = 'View details for ' + t;
      return (
        '<div class="shortlist-finalist-cluster">' +
        '<div class="shortlist-finalist-cols shortlist-finalist-line" data-finalist-id="' +
        escapeAttr(String(apartment.id)) +
        '">' +
        '<a class="shortlist-finalist-line-main" href="' +
        escapeAttr(href) +
        '" aria-label="' +
        escapeAttr(lineAria) +
        '">' +
        buildFinalistRowBeforeUrlHtml(apartment, ord) +
        '</a>' +
        finalistExternalListingCell(apartment) +
        '<a class="shortlist-finalist-line-main" href="' +
        escapeAttr(href) +
        '" aria-label="' +
        escapeAttr(lineAria) +
        '">' +
        buildFinalistRowAfterUrlHtml(apartment) +
        '</a>' +
        '</div></div>'
      );
    }).join('');
    var tableAriaLabel = sortMode === 'ranked'
      ? 'Compare table, ranked by Avg then workflow'
      : 'Compare table, sorted by ' + sortMode;
    listEl.innerHTML =
      '<div class="shortlist-finalist-wrap" role="region" aria-label="' + escapeAttr(tableAriaLabel) + '">' +
        '<div class="shortlist-finalist-header shortlist-finalist-cols" role="row">' + h + '</div>' +
        '<div class="shortlist-finalist-body">' + body + '</div>' +
      '</div>';
    wireListingThumbHovers();
    wireFinalistMobileExpand();
  }

  function renderNextActionsToolbarHtml() {
    return (
      '<div class="shortlist-next-actions-toolbar">' +
        '<button type="button" class="na-mobile-toolbar-toggle" aria-expanded="false">' +
        '<span class="na-mobile-toolbar-title">Calendar options</span>' +
        '<span class="na-mobile-toolbar-hint">Show</span>' +
        '</button>' +
        '<div class="shortlist-next-actions-toolbar-row">' +
          '<div class="shortlist-next-actions-layout" role="group" aria-label="Next actions layout">' +
            '<div class="shortlist-view-segment shortlist-na-segment" role="presentation">' +
              '<button type="button" class="shortlist-view-btn" data-na-layout="list" aria-pressed="' +
              (naLayoutMode === 'list' ? 'true' : 'false') +
              '">List</button>' +
              '<button type="button" class="shortlist-view-btn" data-na-layout="calendar" aria-pressed="' +
              (naLayoutMode === 'calendar' ? 'true' : 'false') +
              '">Calendar</button>' +
            '</div>' +
          '</div>' +
          (naLayoutMode === 'calendar'
            ? '<div class="shortlist-next-actions-cal-density" role="group" aria-label="Summary, details, or prospect on each card">' +
              '<div class="shortlist-view-segment shortlist-view-segment--density shortlist-na-segment" role="presentation">' +
              '<button type="button" class="shortlist-view-btn" data-na-cal-density="summary" aria-pressed="' +
              (naCalendarDensity === 'summary' ? 'true' : 'false') +
              '">Summary</button>' +
              '<button type="button" class="shortlist-view-btn" data-na-cal-density="details" aria-pressed="' +
              (naCalendarDensity === 'details' ? 'true' : 'false') +
              '">Details</button>' +
              '<button type="button" class="shortlist-view-btn" data-na-cal-density="prospect" aria-pressed="' +
              (naCalendarDensity === 'prospect' ? 'true' : 'false') +
              '">Prospect</button>' +
              '</div></div>'
            : '') +
        '</div>' +
      '</div>'
    );
  }

  function renderNextActionsCalendarHtml(apartments) {
    var events = collectNextActionEvents(apartments);
    if (!events.length) {
      return '<div class="empty-state">No dated events in this list.</div>';
    }
    var byDay = {};
    events.forEach(function (ev) {
      var k = ev.dayKey;
      if (!byDay[k]) byDay[k] = [];
      byDay[k].push(ev);
    });
    var dayKeys = Object.keys(byDay).sort();
    var html =
      '<div class="shortlist-na-calendar" role="region" aria-label="Next actions by day">';
      dayKeys.forEach(function (dk) {
      var list = byDay[dk].slice().sort(function (a, b) {
        return a.sortTs - b.sortTs;
      });
      var uid = 'na-day-' + dk.replace(/[^0-9a-z-]/gi, '');
      var rows = buildCalendarDayRows(list);
      var body =
        naCalendarDensity === 'summary'
          ? renderNextActionsCalendarDaySummaryHtml(dk, list)
          : rows
              .map(function (row) {
                if (row.type === 'event') return renderNextActionsEventBlock(row.ev, row.tourTime || null);
                if (row.type === 'travel') return renderCalendarTravelRow(row);
                if (row.type === 'debrief') return renderCalendarDebriefRow(row);
                if (row.type === 'free') return renderCalendarFreeSlotRow(row);
                if (row.type === 'break') return renderCalendarAgendaBreak();
                if (row.type === 'hr') return '<hr class="shortlist-na-timeline-hr" />';
                return '';
              })
              .join('');
      html +=
        '<section class="shortlist-na-day" aria-labelledby="' +
        escapeAttr(uid) +
        '">' +
        '<h3 class="shortlist-na-day-heading" id="' +
        escapeAttr(uid) +
        '">' +
        escapeHtml(formatCalendarDayHeading(dk)) +
        '</h3>' +
        '<div class="shortlist-na-day-events">' +
        body +
        '</div>' +
        '</section>';
    });
    html += '</div>';
    return html;
  }

  function renderNextActionsEventBlock(ev, tourTimeRange) {
    var apartment = ev.apt;
    var id = apartment.id;
    var href = id != null ? '/details/?id=' + encodeURIComponent(id) : '#';
    var status = NyhomeStatus.normalizeStatus(apartment.status || 'new');
    var statusLabel = formatStatusLabel(status);
    var kindClass = 'shortlist-na-etype--' + ev.kind;
    var kindLabel =
      ev.kind === 'tour' ? 'Tour' : ev.kind === 'deadline' ? 'App deadline' : 'Move-in';
    var timeLine =
      tourTimeRange && tourTimeRange.startMs != null && tourTimeRange.endMs != null
        ? formatCalendarSlotRange(tourTimeRange.startMs, tourTimeRange.endMs)
        : formatEventTimeOrAllDay(ev);
    var title = String(apartment.title || 'Untitled apartment').trim();
    var subtitleLine = formatCalendarSubtitleAddress(apartment);
    if (!subtitleLine) subtitleLine = title || '—';
    var notesPanelId = 'shortlist-na-notes-' + String(id) + '-' + ev.kind;
    var starNaCal =
      typeof NyhomeListingStar !== 'undefined' ? NyhomeListingStar.displayHtmlIfStarred(apartment) : '';
    return (
      '<article class="shortlist-next-actions-row shortlist-na-event-block ' +
      kindClass +
      ' listing-status-' +
      status.replace(/_/g, '-') +
      '" data-apartment-id="' +
      escapeAttr(String(id)) +
      '">' +
      '<div class="shortlist-na-line shortlist-na-line--event-banner">' +
      '<div class="shortlist-na-what">' +
      '<div class="shortlist-na-event-head">' +
      '<div class="shortlist-na-banner-line">' +
      starNaCal +
      '<span class="shortlist-na-banner-kind">' +
      escapeHtml(kindLabel) +
      '</span>' +
      naCalendarMetaSep() +
      '<span class="shortlist-na-banner-time">' +
      escapeHtml(timeLine) +
      '</span>' +
      naCalendarMetaSep() +
      '<span class="status-pill ' +
      NyhomeStatus.statusClass(status) +
      ' shortlist-next-actions-pill">' +
      escapeHtml(statusLabel) +
      '</span>' +
      naCalendarMetaSep() +
      nextActionsBannerScoresInlineHtml(apartment.scores) +
      naCalendarMetaSep() +
      '<span class="shortlist-na-banner-actions">' +
      nextActionsAdvanceRejectHtml(apartment, { sepBeforeReject: true }) +
      '</span>' +
      '</div>' +
      '<a class="shortlist-na-address-line" href="' +
      escapeAttr(href) +
      '">' +
      escapeHtml(subtitleLine) +
      '</a>' +
      '</div>' +
      nextActionsListingSpecStrip(apartment) +
      (naCalendarDensity === 'prospect' ? renderNotesDetailsCollapsible(apartment, ev, notesPanelId) : '') +
      (naLayoutMode === 'calendar' && naCalendarDensity === 'details' && ev.kind === 'tour'
        ? '<button type="button" class="m-tour-screen-btn" data-tour-screen-apartment-id="' +
          escapeAttr(String(id)) +
          '">Tour worksheet</button>'
        : '') +
      '</div></div></article>'
    );
  }

  function renderNextActionsList(visible) {
    var sorted = sortForFinalist(visible);
    var toolbar = renderNextActionsToolbarHtml();
    var printTitle = '<h2 class="shortlist-na-print-title">Next actions</h2>';
    if (!sorted.length) {
      listEl.innerHTML =
        '<div class="shortlist-next-actions-wrap">' +
        toolbar +
        printTitle +
        '<div class="empty-state">No next actions match. Add a tour, app deadline, or move-in — or widen the "only include" filters.</div>' +
        '</div>';
      wireNextActionsChrome();
      return;
    }
    if (naLayoutMode === 'calendar') {
      var wrapCls =
        'shortlist-next-actions-wrap shortlist-na-density-' + naCalendarDensity;
      listEl.innerHTML =
        '<div class="' +
        wrapCls +
        '" role="region" aria-label="Next actions" data-na-density="' +
        escapeAttr(naCalendarDensity) +
        '">' +
        toolbar +
        printTitle +
        buildCalendarPrintTocHtml(sorted) +
        renderNextActionsCalendarHtml(sorted) +
        '</div>';
    } else {
      listEl.innerHTML =
        '<div class="shortlist-next-actions-wrap" role="region" aria-label="Next actions">' +
        toolbar +
        printTitle +
        '<p class="shortlist-next-actions-intro muted">Open a row for full details. Use Calendar to see visits by day.</p>' +
        '<div class="shortlist-next-actions-list">' +
        sorted.map(function (apartment) {
          return renderNextActionsRow(apartment);
        }).join('') +
        '</div></div>';
    }
    wireNextActionsChrome();
  }

  function wireNextActionsChrome() {
    wireNextActionsListInteractions();
    if (!listEl) return;
    listEl.querySelectorAll('[data-na-layout]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var m = btn.getAttribute('data-na-layout');
        if (!m || m === naLayoutMode || !VALID_NA_LAYOUTS[m]) return;
        naLayoutMode = m;
        saveNextActionsPrefs();
        if (allApartments.length) applyFilters();
      });
    });
    listEl.querySelectorAll('[data-na-cal-density]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var m = btn.getAttribute('data-na-cal-density');
        if (!m || m === naCalendarDensity || !VALID_NA_CAL_DENSITY[m]) return;
        naCalendarDensity = m;
        saveNextActionsPrefs();
        if (allApartments.length && viewMode === 'next-actions') applyFilters();
      });
    });
    listEl.querySelectorAll('[data-tour-screen-apartment-id]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var id = btn.getAttribute('data-tour-screen-apartment-id');
        var apt = allApartments.find(function (a) {
          return String(a.id) === String(id);
        });
        if (apt) showTourScreen(apt);
      });
    });
    wireNAToolbarToggle();
  }

  function renderNextActionsRow(apartment) {
    var id = apartment.id;
    var href = id != null ? '/details/?id=' + encodeURIComponent(id) : '#';
    var status = NyhomeStatus.normalizeStatus(apartment.status || 'new');
    var statusLabel = formatStatusLabel(status);
    var loc = [apartment.neighborhood, apartment.address].filter(Boolean).join(' · ');
    var metaBits = [];
    if (apartment.next_visit && apartment.next_visit.visit_at) {
      metaBits.push('Tour ' + formatShortDateTime(apartment.next_visit.visit_at));
    }
    if (apartment.application && apartment.application.deadline_at) {
      metaBits.push('Deadline ' + formatShortDateTime(apartment.application.deadline_at));
    }
    if (hasMoveInDate(apartment)) {
      metaBits.push('Move-in ' + String(apartment.move_in_date).trim());
    }
    var metaInline = metaBits.length
      ? '<span class="shortlist-next-actions-sep muted">·</span><span class="shortlist-next-actions-dates muted">' +
        escapeHtml(metaBits.join(' · ')) +
        '</span>'
      : '';
    var starNaList =
      typeof NyhomeListingStar !== 'undefined' ? NyhomeListingStar.displayHtmlIfStarred(apartment) : '';
    return (
      '<article class="shortlist-next-actions-row" data-apartment-id="' + escapeAttr(String(id)) + '">' +
        '<div class="shortlist-next-actions-row-top">' +
          '<div class="shortlist-next-actions-line">' +
            '<a class="shortlist-next-actions-main" href="' + escapeAttr(href) + '">' +
              starNaList +
              '<span class="shortlist-next-actions-title">' + escapeHtml(apartment.title || 'Untitled apartment') + '</span>' +
              '<span class="shortlist-next-actions-sep muted">·</span>' +
              '<span class="shortlist-next-actions-loc muted">' + escapeHtml(loc || '—') + '</span>' +
              metaInline +
              '<span class="shortlist-next-actions-sep muted">·</span>' +
              '<span class="status-pill ' + NyhomeStatus.statusClass(status) + ' shortlist-next-actions-pill">' + escapeHtml(statusLabel) + '</span>' +
            '</a>' +
          '</div>' +
          '<div class="shortlist-next-actions-side">' +
            nextActionsAdvanceRejectHtml(apartment) +
          '</div>' +
        '</div>' +
      '</article>'
    );
  }

  function wireNextActionsListInteractions() {
    if (!listEl) return;
    listEl.querySelectorAll('[data-def-toggle]').forEach(function (button) {
      button.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var panelId = button.getAttribute('data-def-for');
        if (!panelId) return;
        var panel = document.getElementById(panelId);
        if (!panel || !listEl.contains(panel)) return;
        if (panel.hasAttribute('hidden')) {
          panel.removeAttribute('hidden');
          button.setAttribute('aria-expanded', 'true');
        } else {
          panel.setAttribute('hidden', '');
          button.setAttribute('aria-expanded', 'false');
        }
        var hint = button.querySelector('.shortlist-na-notes-toggle-hint');
        if (hint) {
          hint.textContent = panel.hasAttribute('hidden') ? 'Show' : 'Hide';
        }
      });
    });
    listEl.querySelectorAll('[data-advance-status]').forEach(function (btn) {
      if (btn.disabled) return;
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var rawId = btn.getAttribute('data-apartment-id');
        var id = Number(rawId);
        var apt = allApartments.find(function (a) { return Number(a.id) === id; });
        if (!apt) return;
        var nextS = nextNavStatus(apt.status);
        if (!nextS) return;
        btn.disabled = true;
        NyhomeAPI.saveApartment(NyhomeApartmentPayload.apartmentToSavePayload(apt, { status: nextS }))
          .then(function () {
            return NyhomeAPI.getApartments();
          })
          .then(render)
          .catch(function (err) {
            console.error('[nyhome-shortlist] advance status', err);
            btn.disabled = false;
          });
      });
    });
    listEl.querySelectorAll('[data-reject-apartment]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var rawId = btn.getAttribute('data-apartment-id');
        var id = Number(rawId);
        var apt = allApartments.find(function (a) { return Number(a.id) === id; });
        if (!apt) return;
        function doReject() {
          btn.disabled = true;
          NyhomeAPI.saveApartment(NyhomeApartmentPayload.apartmentToSavePayload(apt, { status: 'rejected' }))
            .then(function () {
              return NyhomeAPI.getApartments();
            })
            .then(render)
            .catch(function (err) {
              console.error('[nyhome-shortlist] reject', err);
              btn.disabled = false;
            });
        }
        if (typeof NyhomeUiFeedback !== 'undefined' && NyhomeUiFeedback.confirm) {
          NyhomeUiFeedback.confirm('Mark this apartment as rejected?', {
            title: 'Reject listing',
            destructive: true,
            confirmLabel: 'Reject',
          }).then(function (ok) {
            if (ok) doReject();
          });
          return;
        }
        if (!confirm('Mark this apartment as rejected?')) return;
        doReject();
      });
    });
  }

  function renderApartmentCard(apartment) {
    var article = document.createElement('article');
    var status = NyhomeStatus.normalizeStatus(apartment.status || 'new');
    var statusLabel = formatStatusLabel(status);
    var hoodOnly =
      apartment.neighborhood && String(apartment.neighborhood).trim()
        ? '<div class="apartment-location muted">' +
          escapeHtml(String(apartment.neighborhood).trim()) +
          '</div>'
        : '';
    var starBtn =
      typeof NyhomeListingStar !== 'undefined' ? NyhomeListingStar.buttonHtml(apartment) : '';
    article.className = 'apartment-card listing-status-' + status.replace(/_/g, '-');

    article.innerHTML =
      '<div class="apartment-body">' +
        '<div class="card-topline">' +
          '<div class="apartment-title-block">' +
            '<div class="apartment-title-inner">' +
            starBtn +
            '<h2 class="apartment-title apartment-title-text">' + escapeHtml(apartment.title || 'Untitled apartment') + '</h2>' +
            '</div>' +
            hoodOnly +
          '</div>' +
          '<div class="card-topright">' +
            '<span class="status-pill ' +
            NyhomeStatus.statusClass(status) +
            ' card-top-status-pill" title="' +
            escapeAttr('Status: ' + statusLabel) +
            '">' +
            escapeHtml(statusLabel) +
            '</span>' +
            scoreChip(apartment.scores && apartment.scores.combined) +
          '</div>' +
        '</div>' +
        '<div class="card-status-container">' +
          renderFacts(apartment) +
        '</div>' +
        renderScoresAndThumbs(apartment) +
        renderCardScheduleMeta(apartment) +
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
    if (apartment.net_effective_cents) {
      facts.push('Net eff. ' + formatMoney(apartment.net_effective_cents) + '/mo');
    }
    if (apartment.total_move_in_cents != null) {
      facts.push('Move-in ' + formatMoney(apartment.total_move_in_cents) + ' total');
    }
    if (apartment.bedrooms != null) facts.push(apartment.bedrooms + ' bed');
    if (apartment.bathrooms != null) facts.push(apartment.bathrooms + ' bath');
    if (apartment.square_feet) facts.push(apartment.square_feet + ' sq ft');
    if (apartment.move_in_date) facts.push('Move-in ' + apartment.move_in_date);
    return facts.map(function (f) { return '<span class="pill">' + escapeHtml(f) + '</span>'; }).join('');
  }

  function renderScores(scores) {
    return (
      '<div class="score-grid score-grid--card-partners">' +
      scoreBox('kerv', 'Kerv', scores.kerv) +
      scoreBox('peter', 'Peter', scores.peter) +
      '</div>'
    );
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
    var dup =
      apartment.id != null
        ? '<button type="button" class="apt-dup-btn" data-apartment-id="' +
          escapeAttr(String(apartment.id)) +
          '" aria-label="Duplicate listing">⧉ Duplicate</button>'
        : '';
    return '<div class="card-actions">' +
      actionLink('Details', apartment.id ? '/details/?id=' + encodeURIComponent(apartment.id) : '') +
      actionLink('Listing', apartment.listing_url, true) +
      dup +
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

  function renderCardScheduleMeta(apartment) {
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
