(function () {
  var state = {
    apartments: [],
    criteria: [],
    neighborhoods: [],
    buildingBlacklist: [],
    adminCriteriaPainted: false,
    adminBlacklistPainted: false,
    adminAnalyticsFetched: false,
    analyticsData: null,
    analyticsPeriod: 'today',
    adminActivityFetched: false,
    activityData: null,
    activityPeriod: '7d',
    criteriaDistFilter: 'both',
  };
  var form = document.getElementById('apartment-form');
  var listEl = document.getElementById('admin-apartment-list');
  var criteriaListEl = document.getElementById('criteria-list');
  var blacklistListEl = document.getElementById('building-blacklist-list');
  var criteriaDragId = null;
  var vibeSlots = ['', '', ''];
  var vibeActiveSlot = 0;

  /** API rows may use string or number ids; DOM uses numeric attributes — match loosely. */
  function findCriterionInState(id) {
    return state.criteria.find(function (c) {
      return String(c.id) === String(id);
    });
  }

  function patchApartmentsCacheCriteria(mutator) {
    try {
      var cached = NyhomeAPI.getApartmentsCache();
      if (!cached || !Array.isArray(cached.criteria)) return;
      mutator(cached.criteria);
      NyhomeAPI.setApartmentsCache(cached);
    } catch (e) {}
  }

  var ADMIN_SORT_STORAGE_KEY = 'nyhomeAdminApartmentSort';
  var PUBLIC_BASE_STORAGE_KEY = 'nyhomePublicBaseUrl';
  var ADMIN_VALID_SORTS = { default: 1, updated: 1, avg: 1, workflow: 1, ranked: 1 };
  var adminSortMode = 'default';

  document.addEventListener('DOMContentLoaded', boot);

  function boot() {
    var formEl = document.getElementById('apartment-form');
    if (formEl) {
      var qid = new URLSearchParams(window.location.search).get('id');
      if (qid && String(qid).trim()) {
        window.location.replace('/details/?id=' + encodeURIComponent(String(qid).trim()));
        return;
      }
    }
    bindTabs();
    bindApartmentSearch();
    bindAnalyticsRefresh();
    bindAnalyticsPeriodFilter();
    bindActivityPeriodFilter();
    bindCriteriaPartnerFilter();
    initAdminSort();
    bindApartmentForm();
    bindCriterionForm();
    if (form) {
      bindSelectorChips();
      bindNotesParser();
      initVibeSlots();
      syncStatusControls(value('status') || 'new');
      bindStatusControls();
    }
    if (criteriaListEl) bindCriteriaList();
    bindBlacklistList();
    bindBlacklistForm();
    bindBlacklistPasteHelper();
    bindPipelineDigestSettings();
    load();
  }

  function applyAdminListPaint() {
    renderApartments();
    renderSearchSuggestions();
    renderNeighborhoodOptions();
    if (state.adminCriteriaPainted) {
      renderCriteria();
    }
    if (state.adminBlacklistPainted) {
      renderBlacklist();
    }
  }

  function load() {
    var cached = NyhomeAPI.getApartmentsCache();
    if (cached) {
      state.apartments = cached.apartments || [];
      state.criteria = cached.criteria || [];
      state.neighborhoods = cached.neighborhoods || [];
      applyAdminListPaint();
    }
    return Promise.all([
      NyhomeAPI.getApartments(),
      NyhomeAPI.getBuildingBlacklist().catch(function () {
        return { entries: [] };
      }),
    ])
      .then(function (results) {
        var data = results[0] || {};
        var bl = results[1] || { entries: [] };
        state.apartments = data.apartments || [];
        state.criteria = data.criteria || [];
        state.neighborhoods = data.neighborhoods || [];
        state.buildingBlacklist = (bl && bl.entries) || [];
        applyAdminListPaint();
      })
      .catch(function (err) {
        console.error('[nyhome-admin] load', err);
      });
  }

  function bindPipelineDigestSettings() {
    var input = document.getElementById('nyhome-public-base-url');
    var saveBtn = document.getElementById('nyhome-save-public-url');
    var sendBtn = document.getElementById('nyhome-send-pipeline-digest');
    var statusEl = document.getElementById('nyhome-digest-status');
    if (!input || !saveBtn || !sendBtn) return;

    try {
      var saved = localStorage.getItem(PUBLIC_BASE_STORAGE_KEY);
      if (saved) input.value = saved;
    } catch (e) {}

    saveBtn.addEventListener('click', function () {
      var v = (input.value || '').trim().replace(/\/+$/, '');
      try {
        if (v) localStorage.setItem(PUBLIC_BASE_STORAGE_KEY, v);
        else localStorage.removeItem(PUBLIC_BASE_STORAGE_KEY);
      } catch (e) {}
      if (statusEl) {
        statusEl.textContent = v
          ? 'Saved public URL in this browser.'
          : 'Cleared. Server can still use NYHOME_PUBLIC_URL if set.';
      }
    });

    sendBtn.addEventListener('click', function () {
      var base = (input.value || '').trim().replace(/\/+$/, '');
      if (!base) {
        try {
          base = (localStorage.getItem(PUBLIC_BASE_STORAGE_KEY) || '').trim().replace(/\/+$/, '');
        } catch (e) {
          base = '';
        }
      }
      if (!base && window.location && window.location.origin) base = window.location.origin.replace(/\/+$/, '');
      sendBtn.disabled = true;
      var old = sendBtn.textContent;
      sendBtn.textContent = 'Sending…';
      if (statusEl) statusEl.textContent = '';
      NyhomeAPI.sendPipelineDigestEmail({ publicBaseUrl: base })
        .then(function (res) {
          if (statusEl) {
            statusEl.textContent =
              'Sent: ' + (res.subject || 'OK') + ' (to ' + (res.to && res.to.length ? res.to.join(', ') : 'recipients') + ').';
          }
          if (typeof NyhomeUiFeedback !== 'undefined' && NyhomeUiFeedback.showToast) {
            NyhomeUiFeedback.showToast('Digest sent: ' + (res.subject || 'OK'));
          }
        })
        .catch(function (err) {
          var msg = err.message || 'Send failed';
          if (statusEl) statusEl.textContent = msg;
          else if (typeof NyhomeUiFeedback !== 'undefined' && NyhomeUiFeedback.alert) {
            NyhomeUiFeedback.alert(msg, { title: 'Email digest' });
          } else {
            alert(msg);
          }
        })
        .then(function () {
          sendBtn.disabled = false;
          sendBtn.textContent = old;
        });
    });
  }

  function bindTabs() {
    Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (button) {
      button.addEventListener('click', function () {
        var tab = button.getAttribute('data-tab');
        var savedPanel = document.getElementById('tab-saved');
        var leavingSaved = savedPanel && savedPanel.classList.contains('active');
        if (leavingSaved && tab !== 'saved') {
          clearAdminApartmentSearch();
        }
        document.querySelectorAll('.tab').forEach(function (el) { el.classList.remove('active'); });
        document.querySelectorAll('.tab-panel').forEach(function (el) { el.classList.remove('active'); });
        button.classList.add('active');
        document.getElementById('tab-' + tab).classList.add('active');
        if (tab === 'criteria' && !state.adminCriteriaPainted) {
          state.adminCriteriaPainted = true;
          renderCriteria();
        } else if (tab === 'blacklist' && !state.adminBlacklistPainted) {
          state.adminBlacklistPainted = true;
          renderBlacklist();
        } else if (tab === 'analytics' && !state.adminAnalyticsFetched) {
          fetchAndRenderAnalytics();
        } else if (tab === 'activity-log' && !state.adminActivityFetched) {
          fetchAndRenderActivity();
        }
      });
    });
  }

  function syncSearchClearVisibility() {
    var input = document.getElementById('admin-apartment-search');
    var clear = document.getElementById('admin-apartment-search-clear');
    if (!input || !clear) return;
    var has = String(input.value || '').trim().length > 0;
    clear.hidden = !has;
    clear.setAttribute('aria-hidden', has ? 'false' : 'true');
  }

  var SEARCH_SUGGEST_LIMIT = 12;
  var searchSuggestBlurTimeout = null;

  function setSearchListboxExpanded(isOpen) {
    var el = document.getElementById('admin-apartment-search');
    if (el) {
      el.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    }
  }

  function hideSearchSuggestions() {
    var box = document.getElementById('admin-apartment-search-suggestions');
    if (box) {
      box.hidden = true;
      box.innerHTML = '';
    }
    setSearchListboxExpanded(false);
  }

  function renderSearchSuggestions() {
    var box = document.getElementById('admin-apartment-search-suggestions');
    if (!box) return;
    var q = getAdminApartmentSearchQuery();
    if (!q) {
      hideSearchSuggestions();
      return;
    }
    if (!state.apartments.length) {
      hideSearchSuggestions();
      return;
    }
    var matches = state.apartments.filter(function (a) {
      return apartmentSearchHaystack(a).indexOf(q) !== -1;
    });
    var list = matches.slice(0, SEARCH_SUGGEST_LIMIT);
    if (list.length) {
      box.innerHTML = list.map(function (a) {
        var sub = [a.neighborhood, a.address].filter(Boolean).join(' · ');
        return '<button type="button" class="admin-header-search-suggestion" role="option" data-apartment-id="' + String(escapeAttr(String(a.id))) + '">' +
          '<span class="admin-header-search-suggestion-title">' + escapeHtml(a.title) + '</span>' +
          (sub ? '<span class="admin-header-search-suggestion-sub">' + escapeHtml(sub) + '</span>' : '') +
          '</button>';
      }).join('');
    } else {
      box.innerHTML = '<div class="admin-header-search-suggestions-empty" role="status">No names match your search</div>';
    }
    box.hidden = false;
    setSearchListboxExpanded(true);
  }

  function clearAdminApartmentSearch() {
    var input = document.getElementById('admin-apartment-search');
    if (input) input.value = '';
    syncSearchClearVisibility();
    hideSearchSuggestions();
    renderApartments();
  }

  function bindApartmentSearch() {
    var input = document.getElementById('admin-apartment-search');
    var clear = document.getElementById('admin-apartment-search-clear');
    var box = document.getElementById('admin-apartment-search-suggestions');
    if (!input) return;
    if (box) {
      box.addEventListener('mousedown', function (e) {
        var btn = e.target.closest('.admin-header-search-suggestion');
        if (!btn) return;
        e.preventDefault();
        var id = Number(btn.getAttribute('data-apartment-id'));
        var a = state.apartments.find(function (x) { return x.id === id; });
        if (!a) return;
        input.value = a.title;
        syncSearchClearVisibility();
        renderApartments();
        hideSearchSuggestions();
        input.focus();
      });
    }
    function clearBlurTimer() {
      if (searchSuggestBlurTimeout) {
        clearTimeout(searchSuggestBlurTimeout);
        searchSuggestBlurTimeout = null;
      }
    }
    function scheduleHideSuggestions() {
      clearBlurTimer();
      searchSuggestBlurTimeout = setTimeout(hideSearchSuggestions, 200);
    }
    input.addEventListener('input', function () {
      clearBlurTimer();
      syncSearchClearVisibility();
      renderApartments();
      renderSearchSuggestions();
    });
    input.addEventListener('focus', function () {
      clearBlurTimer();
      renderSearchSuggestions();
    });
    input.addEventListener('blur', function (e) {
      var t = e.relatedTarget;
      if (box && t && box.contains(t)) {
        return;
      }
      clearBlurTimer();
      scheduleHideSuggestions();
    });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        hideSearchSuggestions();
      }
    });
    if (clear) {
      clear.addEventListener('click', function () {
        input.value = '';
        syncSearchClearVisibility();
        renderApartments();
        hideSearchSuggestions();
        input.focus();
      });
    }
    syncSearchClearVisibility();
    hideSearchSuggestions();
  }

  function bindApartmentForm() {
    if (!form) return;
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      NyhomeSaveWorkflow.saveApartmentRespectingBlacklist(NyhomeAPI.saveApartment, function (forRetry) {
        var p = readApartmentForm();
        if (forRetry) p.ignoreBlacklist = true;
        return p;
      })
        .then(function (res) {
          var rid = res && res.id != null ? res.id : null;
          if (rid != null && String(rid).trim() !== '') {
            window.location.href = '/details/?id=' + encodeURIComponent(String(rid));
            return;
          }
          clearApartmentForm();
          return load();
        })
        .catch(function (err) {
          console.error('[nyhome-admin] save apartment', err);
          if (err.status === 409) return;
          var msg =
            'Could not save this apartment. Confirm the address field is filled, you are online, and the API is reachable. Details are in the browser console.';
          if (typeof NyhomeUiFeedback !== 'undefined' && NyhomeUiFeedback.alert) {
            NyhomeUiFeedback.alert(msg, { title: 'Could not save' });
          } else {
            window.alert(msg);
          }
        });
    });

    var resetBtn = document.getElementById('reset-form');
    if (resetBtn) {
      resetBtn.addEventListener('click', clearApartmentForm);
    }
  }

  function bindCriterionForm() {
    var cform = document.getElementById('criterion-form');
    if (!cform) return;
    cform.addEventListener('submit', function (event) {
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

  function bindCriteriaList() {
    if (!criteriaListEl) return;
    criteriaListEl.addEventListener('click', function (event) {
      if (event.target.closest('.criterion-drag') || event.target.closest('.criterion-delete')) return;
      var disp = event.target.closest('.criterion-display');
      if (!disp || !criteriaListEl.contains(disp)) return;
      var cell = disp.closest('.criterion-cell');
      var row = disp.closest('.criterion-edit-row');
      if (!cell || !row) return;
      beginCriterionEdit(cell, row);
    });
    criteriaListEl.addEventListener('keydown', function (event) {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      var disp = event.target.closest('.criterion-display');
      if (!disp || !criteriaListEl.contains(disp)) return;
      if (event.key === ' ') event.preventDefault();
      var cell = disp.closest('.criterion-cell');
      var row = disp.closest('.criterion-edit-row');
      if (!cell || !row) return;
      beginCriterionEdit(cell, row);
    });
    criteriaListEl.addEventListener('focusout', function (event) {
      var t = event.target;
      if (!t.classList || !t.classList.contains('criterion-input')) return;
      var cell = t.closest('.criterion-cell');
      var row = t.closest('.criterion-edit-row');
      if (!cell || !row) return;
      setTimeout(function () {
        if (!cell.classList.contains('is-editing')) return;
        if (cell.contains(document.activeElement)) return;
        endCriterionEditCell(cell, row, true);
      }, 0);
    });
    criteriaListEl.addEventListener('dragstart', function (event) {
      var handle = event.target.closest('.criterion-drag');
      if (!handle || !criteriaListEl.contains(handle)) return;
      var row = handle.closest('.criterion-edit-row');
      if (!row) return;
      criteriaDragId = Number(row.getAttribute('data-criterion-id'));
      row.classList.add('criterion-row--dragging');
      event.dataTransfer.setData('text/plain', String(criteriaDragId));
      event.dataTransfer.effectAllowed = 'move';
    });
    criteriaListEl.addEventListener('dragover', function (event) {
      if (criteriaDragId == null) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
    });
    criteriaListEl.addEventListener('drop', function (event) {
      if (criteriaDragId == null) return;
      event.preventDefault();
      var dragRow = criteriaListEl.querySelector('.criterion-edit-row[data-criterion-id="' + criteriaDragId + '"]');
      if (!dragRow) return;
      var dropRow = event.target.closest('.criterion-edit-row');
      if (!dropRow) {
        criteriaListEl.appendChild(dragRow);
      } else if (dragRow !== dropRow) {
        var rect = dropRow.getBoundingClientRect();
        var after = event.clientY > rect.top + rect.height / 2;
        if (after) criteriaListEl.insertBefore(dragRow, dropRow.nextSibling);
        else criteriaListEl.insertBefore(dragRow, dropRow);
      }
      var ids = Array.prototype.map.call(criteriaListEl.querySelectorAll('.criterion-edit-row'), function (el) {
        return Number(el.getAttribute('data-criterion-id'));
      });
      NyhomeAPI.reorderCriteria(ids).then(function () {
        state.criteria.sort(function (a, b) {
          return ids.indexOf(Number(a.id)) - ids.indexOf(Number(b.id));
        });
        patchApartmentsCacheCriteria(function (arr) {
          arr.sort(function (a, b) {
            return ids.indexOf(Number(a.id)) - ids.indexOf(Number(b.id));
          });
        });
        renderApartments();
      }).catch(function (err) {
        console.error('[nyhome-admin] reorder criteria', err);
        load();
      });
      criteriaDragId = null;
    });
    criteriaListEl.addEventListener('dragend', function () {
      criteriaDragId = null;
      Array.prototype.forEach.call(criteriaListEl.querySelectorAll('.criterion-edit-row'), function (el) {
        el.classList.remove('criterion-row--dragging');
      });
    });
  }

  function bindBlacklistForm() {
    var form = document.getElementById('blacklist-add-form');
    if (!form) return;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var manual = document.getElementById('blacklist-address-manual');
      var pasteEl = document.getElementById('blacklist-raw-paste');
      var notesEl = document.getElementById('blacklist-notes');
      var addr = manual && manual.value.trim();
      var paste = pasteEl && pasteEl.value.trim();
      if (!addr && !paste) {
        if (typeof NyhomeUiFeedback !== 'undefined' && NyhomeUiFeedback.alert) {
          NyhomeUiFeedback.alert('Enter a street address or paste listing text that includes an address line.', {
            title: 'Blacklist',
          });
        } else {
          window.alert('Enter a street address or paste listing text that includes an address line.');
        }
        return;
      }
      NyhomeAPI.createBuildingBlacklist({
        address: addr || null,
        rawPaste: paste || null,
        notes: notesEl ? notesEl.value.trim() : '',
      })
        .then(function () {
          if (pasteEl) pasteEl.value = '';
          if (manual) manual.value = '';
          if (notesEl) notesEl.value = '';
          return load();
        })
        .catch(function (err) {
          console.error('[nyhome-admin] blacklist add', err);
          var msg = err.message || 'Could not add to blacklist.';
          if (typeof NyhomeUiFeedback !== 'undefined' && NyhomeUiFeedback.alert) {
            NyhomeUiFeedback.alert(msg, { title: 'Blacklist' });
          } else {
            window.alert(msg);
          }
        });
    });
  }

  function bindBlacklistList() {
    if (!blacklistListEl) return;
    blacklistListEl.addEventListener('click', function (event) {
      var del = event.target.closest('.blacklist-delete');
      if (del && blacklistListEl.contains(del)) {
        var rowDel = del.closest('[data-blacklist-id]');
        var bid = rowDel ? Number(rowDel.getAttribute('data-blacklist-id')) : 0;
        if (!bid) return;
        function doRemove() {
          NyhomeAPI.deleteBuildingBlacklist(bid).then(load).catch(function (err) {
            console.error('[nyhome-admin] blacklist delete', err);
          });
        }
        if (typeof NyhomeUiFeedback !== 'undefined' && NyhomeUiFeedback.confirm) {
          NyhomeUiFeedback.confirm('Remove this building from the blacklist?', {
            title: 'Remove from blacklist',
            confirmLabel: 'Remove',
          }).then(function (ok) {
            if (ok) doRemove();
          });
          return;
        }
        if (!window.confirm('Remove this building from the blacklist?')) return;
        doRemove();
        return;
      }
      var disp = event.target.closest('.criterion-display');
      if (!disp || !blacklistListEl.contains(disp)) return;
      var cell = disp.closest('.criterion-cell');
      var row = disp.closest('.blacklist-edit-row');
      if (!cell || !row) return;
      beginBlacklistEdit(cell, row);
    });
    blacklistListEl.addEventListener('keydown', function (event) {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      var disp = event.target.closest('.criterion-display');
      if (!disp || !blacklistListEl.contains(disp)) return;
      if (event.key === ' ') event.preventDefault();
      var cell = disp.closest('.criterion-cell');
      var row = disp.closest('.blacklist-edit-row');
      if (!cell || !row) return;
      beginBlacklistEdit(cell, row);
    });
    blacklistListEl.addEventListener('focusout', function (event) {
      var t = event.target;
      if (!t.classList || !t.classList.contains('criterion-input')) return;
      var cell = t.closest('.criterion-cell');
      var row = t.closest('.blacklist-edit-row');
      if (!cell || !row || !blacklistListEl.contains(row)) return;
      setTimeout(function () {
        if (!cell.classList.contains('is-editing')) return;
        if (cell.contains(document.activeElement)) return;
        endBlacklistEditCell(cell, row, true);
      }, 0);
    });
  }

  function beginBlacklistEdit(cell, row) {
    Array.prototype.forEach.call(row.querySelectorAll('.criterion-cell.is-editing'), function (c) {
      if (c !== cell) endBlacklistEditCell(c, row, true);
    });
    cell.classList.add('is-editing');
    var input = cell.querySelector('.criterion-input');
    if (input) {
      setTimeout(function () {
        input.focus();
        if (typeof input.select === 'function' && input.type !== 'number') input.select();
      }, 0);
    }
  }

  function syncBlacklistDisplayFromInputs(row) {
    var addrI = row.querySelector('.blacklist-input--address');
    var notesI = row.querySelector('.blacklist-input--notes');
    var addrD = row.querySelector('.blacklist-display--street');
    var notesD = row.querySelector('.blacklist-display--notes');
    if (addrD && addrI) {
      var av = addrI.value.trim();
      addrD.textContent = av || addrD.textContent;
    }
    if (notesD && notesI) {
      var dv = String(notesI.value || '').trim();
      if (dv) {
        notesD.textContent = notesI.value;
        notesD.classList.remove('criterion-display--empty');
      } else {
        notesD.innerHTML = '<span class="criterion-placeholder">Notes</span>';
        notesD.classList.add('criterion-display--empty');
      }
    }
  }

  function syncBlacklistDisplayFromState(row) {
    var id = Number(row.getAttribute('data-blacklist-id'));
    var prev = state.buildingBlacklist.find(function (x) { return x.id === id; });
    if (!prev) return;
    var addrD = row.querySelector('.blacklist-display--street');
    var notesD = row.querySelector('.blacklist-display--notes');
    var addrI = row.querySelector('.blacklist-input--address');
    var notesI = row.querySelector('.blacklist-input--notes');
    var keyEl = row.querySelector('.blacklist-row-key');
    if (keyEl) {
      keyEl.textContent = prev.normalized_key || '';
      keyEl.setAttribute('title', prev.normalized_key || '');
    }
    var streetShow = prev.display_address || prev.normalized_key || '';
    if (addrD) addrD.textContent = streetShow;
    if (addrI) addrI.value = prev.display_address || '';
    var defTrim = prev.notes && String(prev.notes).trim();
    if (notesD) {
      if (defTrim) {
        notesD.textContent = prev.notes;
        notesD.classList.remove('criterion-display--empty');
      } else {
        notesD.innerHTML = '<span class="criterion-placeholder">Notes</span>';
        notesD.classList.add('criterion-display--empty');
      }
    }
    if (notesI) notesI.value = prev.notes || '';
  }

  function endBlacklistEditCell(cell, row, shouldSave) {
    if (!cell.classList.contains('is-editing')) return Promise.resolve();
    cell.classList.remove('is-editing');
    syncBlacklistDisplayFromInputs(row);
    if (shouldSave) {
      return saveBlacklistRow(row)
        .then(function () {
          syncBlacklistDisplayFromState(row);
        })
        .catch(function () {
          load();
        });
    }
    return Promise.resolve();
  }

  function saveBlacklistRow(row) {
    var id = Number(row.getAttribute('data-blacklist-id'));
    if (!id) return Promise.resolve();
    var addrEl = row.querySelector('.blacklist-input--address');
    var notesEl = row.querySelector('.blacklist-input--notes');
    if (!addrEl || !notesEl) return Promise.resolve();
    var displayAddress = addrEl.value.trim();
    if (!displayAddress) {
      var blankPrev = state.buildingBlacklist.find(function (x) { return x.id === id; });
      if (blankPrev) addrEl.value = blankPrev.display_address || blankPrev.normalized_key || '';
      return Promise.resolve();
    }
    var notes = notesEl.value;
    var prev = state.buildingBlacklist.find(function (x) { return x.id === id; });
    if (prev && prev.display_address === displayAddress && String(prev.notes || '') === String(notes || '')) {
      return Promise.resolve();
    }
    return NyhomeAPI.updateBuildingBlacklist({ id: id, displayAddress: displayAddress, notes: notes }).then(function () {
      if (prev) {
        prev.display_address = displayAddress;
        prev.notes = notes;
      }
    });
  }

  function renderBlacklist() {
    if (!blacklistListEl) return;
    if (!state.buildingBlacklist.length) {
      blacklistListEl.innerHTML = '<div class="empty-state">No blacklisted buildings yet.</div>';
      return;
    }
    blacklistListEl.innerHTML = '';
    state.buildingBlacklist.forEach(function (row) {
      var streetShow = row.display_address || row.normalized_key || '';
      var defTrim = row.notes && String(row.notes).trim();
      var notesDisplay = defTrim
        ? escapeHtml(row.notes)
        : '<span class="criterion-placeholder">Notes</span>';
      var el = document.createElement('div');
      el.className = 'list-row criterion-edit-row blacklist-edit-row';
      el.setAttribute('data-blacklist-id', String(row.id));
      el.innerHTML =
        '<span class="blacklist-row-key muted" title="' + escapeAttr(row.normalized_key || '') + '">' + escapeHtml(row.normalized_key || '') + '</span>' +
        '<div class="criterion-cell criterion-cell--label blacklist-cell--street">' +
          '<span class="criterion-display criterion-display--label blacklist-display--street" tabindex="0" role="button" aria-label="Edit street">' + escapeHtml(streetShow) + '</span>' +
          '<input type="text" class="criterion-input criterion-input--label blacklist-input--address" value="' + escapeAttr(row.display_address || '') + '" autocomplete="off" aria-label="Street display">' +
        '</div>' +
        '<div class="criterion-cell criterion-cell--definition blacklist-cell--notes">' +
          '<span class="criterion-display criterion-display--definition blacklist-display--notes' + (defTrim ? '' : ' criterion-display--empty') + '" tabindex="0" role="button" aria-label="Edit notes">' + notesDisplay + '</span>' +
          '<textarea class="criterion-input criterion-input--definition blacklist-input--notes" rows="2" aria-label="Notes">' + escapeHtml(row.notes || '') + '</textarea>' +
        '</div>' +
        '<button type="button" class="danger-btn criterion-delete blacklist-delete">Delete</button>';
      blacklistListEl.appendChild(el);
    });
  }

  function beginCriterionEdit(cell, row) {
    Array.prototype.forEach.call(row.querySelectorAll('.criterion-cell.is-editing'), function (c) {
      if (c !== cell) endCriterionEditCell(c, row, true);
    });
    cell.classList.add('is-editing');
    var input = cell.querySelector('.criterion-input');
    if (input) {
      setTimeout(function () {
        input.focus();
        if (typeof input.select === 'function' && input.type !== 'number') input.select();
      }, 0);
    }
  }

  function syncCriterionDisplayFromInputs(row) {
    var labelI = row.querySelector('.criterion-input--label');
    var defI = row.querySelector('.criterion-input--definition');
    var wI = row.querySelector('.criterion-input--weight');
    var labelD = row.querySelector('.criterion-display--label');
    var defD = row.querySelector('.criterion-display--definition');
    var wD = row.querySelector('.criterion-display--weight');
    if (labelD && labelI) labelD.textContent = labelI.value.trim() || labelD.textContent;
    if (defD && defI) {
      var dv = String(defI.value || '').trim();
      if (dv) {
        defD.textContent = defI.value;
        defD.classList.remove('criterion-display--empty');
      } else {
        defD.innerHTML = '<span class="criterion-placeholder">Add notes</span>';
        defD.classList.add('criterion-display--empty');
      }
    }
    if (wD && wI) {
      var nw = Number(wI.value);
      if (Number.isFinite(nw) && nw >= 0) wD.textContent = nw.toFixed(1);
    }
  }

  function syncCriterionDisplayFromState(row) {
    var id = Number(row.getAttribute('data-criterion-id'));
    var prev = findCriterionInState(id);
    if (!prev) return;
    var labelD = row.querySelector('.criterion-display--label');
    var labelI = row.querySelector('.criterion-input--label');
    var defD = row.querySelector('.criterion-display--definition');
    var defI = row.querySelector('.criterion-input--definition');
    var wD = row.querySelector('.criterion-display--weight');
    var wI = row.querySelector('.criterion-input--weight');
    if (labelD) labelD.textContent = prev.label;
    if (labelI) labelI.value = prev.label;
    var defTrim = prev.definition && String(prev.definition).trim();
    if (defD) {
      if (defTrim) {
        defD.textContent = prev.definition;
        defD.classList.remove('criterion-display--empty');
      } else {
        defD.innerHTML = '<span class="criterion-placeholder">Add notes</span>';
        defD.classList.add('criterion-display--empty');
      }
    }
    if (defI) defI.value = prev.definition || '';
    if (wD) wD.textContent = Number(prev.weight).toFixed(1);
    if (wI) wI.value = String(Number(prev.weight));
  }

  function endCriterionEditCell(cell, row, shouldSave) {
    if (!cell.classList.contains('is-editing')) return Promise.resolve();
    cell.classList.remove('is-editing');
    syncCriterionDisplayFromInputs(row);
    if (shouldSave) {
      return saveCriterionRow(row)
        .then(function () {
          syncCriterionDisplayFromState(row);
        })
        .catch(function (err) {
          console.error('[nyhome-admin] update criterion', err);
          load();
        });
    }
    return Promise.resolve();
  }

  /** Avoid skipping PUT when DB/API serialized weight differs slightly from Number(input.value). */
  function criterionWeightUnchanged(prevW, inputW) {
    var a = Number(prevW);
    var b = Number(inputW);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
    return Math.abs(a - b) < 1e-9;
  }

  function saveCriterionRow(row) {
    var id = Number(row.getAttribute('data-criterion-id'));
    if (!id) return Promise.resolve();
    var labelEl = row.querySelector('.criterion-input--label');
    var defEl = row.querySelector('.criterion-input--definition');
    var weightEl = row.querySelector('.criterion-input--weight');
    if (!labelEl || !defEl || !weightEl) return Promise.resolve();
    var label = labelEl.value.trim();
    if (!label) {
      var blankPrev = findCriterionInState(id);
      if (blankPrev) labelEl.value = blankPrev.label;
      return Promise.resolve();
    }
    var definition = defEl.value;
    var weight = Number(weightEl.value);
    if (!Number.isFinite(weight) || weight < 0) {
      var badPrev = findCriterionInState(id);
      if (badPrev) weightEl.value = String(Number(badPrev.weight));
      return Promise.resolve();
    }
    var prev = findCriterionInState(id);
    if (prev && prev.label === label && String(prev.definition || '') === definition && criterionWeightUnchanged(prev.weight, weight)) {
      return Promise.resolve();
    }
    return NyhomeAPI.updateCriterion({ id: id, label: label, definition: definition, weight: weight }).then(function () {
      if (prev) {
        prev.label = label;
        prev.definition = definition;
        prev.weight = weight;
      }
      patchApartmentsCacheCriteria(function (arr) {
        var c = arr.find(function (x) {
          return String(x.id) === String(id);
        });
        if (c) {
          c.label = label;
          c.definition = definition;
          c.weight = weight;
        }
      });
    });
  }

  function bindStatusControls() {
    var reject = document.getElementById('status-reject');
    var status = document.getElementById('status');

    if (reject) reject.addEventListener('click', function () {
      function applyReject() {
        setValue('status', 'rejected');
        syncStatusControls('rejected');
      }
      if (typeof NyhomeUiFeedback !== 'undefined' && NyhomeUiFeedback.confirm) {
        NyhomeUiFeedback.confirm('Mark this apartment as rejected?', {
          title: 'Reject listing',
          destructive: true,
          confirmLabel: 'Reject',
        }).then(function (ok) {
          if (ok) applyReject();
        });
        return;
      }
      if (!confirm('Mark this apartment as rejected?')) return;
      applyReject();
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

  var LISTING_CHIP_LABELS = {
    dishwasher: 'Dishwasher',
    'washer-dryer': 'W/D',
    storage: 'Storage',
    views: 'Views',
    doorman: 'Doorman',
    highrise: 'Highrise',
    'new-construction': 'New construction',
    walkup: 'Walkup',
    pool: 'Pool',
    sauna: 'Sauna',
    'laundry-room': 'Laundry room',
    suites: 'Suites',
  };

  function formatListingChipLabel(slug) {
    if (Object.prototype.hasOwnProperty.call(LISTING_CHIP_LABELS, slug)) {
      return LISTING_CHIP_LABELS[slug];
    }
    return String(slug)
      .replace(/-/g, ' ')
      .replace(/\b\w/g, function (c) { return c.toUpperCase(); });
  }

  function apartmentSearchHaystack(apartment) {
    return NyhomeApartmentSearch.haystackForApartment(apartment, formatStatusLabel, formatListingChipLabel);
  }

  function getAdminApartmentSearchQuery() {
    var el = document.getElementById('admin-apartment-search');
    if (!el) return '';
    return String(el.value || '').trim().toLowerCase();
  }

  function statusOptions(current) {
    var values = NyhomeStatus.STATUS_ORDER.slice();
    if (values.indexOf(current) < 0) values.push(current);
    return values.map(function (status) {
      return '<option value="' + escapeAttr(status) + '"' + (status === current ? ' selected' : '') + '>' + escapeHtml(formatStatusLabel(status)) + '</option>';
    }).join('');
  }

  function readApartmentForm() {
    var id = numberOrNull(value('apartment-id'));
    var fromState = id
      ? state.apartments.find(function (a) {
          return Number(a.id) === id;
        })
      : null;
    return {
      id: id,
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
      imageUrls: getVibeImageUrls(),
      listingStar: (function () {
        if (!fromState) return null;
        var ls = fromState.listing_star;
        if (ls == null || ls === '' || ls === 0) return null;
        var n = Number(ls);
        return n >= 1 && n <= 3 ? n : null;
      })(),
    };
  }

  function fillApartmentForm(apartment) {
    if (!document.getElementById('apartment-id')) return;
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
    setVibeSlotsFromUrls((apartment.images || []).map(function (img) { return img.image_url; }).filter(Boolean));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function clearApartmentForm() {
    if (!form) return;
    form.reset();
    setValue('apartment-id', '');
    syncStatusControls('new');
    setValue('status', 'new');
    setValue('bedrooms', 1);
    setValue('bathrooms', 1);
    setSelectedValues('unit-features', []);
    setSelectedValues('amenities', []);
    setVibeSlotsFromUrls([]);
  }

  function getVibeImageUrls() {
    return vibeSlots.filter(function (u) { return u && String(u).trim(); });
  }

  function setVibeSlotsFromUrls(urls) {
    var list = (urls || []).slice(0, 3);
    for (var i = 0; i < 3; i++) {
      vibeSlots[i] = list[i] ? String(list[i]) : '';
    }
    for (var j = 0; j < 3; j++) {
      updateVibeSlotUI(j);
    }
  }

  function firstEmptyVibeIndex() {
    for (var i = 0; i < 3; i++) {
      if (!vibeSlots[i]) return i;
    }
    return -1;
  }

  function assignVibeSlot(index, dataUrl) {
    if (index < 0 || index > 2) return;
    vibeSlots[index] = dataUrl;
    updateVibeSlotUI(index);
  }

  function updateVibeSlotUI(index) {
    var root = document.getElementById('vibe-photo-slots');
    if (!root) return;
    var slot = root.querySelector('.vibe-slot[data-vibe-slot="' + index + '"]');
    if (!slot) return;
    var surface = slot.querySelector('.vibe-slot-surface');
    var clearBtn = slot.querySelector('[data-vibe-clear]');
    var u = vibeSlots[index];
    if (u) {
      surface.innerHTML = '<img class="vibe-slot-img" src="' + escapeAttr(u) + '" alt="Preview">';
      if (clearBtn) clearBtn.hidden = false;
    } else {
      surface.innerHTML = '<span class="vibe-slot-placeholder">Click, paste, drop</span>';
      if (clearBtn) clearBtn.hidden = true;
    }
  }

  function initVibeSlots() {
    setVibeSlotsFromUrls([]);
    bindVibePhotoSlots();
  }

  function bindVibePhotoSlots() {
    var root = document.getElementById('vibe-photo-slots');
    if (!root || !window.NyhomeVibeImages) {
      if (!window.NyhomeVibeImages) {
        console.warn('[nyhome-admin] vibeImages.js not loaded; photo slots disabled');
      }
      return;
    }

    function compressAndSet(file, slotIndex) {
      window.NyhomeVibeImages.fileToCompressedDataUrl(file).then(function (dataUrl) {
        var idx = slotIndex;
        if (idx < 0 || idx > 2) idx = 0;
        assignVibeSlot(idx, dataUrl);
      }).catch(function (err) {
        console.error('[nyhome-admin] image compress', err);
      });
    }

    root.addEventListener('click', function (e) {
      var c = e.target.closest && e.target.closest('[data-vibe-clear]');
      if (c) {
        e.preventDefault();
        e.stopPropagation();
        var clearSlot = c.closest('.vibe-slot');
        if (clearSlot) {
          var cidx = Number(clearSlot.getAttribute('data-vibe-slot'));
          assignVibeSlot(cidx, '');
        }
        return;
      }
      var s = e.target.closest && e.target.closest('.vibe-slot-surface');
      if (s) {
        var parent = s.closest('.vibe-slot');
        if (parent) {
          vibeActiveSlot = Number(parent.getAttribute('data-vibe-slot')) || 0;
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
      var empty = firstEmptyVibeIndex();
      var idx = empty === -1 ? vibeActiveSlot : empty;
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
      var idx = slot ? Number(slot.getAttribute('data-vibe-slot')) : vibeActiveSlot;
      if (Number.isNaN(idx)) idx = 0;
      compressAndSet(file, idx);
    });
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

  /** Paste often fires before the textarea value updates; use clipboard text and insert explicitly. */
  function insertPlainTextFromPaste(textarea, e, onAfter) {
    var cd = e.clipboardData;
    var clip = cd && typeof cd.getData === 'function' ? cd.getData('text/plain') : '';
    if (!clip) return false;
    e.preventDefault();
    var start = textarea.selectionStart;
    var end = textarea.selectionEnd;
    var val = textarea.value || '';
    if (typeof start !== 'number' || typeof end !== 'number') {
      textarea.value = val + clip;
    } else {
      textarea.value = val.slice(0, start) + clip + val.slice(end);
      var caret = start + clip.length;
      try {
        textarea.setSelectionRange(caret, caret);
      } catch (err) { /* empty */ }
    }
    if (typeof onAfter === 'function') onAfter(textarea.value);
    return true;
  }

  function bindNotesParser() {
    var notes = document.getElementById('notes');
    if (!notes) return;
    if (typeof NyhomeListingText === 'undefined' || typeof NyhomeListingText.parseListingText !== 'function') {
      console.warn('[nyhome-admin] NyhomeListingText not loaded; apartment Notes paste helper disabled.');
      return;
    }
    notes.addEventListener('paste', function (e) {
      if (!insertPlainTextFromPaste(notes, e, applyListingText)) {
        setTimeout(function () {
          applyListingText(notes.value);
        }, 0);
      }
    });
    notes.addEventListener('blur', function () {
      applyListingText(notes.value);
    });
  }

  function bindBlacklistPasteHelper() {
    var raw = document.getElementById('blacklist-raw-paste');
    var manual = document.getElementById('blacklist-address-manual');
    if (!raw || !manual) return;
    if (typeof NyhomeListingText === 'undefined' || typeof NyhomeListingText.parseListingText !== 'function') return;

    function fillStreetFromRaw(val) {
      var parsed = NyhomeListingText.parseListingText(val);
      if (parsed && parsed.address) manual.value = parsed.address;
    }

    raw.addEventListener('paste', function (e) {
      if (!insertPlainTextFromPaste(raw, e, fillStreetFromRaw)) {
        setTimeout(function () {
          fillStreetFromRaw(raw.value);
        }, 0);
      }
    });
    raw.addEventListener('blur', function () {
      var parsed = NyhomeListingText.parseListingText(raw.value);
      if (parsed && parsed.address && !manual.value.trim()) {
        manual.value = parsed.address;
      }
    });
  }

  function applyListingText(text) {
    if (typeof NyhomeListingText === 'undefined' || typeof NyhomeListingText.parseListingText !== 'function') {
      return;
    }
    var parsed = NyhomeListingText.parseListingText(text);
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
    if (parsed.organizedNotes && notes) notes.value = parsed.organizedNotes;
  }

  /**
   * Read stored sort preference, sync the sort segment UI, and wire click handlers.
   * Only wires buttons inside #admin-sort (Saved apartments tab only).
   */
  function initAdminSort() {
    try {
      var saved = localStorage.getItem(ADMIN_SORT_STORAGE_KEY);
      if (saved && ADMIN_VALID_SORTS[saved]) adminSortMode = saved;
    } catch (e) {}
    syncAdminSortUi();
    var root = document.getElementById('admin-sort');
    if (!root) return;
    root.querySelectorAll('[data-admin-sort]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var mode = btn.getAttribute('data-admin-sort');
        if (!ADMIN_VALID_SORTS[mode] || mode === adminSortMode) return;
        adminSortMode = mode;
        try { localStorage.setItem(ADMIN_SORT_STORAGE_KEY, adminSortMode); } catch (e) {}
        syncAdminSortUi();
        renderApartments();
      });
    });
  }

  function syncAdminSortUi() {
    var root = document.getElementById('admin-sort');
    if (!root) return;
    root.querySelectorAll('[data-admin-sort]').forEach(function (btn) {
      var on = btn.getAttribute('data-admin-sort') === adminSortMode;
      btn.setAttribute('aria-checked', on ? 'true' : 'false');
    });
  }

  /** Apply the current adminSortMode to an already-filtered list of apartments. */
  function applyAdminSort(items) {
    if (typeof NyhomeShortlistSort === 'undefined') return items;
    if (adminSortMode === 'ranked') return NyhomeShortlistSort.sortForFinalist(items);
    if (adminSortMode === 'avg') return NyhomeShortlistSort.sortForDisplay(items, 'avg');
    if (adminSortMode === 'workflow') return NyhomeShortlistSort.sortForDisplay(items, 'workflow');
    if (adminSortMode === 'updated') return NyhomeShortlistSort.sortForDisplay(items, 'updated');
    return items;
  }

  function renderApartments() {
    if (!listEl) return;
    if (!state.apartments.length) {
      listEl.innerHTML = '<div class="empty-state">No apartments yet.</div>';
      return;
    }
    var q = getAdminApartmentSearchQuery();
    var items = !q
      ? state.apartments.slice()
      : state.apartments.filter(function (a) {
        return apartmentSearchHaystack(a).indexOf(q) !== -1;
      });
    if (!items.length) {
      listEl.innerHTML = '<div class="empty-state">No listings match your search.</div>';
      return;
    }
    items = applyAdminSort(items);
    listEl.innerHTML = '';
    items.forEach(function (apartment) {
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
          '<h3 class="manager-row-title">' +
          '<span class="manager-row-title-inner">' +
          (window.NyhomeListingStar ? window.NyhomeListingStar.displayHtmlIfStarred(apartment) : '') +
          '<span class="manager-row-title-text">' + escapeHtml(apartment.title) + '</span>' +
          '</span></h3>' +
          '<div class="manager-row-sub muted">' + escapeHtml([apartment.neighborhood, apartment.address].filter(Boolean).join(' · ')) + '</div>' +
        '</div>' +
        '<select class="status-pill status-select manager-row-status ' + NyhomeStatus.statusClass(cur) + '" data-apartment-status>' +
          statusOptions(cur) +
        '</select>' +
        '<span class="match-pill match-pill--row">' +
          '<span class="match-percentage">' + scoreText(apartment.scores && apartment.scores.combined) + '</span>' +
          '<span class="match-score-label">Avg</span>' +
        '</span>' +
        '<span class="manager-row-metric manager-row-metric--rent" title="Rent">' + escapeHtml(apartment.rent_cents ? formatMoney(apartment.rent_cents) : 'Rent TBD') + '</span>' +
        '<span class="manager-row-metric manager-row-metric--unit" title="Unit">' + escapeHtml(unitSummary(apartment) || 'Unit TBD') + '</span>' +
        '<span class="manager-row-metric manager-row-metric--move" title="Move-in">' + escapeHtml(apartment.move_in_date ? 'Move-in ' + apartment.move_in_date : 'Move-in TBD') + '</span>' +
        '<div class="manager-row-actions" role="group" aria-label="Listing actions">' +
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
        var payload = NyhomeApartmentPayload.apartmentToSavePayload(apartment, { status: nextStatus });
        statusSelect.className = 'status-pill status-select manager-row-status ' + NyhomeStatus.statusClass(nextStatus);
        statusSelect.disabled = true;
        NyhomeSaveWorkflow.saveApartmentRespectingBlacklist(NyhomeAPI.saveApartment, function (forRetry) {
          var o = { status: nextStatus };
          if (forRetry) o.ignoreBlacklist = true;
          return NyhomeApartmentPayload.apartmentToSavePayload(apartment, o);
        })
          .then(function () {
            apartment.status = nextStatus;
            if (form && document.getElementById('apartment-id') && String(value('apartment-id')) === String(apartment.id)) {
              setValue('status', nextStatus);
              syncStatusControls(nextStatus);
            }
            return load();
          })
          .catch(function (err) {
            console.error('[nyhome-admin] save apartment status', err);
            if (statusSelect.isConnected) {
              statusSelect.value = prev;
              statusSelect.className = 'status-pill status-select manager-row-status ' + NyhomeStatus.statusClass(prev);
            }
          })
          .then(function () {
          if (statusSelect.isConnected) {
            statusSelect.disabled = false;
          }
        });
      });
    }

    card.querySelector('[data-action="delete"]').addEventListener('click', function () {
      function doDelete() {
        return NyhomeAPI.deleteApartment(apartment.id).then(load).catch(function (err) {
          console.error('[nyhome-admin] delete apartment', err);
        });
      }
      if (typeof NyhomeUiFeedback !== 'undefined' && NyhomeUiFeedback.confirm) {
        NyhomeUiFeedback.confirm('Delete this apartment?', {
          title: 'Delete listing',
          destructive: true,
          confirmLabel: 'Delete',
        }).then(function (ok) {
          if (ok) doDelete();
        });
        return;
      }
      if (!confirm('Delete this apartment?')) return;
      doDelete();
    });

    card.addEventListener('click', function (event) {
      if (event.target.closest('a, button, select, label, input, textarea')) return;
      window.location.href = '/details/?id=' + encodeURIComponent(apartment.id);
    });

    return card;
  }

  function renderRatingControls(apartment) {
    if (!state.criteria.length) return '<p class="muted">Add criteria to start scoring.</p>';
    return '<details class="rating-shell">' +
      '<summary>' +
        '<span class="rating-summary-title">Voting</span>' +
        '<span class="rating-summary-stats">' +
          scoreStat('combined', 'Avg', apartment.scores && apartment.scores.combined) +
          scoreStat('kerv', 'Kerv', apartment.scores && apartment.scores.kerv) +
          scoreStat('peter', 'Peter', apartment.scores && apartment.scores.peter) +
        '</span>' +
      '</summary>' +
      '<section class="rating-panel">' +
        '<div class="rating-legend" aria-label="Voting legend">' +
          '<span><i class="legend-dot legend-kerv"></i>Kerv</span>' +
          '<span><i class="legend-dot legend-peter"></i>Peter</span>' +
          '<span><i class="legend-dot legend-combined"></i>Avg</span>' +
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
        var rating = ((apartment.ratings || {})[partnerKey] || {})[criterion.id];
        return '<div class="vote-row">' +
          '<div class="vote-criterion"><strong>' + escapeHtml(criterion.label) + '</strong>' +
          (criterion.definition ? '<span>' + escapeHtml(criterion.definition) + '</span>' : '') + '</div>' +
          '<div class="score-picker">' +
          naRatingButton(partnerKey, criterion.id, rating === null) +
          [0, 1, 2, 3, 4, 5].map(function (score) {
            return ratingButton(partnerKey, criterion.id, score, rating != null && Number(rating) === score);
          }).join('') + '</div>' +
        '</div>';
      }).join('') +
    '</div>';
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
    if (!criteriaListEl) return;
    if (!state.criteria.length) {
      criteriaListEl.innerHTML = '<div class="empty-state criteria-empty">No criteria yet.</div>';
      return;
    }
    criteriaListEl.innerHTML = '';
    state.criteria.forEach(function (criterion) {
      var defTrim = criterion.definition && String(criterion.definition).trim();
      var defDisplay = defTrim
        ? escapeHtml(criterion.definition)
        : '<span class="criterion-placeholder">Add notes</span>';
      var row = document.createElement('div');
      row.className = 'list-row criterion-edit-row';
      row.setAttribute('data-criterion-id', String(criterion.id));
      row.innerHTML =
        '<button type="button" class="criterion-drag" draggable="true" aria-label="Drag to reorder">' +
        '<svg class="criterion-drag-icon" viewBox="0 0 16 22" width="16" height="22" aria-hidden="true" focusable="false">' +
        '<path fill="currentColor" d="M4 4h2v2H4V4zm6 0h2v2h-2V4zM4 9h2v2H4V9zm6 0h2v2h-2V9zm-6 5h2v2H4v-2zm6 0h2v2h-2v-2z"/></svg></button>' +
        '<div class="criterion-cell criterion-cell--label">' +
        '<span class="criterion-display criterion-display--label" tabindex="0" role="button" aria-label="Edit label">' + escapeHtml(criterion.label) + '</span>' +
        '<input class="criterion-input criterion-input--label" type="text" value="' + escapeAttr(criterion.label) + '" autocomplete="off" aria-label="Criterion label">' +
        '</div>' +
        '<div class="criterion-cell criterion-cell--definition">' +
        '<span class="criterion-display criterion-display--definition' + (defTrim ? '' : ' criterion-display--empty') + '" tabindex="0" role="button" aria-label="Edit definition">' + defDisplay + '</span>' +
        '<textarea class="criterion-input criterion-input--definition" rows="3" aria-label="Criterion definition">' + escapeHtml(criterion.definition || '') + '</textarea>' +
        '</div>' +
        '<div class="criterion-cell criterion-cell--weight">' +
        '<span class="criterion-display criterion-display--weight" tabindex="0" role="button" aria-label="Edit weight">' + escapeHtml(Number(criterion.weight).toFixed(1)) + '</span>' +
        '<input class="criterion-input criterion-input--weight" type="number" min="0" step="0.1" value="' + escapeAttr(Number(criterion.weight)) + '" aria-label="Weight">' +
        '</div>' +
        '<button class="danger-btn criterion-delete" type="button">Delete</button>';
      row.querySelector('.criterion-delete').addEventListener('click', function () {
        NyhomeAPI.deleteCriterion(criterion.id).then(load).catch(function (err) {
          console.error('[nyhome-admin] delete criterion', err);
        });
      });
      criteriaListEl.appendChild(row);
    });
  }

  function renderNeighborhoodOptions() {
    var datalist = document.getElementById('neighborhood-options');
    if (!datalist) return;
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

  function scoreBox(voteKey, label, value) {
    return '<div class="score-box score-box--vote-' + voteKey + '"><span class="muted">' + escapeHtml(label) + '</span><span class="score-box-value">' + (value != null ? Math.round(value) : '-') + '</span></div>';
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

  function scoreStat(voteKey, label, value) {
    return '<span class="score-stat score-stat--vote-' + voteKey + '"><b>' + escapeHtml(label) + '</b> ' + (value != null ? Math.round(value) : '-') + '</span>';
  }

  function checkIcon() {
    return '<svg class="check-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9.2 16.6 4.9 12.3l-2 2 6.3 6.3L21.8 7.9l-2-2z"></path></svg>';
  }

  function value(id) {
    var el = document.getElementById(id);
    if (!el) return '';
    return String(el.value || '').trim();
  }

  function setValue(id, next) {
    var el = document.getElementById(id);
    if (!el) return;
    el.value = next == null ? '' : next;
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

  // ─────────────────────────────────────────────────────────────────────────
  // Analytics + Activity tabs
  // ─────────────────────────────────────────────────────────────────────────

  var chartTimelineInstance = null;
  var chartFunnelInstance = null;
  var chartTransitionsInstance = null;
  var chartPartnerInstance = null;
  var chartCriteriaDistInstance = null;

  function bindAnalyticsRefresh() {
    var btn = document.getElementById('analytics-refresh-btn');
    if (btn) {
      btn.addEventListener('click', function () {
        state.adminAnalyticsFetched = false;
        fetchAndRenderAnalytics();
      });
    }
    var actBtn = document.getElementById('activity-refresh-btn');
    if (actBtn) {
      actBtn.addEventListener('click', function () {
        state.adminActivityFetched = false;
        fetchAndRenderActivity();
      });
    }
  }

  function bindAnalyticsPeriodFilter() {
    var btns = document.querySelectorAll('[data-analytics-period]');
    btns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var period = btn.getAttribute('data-analytics-period');
        if (period === state.analyticsPeriod) return;
        state.analyticsPeriod = period;
        btns.forEach(function (b) { b.setAttribute('aria-checked', 'false'); });
        btn.setAttribute('aria-checked', 'true');
        state.adminAnalyticsFetched = false;
        fetchAndRenderAnalytics();
      });
    });
  }

  function bindActivityPeriodFilter() {
    var btns = document.querySelectorAll('[data-activity-period]');
    btns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var period = btn.getAttribute('data-activity-period');
        if (period === state.activityPeriod) return;
        state.activityPeriod = period;
        btns.forEach(function (b) { b.setAttribute('aria-checked', 'false'); });
        btn.setAttribute('aria-checked', 'true');
        state.adminActivityFetched = false;
        fetchAndRenderActivity();
      });
    });
  }

  function fetchAndRenderAnalytics() {
    var kpisEl = document.getElementById('admin-analytics-kpis');
    var chartsEl = document.getElementById('admin-analytics-charts');
    if (kpisEl) kpisEl.innerHTML = '<div class="analytics-loading">Loading…</div>';
    if (chartsEl) chartsEl.innerHTML = '';

    state.adminAnalyticsFetched = true;
    NyhomeAPI.getAdminAnalytics(state.analyticsPeriod)
      .then(function (data) {
        state.analyticsData = data;
        renderAnalyticsKpis(data.pulse, data.todayRollup, data.transitions);
        renderAnalyticsCharts(data);
        renderLeastVotedListings(data.leastVotedListings);
        renderCriterionStats(data.criterionStats, state.criteriaDistFilter);
        renderCriteriaDist(data.criterionStats, state.criteriaDistFilter);
      })
      .catch(function (err) {
        console.error('[nyhome-admin] getAdminAnalytics', err);
        var msg = err.message || 'Could not load analytics';
        if (kpisEl) kpisEl.innerHTML = '<div class="analytics-error">' + escapeHtml(msg) + '</div>';
        state.adminAnalyticsFetched = false;
      });
  }

  function fetchAndRenderActivity() {
    var actEl = document.getElementById('admin-analytics-activity');
    var summaryEl = document.getElementById('admin-activity-summary');
    if (actEl) actEl.innerHTML = '<div class="analytics-loading">Loading…</div>';
    if (summaryEl) summaryEl.innerHTML = '';

    state.adminActivityFetched = true;
    NyhomeAPI.getAdminAnalytics(state.activityPeriod)
      .then(function (data) {
        state.activityData = data;
        renderActivitySummary(data.activityByDay, data.todayRollup);
        renderAnalyticsActivity(data.activityByDay, data.capped);
      })
      .catch(function (err) {
        console.error('[nyhome-admin] getAdminAnalytics (activity)', err);
        var msg = err.message || 'Could not load activity log';
        if (actEl) actEl.innerHTML = '<div class="analytics-error">' + escapeHtml(msg) + '</div>';
        state.adminActivityFetched = false;
      });
  }

  /** Build a colored KPI tile. */
  function kpiTile(value, label, variant) {
    var cls = 'analytics-kpi-tile' + (variant ? ' analytics-kpi-tile--' + variant : '');
    return '<div class="' + cls + '">' +
      '<div class="analytics-kpi-tile-value">' + escapeHtml(String(value)) + '</div>' +
      '<div class="analytics-kpi-tile-label">' + escapeHtml(label) + '</div>' +
      '</div>';
  }

  /** Render colorful KPI tiles + period activity + transitions + attention. */
  function renderAnalyticsKpis(pulse, todayRollup, transitions) {
    var el = document.getElementById('admin-analytics-kpis');
    if (!el) return;
    if (!pulse) { el.innerHTML = '<div class="analytics-empty">No data.</div>'; return; }

    var html = '';

    // ── Pipeline state tiles ──────────────────────────────────────────────
    html += '<div class="analytics-kpi-section">';
    html += '<p class="analytics-kpi-section-label">Pipeline state</p>';
    html += '<div class="analytics-kpi-tiles">';
    html += kpiTile(pulse.activeCount, 'Active', 'active');
    html += kpiTile(pulse.attentionCount, 'Need attention', 'attention');
    html += kpiTile(pulse.starred, 'Starred', 'starred');
    html += kpiTile(pulse.avgCombined != null ? pulse.avgCombined + '%' : '—', 'Avg score', 'avg');
    html += kpiTile(pulse.early, 'Early stage', '');
    html += kpiTile(pulse.tourFlow, 'In tours', 'tour');
    html += kpiTile(pulse.late, 'Late stage', 'late');
    html += kpiTile(pulse.tours7d, 'Tours (7d)', '');
    html += kpiTile(pulse.signedCount, 'Signed', 'signed');
    html += '</div></div>';

    // ── Period activity tiles ─────────────────────────────────────────────
    if (todayRollup) {
      html += '<div class="analytics-kpi-section">';
      html += '<p class="analytics-kpi-section-label">Period activity</p>';
      html += '<div class="analytics-kpi-tiles">';
      html += kpiTile(todayRollup.status, 'Status changes', 'status-ev');
      html += kpiTile(todayRollup.vote, 'Score changes', 'vote-ev');
      html += kpiTile(todayRollup.kerv, 'Kerv votes', 'kerv');
      html += kpiTile(todayRollup.peter, 'Peter votes', 'peter');
      html += kpiTile(todayRollup.listingsAddedToday, 'New listings', '');
      html += '</div></div>';
    }

    // ── Status transitions ────────────────────────────────────────────────
    if (transitions && transitions.length) {
      html += '<div class="analytics-kpi-section">';
      html += '<p class="analytics-kpi-section-label">Status transitions</p>';
      html += '<table class="analytics-kpi-table" role="presentation">';
      transitions.forEach(function (t) {
        html += '<tr><td>' + escapeHtml(t.label) + '</td><td>' + escapeHtml(String(t.count)) + '</td></tr>';
      });
      html += '</table></div>';
    }

    // ── Attention list ────────────────────────────────────────────────────
    if (pulse.attention && pulse.attention.length) {
      html += '<div class="analytics-kpi-section">';
      html += '<p class="analytics-kpi-section-label">Needs attention (' + escapeHtml(String(pulse.attentionCount)) + ')</p>';
      html += '<ul class="analytics-attention-list">';
      pulse.attention.forEach(function (item) {
        var link = item.id != null ? '/details/?id=' + encodeURIComponent(item.id) : null;
        html +=
          '<li class="analytics-attention-item">' +
          '<span class="analytics-attention-title">' + escapeHtml(item.title) + '</span>' +
          '<span class="analytics-attention-reasons">' + escapeHtml((item.reasons || []).join('; ')) + '</span>' +
          (item.suggest ? '<span class="analytics-attention-suggest">Next: ' + escapeHtml(item.suggest) + '</span>' : '') +
          (link ? '<a href="' + escapeAttr(link) + '" class="analytics-attention-link">Open listing</a>' : '') +
          '</li>';
      });
      html += '</ul></div>';
    } else {
      html += '<div class="analytics-kpi-section">';
      html += '<p class="analytics-kpi-section-label">Needs attention</p>';
      html += '<p class="muted" style="font-size:14px;margin:0;">All clear — no flagged listings.</p>';
      html += '</div>';
    }

    el.innerHTML = html;
  }

  /** Render a stacked bar chart: events per day broken down by status vs vote. */
  function renderAnalyticsCharts(data) {
    var el = document.getElementById('admin-analytics-charts');
    if (!el) return;

    if (typeof Chart === 'undefined') {
      el.innerHTML = '<div class="analytics-error">Chart.js failed to load.</div>';
      return;
    }

    // Destroy all existing instances before rebuilding the DOM
    [chartTimelineInstance, chartFunnelInstance, chartTransitionsInstance, chartPartnerInstance].forEach(function (c) {
      if (c) c.destroy();
    });
    chartTimelineInstance = chartFunnelInstance = chartTransitionsInstance = chartPartnerInstance = null;

    var activityByDay = (data && data.activityByDay) || [];
    var pulse = (data && data.pulse) || null;
    var criterionStats = (data && data.criterionStats) || [];

    // Derive period transitions from activityByDay events so they reflect the full selected period.
    var transMap = {};
    activityByDay.forEach(function (day) {
      (day.events || []).forEach(function (ev) {
        if (ev.eventType !== 'status') return;
        var label = ev.summary || (ev.fromStatus + ' → ' + ev.toStatus);
        transMap[label] = (transMap[label] || 0) + 1;
      });
    });
    var periodTransitions = Object.keys(transMap)
      .map(function (label) { return { label: label, count: transMap[label] }; })
      .sort(function (a, b) { return b.count - a.count; })
      .slice(0, 12);

    var days = activityByDay.slice().reverse();
    var hasActivity = days.length > 0;
    var hasFunnel = pulse != null;
    var hasTransitions = periodTransitions.length > 0;
    var hasPartner = criterionStats.length > 0;

    if (!hasActivity && !hasFunnel && !hasTransitions && !hasPartner) {
      el.innerHTML = '<div class="analytics-empty">No chart data for this period.</div>';
      return;
    }

    // Dynamic heights
    var transH = Math.max(120, periodTransitions.length * 32);
    var partnerH = Math.max(140, criterionStats.length * 30);

    // Build chart grid HTML
    var grid = '<div class="analytics-charts-grid">';

    if (hasActivity) {
      grid +=
        '<div class="analytics-chart-card analytics-chart-card--full">' +
        '<p class="analytics-chart-label">Events over time</p>' +
        '<div class="analytics-chart-wrap"><canvas id="chart-timeline"></canvas></div>' +
        '</div>';
    }

    if (hasFunnel) {
      grid +=
        '<div class="analytics-chart-card">' +
        '<p class="analytics-chart-label">Pipeline funnel</p>' +
        '<div class="analytics-chart-wrap analytics-chart-wrap--sm"><canvas id="chart-funnel"></canvas></div>' +
        '</div>';
    }

    if (hasTransitions) {
      grid +=
        '<div class="analytics-chart-card">' +
        '<p class="analytics-chart-label">Status transitions</p>' +
        '<div class="analytics-chart-wrap" style="height:' + transH + 'px"><canvas id="chart-transitions"></canvas></div>' +
        '</div>';
    }

    if (hasPartner) {
      grid +=
        '<div class="analytics-chart-card analytics-chart-card--full">' +
        '<p class="analytics-chart-label">Kerv vs Peter — by criterion</p>' +
        '<div class="analytics-chart-wrap" style="height:' + partnerH + 'px"><canvas id="chart-partner"></canvas></div>' +
        '</div>';
    }

    grid += '</div>';
    el.innerHTML = grid;

    // ── 1. Timeline area chart ─────────────────────────────────────────
    if (hasActivity) {
      var tlLabels = days.map(function (d) {
        return d.label.replace(/,\s*\d{4}$/, '').split(' ').slice(1).join(' ');
      });
      var statusCounts = days.map(function (d) {
        return (d.events || []).filter(function (e) { return e.eventType === 'status'; }).length;
      });
      var voteCounts = days.map(function (d) {
        return (d.events || []).filter(function (e) { return e.eventType === 'vote'; }).length;
      });
      var tlCanvas = document.getElementById('chart-timeline');
      if (tlCanvas) {
        chartTimelineInstance = new Chart(tlCanvas, {
          type: 'line',
          data: {
            labels: tlLabels,
            datasets: [
              {
                label: 'Status changes',
                data: statusCounts,
                borderColor: '#4898f5',
                backgroundColor: 'rgba(72,152,245,0.15)',
                fill: true, tension: 0.35, pointRadius: 2, borderWidth: 2,
              },
              {
                label: 'Score changes',
                data: voteCounts,
                borderColor: '#a175f0',
                backgroundColor: 'rgba(161,117,240,0.12)',
                fill: true, tension: 0.35, pointRadius: 2, borderWidth: 2,
              },
            ],
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { position: 'top', labels: { font: { size: 12 }, boxWidth: 12 } } },
            scales: {
              x: { grid: { display: false }, ticks: { font: { size: 11 } } },
              y: { beginAtZero: true, ticks: { precision: 0, font: { size: 11 } } },
            },
          },
        });
      }
    }

    // ── 2. Pipeline funnel (horizontal bar) ────────────────────────────
    if (hasFunnel) {
      var fnCanvas = document.getElementById('chart-funnel');
      if (fnCanvas) {
        chartFunnelInstance = new Chart(fnCanvas, {
          type: 'bar',
          data: {
            labels: ['Early stage', 'Tours', 'Finalist+', 'Signed'],
            datasets: [{
              data: [pulse.early || 0, pulse.tourFlow || 0, pulse.late || 0, pulse.signedCount || 0],
              backgroundColor: [
                'rgba(72,152,245,0.78)',
                'rgba(52,211,153,0.78)',
                'rgba(244,114,182,0.78)',
                'rgba(110,231,183,0.78)',
              ],
              borderRadius: 5,
              borderSkipped: false,
            }],
          },
          options: {
            indexAxis: 'y', responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              x: { beginAtZero: true, ticks: { precision: 0, font: { size: 11 } } },
              y: { grid: { display: false }, ticks: { font: { size: 13 } } },
            },
          },
        });
      }
    }

    // ── 3. Status transitions (horizontal bar) ─────────────────────────
    if (hasTransitions) {
      var trCanvas = document.getElementById('chart-transitions');
      if (trCanvas) {
        chartTransitionsInstance = new Chart(trCanvas, {
          type: 'bar',
          data: {
            labels: periodTransitions.map(function (t) { return t.label; }),
            datasets: [{
              data: periodTransitions.map(function (t) { return t.count; }),
              backgroundColor: 'rgba(129,140,248,0.78)',
              borderRadius: 4,
              borderSkipped: false,
            }],
          },
          options: {
            indexAxis: 'y', responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              x: { beginAtZero: true, ticks: { precision: 0, font: { size: 11 } } },
              y: { grid: { display: false }, ticks: { font: { size: 11 } } },
            },
          },
        });
      }
    }

    // ── 4. Partner comparison (grouped horizontal bar) ─────────────────
    if (hasPartner) {
      var ptCanvas = document.getElementById('chart-partner');
      if (ptCanvas) {
        chartPartnerInstance = new Chart(ptCanvas, {
          type: 'bar',
          data: {
            labels: criterionStats.map(function (c) { return c.label; }),
            datasets: [
              {
                label: 'Kerv',
                data: criterionStats.map(function (c) { return c.kervAvg; }),
                backgroundColor: 'rgba(15,184,169,0.75)',
                borderRadius: 3,
              },
              {
                label: 'Peter',
                data: criterionStats.map(function (c) { return c.peterAvg; }),
                backgroundColor: 'rgba(241,91,154,0.75)',
                borderRadius: 3,
              },
            ],
          },
          options: {
            indexAxis: 'y', responsive: true, maintainAspectRatio: false,
            plugins: { legend: { position: 'top', labels: { font: { size: 12 }, boxWidth: 12 } } },
            scales: {
              x: { beginAtZero: true, max: 5, ticks: { precision: 1, font: { size: 11 } } },
              y: { grid: { display: false }, ticks: { font: { size: 12 } } },
            },
          },
        });
      }
    }
  }

  /** Build a summary item cell for the activity summary bar. */
  function summaryItem(value, label, variant) {
    var cls = 'analytics-summary-item' + (variant ? ' analytics-summary-item--' + variant : '');
    return '<div class="' + cls + '">' +
      '<div class="analytics-summary-value">' + escapeHtml(String(value)) + '</div>' +
      '<div class="analytics-summary-label">' + escapeHtml(label) + '</div>' +
      '</div>';
  }

  /** Render the summary bar above the activity log (totals for the period). */
  function renderActivitySummary(activityByDay, todayRollup) {
    var el = document.getElementById('admin-activity-summary');
    if (!el) return;

    var total = 0, statusCount = 0, voteCount = 0, kervCount = 0, peterCount = 0;
    (activityByDay || []).forEach(function (day) {
      (day.events || []).forEach(function (ev) {
        total++;
        if (ev.eventType === 'status') statusCount++;
        if (ev.eventType === 'vote') {
          voteCount++;
          if (ev.partnerKey === 'kerv') kervCount++;
          if (ev.partnerKey === 'peter') peterCount++;
        }
      });
    });

    var newListings = todayRollup ? (todayRollup.listingsAddedToday || 0) : 0;

    var html = '<div class="analytics-summary-bar">';
    html += summaryItem(total, 'Total events', '');
    html += summaryItem(statusCount, 'Status changes', 'status-ev');
    html += summaryItem(voteCount, 'Score changes', 'vote-ev');
    html += summaryItem(kervCount, 'Kerv votes', 'kerv');
    html += summaryItem(peterCount, 'Peter votes', 'peter');
    if (newListings > 0) html += summaryItem(newListings, 'New listings', '');
    html += '</div>';
    el.innerHTML = html;
  }

  // ── Scoring gaps ──────────────────────────────────────────────────────────

  function bindCriteriaPartnerFilter() {
    var btns = document.querySelectorAll('[data-criteria-partner]');
    btns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var filter = btn.getAttribute('data-criteria-partner');
        if (filter === state.criteriaDistFilter) return;
        state.criteriaDistFilter = filter;
        btns.forEach(function (b) { b.setAttribute('aria-checked', 'false'); });
        btn.setAttribute('aria-checked', 'true');
        if (state.analyticsData) {
          renderCriterionStats(state.analyticsData.criterionStats, filter);
          renderCriteriaDist(state.analyticsData.criterionStats, filter);
        }
      });
    });
  }

  /** Listing title + colored vote-progress bars showing scoring completeness. */
  function renderLeastVotedListings(listings) {
    var el = document.getElementById('admin-analytics-least-voted');
    if (!el) return;
    if (!listings || !listings.length) {
      el.innerHTML = '<div class="analytics-empty">No active listings to show.</div>';
      return;
    }

    var html = '<table class="analytics-voted-table" role="table">';
    html += '<thead><tr><th>Listing</th><th>Status</th>' +
      '<th style="color:#0a8a80">Kerv</th><th style="color:#9d174d">Peter</th></tr></thead>';
    html += '<tbody>';

    listings.forEach(function (apt) {
      var link = '/details/?id=' + encodeURIComponent(apt.id);
      var kPct = apt.total > 0 ? Math.round(apt.kervVoted / apt.total * 100) : 0;
      var pPct = apt.total > 0 ? Math.round(apt.peterVoted / apt.total * 100) : 0;
      var statusLabel = String(apt.status || 'new').replace(/_/g, ' ');

      html += '<tr>' +
        '<td><a href="' + escapeAttr(link) + '" class="analytics-event-title-link">' + escapeHtml(apt.title) + '</a></td>' +
        '<td><span class="analytics-status-chip">' + escapeHtml(statusLabel) + '</span></td>' +
        '<td>' + voteProgressBar(apt.kervVoted, apt.total, kPct, '#0fb8a9') + '</td>' +
        '<td>' + voteProgressBar(apt.peterVoted, apt.total, pPct, '#f15b9a') + '</td>' +
        '</tr>';
    });

    html += '</tbody></table>';
    el.innerHTML = html;
  }

  function voteProgressBar(voted, total, pct, color) {
    return '<div class="analytics-vote-bar-wrap">' +
      '<div class="analytics-vote-bar-track">' +
      '<div class="analytics-vote-bar-fill" style="width:' + pct + '%;background:' + color + '"></div>' +
      '</div>' +
      '<span class="analytics-vote-count">' + voted + '/' + total + '</span>' +
      '</div>';
  }

  // ── Criteria ratings ──────────────────────────────────────────────────────

  /** Stacked bell-curve area chart: score distribution (0–5) aggregated across all criteria. */
  function renderCriteriaDist(criterionStats, filter) {
    var el = document.getElementById('admin-analytics-criteria-dist');
    if (!el) return;

    if (!criterionStats || !criterionStats.length || typeof Chart === 'undefined') {
      el.innerHTML = '';
      if (chartCriteriaDistInstance) { chartCriteriaDistInstance.destroy(); chartCriteriaDistInstance = null; }
      return;
    }

    if (!el.querySelector('canvas')) {
      el.innerHTML = '<div class="analytics-chart-wrap analytics-chart-wrap--sm"><canvas id="chart-criteria-dist"></canvas></div>';
    }

    // Aggregate distribution across all criteria
    var kervTotal = [0, 0, 0, 0, 0, 0];
    var peterTotal = [0, 0, 0, 0, 0, 0];
    criterionStats.forEach(function (c) {
      for (var i = 0; i < 6; i++) {
        kervTotal[i] += c.kervDist[i];
        peterTotal[i] += c.peterDist[i];
      }
    });

    var datasets = [];
    if (filter !== 'peter') {
      datasets.push({
        label: 'Kerv',
        data: kervTotal,
        borderColor: '#0fb8a9',
        backgroundColor: 'rgba(15,184,169,0.18)',
        fill: true, tension: 0.42, pointRadius: 3, borderWidth: 2,
      });
    }
    if (filter !== 'kerv') {
      datasets.push({
        label: 'Peter',
        data: peterTotal,
        borderColor: '#f15b9a',
        backgroundColor: 'rgba(241,91,154,0.14)',
        fill: true, tension: 0.42, pointRadius: 3, borderWidth: 2,
      });
    }

    var canvas = document.getElementById('chart-criteria-dist');
    if (!canvas) return;

    if (chartCriteriaDistInstance) { chartCriteriaDistInstance.destroy(); chartCriteriaDistInstance = null; }

    chartCriteriaDistInstance = new Chart(canvas, {
      type: 'line',
      data: { labels: ['0', '1', '2', '3', '4', '5'], datasets: datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { font: { size: 11 }, boxWidth: 10 } },
          tooltip: { callbacks: { title: function (items) { return 'Score ' + items[0].label; } } },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { font: { size: 11 } },
            title: { display: true, text: 'Score (0–5)', font: { size: 11 }, color: '#888' },
          },
          y: { beginAtZero: true, ticks: { precision: 0, font: { size: 11 } } },
        },
      },
    });
  }

  /** Criteria sorted highest → lowest by avg, with per-row score bars and counts. */
  function renderCriterionStats(criterionStats, filter) {
    var el = document.getElementById('admin-analytics-criteria-list');
    if (!el) return;
    if (!criterionStats || !criterionStats.length) {
      el.innerHTML = '<div class="analytics-empty">No criteria data.</div>';
      return;
    }

    var showKerv = filter !== 'peter';
    var showPeter = filter !== 'kerv';

    var html = '<table class="analytics-criteria-table" role="table">';
    html += '<thead><tr><th>Criterion</th>';
    if (showKerv) html += '<th class="criteria-th-kerv">Kerv avg</th>';
    if (showPeter) html += '<th class="criteria-th-peter">Peter avg</th>';
    html += '<th>Votes</th><th>% total</th></tr></thead><tbody>';

    criterionStats.forEach(function (c) {
      var displayAvg = filter === 'kerv' ? c.kervAvg : filter === 'peter' ? c.peterAvg : c.combinedAvg;
      var barPct = displayAvg != null ? Math.round(displayAvg / 5 * 100) : 0;
      var votes = filter === 'kerv' ? c.kervCount : filter === 'peter' ? c.peterCount : c.bothCount;

      html += '<tr>';
      html += '<td class="criteria-label-cell">' +
        '<span class="criteria-label">' + escapeHtml(c.label) + '</span>' +
        '<div class="analytics-score-bar-wrap"><div class="analytics-score-bar-fill" style="width:' + barPct + '%"></div></div>' +
        '</td>';
      if (showKerv) {
        html += '<td class="criteria-score-kerv">' + (c.kervAvg != null ? c.kervAvg + '/5' : '—') + '</td>';
      }
      if (showPeter) {
        html += '<td class="criteria-score-peter">' + (c.peterAvg != null ? c.peterAvg + '/5' : '—') + '</td>';
      }
      html += '<td class="criteria-votes">' + votes + '</td>';
      html += '<td class="criteria-pct">' + c.pctOfTotal + '%</td>';
      html += '</tr>';
    });

    html += '</tbody></table>';
    el.innerHTML = html;
  }

  /** Render the collapsible day-card activity log (used by both Analytics and Activity tabs). */
  function renderAnalyticsActivity(activityByDay, capped) {
    var el = document.getElementById('admin-analytics-activity');
    if (!el) return;

    if (!activityByDay || activityByDay.length === 0) {
      el.innerHTML = '<div class="analytics-empty">No logged events for this period.</div>';
      return;
    }

    var rangeEl = document.getElementById('analytics-day-range');
    if (rangeEl) {
      var oldest = activityByDay[activityByDay.length - 1];
      var newest = activityByDay[0];
      if (oldest && newest && oldest.ymd !== newest.ymd) {
        rangeEl.textContent = '(' + oldest.ymd + ' – ' + newest.ymd + ')';
      } else if (newest) {
        rangeEl.textContent = '(' + newest.ymd + ')';
      }
    }

    var html = '';
    if (capped) {
      html += '<div class="analytics-capped-note">Showing the most recent 2,000 events — older history is in the DB.</div>';
    }

    activityByDay.forEach(function (day) {
      var summaryText = escapeHtml(day.label) +
        '<span class="analytics-day-count">&ensp;' + escapeHtml(String(day.count)) +
        ' event' + (day.count === 1 ? '' : 's') + '</span>';

      html +=
        '<details class="analytics-day-card">' +
        '<summary><span class="analytics-day-chevron" aria-hidden="true">›</span>' +
        '<span class="analytics-day-label">' + summaryText + '</span>' +
        '</summary>' +
        '<div class="analytics-day-body">';

      if (!day.events || day.events.length === 0) {
        html += '<div class="analytics-empty">No logged events.</div>';
      } else {
        day.events.forEach(function (ev) {
          var typeBadgeClass = ev.eventType === 'vote'
            ? 'analytics-event-type-badge--vote'
            : 'analytics-event-type-badge--status';
          var typeLabel = ev.eventType === 'vote' ? 'Vote' : 'Status';
          var detailLink = ev.id != null
            ? '/details/?id=' + encodeURIComponent(ev.id) + '&tab=activity'
            : null;

          html +=
            '<div class="analytics-event-row">' +
            '<span class="analytics-event-time">' + escapeHtml(ev.timeLabel || '') + '</span>' +
            '<span class="analytics-event-type-badge ' + escapeAttr(typeBadgeClass) + '">' + escapeHtml(typeLabel) + '</span>' +
            '<span class="analytics-event-col">' +
            '<span class="analytics-event-title">' +
            (detailLink
              ? '<a href="' + escapeAttr(detailLink) + '" class="analytics-event-title-link">' + escapeHtml(ev.title || 'Listing') + '</a>'
              : escapeHtml(ev.title || 'Listing')) +
            '</span>' +
            '<span class="analytics-event-summary">' + escapeHtml(ev.summary || '') + '</span>' +
            '</span>' +
            '</div>';
        });
      }

      html += '</div></details>';
    });

    el.innerHTML = html;
  }

})();
