(function () {
  var state = {
    apartments: [],
    criteria: [],
    neighborhoods: [],
    buildingBlacklist: [],
    adminCriteriaPainted: false,
    adminBlacklistPainted: false,
  };
  var form = document.getElementById('apartment-form');
  var listEl = document.getElementById('admin-apartment-list');
  var criteriaListEl = document.getElementById('criteria-list');
  var blacklistListEl = document.getElementById('building-blacklist-list');
  var criteriaDragId = null;
  var vibeSlots = ['', '', ''];
  var vibeActiveSlot = 0;

  document.addEventListener('DOMContentLoaded', boot);

  function boot() {
    bindTabs();
    bindApartmentSearch();
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
        maybeApplyEditFromQuery();
      })
      .catch(function (err) {
        console.error('[nyhome-admin] load', err);
      });
  }

  function maybeApplyEditFromQuery() {
    if (!form) return;
    var id = new URLSearchParams(window.location.search).get('id');
    if (!id) return;
    var a = state.apartments.find(function (x) { return String(x.id) === String(id); });
    if (a) fillApartmentForm(a);
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
        .then(function () {
          clearApartmentForm();
          return load();
        })
        .catch(function (err) {
          console.error('[nyhome-admin] save apartment', err);
          if (err.status === 409) return;
          window.alert('Could not save this apartment. Confirm the address field is filled, you are online, and the API is reachable. Details are in the browser console.');
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
        window.alert('Enter a street address or paste listing text that includes an address line.');
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
          window.alert(err.message || 'Could not add to blacklist.');
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
        if (!window.confirm('Remove this building from the blacklist?')) return;
        NyhomeAPI.deleteBuildingBlacklist(bid).then(load).catch(function (err) {
          console.error('[nyhome-admin] blacklist delete', err);
        });
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
    var prev = state.criteria.find(function (c) { return c.id === id; });
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

  function saveCriterionRow(row) {
    var id = Number(row.getAttribute('data-criterion-id'));
    if (!id) return Promise.resolve();
    var labelEl = row.querySelector('.criterion-input--label');
    var defEl = row.querySelector('.criterion-input--definition');
    var weightEl = row.querySelector('.criterion-input--weight');
    if (!labelEl || !defEl || !weightEl) return Promise.resolve();
    var label = labelEl.value.trim();
    if (!label) {
      var blankPrev = state.criteria.find(function (c) { return c.id === id; });
      if (blankPrev) labelEl.value = blankPrev.label;
      return Promise.resolve();
    }
    var definition = defEl.value;
    var weight = Number(weightEl.value);
    if (!Number.isFinite(weight) || weight < 0) {
      var badPrev = state.criteria.find(function (c) { return c.id === id; });
      if (badPrev) weightEl.value = String(Number(badPrev.weight));
      return Promise.resolve();
    }
    var prev = state.criteria.find(function (c) { return c.id === id; });
    if (prev && prev.label === label && String(prev.definition || '') === definition && Number(prev.weight) === weight) {
      return Promise.resolve();
    }
    return NyhomeAPI.updateCriterion({ id: id, label: label, definition: definition, weight: weight }).then(function () {
      if (prev) {
        prev.label = label;
        prev.definition = definition;
        prev.weight = weight;
      }
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
    var parts = [
      apartment.title,
      apartment.neighborhood,
      apartment.address,
      apartment.apt_number,
      formatStatusLabel(apartment.status),
    ];
    (apartment.unit_features || []).forEach(function (slug) {
      if (!slug) return;
      parts.push(slug, formatListingChipLabel(slug));
    });
    (apartment.amenities || []).forEach(function (slug) {
      if (!slug) return;
      parts.push(slug, formatListingChipLabel(slug));
    });
    return parts
      .filter(function (p) { return p != null && String(p).trim() !== ''; })
      .map(function (p) { return String(p).toLowerCase(); })
      .join(' ');
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

  function renderApartments() {
    if (!listEl) return;
    if (!state.apartments.length) {
      listEl.innerHTML = '<div class="empty-state">No apartments yet.</div>';
      return;
    }
    var q = getAdminApartmentSearchQuery();
    var items = !q
      ? state.apartments
      : state.apartments.filter(function (a) {
        return apartmentSearchHaystack(a).indexOf(q) !== -1;
      });
    if (!items.length) {
      listEl.innerHTML = '<div class="empty-state">No listings match your search.</div>';
      return;
    }
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
          (window.NyhomeListingStar ? window.NyhomeListingStar.displayHtml(apartment) : '') +
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
      if (!confirm('Delete this apartment?')) return;
      return NyhomeAPI.deleteApartment(apartment.id).then(load).catch(function (err) {
        console.error('[nyhome-admin] delete apartment', err);
      });
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
})();
