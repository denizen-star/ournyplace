(function () {
  var listEl = document.getElementById('apartment-list');
  var summaryEl = document.getElementById('summary-grid');

  document.addEventListener('DOMContentLoaded', boot);

  function boot() {
    NyhomeAPI.getApartments().then(render).catch(function () {
      listEl.innerHTML = '<div class="empty-state">Could not load apartments yet.</div>';
    });
  }

  function render(data) {
    var apartments = data.apartments || [];
    renderSummary(apartments);

    if (apartments.length === 0) {
      listEl.innerHTML = '<div class="empty-state">No apartments yet. Add the first one in Manage.</div>';
      return;
    }

    listEl.innerHTML = '';
    apartments.forEach(function (apartment) {
      listEl.appendChild(renderApartmentCard(apartment, data.criteria || []));
    });
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
      summaryCard(best && best.scores.combined ? Math.round(best.scores.combined) : '-', 'top combined score');
  }

  function summaryCard(value, label) {
    return '<article class="summary-card"><span class="summary-value">' + escapeHtml(value) + '</span><span class="summary-label">' + escapeHtml(label) + '</span></article>';
  }

  function renderApartmentCard(apartment) {
    var article = document.createElement('article');
    article.className = 'apartment-card';

    article.innerHTML =
      '<div class="apartment-body">' +
        '<div class="card-topline">' +
          '<div>' +
            '<h2 class="apartment-title">' + escapeHtml(apartment.title || 'Untitled apartment') + '</h2>' +
            '<div class="apartment-location muted">' + escapeHtml([apartment.neighborhood, apartment.address].filter(Boolean).join(' · ')) + '</div>' +
          '</div>' +
          scoreChip(apartment.scores && apartment.scores.combined) +
        '</div>' +
        '<div class="card-status-container">' +
          renderStatusPill(apartment.status || 'new') +
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
      return '<span class="pill score-chip">Score -</span>';
    }

    return '<span class="pill score-chip">' + Math.round(value) + '%</span>';
  }

  function renderStatusPill(status) {
    return '<span class="status-pill ' + NyhomeStatus.statusClass(status) + '">' + escapeHtml(formatStatusLabel(status)) + '</span>';
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
      scoreBox('Combined', scores.combined) +
      scoreBox('Kerv', scores.kerv) +
      scoreBox('Peter', scores.peter) +
    '</div>';
  }

  function scoreBox(label, value) {
    return '<div class="score-box"><span class="muted">' + label + '</span><strong>' + (value != null ? Math.round(value) + '%' : '-') + '</strong></div>';
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
