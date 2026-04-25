(function () {
  var listEl = document.getElementById('apartment-list');
  var summaryEl = document.getElementById('summary-grid');
  var filterEl = document.getElementById('status-filter');

  var activeFilters = new Set();
  var allApartments = [];

  document.addEventListener('DOMContentLoaded', boot);

  function boot() {
    NyhomeAPI.getApartments().then(render).catch(function () {
      listEl.innerHTML = '<div class="empty-state">Could not load apartments yet.</div>';
    });
  }

  function render(data) {
    allApartments = data.apartments || [];
    renderSummary(allApartments);
    renderFilterBar(allApartments);

    if (allApartments.length === 0) {
      listEl.innerHTML = '<div class="empty-state">No apartments yet. Add the first one in Manage.</div>';
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

    listEl.innerHTML = '';
    if (visible.length === 0) {
      listEl.innerHTML = '<div class="empty-state">No apartments match the selected filters.</div>';
      return;
    }
    visible.forEach(function (apartment) {
      listEl.appendChild(renderApartmentCard(apartment));
    });
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
        renderScores(apartment.scores || {}) +
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
      return '<span class="link-button action-disabled" aria-disabled="true">' + escapeHtml(label) + '</span>';
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
