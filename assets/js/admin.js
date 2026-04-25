(function () {
  var state = { apartments: [], criteria: [], neighborhoods: [] };
  var form = document.getElementById('apartment-form');
  var listEl = document.getElementById('admin-apartment-list');
  var criteriaListEl = document.getElementById('criteria-list');
  var nextActionsEl = document.getElementById('next-actions');

  document.addEventListener('DOMContentLoaded', boot);

  function boot() {
    bindTabs();
    bindForms();
    bindSelectorChips();
    bindNotesParser();
    syncStatusControls(value('status') || 'new');
    bindStatusControls();
    load();
  }

  function load() {
    return NyhomeAPI.getApartments().then(function (data) {
      state.apartments = data.apartments || [];
      state.criteria = data.criteria || [];
      state.neighborhoods = data.neighborhoods || [];
      renderApartments();
      renderCriteria();
      renderNeighborhoodOptions();
      renderNextActions();
    }).catch(function (err) {
      console.error('[nyhome-admin] load', err);
    });
  }

  function bindTabs() {
    Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (button) {
      button.addEventListener('click', function () {
        var tab = button.getAttribute('data-tab');
        document.querySelectorAll('.tab').forEach(function (el) { el.classList.remove('active'); });
        document.querySelectorAll('.tab-panel').forEach(function (el) { el.classList.remove('active'); });
        button.classList.add('active');
        document.getElementById('tab-' + tab).classList.add('active');
      });
    });
  }

  function bindForms() {
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      NyhomeAPI.saveApartment(readApartmentForm()).then(function () {
        clearApartmentForm();
        return load();
      }).catch(function (err) {
        console.error('[nyhome-admin] save apartment', err);
      });
    });

    document.getElementById('reset-form').addEventListener('click', clearApartmentForm);

    document.getElementById('criterion-form').addEventListener('submit', function (event) {
      event.preventDefault();
      NyhomeAPI.saveCriterion({
        label: document.getElementById('criterion-label').value,
        definition: document.getElementById('criterion-definition').value,
        weight: Number(document.getElementById('criterion-weight').value || 1),
      }).then(function () {
        document.getElementById('criterion-label').value = '';
        document.getElementById('criterion-definition').value = '';
        document.getElementById('criterion-weight').value = '1';
        return load();
      }).catch(function (err) {
        console.error('[nyhome-admin] save criterion', err);
      });
    });
  }

  function bindStatusControls() {
    var reject = document.getElementById('status-reject');
    var status = document.getElementById('status');

    if (reject) reject.addEventListener('click', function () {
      if (!confirm('Mark this apartment as rejected?')) return;
      setValue('status', 'rejected');
      syncStatusControls('rejected');
    });
    if (status) status.addEventListener('change', function () {
      syncStatusControls(status.value || 'new');
    });
  }

  function syncStatusControls(current) {
    var reject = document.getElementById('status-reject');
    var status = document.getElementById('status');

    if (status) {
      var next = String(current || 'new');
      if (!status.options.length) {
        status.innerHTML = statusOptions(next);
      }
      if (!Array.prototype.some.call(status.options, function (opt) { return opt.value === next; })) {
        var option = document.createElement('option');
        option.value = next;
        option.textContent = formatStatusLabel(next);
        status.appendChild(option);
      }
      status.value = next;
      status.className = 'status-pill status-select ' + NyhomeStatus.statusClass(next);
    }

    var isRejected = current === 'rejected';
    if (reject) reject.disabled = isRejected;
  }

  function formatStatusLabel(status) {
    return String(status || '')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, function (ch) { return ch.toUpperCase(); });
  }

  function statusOptions(current) {
    var values = NyhomeStatus.STATUS_ORDER.slice();
    if (values.indexOf(current) < 0) values.push(current);
    return values.map(function (status) {
      return '<option value="' + escapeAttr(status) + '"' + (status === current ? ' selected' : '') + '>' + escapeHtml(formatStatusLabel(status)) + '</option>';
    }).join('');
  }

  function apartmentToSavePayload(apartment) {
    return {
      id: apartment.id,
      neighborhood: apartment.neighborhood || '',
      address: apartment.address,
      aptNumber: apartment.apt_number || '',
      rent: apartment.rent_cents != null ? apartment.rent_cents / 100 : null,
      netEffective: apartment.net_effective_cents != null ? apartment.net_effective_cents / 100 : null,
      brokerFee: apartment.broker_fee_cents != null ? apartment.broker_fee_cents / 100 : null,
      deposit: apartment.deposit_cents != null ? apartment.deposit_cents / 100 : null,
      amenitiesFees: apartment.amenities_fees_cents != null ? apartment.amenities_fees_cents / 100 : null,
      totalMoveIn: apartment.total_move_in_cents != null ? apartment.total_move_in_cents / 100 : null,
      bedrooms: apartment.bedrooms != null ? apartment.bedrooms : 1,
      bathrooms: apartment.bathrooms != null ? apartment.bathrooms : 1,
      squareFeet: apartment.square_feet,
      unitFeatures: apartment.unit_features || [],
      amenities: apartment.amenities || [],
      moveInDate: apartment.move_in_date || null,
      status: NyhomeStatus.normalizeStatus(apartment.status || 'new'),
      listingUrl: apartment.listing_url || '',
      sourceUrl: apartment.source_url != null && apartment.source_url !== '' ? apartment.source_url : (apartment.listing_url || ''),
      importStatus: apartment.import_status || 'manual',
      notes: apartment.notes || '',
      imageUrls: (apartment.images || []).map(function (img) { return img.image_url; }).filter(Boolean),
    };
  }

  function readApartmentForm() {
    return {
      id: numberOrNull(value('apartment-id')),
      neighborhood: value('neighborhood'),
      address: value('address'),
      aptNumber: value('apt-number'),
      rent: numberOrNull(value('rent')),
      netEffective: numberOrNull(value('net-effective')),
      brokerFee: numberOrNull(value('broker-fee')),
      deposit: numberOrNull(value('deposit')),
      amenitiesFees: numberOrNull(value('amenities-fees')),
      totalMoveIn: numberOrNull(value('total-move-in')),
      bedrooms: numberOrNull(value('bedrooms')) || 1,
      bathrooms: numberOrNull(value('bathrooms')) || 1,
      squareFeet: numberOrNull(value('square-feet')),
      unitFeatures: getSelectedValues('unit-features'),
      amenities: getSelectedValues('amenities'),
      moveInDate: value('move-in-date') || null,
      status: NyhomeStatus.normalizeStatus(value('status') || 'new'),
      listingUrl: value('listing-url'),
      notes: value('notes'),
      imageUrls: value('image-urls').split('\n').map(function (line) { return line.trim(); }).filter(Boolean),
    };
  }

  function fillApartmentForm(apartment) {
    setValue('apartment-id', apartment.id);
    setValue('neighborhood', apartment.neighborhood);
    setValue('address', apartment.address);
    setValue('apt-number', apartment.apt_number);
    setValue('rent', apartment.rent_cents ? apartment.rent_cents / 100 : '');
    setValue('net-effective', apartment.net_effective_cents ? apartment.net_effective_cents / 100 : '');
    setValue('broker-fee', apartment.broker_fee_cents ? apartment.broker_fee_cents / 100 : '');
    setValue('deposit', apartment.deposit_cents ? apartment.deposit_cents / 100 : '');
    setValue('amenities-fees', apartment.amenities_fees_cents ? apartment.amenities_fees_cents / 100 : '');
    setValue('total-move-in', apartment.total_move_in_cents ? apartment.total_move_in_cents / 100 : '');
    setValue('bedrooms', apartment.bedrooms || 1);
    setValue('bathrooms', apartment.bathrooms || 1);
    setValue('square-feet', apartment.square_feet);
    setSelectedValues('unit-features', apartment.unit_features || []);
    setSelectedValues('amenities', apartment.amenities || []);
    setValue('move-in-date', apartment.move_in_date || '');
    syncStatusControls(apartment.status || 'new');
    setValue('status', apartment.status || 'new');
    setValue('listing-url', apartment.listing_url || '');
    setValue('notes', apartment.notes || '');
    setValue('image-urls', (apartment.images || []).map(function (img) { return img.image_url; }).join('\n'));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function clearApartmentForm() {
    form.reset();
    setValue('apartment-id', '');
    syncStatusControls('new');
    setValue('status', 'new');
    setValue('bedrooms', 1);
    setValue('bathrooms', 1);
    setSelectedValues('unit-features', []);
    setSelectedValues('amenities', []);
  }

  function bindSelectorChips() {
    document.querySelectorAll('.selector-chip').forEach(function (button) {
      button.innerHTML = checkIcon() + '<span>' + button.textContent + '</span>';
      button.addEventListener('click', function () {
        button.classList.toggle('active');
        button.setAttribute('aria-pressed', button.classList.contains('active') ? 'true' : 'false');
      });
    });
  }

  function bindNotesParser() {
    var notes = document.getElementById('notes');
    notes.addEventListener('paste', function () {
      setTimeout(function () {
        applyListingText(notes.value);
      }, 0);
    });
    notes.addEventListener('blur', function () {
      applyListingText(notes.value);
    });
  }

  function applyListingText(text) {
    var parsed = parseListingText(text);
    if (!parsed) return;
    var notes = document.getElementById('notes');
    if (parsed.address) setValue('address', parsed.address);
    if (parsed.aptNumber) setValue('apt-number', parsed.aptNumber);
    if (parsed.neighborhood) setValue('neighborhood', parsed.neighborhood);
    if (parsed.listingUrl) setValue('listing-url', parsed.listingUrl);
    if (parsed.rent != null) setValue('rent', parsed.rent);
    if (parsed.netEffective != null) setValue('net-effective', parsed.netEffective);
    if (parsed.amenitiesFees != null) setValue('amenities-fees', parsed.amenitiesFees);
    if (parsed.squareFeet != null) setValue('square-feet', parsed.squareFeet);
    if (parsed.bedrooms != null) setValue('bedrooms', parsed.bedrooms);
    if (parsed.bathrooms != null) setValue('bathrooms', parsed.bathrooms);
    if (parsed.amenities && parsed.amenities.length) {
      setSelectedValues('amenities', mergeValues(getSelectedValues('amenities'), parsed.amenities));
    }
    if (parsed.organizedNotes) notes.value = parsed.organizedNotes;
  }

  function parseListingText(text) {
    if (!text || !String(text).trim()) return null;
    var lines = String(text).split(/\r?\n/).map(function (line) { return line.trim(); }).filter(Boolean);
    var parsed = { amenities: [] };
    var notes = [];
    var other = [];
    var consumed = {};

    lines.forEach(function (line, index) {
      var neighborhoodMatch = line.match(/^Rental unit in (.+)$/i);
      if (neighborhoodMatch) {
        parsed.neighborhood = neighborhoodMatch[1].trim();
        consumed[index] = true;
        notes.push('Listing type: Rental unit');
        return;
      }

      if (/^New Development$/i.test(line)) {
        parsed.amenities.push('new-construction');
        consumed[index] = true;
        notes.push('Building: New development');
        return;
      }

      var addressMatch = line.match(/^(.+\d{1,6}.*?)(?:\s+#\s*([A-Za-z0-9-]+))$/);
      if (addressMatch) {
        parsed.address = addressMatch[1].trim();
        parsed.aptNumber = addressMatch[2] || '';
        consumed[index] = true;
        return;
      }

      var linkMatch = line.match(/^https?:\/\/\S+$/i);
      if (linkMatch) {
        parsed.listingUrl = line;
        consumed[index] = true;
      }
    });

    for (var i = 0; i < lines.length; i++) {
      if (/^\$[\d,]+$/.test(lines[i])) {
        var amount = Number(lines[i].replace(/[$,]/g, ''));
        var next = lines[i + 1] || '';
        if (/^base rent$/i.test(next) && parsed.rent == null) {
          parsed.rent = amount;
          consumed[i] = true;
          consumed[i + 1] = true;
        } else if (/net effective base rent/i.test(next)) {
          parsed.netEffective = amount;
          consumed[i] = true;
          consumed[i + 1] = true;
        } else if (amount < 1000 && parsed.amenitiesFees == null) {
          parsed.amenitiesFees = amount;
          consumed[i] = true;
          notes.push('Additional monthly fee: $' + amount);
        }
      } else {
        var inlineNet = lines[i].match(/^\$([\d,]+)\s+net effective base rent$/i);
        if (inlineNet) {
          parsed.netEffective = Number(inlineNet[1].replace(/,/g, ''));
          consumed[i] = true;
        }
      }
    }

    var sqftMatch = String(text).match(/([\d,]+|-)\s*ft²/i);
    if (sqftMatch && sqftMatch[1] !== '-') parsed.squareFeet = Number(sqftMatch[1].replace(/,/g, ''));

    var bedMatch = String(text).match(/(\d+(?:\.\d+)?)\s*bed\b/i);
    if (bedMatch) parsed.bedrooms = Number(bedMatch[1]);

    var bathMatch = String(text).match(/(\d+(?:\.\d+)?)\s*bath\b/i);
    if (bathMatch) parsed.bathrooms = Number(bathMatch[1]);

    lines.forEach(function (line, index) {
      if (consumed[index]) return;
      if (/^Save$/i.test(line) || /^For Rent$/i.test(line)) return;
      if (/^\d+(?:\.\d+)?\s*bed$/i.test(line)) return;
      if (/^\d+(?:\.\d+)?\s*bath$/i.test(line)) return;
      if (/^[\d,-]+\s*ft²$/i.test(line)) return;
      if (/^\$\d+ per ft²$/i.test(line)) return;
      if (/^\d+ rooms?$/i.test(line)) return;
      if (/months? free|month free|lease/i.test(line)) {
        notes.push('Concession: ' + line);
        return;
      }
      if (/^Listing by /i.test(line)) {
        notes.push(line);
        return;
      }
      if (/Base rent only|full breakdown/i.test(line)) {
        notes.push(line);
        return;
      }
      other.push(line);
    });

    if (!parsed.address && parsed.rent == null && parsed.netEffective == null && !parsed.neighborhood) return null;
    parsed.organizedNotes = buildOrganizedNotes(notes, other);
    return parsed;
  }

  function buildOrganizedNotes(notes, other) {
    var sections = [];
    var uniqueNotes = Array.from(new Set(notes));
    var uniqueOther = Array.from(new Set(other));
    if (uniqueNotes.length) sections.push(uniqueNotes.join('\n'));
    if (uniqueOther.length) sections.push('Other:\n' + uniqueOther.join('\n'));
    return sections.join('\n\n');
  }

  function renderApartments() {
    if (!state.apartments.length) {
      listEl.innerHTML = '<div class="empty-state">No apartments yet.</div>';
      return;
    }
    listEl.innerHTML = '';
    state.apartments.forEach(function (apartment) {
      listEl.appendChild(renderAdminApartment(apartment));
    });
  }

  function renderAdminApartment(apartment) {
    var card = document.createElement('article');
    card.className = 'manager-row';
    var cur = apartment.status || 'new';
    card.innerHTML =
      '<div class="manager-row-line">' +
        '<div class="manager-row-identity">' +
          '<h3 class="manager-row-title">' + escapeHtml(apartment.title) + '</h3>' +
          '<div class="manager-row-sub muted">' + escapeHtml([apartment.neighborhood, apartment.address].filter(Boolean).join(' · ')) + '</div>' +
        '</div>' +
        '<select class="status-pill status-select manager-row-status ' + NyhomeStatus.statusClass(cur) + '" data-apartment-status>' +
          statusOptions(cur) +
        '</select>' +
        '<span class="match-pill match-pill--row">' +
          '<span class="match-percentage">' + scoreText(apartment.scores && apartment.scores.combined) + '</span>' +
          '<span class="match-score-label">Combined</span>' +
        '</span>' +
        '<span class="manager-row-metric manager-row-metric--rent" title="Rent">' + escapeHtml(apartment.rent_cents ? formatMoney(apartment.rent_cents) : 'Rent TBD') + '</span>' +
        '<span class="manager-row-metric manager-row-metric--unit" title="Unit">' + escapeHtml(unitSummary(apartment) || 'Unit TBD') + '</span>' +
        '<span class="manager-row-metric manager-row-metric--move" title="Move-in">' + escapeHtml(apartment.move_in_date ? 'Move-in ' + apartment.move_in_date : 'Move-in TBD') + '</span>' +
        '<div class="manager-row-actions" role="group" aria-label="Listing actions">' +
          '<button type="button" class="row-action row-action--edit" data-action="edit">Edit</button>' +
          '<a class="row-action row-action--details" href="/details/?id=' + encodeURIComponent(apartment.id) + '">Details</a>' +
          '<button type="button" class="row-action row-action--delete" data-action="delete">Delete</button>' +
        '</div>' +
      '</div>';

    var statusSelect = card.querySelector('[data-apartment-status]');
    if (statusSelect) {
      var aria = 'Status, ' + String(apartment.title != null && String(apartment.title).trim() !== '' ? apartment.title : 'this listing');
      statusSelect.setAttribute('aria-label', aria);
      statusSelect.addEventListener('change', function () {
        var nextStatus = NyhomeStatus.normalizeStatus(statusSelect.value);
        var prev = apartment.status || 'new';
        var payload = apartmentToSavePayload(apartment);
        payload.status = nextStatus;
        statusSelect.className = 'status-pill status-select manager-row-status ' + NyhomeStatus.statusClass(nextStatus);
        statusSelect.disabled = true;
        NyhomeAPI.saveApartment(payload).then(function () {
          apartment.status = nextStatus;
          if (String(value('apartment-id')) === String(apartment.id)) {
            setValue('status', nextStatus);
            syncStatusControls(nextStatus);
          }
          return load();
        }).catch(function (err) {
          console.error('[nyhome-admin] save apartment status', err);
          if (statusSelect.isConnected) {
            statusSelect.value = prev;
            statusSelect.className = 'status-pill status-select manager-row-status ' + NyhomeStatus.statusClass(prev);
          }
        }).then(function () {
          if (statusSelect.isConnected) {
            statusSelect.disabled = false;
          }
        });
      });
    }

    card.querySelector('[data-action="edit"]').addEventListener('click', function () { fillApartmentForm(apartment); });
    card.querySelector('[data-action="delete"]').addEventListener('click', function () {
      if (!confirm('Delete this apartment?')) return;
      return NyhomeAPI.deleteApartment(apartment.id).then(load).catch(function (err) {
        console.error('[nyhome-admin] delete apartment', err);
      });
    });

    return card;
  }

  function renderRatingControls(apartment) {
    if (!state.criteria.length) return '<p class="muted">Add criteria to start scoring.</p>';
    return '<details class="rating-shell">' +
      '<summary>' +
        '<span class="rating-summary-title">Voting</span>' +
        '<span class="rating-summary-stats">' +
          scoreStat('Combined', apartment.scores && apartment.scores.combined) +
          scoreStat('Kerv', apartment.scores && apartment.scores.kerv) +
          scoreStat('Peter', apartment.scores && apartment.scores.peter) +
        '</span>' +
      '</summary>' +
      '<section class="rating-panel">' +
        '<div class="rating-legend" aria-label="Voting legend">' +
          '<span><i class="legend-dot legend-kerv"></i>Kerv</span>' +
          '<span><i class="legend-dot legend-peter"></i>Peter</span>' +
        '</div>' +
      '<div class="partner-vote-grid">' +
        renderPartnerRatingCard(apartment, 'kerv') +
        renderPartnerRatingCard(apartment, 'peter') +
      '</div>' +
      '</section>' +
    '</details>';
  }

  function renderPartnerRatingCard(apartment, partnerKey) {
    return '<div class="partner-vote-card partner-vote-card-' + partnerKey + '" aria-label="' + (partnerKey === 'kerv' ? 'Kerv' : 'Peter') + ' voting card">' +
      state.criteria.map(function (criterion) {
        var rating = ((apartment.ratings || {})[partnerKey] || {})[criterion.id] || '';
        return '<div class="vote-row">' +
          '<div class="vote-criterion"><strong>' + escapeHtml(criterion.label) + '</strong>' +
          (criterion.definition ? '<span>' + escapeHtml(criterion.definition) + '</span>' : '') + '</div>' +
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

  function renderVisitForm(apartment) {
    var visit = apartment.next_visit || {};
    return '<form data-visit-form class="form-card">' +
      '<div class="form-grid"><label>Visit time<input data-visit-at type="datetime-local" value="' + escapeAttr(toDateTimeLocal(visit.visit_at)) + '"></label>' +
      '<label class="span-2">Visit notes<textarea data-visit-notes rows="2">' + escapeHtml(visit.notes || '') + '</textarea></label></div>' +
      '<button class="secondary-btn" type="submit">Save visit</button></form>';
  }

  function renderApplicationForm(apartment) {
    var application = apartment.application || {};
    return '<form data-application-form class="form-card">' +
      '<div class="form-grid">' +
        '<label>Application status<input data-application-status value="' + escapeAttr(application.status || '') + '" placeholder="documents sent"></label>' +
        '<label>Broker name<input data-broker-name value="' + escapeAttr(application.broker_name || '') + '"></label>' +
        '<label>Broker contact<input data-broker-contact value="' + escapeAttr(application.broker_contact || '') + '"></label>' +
        '<label>Deadline<input data-deadline-at type="datetime-local" value="' + escapeAttr(toDateTimeLocal(application.deadline_at)) + '"></label>' +
        '<label class="span-2">Application notes<textarea data-application-notes rows="2">' + escapeHtml(application.notes || '') + '</textarea></label>' +
      '</div><button class="secondary-btn" type="submit">Save application</button></form>';
  }

  function renderCriteria() {
    if (!state.criteria.length) {
      criteriaListEl.innerHTML = '<div class="empty-state">No criteria yet.</div>';
      return;
    }
    criteriaListEl.innerHTML = '';
    state.criteria.forEach(function (criterion) {
      var row = document.createElement('div');
      row.className = 'list-row';
      row.innerHTML = '<div><strong>' + escapeHtml(criterion.label) + '</strong>' +
        (criterion.definition ? '<div class="muted">' + escapeHtml(criterion.definition) + '</div>' : '') +
        '</div><div class="button-row"><span class="pill">weight ' + Number(criterion.weight).toFixed(1) + '</span><button class="danger-btn" type="button">Delete</button></div>';
      row.querySelector('button').addEventListener('click', function () {
        NyhomeAPI.deleteCriterion(criterion.id).then(load).catch(function (err) {
          console.error('[nyhome-admin] delete criterion', err);
        });
      });
      criteriaListEl.appendChild(row);
    });
  }

  function renderNeighborhoodOptions() {
    var datalist = document.getElementById('neighborhood-options');
    datalist.innerHTML = state.neighborhoods.map(function (neighborhood) {
      return '<option value="' + escapeAttr(neighborhood.name) + '"></option>';
    }).join('');
  }

  function getSelectedValues(groupName) {
    return Array.prototype.map.call(
      document.querySelectorAll('[data-selector-group="' + groupName + '"] .selector-chip.active'),
      function (button) { return button.getAttribute('data-value'); }
    );
  }

  function setSelectedValues(groupName, values) {
    var selected = new Set(values || []);
    document.querySelectorAll('[data-selector-group="' + groupName + '"] .selector-chip').forEach(function (button) {
      var isActive = selected.has(button.getAttribute('data-value'));
      button.classList.toggle('active', isActive);
      button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
  }

  function mergeValues(a, b) {
    return Array.from(new Set([].concat(a || [], b || [])));
  }

  function renderNextActions() {
    var actions = [];
    state.apartments.forEach(function (apartment) {
      if (apartment.next_visit) actions.push(apartment.title + ': tour ' + apartment.next_visit.visit_at);
      if (apartment.application && apartment.application.deadline_at) actions.push(apartment.title + ': application deadline ' + apartment.application.deadline_at);
    });
    nextActionsEl.innerHTML = actions.length
      ? actions.map(function (action) { return '<div class="list-row">' + escapeHtml(action) + '</div>'; }).join('')
      : '<div class="empty-state">No next actions yet.</div>';
  }

  function scoreBox(label, value) {
    return '<div class="score-box"><span class="muted">' + label + '</span><strong>' + (value != null ? Math.round(value) : '-') + '</strong></div>';
  }

  function scoreText(value) {
    return value != null ? Math.round(value) + '%' : '-';
  }

  function unitSummary(apartment) {
    var specs = [];
    if (apartment.bedrooms != null) specs.push(apartment.bedrooms + ' bed');
    if (apartment.bathrooms != null) specs.push(apartment.bathrooms + ' bath');
    if (apartment.square_feet) specs.push(apartment.square_feet + ' sq ft');
    return specs.join(' · ');
  }

  function formatMoney(cents) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format((Number(cents) || 0) / 100);
  }

  function scoreStat(label, value) {
    return '<span class="score-stat"><b>' + escapeHtml(label) + '</b> ' + (value != null ? Math.round(value) : '-') + '</span>';
  }

  function checkIcon() {
    return '<svg class="check-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9.2 16.6 4.9 12.3l-2 2 6.3 6.3L21.8 7.9l-2-2z"></path></svg>';
  }

  function value(id) {
    return document.getElementById(id).value.trim();
  }

  function setValue(id, next) {
    document.getElementById(id).value = next == null ? '' : next;
  }

  function numberOrNull(value) {
    var n = Number(value);
    return Number.isFinite(n) && value !== '' ? n : null;
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
