(function () {
  var rootEl = document.getElementById('detail-root');
  var state = { apartment: null, criteria: [], neighborhoods: [], detailVibeSlots: ['', '', ''], detailVibeActiveSlot: 0 };

  document.addEventListener('DOMContentLoaded', boot);

  var STATUS_ORDER = NyhomeStatus.STATUS_NAV;

  function catchSaveApartment(err) {
    console.error('[nyhome-details] save apartment', err);
    if (err.status === 409) return;
    if (window.alert) window.alert('Could not save. Check your connection and try again.');
  }

  function saveDetailApartment() {
    return NyhomeSaveWorkflow.saveApartmentRespectingBlacklist(NyhomeAPI.saveApartment, function (forRetry) {
      var p = buildApartmentPayload();
      if (forRetry) p.ignoreBlacklist = true;
      return p;
    });
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

    var tab = activeTab || (currentTab() || 'scorecard');
    var cached = NyhomeAPI.getApartmentsCache();
    if (cached) {
      try {
        var fromCache = (cached.apartments || []).find(function (item) {
          return String(item.id) === String(id);
        });
        if (fromCache) {
          state.apartment = fromCache;
          state.criteria = cached.criteria || [];
          state.neighborhoods = cached.neighborhoods || [];
          render(tab);
        }
      } catch (e) {
        console.error('[nyhome-details] cache render', e);
      }
    }

    NyhomeAPI.getApartments()
      .then(function (data) {
        var apartment = (data.apartments || []).find(function (item) {
          return String(item.id) === String(id);
        });

        if (!apartment) {
          rootEl.innerHTML = '<div class="empty-state">Apartment not found.</div>';
          return;
        }

        state.apartment = apartment;
        state.criteria = data.criteria || [];
        state.neighborhoods = data.neighborhoods || [];
        render(activeTab || currentTab() || 'scorecard');
      })
      .catch(function () {
        if (state.apartment) {
          return;
        }
        rootEl.innerHTML = '<div class="empty-state">Could not load apartment details yet.</div>';
      });
  }

  function render(activeTab) {
    var apartment = state.apartment;
    if (!apartment) return;
    var tab = activeTab || 'scorecard';
    syncDetailVibeSlotsFromApartment(apartment);
    rootEl.innerHTML =
      renderSummaryHeader(apartment) +
      '<div class="summary-tabs-container">' +
        renderTabs(tab) +
        '<div class="summary-tab-panels" id="detail-tab-panels">' + tabPanelHtml(apartment, tab) + '</div>' +
      '</div>';

    bindTabs();
    bindStatusHeader();
    detailPanelBind(tab);
  }

  function tabPanelHtml(apartment, activeTab) {
    if (activeTab === 'scorecard') return renderScorecardTab(apartment, activeTab);
    if (activeTab === 'images') return renderImagesTab(apartment, activeTab);
    if (activeTab === 'unit') return renderUnitSetupTab(apartment, activeTab);
    if (activeTab === 'peter') return renderPartnerTab(apartment, 'peter', activeTab);
    if (activeTab === 'kerv') return renderPartnerTab(apartment, 'kerv', activeTab);
    if (activeTab === 'tour') return renderTourTab(apartment, activeTab);
    if (activeTab === 'application') return renderApplicationTab(apartment, activeTab);
    if (activeTab === 'activity') return renderActivityTab(apartment, activeTab);
    return renderScorecardTab(apartment, 'scorecard');
  }

  function detailPanelBind(tabId) {
    if (tabId === 'images') {
      for (var vi = 0; vi < 3; vi++) {
        updateDetailVibeSlotUI(vi);
      }
      bindDetailVibePhotoSlots();
      bindDetailVibeSave();
      bindVoting();
      bindDefinitionToggles();
    } else if (tabId === 'peter' || tabId === 'kerv') {
      bindVoting();
      bindDefinitionToggles();
    } else if (tabId === 'unit') {
      bindUnitPanel();
    } else if (tabId === 'tour') {
      bindVisitForm();
    } else if (tabId === 'application') {
      bindApplicationForm();
    }
  }

  function renderSummaryHeader(apartment) {
    var status = NyhomeStatus.normalizeStatus(apartment.status || 'new');
    return '<section class="app-summary-card">' +
      '<div class="summary-hero-badges">' +
        '<div class="summary-hero-badges-left">' +
        '<img class="summary-status-badge" src="/assets/img/' + escapeAttr(status) + '.png" alt="" aria-hidden="true" width="100" height="100">' +
        '</div>' +
      '</div>' +
      '<div class="summary-status-row">' +
        statusProgressionControls(apartment.status || 'new') +
      '</div>' +
      '<div class="summary-title-row">' +
        '<div>' +
          '<h2 class="apartment-title">' + escapeHtml(apartment.title || 'Untitled apartment') + '</h2>' +
          '<div class="apartment-location muted">' + escapeHtml([apartment.neighborhood, apartment.address].filter(Boolean).join(' · ')) + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="app-meta">' +
        metaItem('location', apartment.neighborhood || apartment.address || 'Neighborhood TBD') +
        metaItem('money', formatMoney(apartment.rent_cents) || 'Rent TBD') +
        metaItem('home', unitSummary(apartment) || 'Unit details TBD') +
        metaItem('calendar', apartment.move_in_date ? 'Move-in ' + apartment.move_in_date : 'Move-in TBD') +
        metaItem('refresh', apartment.updated_at ? 'Updated ' + formatDate(apartment.updated_at) : 'Updated TBD') +
        linkMetaItem(apartment.listing_url) +
        renderScores(apartment.scores || {}, 'score-grid--meta-inline') +
      '</div>' +
    '</section>';
  }

  function renderTabs(activeTab) {
    var tabs = [
      ['scorecard', 'Scorecard'],
      ['images', 'Images'],
      ['unit', 'Unit Setup'],
      ['peter', 'Peter'],
      ['kerv', 'Kerv'],
      ['tour', 'Tour'],
      ['application', 'Application'],
      ['activity', 'Activity Log'],
    ];

    return '<div class="summary-tabs-header">' +
      tabs.map(function (tab) {
        return '<button type="button" class="summary-tab' + (activeTab === tab[0] ? ' active' : '') + '" data-tab-target="' + tab[0] + '">' + tab[1] + '</button>';
      }).join('') +
      '<button type="button" class="status-reject-quiet summary-tabs-reject" data-status-reject aria-label="Mark rejected">Reject</button>' +
    '</div>';
  }

  function getListingPhotoUrls(apartment) {
    return (apartment.images || []).map(function (i) { return i.image_url; }).filter(Boolean).slice(0, 3);
  }

  function syncDetailVibeSlotsFromApartment(apartment) {
    var urls = getListingPhotoUrls(apartment);
    state.detailVibeSlots = ['', '', ''];
    for (var i = 0; i < urls.length && i < 3; i++) {
      state.detailVibeSlots[i] = urls[i];
    }
  }

  function getDetailVibeImageUrls() {
    return state.detailVibeSlots.filter(function (u) { return u && String(u).trim(); });
  }

  function renderDetailVibeEditor() {
    return '<div class="content-section detail-images-editor">' +
      '<div class="section-header"><h3 class="section-title">Listing photos</h3></div>' +
      '<p class="form-hint muted">Up to 3. Click a slot, then paste a screenshot or drop an image. Saved as compressed JPEGs (same as admin).</p>' +
      '<div id="detail-vibe-photo-slots" class="vibe-photo-slots detail-vibe-photo-slots" role="group" aria-label="Apartment photos">' +
        '<div class="vibe-slot" data-vibe-slot="0">' +
          '<div class="vibe-slot-surface" tabindex="0" role="button" aria-label="Photo 1, paste or drop"></div>' +
          '<button type="button" class="vibe-slot-clear" data-vibe-clear aria-label="Remove photo 1" hidden>×</button>' +
        '</div>' +
        '<div class="vibe-slot" data-vibe-slot="1">' +
          '<div class="vibe-slot-surface" tabindex="0" role="button" aria-label="Photo 2, paste or drop"></div>' +
          '<button type="button" class="vibe-slot-clear" data-vibe-clear aria-label="Remove photo 2" hidden>×</button>' +
        '</div>' +
        '<div class="vibe-slot" data-vibe-slot="2">' +
          '<div class="vibe-slot-surface" tabindex="0" role="button" aria-label="Photo 3, paste or drop"></div>' +
          '<button type="button" class="vibe-slot-clear" data-vibe-clear aria-label="Remove photo 3" hidden>×</button>' +
        '</div>' +
      '</div>' +
      '<div class="button-row detail-vibe-actions">' +
        '<button type="button" class="primary-btn" id="detail-vibe-save-photos">Save photos</button>' +
      '</div>' +
    '</div>';
  }

  function firstEmptyDetailVibeIndex() {
    for (var i = 0; i < 3; i++) {
      if (!state.detailVibeSlots[i]) return i;
    }
    return -1;
  }

  function assignDetailVibeSlot(index, dataUrl) {
    if (index < 0 || index > 2) return;
    state.detailVibeSlots[index] = dataUrl;
    updateDetailVibeSlotUI(index);
  }

  function updateDetailVibeSlotUI(index) {
    var root = document.getElementById('detail-vibe-photo-slots');
    if (!root) return;
    var slot = root.querySelector('.vibe-slot[data-vibe-slot="' + index + '"]');
    if (!slot) return;
    var surface = slot.querySelector('.vibe-slot-surface');
    var clearBtn = slot.querySelector('[data-vibe-clear]');
    var u = state.detailVibeSlots[index];
    if (u) {
      surface.innerHTML = '<img class="vibe-slot-img" src="' + escapeAttr(u) + '" alt="Preview">';
      if (clearBtn) clearBtn.hidden = false;
    } else {
      surface.innerHTML = '<span class="vibe-slot-placeholder">Click, paste, drop</span>';
      if (clearBtn) clearBtn.hidden = true;
    }
  }

  function bindDetailVibePhotoSlots() {
    var root = document.getElementById('detail-vibe-photo-slots');
    if (!root || !window.NyhomeVibeImages) {
      return;
    }

    function compressAndSet(file, slotIndex) {
      window.NyhomeVibeImages.fileToCompressedDataUrl(file).then(function (dataUrl) {
        var idx = slotIndex;
        if (idx < 0 || idx > 2) idx = 0;
        assignDetailVibeSlot(idx, dataUrl);
      }).catch(function (err) {
        console.error('[nyhome-details] image compress', err);
      });
    }

    root.addEventListener('click', function (e) {
      var c = e.target.closest && e.target.closest('[data-vibe-clear]');
      if (c) {
        e.preventDefault();
        e.stopPropagation();
        var clearSlot = c.closest('.vibe-slot');
        if (clearSlot) {
          assignDetailVibeSlot(Number(clearSlot.getAttribute('data-vibe-slot')), '');
        }
        return;
      }
      var s = e.target.closest && e.target.closest('.vibe-slot-surface');
      if (s) {
        var parent = s.closest('.vibe-slot');
        if (parent) {
          state.detailVibeActiveSlot = Number(parent.getAttribute('data-vibe-slot')) || 0;
        }
        try {
          s.focus();
        } catch (err) { /* empty */ }
      }
    });

    root.addEventListener('paste', function (e) {
      var f = window.NyhomeVibeImages.clipboardImageFileFromEvent(e);
      if (!f) return;
      e.preventDefault();
      e.stopPropagation();
      var empty = firstEmptyDetailVibeIndex();
      var idx = empty === -1 ? state.detailVibeActiveSlot : empty;
      compressAndSet(f, idx);
    });

    root.addEventListener('dragover', function (e) {
      e.preventDefault();
    });
    root.addEventListener('drop', function (e) {
      e.preventDefault();
      var file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (!file || !file.type || file.type.indexOf('image') !== 0) return;
      var slot = e.target.closest && e.target.closest('.vibe-slot');
      var idx = slot ? Number(slot.getAttribute('data-vibe-slot')) : state.detailVibeActiveSlot;
      if (Number.isNaN(idx)) idx = 0;
      compressAndSet(file, idx);
    });
  }

  function bindDetailVibeSave() {
    var btn = document.getElementById('detail-vibe-save-photos');
    if (!btn) return;
    btn.addEventListener('click', function () {
      saveDetailApartment().then(function () {
        return load('images');
      }).catch(catchSaveApartment);
    });
  }

  function renderListingPhotoGalleryAside(apartment) {
    var urls = getListingPhotoUrls(apartment);
    if (urls.length) {
      return '<aside class="detail-images-gallery" aria-label="Listing photos">' +
        urls.map(function (url) {
          return '<div class="vibe-thumb-frame vibe-thumb--tab"><img class="vibe-thumb-img" src="' + escapeAttr(url) + '" alt="" width="300" height="300" loading="lazy"></div>';
        }).join('') +
      '</aside>';
    }
    return '<aside class="detail-images-gallery detail-images-gallery--empty" aria-label="Listing photos"><p class="muted">No photos yet. Add up to 3 on this page (Images tab) or in Admin.</p></aside>';
  }

  function renderScorecardPhotoBlock(apartment) {
    var urls = getListingPhotoUrls(apartment);
    if (!urls.length) {
      return contentSection('Photos', '<p class="muted">No photos yet. Add them in the <strong>Images</strong> tab or Admin.</p>');
    }
    return contentSection('Photos', '<div class="scorecard-vibe-strip" role="list">' +
      urls.map(function (url) {
        return '<div class="vibe-thumb-frame vibe-thumb--scorecard" role="listitem"><img class="vibe-thumb-img" src="' + escapeAttr(url) + '" alt="" width="400" height="400" loading="lazy"></div>';
      }).join('') +
    '</div>');
  }

  function renderScorecardTab(apartment, activeTab) {
    return '<section id="tab-scorecard" class="summary-tab-content' + (activeTab === 'scorecard' ? ' active' : '') + '">' +
      '<h2>Scorecard</h2>' +
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
      renderScorecardPhotoBlock(apartment) +
    '</section>';
  }

  function renderVotingScoreTable(apartment) {
    if (!state.criteria.length) {
      return '<div class="detail-voting-table-wrap content-section"><p class="muted">Add criteria in Admin to start scoring.</p></div>';
    }
    var r = apartment.ratings || {};
    var rp = r.peter || {};
    var rk = r.kerv || {};
    var rows = state.criteria.map(function (c) {
      return '<tr><th scope="row">' + escapeHtml(c.label) + '</th><td>' + votingScoreCell(rp[c.id]) + '</td><td>' + votingScoreCell(rk[c.id]) + '</td></tr>';
    }).join('');
    return '<div class="detail-voting-table-wrap content-section">' +
      '<div class="section-header"><h3 class="section-title">Per-criterion scores</h3></div>' +
      '<div class="detail-voting-table-scroll">' +
        '<table class="detail-voting-score-table">' +
          '<thead><tr><th scope="col">Criterion</th><th scope="col">Peter</th><th scope="col">Kerv</th></tr></thead>' +
          '<tbody>' + rows + '</tbody>' +
        '</table>' +
      '</div>' +
    '</div>';
  }

  function votingScoreCell(v) {
    if (v === null) return 'N/A';
    if (v === undefined || v === '') return '—';
    return escapeHtml(String(v));
  }

  function renderImagesTab(apartment, activeTab) {
    return '<section id="tab-images" class="summary-tab-content' + (activeTab === 'images' ? ' active' : '') + '">' +
      '<h2>Images &amp; scores</h2>' +
      renderDetailVibeEditor() +
      '<div class="detail-images-tab-layout">' +
        renderVotingScoreTable(apartment) +
        renderListingPhotoGalleryAside(apartment) +
      '</div>' +
    '</section>';
  }

  function detailNeighborhoodOptionsHtml() {
    return (state.neighborhoods || []).map(function (n) {
      return '<option value="' + escapeAttr(n.name) + '"></option>';
    }).join('');
  }

  function renderUnitSetupTab(apartment, activeTab) {
    return '<section id="tab-unit" class="summary-tab-content' + (activeTab === 'unit' ? ' active' : '') + '">' +
      '<h2>Unit Setup</h2>' +
      '<form data-apartment-form class="content-section">' +
        '<div class="section-header"><h3 class="section-title">Apartment Controls</h3></div>' +
        '<div class="form-grid">' +
          '<label>Neighborhood<input data-detail-neighborhood list="detail-neighborhood-options" value="' + escapeAttr(apartment.neighborhood || '') + '" placeholder="Neighborhood" autocomplete="off"></label>' +
          '<datalist id="detail-neighborhood-options">' + detailNeighborhoodOptionsHtml() + '</datalist>' +
          '<label>Address<input data-detail-address required value="' + escapeAttr(apartment.address || '') + '" placeholder="Street address" autocomplete="street-address"></label>' +
          '<label>Apt number<input data-detail-apt value="' + escapeAttr(apartment.apt_number || '') + '" placeholder="Unit" autocomplete="off"></label>' +
          '<label>Move-in date<input data-detail-move-in type="date" value="' + escapeAttr(apartment.move_in_date || '') + '"></label>' +
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

  function renderPartnerTab(apartment, partnerKey, activeTab) {
    var title = partnerKey === 'peter' ? 'Peter' : 'Kerv';
    return '<section id="tab-' + partnerKey + '" class="summary-tab-content' + (activeTab === partnerKey ? ' active' : '') + '">' +
      '<h2>' + title + '</h2>' +
      '<div class="detail-images-tab-layout detail-images-tab-layout--partner">' +
        renderPartnerVotingList(apartment, partnerKey) +
        renderListingPhotoGalleryAside(apartment) +
      '</div>' +
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
    if (!state.apartment) return;
    rootEl.querySelectorAll('.summary-tab').forEach(function (tab) {
      tab.classList.toggle('active', tab.getAttribute('data-tab-target') === tabId);
    });
    var host = document.getElementById('detail-tab-panels');
    if (host) {
      host.innerHTML = tabPanelHtml(state.apartment, tabId);
      detailPanelBind(tabId);
    }
  }

  function currentTab() {
    var active = rootEl.querySelector('.summary-tab.active');
    return active ? active.getAttribute('data-tab-target') : '';
  }

  function bindStatusHeader() {
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
      saveDetailApartment().then(function () { load(currentTab() || 'scorecard'); }).catch(catchSaveApartment);
    });
    if (status) status.addEventListener('change', function () {
      syncStatusControls(status.value || 'new');
      saveDetailApartment().then(function () { load(currentTab() || 'scorecard'); }).catch(catchSaveApartment);
    });

    if (state.apartment) {
      syncStatusControls(NyhomeStatus.normalizeStatus(state.apartment.status || 'new'));
    }
  }

  function bindUnitPanel() {
    var form = rootEl.querySelector('[data-apartment-form]');
    if (!form) return;
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      saveDetailApartment().then(function () { load('unit'); }).catch(catchSaveApartment);
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
        var payload = {
          apartmentId: state.apartment.id,
          partnerKey: parts[0],
          criterionId: Number(parts[1]),
        };
        if (button.getAttribute('data-na') === 'true') {
          payload.score = null;
        } else {
          payload.score = Number(button.getAttribute('data-score'));
        }
        NyhomeAPI.saveRating(payload).then(function () { load(currentTab() || 'scorecard'); });
      });
    });
  }

  function bindDefinitionToggles() {
    rootEl.querySelectorAll('[data-def-toggle]').forEach(function (button) {
      button.addEventListener('click', function () {
        var id = button.getAttribute('data-def-for');
        if (!id) return;
        var panel = document.getElementById(id);
        if (!panel || !rootEl.contains(panel)) return;
        if (panel.hasAttribute('hidden')) {
          panel.removeAttribute('hidden');
          button.setAttribute('aria-expanded', 'true');
        } else {
          panel.setAttribute('hidden', '');
          button.setAttribute('aria-expanded', 'false');
        }
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

  function renderScores(scores, extraClass) {
    var cls = 'score-grid' + (extraClass ? ' ' + extraClass : '');
    return '<div class="' + cls + '" role="group" aria-label="Match scores">' +
      scoreBox('combined', 'Avg', scores.combined) +
      scoreBox('kerv', 'Kerv', scores.kerv) +
      scoreBox('peter', 'Peter', scores.peter) +
    '</div>';
  }

  function scoreBox(voteKey, label, value) {
    return '<div class="score-box score-box--vote-' + voteKey + '"><span class="muted">' + escapeHtml(label) + '</span><span class="score-box-value">' + scoreText(value) + '</span></div>';
  }

  function renderPartnerVotingList(apartment, partnerKey) {
    if (!state.criteria.length) {
      return '<div class="empty-state">Add criteria in Admin to start scoring.</div>';
    }
    return '<section class="content-section detail-vote-content">' +
      '<div class="compact-list detail-vote-list">' +
        state.criteria.map(function (criterion) {
          return renderPartnerVoteRow(apartment, partnerKey, criterion);
        }).join('') +
      '</div>' +
    '</section>';
  }

  function renderPartnerVoteRow(apartment, partnerKey, criterion) {
    var rating = ((apartment.ratings || {})[partnerKey] || {})[criterion.id];
    var def = criterion.definition && String(criterion.definition).trim();
    var hasDef = Boolean(def);
    var panelId = 'criterion-def-' + partnerKey + '-' + criterion.id;
    var rowClass = 'manager-row detail-vote-row detail-vote-row--' + partnerKey;
    return '<article class="' + rowClass + '">' +
      '<div class="detail-vote-line">' +
        '<div class="detail-vote-left">' +
          '<strong class="detail-vote-label">' + escapeHtml(criterion.label) + '</strong>' +
          (hasDef
            ? '<button type="button" class="criterion-def-btn" data-def-toggle data-def-for="' + escapeAttr(panelId) + '" aria-expanded="false" aria-label="Show definition for ' + escapeAttr(criterion.label) + '">?</button>'
            : '<span class="criterion-def-spacer" aria-hidden="true"></span>') +
        '</div>' +
        '<div class="score-picker detail-vote-scores partner-vote-card-' + partnerKey + '">' +
        naRatingButton(partnerKey, criterion.id, rating === null) +
        [0, 1, 2, 3, 4, 5].map(function (score) {
          return ratingButton(partnerKey, criterion.id, score, rating != null && Number(rating) === score);
        }).join('') +
        '</div>' +
      '</div>' +
      (hasDef
        ? '<div class="vote-criterion-def-panel" id="' + escapeAttr(panelId) + '" hidden><p class="vote-criterion-def-text">' + escapeHtml(def) + '</p></div>'
        : '') +
    '</article>';
  }

  function naRatingButton(partnerKey, criterionId, isActive) {
    return '<button type="button" class="score-btn score-btn--na' + (isActive ? ' active' : '') + '" data-rating="' + partnerKey + ':' + criterionId + '" data-na="true" aria-label="Not applicable">' +
      '<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">' +
        '<path d="M24 4 43 15v18L24 44 5 33V15Z"></path>' +
      '</svg>' +
      '<span class="score-btn-na-text">N/A</span>' +
    '</button>';
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

  function statusOptions(current) {
    var values = NyhomeStatus.STATUS_ORDER.slice();
    if (values.indexOf(current) < 0) values.push(current);
    return values.map(function (status) {
      return '<option value="' + escapeAttr(status) + '"' + (status === current ? ' selected' : '') + '>' + escapeHtml(formatStatusLabel(status)) + '</option>';
    }).join('');
  }

  function stepStatus(delta, shouldSave) {
    var current = getStatusValue() || 'new';
    var index = STATUS_ORDER.indexOf(current);
    if (index < 0) return;
    var nextIndex = Math.max(0, Math.min(STATUS_ORDER.length - 1, index + delta));
    var next = STATUS_ORDER[nextIndex];
    setStatusValue(next);
    syncStatusControls(next);
    if (shouldSave) {
      saveDetailApartment().then(function () { load(currentTab() || 'scorecard'); }).catch(catchSaveApartment);
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
    var inNav = index >= 0;
    if (prev) prev.disabled = !inNav || isRejected || index === 0;
    if (next) next.disabled = !inNav || isRejected || index === STATUS_ORDER.length - 1;
    if (reject) {
      reject.disabled = isRejected;
      reject.classList.toggle('is-rejected', isRejected);
    }
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

  function haveUnitFormInDom() {
    return !!rootEl.querySelector('[data-apartment-form]');
  }

  function buildApartmentPayload() {
    var apartment = state.apartment;
    var uForm = haveUnitFormInDom();
    var listingEl = rootEl.querySelector('[data-listing-url]');
    var notesEl = rootEl.querySelector('[data-notes]');
    var neighEl = rootEl.querySelector('[data-detail-neighborhood]');
    var addrEl = rootEl.querySelector('[data-detail-address]');
    var aptEl = rootEl.querySelector('[data-detail-apt]');
    var moveEl = rootEl.querySelector('[data-detail-move-in]');
    return {
      id: apartment.id,
      neighborhood: uForm && neighEl ? neighEl.value.trim() : apartment.neighborhood,
      address: uForm && addrEl ? addrEl.value.trim() : apartment.address,
      aptNumber: uForm && aptEl ? aptEl.value.trim() : apartment.apt_number,
      rent: centsToDollars(apartment.rent_cents),
      netEffective: centsToDollars(apartment.net_effective_cents),
      brokerFee: centsToDollars(apartment.broker_fee_cents),
      deposit: centsToDollars(apartment.deposit_cents),
      amenitiesFees: centsToDollars(apartment.amenities_fees_cents),
      totalMoveIn: centsToDollars(apartment.total_move_in_cents),
      bedrooms: apartment.bedrooms,
      bathrooms: apartment.bathrooms,
      squareFeet: apartment.square_feet,
      unitFeatures: uForm ? selectedValues('unit-features') : (apartment.unit_features || []),
      amenities: uForm ? selectedValues('amenities') : (apartment.amenities || []),
      moveInDate: uForm && moveEl && moveEl.value ? moveEl.value : apartment.move_in_date,
      status: NyhomeStatus.normalizeStatus(getStatusValue() || 'new'),
      listingUrl: uForm && listingEl ? listingEl.value : (apartment.listing_url || ''),
      notes: uForm && notesEl ? notesEl.value : (apartment.notes || ''),
      imageUrls: getDetailVibeImageUrls(),
    };
  }

  function selectedValues(groupName) {
    return Array.prototype.map.call(
      rootEl.querySelectorAll('[data-selector-group="' + groupName + '"] .selector-chip.active'),
      function (button) { return button.getAttribute('data-value'); }
    );
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

  function activityTimestamp(value) {
    if (!value) return 0;
    var t = Date.parse(String(value).replace(' ', 'T'));
    return Number.isNaN(t) ? 0 : t;
  }

  function formatActivityDateTime(value) {
    if (!value) return '';
    var date = new Date(String(value).replace(' ', 'T'));
    if (Number.isNaN(date.getTime())) return String(value).slice(0, 16);
    return date.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  }

  function buildActivityItems(apartment) {
    var rows = [];
    if (apartment.created_at) {
      rows.push({
        ts: activityTimestamp(apartment.created_at),
        tuple: ['Created', formatDate(apartment.created_at), apartment.title || 'Apartment added'],
      });
    }
    (apartment.listing_events || []).forEach(function (ev) {
      var ts = activityTimestamp(ev.created_at);
      if (ev.event_type === 'status') {
        var fromL = ev.from_status ? formatStatusLabel(ev.from_status) : 'Start';
        var toL = formatStatusLabel(ev.to_status || 'new');
        rows.push({
          ts: ts,
          tuple: ['Status', formatActivityDateTime(ev.created_at), fromL + ' → ' + toL],
        });
      } else if (ev.event_type === 'vote') {
        var partner = ev.partner_key
          ? String(ev.partner_key).charAt(0).toUpperCase() + String(ev.partner_key).slice(1)
          : 'Vote';
        var sc = ev.score == null ? 'N/A' : String(ev.score);
        var lab = ev.criterion_label || 'Criterion';
        rows.push({
          ts: ts,
          tuple: ['Vote', formatActivityDateTime(ev.created_at), partner + ': ' + lab + ' — ' + sc],
        });
      }
    });
    if (apartment.next_visit) {
      rows.push({
        ts: activityTimestamp(apartment.next_visit.visit_at),
        tuple: ['Tour', formatDate(apartment.next_visit.visit_at), apartment.next_visit.notes || 'Tour scheduled'],
      });
    }
    if (apartment.application) {
      rows.push({
        ts: activityTimestamp(apartment.application.updated_at || apartment.application.deadline_at),
        tuple: [
          'Application',
          formatDate(apartment.application.updated_at || apartment.application.deadline_at),
          apartment.application.status || 'Application tracked',
        ],
      });
    }
    rows.sort(function (a, b) {
      return b.ts - a.ts;
    });
    return rows.map(function (r) {
      return r.tuple;
    });
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
    if (!url) {
      return '<div class="meta-item meta-item--no-listing" role="status">' + iconSvg('link') + '<span>Listing unavailable</span></div>';
    }
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
