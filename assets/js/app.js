(function () {
  var listEl = document.getElementById('apartment-list');
  var summaryEl = document.getElementById('summary-grid');
  var filterEl = document.getElementById('status-filter');
  var sortRootEl = document.getElementById('shortlist-sort');
  var viewRootEl = document.getElementById('shortlist-view');

  var SORT_STORAGE_KEY = 'nyhomeShortlistSort';
  var VIEW_STORAGE_KEY = 'nyhomeShortlistView';
  var NA_LAYOUT_STORAGE_KEY = 'nyhomeNextActionsLayout';
  var NA_OMIT_TOUR_KEY = 'nyhomeNextActionsOmitTour';
  var NA_OMIT_DEADLINE_KEY = 'nyhomeNextActionsOmitDeadline';
  var NA_OMIT_MOVEIN_KEY = 'nyhomeNextActionsOmitMoveIn';
  var VALID_SORTS = { workflow: 1, avg: 1, peter: 1, kerv: 1, updated: 1 };
  var VALID_VIEWS = { cards: 1, finalist: 1, 'next-actions': 1 };
  var VALID_NA_LAYOUTS = { list: 1, calendar: 1 };
  /** Next actions: list vs calendar (calendar = day-grouped agenda). */
  var naLayoutMode = 'list';
  /** When true, hide listings that have the corresponding date field set. */
  var naOmitTour = false;
  var naOmitDeadline = false;
  var naOmitMoveIn = false;
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
  document.addEventListener('DOMContentLoaded', boot);

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
    initShortlistView();
    initShortlistSort();
    initNextActionsPrefs();
    var cached = NyhomeAPI.getApartmentsCache();
    if (cached) {
      try {
        render(cached);
      } catch (e) {
        console.error('[nyhome-shortlist] cache render', e);
      }
    } else if (listEl) {
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
      if (viewMode === 'finalist' || viewMode === 'next-actions') {
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
  }

  function saveNextActionsPrefs() {
    try {
      localStorage.setItem(NA_LAYOUT_STORAGE_KEY, naLayoutMode);
      localStorage.setItem(NA_OMIT_TOUR_KEY, naOmitTour ? '1' : '');
      localStorage.setItem(NA_OMIT_DEADLINE_KEY, naOmitDeadline ? '1' : '');
      localStorage.setItem(NA_OMIT_MOVEIN_KEY, naOmitMoveIn ? '1' : '');
    } catch (e) {}
  }

  function hasMoveInDate(apartment) {
    return !!(apartment && apartment.move_in_date && String(apartment.move_in_date).trim());
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

  /** Listing appears in Next actions if it has a tour, application deadline, and/or move-in date. */
  function qualifiesNextActions(apartment) {
    if (!apartment) return false;
    if (apartment.next_visit) return true;
    if (apartment.application && apartment.application.deadline_at) return true;
    if (hasMoveInDate(apartment)) return true;
    return false;
  }

  /** Apply “exclude if this date is set” toggles (each hides listings with that field populated). */
  function passesNextActionsOmitFilters(apartment) {
    if (!qualifiesNextActions(apartment)) return false;
    if (naOmitTour && apartment.next_visit && apartment.next_visit.visit_at) return false;
    if (naOmitDeadline && apartment.application && apartment.application.deadline_at) return false;
    if (naOmitMoveIn && hasMoveInDate(apartment)) return false;
    return true;
  }

  var PREP_BY_STATUS = {
    new: 'Capture listing basics, photos, and a first-pass score so you can compare apples to apples.',
    evaluating: 'Align on deal-breakers and schedule tours for anything still in contention.',
    shortlisted: 'Confirm tour times, route, and who is taking notes or video during each visit.',
    tour_scheduled: 'Re-read the listing, prep questions for the broker, and plan travel plus a post-tour debrief.',
    toured: 'Compare impressions while fresh; update scores and note follow-ups (board pack, comps, second visit).',
    finalist: 'Gather net-effective math, move-in total, and timeline; decide if you are ready to apply.',
    applying: 'Assemble pay stubs, references, and guarantor paperwork; track deadlines in Application.',
    applied: 'Stay responsive to the landlord; keep a copy of everything submitted and note any open items.',
    approved: 'Review the lease draft against your checklist; flag fees, renewal terms, and rider clauses early.',
    lease_review: 'Run the numbers one last time (rent, concessions, move-in) before countersigning.',
    signed: 'Plan move logistics: insurance, utilities, keys, and a final walkthrough if offered.',
    rejected: 'Archive lessons learned so the next search stays sharper.',
    archived: 'Listing is archived; no further prep needed here.',
  };

  function prepLineForStatus(status) {
    var s = NyhomeStatus.normalizeStatus(status || 'new');
    return PREP_BY_STATUS[s] || PREP_BY_STATUS.new;
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

  function nextActionsFactDetailLine(apartment) {
    var parts = [];
    if (apartment.rent_cents) parts.push(formatMoney(apartment.rent_cents) + '/mo');
    if (apartment.net_effective_cents) parts.push('Net eff. ' + formatMoney(apartment.net_effective_cents) + '/mo');
    if (apartment.total_move_in_cents != null) {
      parts.push('Move-in ' + formatMoney(apartment.total_move_in_cents) + ' total');
    }
    if (apartment.bedrooms != null) parts.push(apartment.bedrooms + ' bed');
    if (apartment.bathrooms != null) parts.push(apartment.bathrooms + ' bath');
    var line = parts.join(' · ');
    if (!line) return '';
    return '<p class="shortlist-na-detail-facts muted">' + escapeHtml(line) + '</p>';
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
        '<div class="status-filter-groups">' +
        (hasClear
          ? '<div class="status-filter-clear-wrap"><a href="#" class="status-filter-clear" data-filter-clear-link>Clear status filters</a></div>'
          : '') +
        statusGroupsHtml +
        '</div>' +
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

    if (wasDrawerOpen) {
      setFiltersDrawerOpen(true);
    }
  }

  function applyFilters() {
    var visible = activeFilters.size === 0
      ? allApartments
      : allApartments.filter(function (a) {
          return activeFilters.has(NyhomeStatus.normalizeStatus(a.status));
        });

    visible = visible.filter(apartmentPassesExtraFilters);

    if (viewMode === 'cards' || viewMode === 'finalist') {
      visible = visible.filter(function (a) {
        var s = NyhomeStatus.normalizeStatus(a.status);
        return s !== 'rejected' && s !== 'archived';
      });
    }

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
      renderFinalistList(visible);
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

  function renderNextActionsToolbarHtml() {
    return (
      '<div class="shortlist-next-actions-toolbar">' +
        '<div class="shortlist-next-actions-toolbar-row">' +
          '<div class="shortlist-next-actions-layout" role="group" aria-label="Next actions layout">' +
            '<span class="shortlist-na-toolbar-label">Layout</span>' +
            '<div class="shortlist-view-segment shortlist-na-segment" role="presentation">' +
              '<button type="button" class="shortlist-view-btn" data-na-layout="list" aria-pressed="' +
              (naLayoutMode === 'list' ? 'true' : 'false') +
              '">List</button>' +
              '<button type="button" class="shortlist-view-btn" data-na-layout="calendar" aria-pressed="' +
              (naLayoutMode === 'calendar' ? 'true' : 'false') +
              '">Calendar</button>' +
            '</div>' +
          '</div>' +
          '<div class="shortlist-next-actions-omit" role="group" aria-label="Exclude listings that have these set">' +
            '<span class="shortlist-na-toolbar-label">Exclude if set</span>' +
            '<label class="shortlist-na-check">' +
              '<input type="checkbox" data-na-omit="tour"' +
              (naOmitTour ? ' checked' : '') +
              '> Tour</label>' +
            '<label class="shortlist-na-check">' +
              '<input type="checkbox" data-na-omit="deadline"' +
              (naOmitDeadline ? ' checked' : '') +
              '> App deadline</label>' +
            '<label class="shortlist-na-check">' +
              '<input type="checkbox" data-na-omit="movein"' +
              (naOmitMoveIn ? ' checked' : '') +
              '> Move-in</label>' +
          '</div>' +
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
        list.map(function (ev) {
          return renderNextActionsEventBlock(ev);
        }).join('') +
        '</div>' +
        '</section>';
    });
    html += '</div>';
    return html;
  }

  function renderNextActionsEventBlock(ev) {
    var apartment = ev.apt;
    var id = apartment.id;
    var href = id != null ? '/details/?id=' + encodeURIComponent(id) : '#';
    var status = NyhomeStatus.normalizeStatus(apartment.status || 'new');
    var statusLabel = formatStatusLabel(status);
    var nextS = nextNavStatus(status);
    var isRejected = status === 'rejected';
    var kindClass = 'shortlist-na-etype--' + ev.kind;
    var kindLabel =
      ev.kind === 'tour' ? 'Tour' : ev.kind === 'deadline' ? 'App deadline' : 'Move-in';
    var timeLine = formatEventTimeOrAllDay(ev);
    var title = String(apartment.title || 'Untitled apartment');
    var place = [apartment.neighborhood, apartment.address].filter(Boolean).join(' — ');
    var visitNotes =
      ev.kind === 'tour' && apartment.next_visit && apartment.next_visit.notes
        ? '<p class="shortlist-na-visit-note muted"><strong>Notes</strong> · ' +
          escapeHtml(String(apartment.next_visit.notes)) +
          '</p>'
        : '';
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
    var prep = prepLineForStatus(status);
    var prepPanelId = 'shortlist-next-prep-' + String(id) + '-' + ev.kind;
    var prepToggleLabel = 'Show prep tips for ' + title.trim();
    return (
      '<article class="shortlist-next-actions-row shortlist-na-event-block ' +
      kindClass +
      '" data-apartment-id="' +
      escapeAttr(String(id)) +
      '">' +
      '<div class="shortlist-na-event-head">' +
      '<div class="shortlist-na-event-head-txt">' +
      '<span class="shortlist-na-etype">' +
      escapeHtml(kindLabel) +
      '</span>' +
      '<span class="shortlist-na-time muted" data-na-time>' +
      escapeHtml(timeLine) +
      '</span>' +
      '</div>' +
      '<span class="status-pill ' +
      NyhomeStatus.statusClass(status) +
      ' shortlist-next-actions-pill">' +
      escapeHtml(statusLabel) +
      '</span>' +
      '</div>' +
      '<div class="shortlist-na-event-body">' +
      '<a class="shortlist-na-titlelink" href="' +
      escapeAttr(href) +
      '"><strong class="shortlist-na-etitle">' +
      escapeHtml(title) +
      '</strong></a>' +
      (place
        ? '<p class="shortlist-na-place muted">' + escapeHtml(place) + '</p>'
        : '') +
      nextActionsFactDetailLine(apartment) +
      visitNotes +
      '</div>' +
      '<div class="shortlist-na-event-actions">' +
      '<div class="shortlist-next-actions-side">' +
      advanceBtn +
      rejectCtrl +
      '<button type="button" class="criterion-def-btn" data-def-toggle data-def-for="' +
      escapeAttr(prepPanelId) +
      '" aria-expanded="false" aria-label="' +
      escapeAttr(prepToggleLabel) +
      '">?</button>' +
      '</div></div>' +
      '<div class="vote-criterion-def-panel shortlist-next-actions-def" id="' +
      escapeAttr(prepPanelId) +
      '" hidden>' +
      '<p class="vote-criterion-def-text">' +
      escapeHtml(prep) +
      '</p></div></article>'
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
        '<div class="empty-state">No next actions match. Add a tour, app deadline, or move-in — or change the exclude filters.</div>' +
        '</div>';
      wireNextActionsChrome();
      return;
    }
    if (naLayoutMode === 'calendar') {
      listEl.innerHTML =
        '<div class="shortlist-next-actions-wrap" role="region" aria-label="Next actions">' +
        toolbar +
        printTitle +
        renderNextActionsCalendarHtml(sorted) +
        '</div>';
    } else {
      listEl.innerHTML =
        '<div class="shortlist-next-actions-wrap" role="region" aria-label="Next actions">' +
        toolbar +
        printTitle +
        '<p class="shortlist-next-actions-intro muted">Tours, deadlines, and move-in — advance, reject, or open a row for details.</p>' +
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
    listEl.querySelectorAll('input[type="checkbox"][data-na-omit]').forEach(function (el) {
      el.addEventListener('change', function () {
        var k = el.getAttribute('data-na-omit');
        var on = el.checked;
        if (k === 'tour') naOmitTour = on;
        else if (k === 'deadline') naOmitDeadline = on;
        else if (k === 'movein') naOmitMoveIn = on;
        saveNextActionsPrefs();
        if (allApartments.length) applyFilters();
      });
    });
  }

  function renderNextActionsRow(apartment) {
    var id = apartment.id;
    var href = id != null ? '/details/?id=' + encodeURIComponent(id) : '#';
    var status = NyhomeStatus.normalizeStatus(apartment.status || 'new');
    var statusLabel = formatStatusLabel(status);
    var nextS = nextNavStatus(status);
    var isRejected = status === 'rejected';
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
    var prep = prepLineForStatus(status);
    var prepPanelId = 'shortlist-next-prep-' + String(id);
    var prepToggleLabel = 'Show prep tips for ' + String(apartment.title || 'this listing').trim();
    return (
      '<article class="shortlist-next-actions-row" data-apartment-id="' + escapeAttr(String(id)) + '">' +
        '<div class="shortlist-next-actions-row-top">' +
          '<div class="shortlist-next-actions-scroll">' +
            '<a class="shortlist-next-actions-main" href="' + escapeAttr(href) + '">' +
              '<span class="shortlist-next-actions-title">' + escapeHtml(apartment.title || 'Untitled apartment') + '</span>' +
              '<span class="shortlist-next-actions-sep muted">·</span>' +
              '<span class="shortlist-next-actions-loc muted">' + escapeHtml(loc || '—') + '</span>' +
              metaInline +
              '<span class="shortlist-next-actions-sep muted">·</span>' +
              '<span class="status-pill ' + NyhomeStatus.statusClass(status) + ' shortlist-next-actions-pill">' + escapeHtml(statusLabel) + '</span>' +
            '</a>' +
            '<button type="button" class="criterion-def-btn" data-def-toggle data-def-for="' + escapeAttr(prepPanelId) + '" aria-expanded="false" aria-label="' + escapeAttr(prepToggleLabel) + '">?</button>' +
          '</div>' +
          '<div class="shortlist-next-actions-side">' +
            advanceBtn +
            rejectCtrl +
          '</div>' +
        '</div>' +
        '<div class="vote-criterion-def-panel shortlist-next-actions-def" id="' + escapeAttr(prepPanelId) + '" hidden>' +
          '<p class="vote-criterion-def-text">' + escapeHtml(prep) + '</p>' +
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
        if (!confirm('Mark this apartment as rejected?')) return;
        var rawId = btn.getAttribute('data-apartment-id');
        var id = Number(rawId);
        var apt = allApartments.find(function (a) { return Number(a.id) === id; });
        if (!apt) return;
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
    article.className = 'apartment-card listing-status-' + status.replace(/_/g, '-');

    article.innerHTML =
      '<div class="apartment-body">' +
        '<div class="card-topline">' +
          '<div>' +
            '<h2 class="apartment-title">' + escapeHtml(apartment.title || 'Untitled apartment') + '</h2>' +
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
