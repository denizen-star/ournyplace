(function () {
  var rootEl = document.getElementById('detail-root');
  var state = { apartment: null, criteria: [] };

  document.addEventListener('DOMContentLoaded', boot);

  var STATUS_ORDER = NyhomeStatus.STATUS_NAV;

  function catchSaveApartment(err) {
    console.error('[nyhome-details] save apartment', err);
  }

  function boot() {
    load();
  }

  function load(activeTab) {
    var id = new URLSearchParams(window.location.search).get('id');
    if (!id) {
      rootEl.innerHTML = '<div class="empty-state">No apartment selected.</div>';
      return;
    }

    NyhomeAPI.getApartments().then(function (data) {
      var apartment = (data.apartments || []).find(function (item) {
        return String(item.id) === String(id);
      });

      if (!apartment) {
        rootEl.innerHTML = '<div class="empty-state">Apartment not found.</div>';
        return;
      }

      state.apartment = apartment;
      state.criteria = data.criteria || [];
      render(activeTab || currentTab() || 'scorecard');
    }).catch(function () {
      rootEl.innerHTML = '<div class="empty-state">Could not load apartment details yet.</div>';
    });
  }

  function render(activeTab) {
    var apartment = state.apartment;
    rootEl.innerHTML =
      renderSummaryHeader(apartment) +
      '<div class="summary-tabs-container">' +
        renderTabs(activeTab) +
        renderScorecardTab(apartment, activeTab) +
        renderUnitSetupTab(apartment, activeTab) +
        renderVotingTab(apartment, activeTab) +
        renderTourTab(apartment, activeTab) +
        renderApplicationTab(apartment, activeTab) +
        renderActivityTab(apartment, activeTab) +
      '</div>';

    bindTabs();
    bindApartmentControls();
    bindVoting();
    bindVisitForm();
    bindApplicationForm();
  }

  function renderSummaryHeader(apartment) {
    return '<section class="app-summary-card">' +
      '<div class="summary-status-row">' +
        statusProgressionControls(apartment.status || 'new') +
        '<span class="match-pill">' +
          '<span class="match-percentage">' + scoreText(apartment.scores && apartment.scores.combined) + '</span>' +
          '<span class="match-score-label">Combined</span>' +
        '</span>' +
      '</div>' +
      '<div class="summary-title-row">' +
        '<div>' +
          '<h2 class="apartment-title">' + escapeHtml(apartment.title || 'Untitled apartment') + '</h2>' +
          '<div class="apartment-location muted">' + escapeHtml([apartment.neighborhood, apartment.address].filter(Boolean).join(' · ')) + '</div>' +
        '</div>' +
        renderActions(apartment) +
      '</div>' +
      '<div class="app-meta">' +
        metaItem('location', apartment.neighborhood || apartment.address || 'Neighborhood TBD') +
        metaItem('money', formatMoney(apartment.rent_cents) || 'Rent TBD') +
        metaItem('home', unitSummary(apartment) || 'Unit details TBD') +
        metaItem('calendar', apartment.move_in_date ? 'Move-in ' + apartment.move_in_date : 'Move-in TBD') +
        metaItem('refresh', apartment.updated_at ? 'Updated ' + formatDate(apartment.updated_at) : 'Updated TBD') +
        linkMetaItem(apartment.listing_url) +
      '</div>' +
    '</section>';
  }

  function renderTabs(activeTab) {
    var tabs = [
      ['scorecard', 'Scorecard'],
      ['unit', 'Unit Setup'],
      ['voting', 'Voting'],
      ['tour', 'Tour'],
      ['application', 'Application'],
      ['activity', 'Activity Log'],
    ];

    return '<div class="summary-tabs-header">' +
      tabs.map(function (tab) {
        return '<button type="button" class="summary-tab' + (activeTab === tab[0] ? ' active' : '') + '" data-tab-target="' + tab[0] + '">' + tab[1] + '</button>';
      }).join('') +
    '</div>';
  }

  function renderScorecardTab(apartment, activeTab) {
    return '<section id="tab-scorecard" class="summary-tab-content' + (activeTab === 'scorecard' ? ' active' : '') + '">' +
      '<h2>Scorecard</h2>' +
      renderScores(apartment.scores || {}) +
      '<div class="two-column">' +
        contentSection('Costs & Timing', renderList([
          ['Rent', formatMoney(apartment.rent_cents)],
          ['Net effective', formatMoney(apartment.net_effective_cents)],
          ['Broker fee', formatMoney(apartment.broker_fee_cents)],
          ['Deposit', formatMoney(apartment.deposit_cents)],
          ['Amenities fees', formatMoney(apartment.amenities_fees_cents)],
          ['Total move-in', formatMoney(apartment.total_move_in_cents)],
          ['Move-in date', apartment.move_in_date],
        ], 'No cost details yet.')) +
        contentSection('Unit Snapshot', renderList([
          ['Unit', unitSummary(apartment)],
          ['Unit features', (apartment.unit_features || []).map(formatLabel).join(', ')],
          ['Amenities', (apartment.amenities || []).map(formatLabel).join(', ')],
        ], 'No unit details yet.')) +
      '</div>' +
      contentSection('Listing Notes', apartment.notes ? '<p>' + escapeHtml(apartment.notes) + '</p>' : '<p class="muted">No notes yet.</p>') +
    '</section>';
  }

  function renderUnitSetupTab(apartment, activeTab) {
    return '<section id="tab-unit" class="summary-tab-content' + (activeTab === 'unit' ? ' active' : '') + '">' +
      '<h2>Unit Setup</h2>' +
      '<form data-apartment-form class="content-section">' +
        '<div class="section-header"><h3 class="section-title">Apartment Controls</h3></div>' +
        '<div class="form-grid">' +
          '<label>Listing URL<input data-listing-url type="url" value="' + escapeAttr(apartment.listing_url || '') + '" placeholder="https://..."></label>' +
          '<label class="span-2">Notes<textarea data-notes rows="5">' + escapeHtml(apartment.notes || '') + '</textarea></label>' +
        '</div>' +
        '<div class="two-column controls-columns">' +
          '<div class="control-group"><h3>Unit Features</h3>' + selectorGroup('unit-features', ['dishwasher', 'washer-dryer', 'storage', 'views'], apartment.unit_features || []) + '</div>' +
          '<div class="control-group"><h3>Amenities</h3>' + selectorGroup('amenities', ['doorman', 'highrise', 'new-construction', 'walkup', 'pool', 'sauna', 'laundry-room', 'suites'], apartment.amenities || []) + '</div>' +
        '</div>' +
        '<button class="primary-btn" type="submit">Save Unit Setup</button>' +
      '</form>' +
    '</section>';
  }

  function renderVotingTab(apartment, activeTab) {
    return '<section id="tab-voting" class="summary-tab-content' + (activeTab === 'voting' ? ' active' : '') + '">' +
      '<h2>Voting</h2>' +
      '<p class="muted tab-intro">Score each criterion from 0 to 5. Each row shows only the criterion and definition, with SVG score buttons.</p>' +
      renderVoting(apartment) +
    '</section>';
  }

  function renderTourTab(apartment, activeTab) {
    var visit = apartment.next_visit || {};
    return '<section id="tab-tour" class="summary-tab-content' + (activeTab === 'tour' ? ' active' : '') + '">' +
      '<h2>Tour</h2>' +
      '<form data-visit-form class="content-section">' +
        '<div class="section-header"><h3 class="section-title">Tour Details</h3></div>' +
        '<div class="form-grid">' +
          '<label>Visit time<input data-visit-at type="datetime-local" value="' + escapeAttr(toDateTimeLocal(visit.visit_at)) + '"></label>' +
          '<label class="span-2">Visit notes<textarea data-visit-notes rows="5">' + escapeHtml(visit.notes || '') + '</textarea></label>' +
        '</div>' +
        '<button class="primary-btn" type="submit">Save Tour</button>' +
      '</form>' +
    '</section>';
  }

  function renderApplicationTab(apartment, activeTab) {
    var application = apartment.application || {};
    return '<section id="tab-application" class="summary-tab-content' + (activeTab === 'application' ? ' active' : '') + '">' +
      '<h2>Application</h2>' +
      '<form data-application-form class="content-section">' +
        '<div class="section-header"><h3 class="section-title">Application Tracking</h3></div>' +
        '<div class="form-grid">' +
          '<label>Application status<input data-application-status value="' + escapeAttr(application.status || '') + '" placeholder="documents sent"></label>' +
          '<label>Broker name<input data-broker-name value="' + escapeAttr(application.broker_name || '') + '"></label>' +
          '<label>Broker contact<input data-broker-contact value="' + escapeAttr(application.broker_contact || '') + '"></label>' +
          '<label>Deadline<input data-deadline-at type="datetime-local" value="' + escapeAttr(toDateTimeLocal(application.deadline_at)) + '"></label>' +
          '<label class="span-2">Application notes<textarea data-application-notes rows="5">' + escapeHtml(application.notes || '') + '</textarea></label>' +
        '</div>' +
        '<button class="primary-btn" type="submit">Save Application</button>' +
      '</form>' +
    '</section>';
  }

  function renderActivityTab(apartment, activeTab) {
    var items = buildActivityItems(apartment);
    return '<section id="tab-activity" class="summary-tab-content' + (activeTab === 'activity' ? ' active' : '') + '">' +
      '<h2>Activity Log</h2>' +
      '<p class="muted tab-intro">Current progress milestones for this apartment.</p>' +
      '<div class="timeline">' +
        (items.length ? items.map(renderTimelineItem).join('') : '<div class="empty-state">No activity yet.</div>') +
      '</div>' +
    '</section>';
  }

  function bindTabs() {
    rootEl.querySelectorAll('[data-tab-target]').forEach(function (button) {
      button.addEventListener('click', function () {
        showTab(button.getAttribute('data-tab-target'));
      });
    });
  }

  function showTab(tabId) {
    rootEl.querySelectorAll('.summary-tab').forEach(function (tab) {
      tab.classList.toggle('active', tab.getAttribute('data-tab-target') === tabId);
    });
    rootEl.querySelectorAll('.summary-tab-content').forEach(function (panel) {
      panel.classList.toggle('active', panel.id === 'tab-' + tabId);
    });
  }

  function currentTab() {
    var active = rootEl.querySelector('.summary-tab.active');
    return active ? active.getAttribute('data-tab-target') : '';
  }

  function bindApartmentControls() {
    var form = rootEl.querySelector('[data-apartment-form]');
    if (!form) return;
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      NyhomeAPI.saveApartment(buildApartmentPayload()).then(function () { load('unit'); }).catch(catchSaveApartment);
    });

    var prev = rootEl.querySelector('[data-status-prev]');
    var next = rootEl.querySelector('[data-status-next]');
    var reject = rootEl.querySelector('[data-status-reject]');
    var status = rootEl.querySelector('[data-status]');
    if (prev) prev.addEventListener('click', function () { stepStatus(-1, true); });
    if (next) next.addEventListener('click', function () { stepStatus(1, true); });
    if (reject) reject.addEventListener('click', function () {
      if (!confirm('Mark this apartment as rejected?')) return;
      setStatusValue('rejected');
      syncStatusControls('rejected');
      NyhomeAPI.saveApartment(buildApartmentPayload()).then(function () { load(currentTab() || 'scorecard'); }).catch(catchSaveApartment);
    });
    if (status) status.addEventListener('change', function () {
      syncStatusControls(status.value || 'new');
      NyhomeAPI.saveApartment(buildApartmentPayload()).then(function () { load(currentTab() || 'scorecard'); }).catch(catchSaveApartment);
    });

    rootEl.querySelectorAll('.selector-chip').forEach(function (button) {
      button.addEventListener('click', function () {
        button.classList.toggle('active');
        button.setAttribute('aria-pressed', button.classList.contains('active') ? 'true' : 'false');
      });
    });
  }

  function bindVoting() {
    rootEl.querySelectorAll('[data-rating]').forEach(function (button) {
      button.addEventListener('click', function () {
        var parts = button.getAttribute('data-rating').split(':');
        NyhomeAPI.saveRating({
          apartmentId: state.apartment.id,
          partnerKey: parts[0],
          criterionId: Number(parts[1]),
          score: Number(button.getAttribute('data-score')),
        }).then(function () { load('voting'); });
      });
    });
  }

  function bindVisitForm() {
    var form = rootEl.querySelector('[data-visit-form]');
    if (!form) return;
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      NyhomeAPI.saveVisit({
        apartmentId: state.apartment.id,
        visitAt: rootEl.querySelector('[data-visit-at]').value,
        notes: rootEl.querySelector('[data-visit-notes]').value,
      }).then(function () { load('tour'); });
    });
  }

  function bindApplicationForm() {
    var form = rootEl.querySelector('[data-application-form]');
    if (!form) return;
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      NyhomeAPI.saveApplication({
        apartmentId: state.apartment.id,
        status: rootEl.querySelector('[data-application-status]').value,
        brokerName: rootEl.querySelector('[data-broker-name]').value,
        brokerContact: rootEl.querySelector('[data-broker-contact]').value,
        deadlineAt: rootEl.querySelector('[data-deadline-at]').value,
        notes: rootEl.querySelector('[data-application-notes]').value,
      }).then(function () { load('application'); });
    });
  }

  function renderScores(scores) {
    return '<div class="score-grid summary-score-grid">' +
      scoreBox('Combined', scores.combined) +
      scoreBox('Kerv', scores.kerv) +
      scoreBox('Peter', scores.peter) +
    '</div>';
  }

  function scoreBox(label, value) {
    return '<div class="score-box"><span class="muted">' + escapeHtml(label) + '</span><strong>' + scoreText(value) + '</strong></div>';
  }

  function renderVoting(apartment) {
    if (!state.criteria.length) {
      return '<div class="empty-state">Add criteria to start scoring.</div>';
    }

    return '<div class="partner-vote-grid detail-vote-grid">' +
      renderPartnerRatingCard(apartment, 'kerv') +
      renderPartnerRatingCard(apartment, 'peter') +
    '</div>';
  }

  function renderPartnerRatingCard(apartment, partnerKey) {
    var label = partnerKey === 'kerv' ? 'Kerv' : 'Peter';
    return '<div class="partner-vote-card partner-vote-card-' + partnerKey + '" aria-label="' + label + ' voting card">' +
      '<h3>' + label + '</h3>' +
      state.criteria.map(function (criterion) {
        var rating = ((apartment.ratings || {})[partnerKey] || {})[criterion.id];
        return '<div class="vote-row">' +
          '<div class="vote-criterion">' +
            '<strong>' + escapeHtml(criterion.label) + '</strong>' +
            (criterion.definition ? '<span>' + escapeHtml(criterion.definition) + '</span>' : '') +
          '</div>' +
          '<div class="score-picker">' + [0, 1, 2, 3, 4, 5].map(function (score) {
            return ratingButton(partnerKey, criterion.id, score, Number(rating) === score);
          }).join('') + '</div>' +
        '</div>';
      }).join('') +
    '</div>';
  }

  function ratingButton(partnerKey, criterionId, score, isActive) {
    return '<button type="button" class="score-btn' + (isActive ? ' active' : '') + '" data-rating="' + partnerKey + ':' + criterionId + '" data-score="' + score + '" aria-label="Score ' + score + '">' +
      '<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">' +
        '<path d="M24 4 43 15v18L24 44 5 33V15Z"></path>' +
      '</svg>' +
      '<span>' + score + '</span>' +
    '</button>';
  }

  function statusProgressionControls(current) {
    var safe = current || 'new';
    return (
      '<div class="status-progression-controls">' +
        '<button type="button" class="status-arrow-link" data-status-prev aria-label="Previous status">←</button>' +
        statusSelect(safe) +
        '<button type="button" class="status-arrow-link" data-status-next aria-label="Next status">→</button>' +
      '</div>'
    );
  }

  function statusSelect(current) {
    return '<select class="status-pill status-select ' + NyhomeStatus.statusClass(current) + '" data-status aria-label="Status">' + statusOptions(current) + '</select>';
  }

  function renderStatusPill(status) {
    return '<span class="status-pill ' + NyhomeStatus.statusClass(status) + '">' + escapeHtml(formatStatusLabel(status)) + '</span>';
  }

  function statusOptions(current) {
    var values = NyhomeStatus.STATUS_ORDER.slice();
    if (values.indexOf(current) < 0) values.push(current);
    return values.map(function (status) {
      return '<option value="' + escapeAttr(status) + '"' + (status === current ? ' selected' : '') + '>' + escapeHtml(formatStatusLabel(status)) + '</option>';
    }).join('');
  }

  function stepStatus(delta, shouldSave) {
    var current = getStatusValue() || 'new';
    if (current === 'rejected') return;
    var index = STATUS_ORDER.indexOf(current);
    if (index < 0) index = 0;
    var nextIndex = Math.max(0, Math.min(STATUS_ORDER.length - 1, index + delta));
    var next = STATUS_ORDER[nextIndex];
    setStatusValue(next);
    syncStatusControls(next);
    if (shouldSave) {
      NyhomeAPI.saveApartment(buildApartmentPayload()).then(function () { load(currentTab() || 'scorecard'); }).catch(catchSaveApartment);
    }
  }

  function getStatusValue() {
    var input = rootEl.querySelector('[data-status]');
    return input ? input.value : '';
  }

  function setStatusValue(next) {
    var input = rootEl.querySelector('[data-status]');
    if (input) input.value = next;
  }

  function syncStatusControls(current) {
    var prev = rootEl.querySelector('[data-status-prev]');
    var next = rootEl.querySelector('[data-status-next]');
    var reject = rootEl.querySelector('[data-status-reject]');
    var status = rootEl.querySelector('[data-status]');

    if (status) {
      status.value = current || 'new';
      status.className = 'status-pill status-select ' + NyhomeStatus.statusClass(current || 'new');
    }

    var isRejected = current === 'rejected';
    var index = STATUS_ORDER.indexOf(current);
    if (index < 0) index = 0;
    if (prev) prev.disabled = isRejected || index === 0;
    if (next) next.disabled = isRejected || index === STATUS_ORDER.length - 1;
    if (reject) reject.disabled = isRejected;
  }

  function formatStatusLabel(status) {
    return String(status || '')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, function (ch) { return ch.toUpperCase(); });
  }

  function selectorGroup(name, values, selectedValues) {
    var selected = new Set(selectedValues || []);
    return '<div class="selector-group" data-selector-group="' + escapeAttr(name) + '">' +
      values.map(function (value) {
        var active = selected.has(value);
        return '<button type="button" class="selector-chip' + (active ? ' active' : '') + '" data-value="' + escapeAttr(value) + '" aria-pressed="' + (active ? 'true' : 'false') + '">' +
          checkIcon() +
          '<span>' + escapeHtml(formatLabel(value)) + '</span>' +
        '</button>';
      }).join('') +
    '</div>';
  }

  function buildApartmentPayload() {
    var apartment = state.apartment;
    return {
      id: apartment.id,
      neighborhood: apartment.neighborhood,
      address: apartment.address,
      aptNumber: apartment.apt_number,
      rent: centsToDollars(apartment.rent_cents),
      netEffective: centsToDollars(apartment.net_effective_cents),
      brokerFee: centsToDollars(apartment.broker_fee_cents),
      deposit: centsToDollars(apartment.deposit_cents),
      amenitiesFees: centsToDollars(apartment.amenities_fees_cents),
      totalMoveIn: centsToDollars(apartment.total_move_in_cents),
      bedrooms: apartment.bedrooms,
      bathrooms: apartment.bathrooms,
      squareFeet: apartment.square_feet,
      unitFeatures: selectedValues('unit-features'),
      amenities: selectedValues('amenities'),
      moveInDate: apartment.move_in_date,
      status: NyhomeStatus.normalizeStatus(getStatusValue() || 'new'),
      listingUrl: rootEl.querySelector('[data-listing-url]').value,
      notes: rootEl.querySelector('[data-notes]').value,
      imageUrls: (apartment.images || []).map(function (image) { return image.image_url; }),
    };
  }

  function selectedValues(groupName) {
    return Array.prototype.map.call(
      rootEl.querySelectorAll('[data-selector-group="' + groupName + '"] .selector-chip.active'),
      function (button) { return button.getAttribute('data-value'); }
    );
  }

  function renderActions(apartment) {
    return '<div class="header-actions">' +
      '<a class="secondary-btn" href="/">Shortlist</a>' +
      actionLink('Listing', apartment.listing_url, true) +
      '<button type="button" class="danger-btn status-reject-action" data-status-reject aria-label="Mark rejected">Reject</button>' +
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

  function contentSection(title, content) {
    return '<section class="content-section">' +
      '<div class="section-header"><h3 class="section-title">' + escapeHtml(title) + '</h3></div>' +
      '<div class="section-content">' + content + '</div>' +
    '</section>';
  }

  function renderList(items, emptyText) {
    var filtered = items.filter(function (item) { return item[1]; });
    if (!filtered.length) return '<p class="muted">' + escapeHtml(emptyText) + '</p>';
    return '<ul class="detail-list">' + filtered.map(function (item) {
      return '<li><strong>' + escapeHtml(item[0]) + ':</strong> ' + escapeHtml(item[1]) + '</li>';
    }).join('') + '</ul>';
  }

  function buildActivityItems(apartment) {
    var items = [];
    if (apartment.created_at) items.push(['Created', formatDate(apartment.created_at), apartment.title || 'Apartment added']);
    if (apartment.updated_at) items.push(['Updated', formatDate(apartment.updated_at), 'Apartment details updated']);
    if (apartment.next_visit) items.push(['Tour', formatDate(apartment.next_visit.visit_at), apartment.next_visit.notes || 'Tour scheduled']);
    if (apartment.application) {
      items.push(['Application', formatDate(apartment.application.updated_at || apartment.application.deadline_at), apartment.application.status || 'Application tracked']);
    }
    return items.reverse();
  }

  function renderTimelineItem(item) {
    return '<div class="timeline-item">' +
      '<div class="timeline-date">' + escapeHtml(item[1] || 'Date TBD') + '</div>' +
      '<div class="timeline-content">' +
        '<span class="timeline-status tag-blue">' + escapeHtml(item[0]) + '</span>' +
        '<span class="timeline-description">' + escapeHtml(item[2] || '') + '</span>' +
      '</div>' +
    '</div>';
  }

  function metaItem(icon, text) {
    return '<div class="meta-item">' + iconSvg(icon) + '<span>' + escapeHtml(text) + '</span></div>';
  }

  function linkMetaItem(url) {
    if (!url) return metaItem('link', 'Listing unavailable');
    return '<div class="meta-item">' + iconSvg('link') + '<a href="' + escapeAttr(url) + '" target="_blank" rel="noreferrer">View Listing</a></div>';
  }

  function iconSvg(name) {
    var paths = {
      location: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657 13.414 20.9a2 2 0 0 1-2.828 0l-4.243-4.243a8 8 0 1 1 11.314 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 1 1-6 0 3 3 0 0 1 6 0z"></path>',
      money: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8V7m0 10v-1m9-4a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"></path>',
      calendar: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2z"></path>',
      refresh: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h5M20 20v-5h-5M5.6 15A7 7 0 0 0 18 18.4M18.4 9A7 7 0 0 0 6 5.6"></path>',
      link: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 0 0-5.656 0l-4 4a4 4 0 1 0 5.656 5.656l1.102-1.101m-.758-4.899a4 4 0 0 0 5.656 0l4-4a4 4 0 0 0-5.656-5.656l-1.1 1.1"></path>',
      home: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m3 12 9-9 9 9M5 10v10h14V10M9 20v-6h6v6"></path>',
    };
    return '<svg class="meta-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">' + (paths[name] || paths.home) + '</svg>';
  }

  function unitSummary(apartment) {
    var specs = [];
    if (apartment.bedrooms != null) specs.push(apartment.bedrooms + ' bed');
    if (apartment.bathrooms != null) specs.push(apartment.bathrooms + ' bath');
    if (apartment.square_feet) specs.push(apartment.square_feet + ' sq ft');
    return specs.join(' · ');
  }

  function scoreText(value) {
    return value != null ? Math.round(value) + '%' : '-';
  }

  function checkIcon() {
    return '<svg class="check-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9.2 16.6 4.9 12.3l-2 2 6.3 6.3L21.8 7.9l-2-2z"></path></svg>';
  }

  function formatLabel(value) {
    return String(value).replace(/-/g, ' ').replace(/\b\w/g, function (char) { return char.toUpperCase(); });
  }

  function centsToDollars(cents) {
    return cents ? Number(cents) / 100 : null;
  }

  function formatMoney(cents) {
    if (!cents) return '';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format((Number(cents) || 0) / 100);
  }

  function formatDate(value) {
    if (!value) return '';
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
    return date.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
  }

  function toDateTimeLocal(value) {
    if (!value) return '';
    return String(value).slice(0, 16);
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
