/**
 * NyhomeToured — toured checklist UI module.
 * Mounts a Peter/Kerv–scoped checklist into any container element.
 * Used by: /details/?tab=toured  and  /details/toured?id=
 *
 * Public API:
 *   NyhomeToured.mountToured(containerEl, apartment, opts)
 *   opts: { saveApartment(payload): Promise, onSaved(updatedApartment): void }
 *
 * Data shape stored in apartment.toured_data (MEDIUMTEXT JSON column):
 *   { peter: { rows: { slug: { value, note, chips } }, tags: [] },
 *     kerv:  { rows: { slug: { value, note, chips } }, tags: [] } }
 */
(function (global) {
  'use strict';

  var PARTNERS = ['peter', 'kerv'];

  var SECTIONS = [
    { id: 'location', label: 'Location & exterior', rows: [
      { slug: 'night_weekend_noise', label: 'Late-night / weekend noise reality', chips: ['quiet','medium','loud'] },
      { slug: 'transit_walk', label: 'Walk to subway: entrance, lighting' },
      { slug: 'scaffolding', label: 'Scaffolding / façade work nearby?' },
    ]},
    { id: 'kitchen', label: 'Kitchen & appliances', rows: [
      { slug: 'dishwasher_size', label: 'Dishwasher: plates fit? (slimline vs full)' },
      { slug: 'dishwasher_smell', label: 'Dishwasher: standing water or musty smell?' },
      { slug: 'cooktop_type', label: 'Gas vs induction/electric', chips: ['gas','induction','electric'] },
    ]},
    { id: 'lighting', label: 'Lighting & view', rows: [
      { slug: 'pov_bed_desk', label: 'From bed/desk: privacy, brick wall, stare-in' },
      { slug: 'light_direction', label: 'Window direction / natural light quality' },
      { slug: 'overhead_vs_switched', label: 'Overhead lights vs switched outlets for lamps' },
    ]},
    { id: 'noise', label: 'Noise & comfort', rows: [
      { slug: 'window_seal', label: 'Window closed: street noise acceptable?', chips: ['quiet','medium','loud'] },
      { slug: 'floor_squeak', label: 'Floor squeak; hear upstairs?' },
      { slug: 'ac_type', label: 'AC type', chips: ['central','PTAC','sleeve','window'] },
    ]},
    { id: 'cleanliness', label: 'Cleanliness & maintenance', rows: [
      { slug: 'hallway_sniff', label: 'Hallways: smell, carpets, trash chute' },
      { slug: 'elevator_wait', label: 'Elevator wait off-peak acceptable?' },
      { slug: 'refresh_vs_reno', label: 'Real renovation vs cosmetic refresh?' },
    ]},
    { id: 'storage', label: 'Storage & space', rows: [
      { slug: 'closet_depth', label: 'Closets deep enough for hangers?' },
      { slug: 'amenity_rooms', label: 'Bike/storage rooms—usable?' },
      { slug: 'layout_utility', label: 'Layout fits furniture vs raw sq ft' },
    ]},
    { id: 'entrance', label: 'Building entrance', rows: [
      { slug: 'packages', label: 'Package room vs lobby piles' },
      { slug: 'lobby_signal', label: 'Lobby cleanliness / dead bulbs—management signal' },
    ]},
    { id: 'mustcheck', label: 'Physical must-checks', rows: [
      { slug: 'water_pressure', label: 'Shower + kitchen: pressure & hot water delay' },
      { slug: 'pests', label: 'Under-sink / baseboards—pest signs' },
      { slug: 'windows_all', label: 'Every window opens, closes, seals' },
      { slug: 'cell_signal', label: 'Cell signal in main rooms' },
    ]},
    { id: 'alignment', label: 'Quick alignment', rows: [
      { slug: 'value_sqft', label: 'Rent ÷ sq ft vs alternatives' },
      { slug: 'days_on_market', label: 'Why still available—broker answer satisfactory?' },
    ]},
  ];

  /* ------------------------------------------------------------------ */
  /* State helpers                                                        */
  /* ------------------------------------------------------------------ */

  function blankPartnerData() {
    return { rows: {}, tags: [] };
  }

  function getPartnerData(touredData, partner) {
    if (!touredData || typeof touredData !== 'object') return blankPartnerData();
    return touredData[partner] || blankPartnerData();
  }

  function rowState(partnerData, slug) {
    return (partnerData.rows && partnerData.rows[slug]) || {};
  }

  /* ------------------------------------------------------------------ */
  /* Render helpers                                                       */
  /* ------------------------------------------------------------------ */

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (ch) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch];
    });
  }

  function renderPartnerSelector(active) {
    return '<div class="toured-partner-strip" role="group" aria-label="Partner POV">' +
      PARTNERS.map(function (p) {
        var label = p === 'peter' ? 'Peter' : 'Kerv';
        return '<button type="button" class="toured-partner-btn' + (active === p ? ' active' : '') + '"' +
          ' data-toured-partner="' + p + '" aria-pressed="' + (active === p ? 'true' : 'false') + '">' +
          esc(label) + '</button>';
      }).join('') +
    '</div>';
  }

  function renderSqftLines(apartment) {
    var sqft = apartment.square_feet;
    if (!sqft) return '';
    function rate(cents) {
      if (!cents || sqft <= 0) return null;
      return (Number(cents) / 100 / Number(sqft)).toFixed(2);
    }
    var gross = rate(apartment.rent_cents);
    var net = rate(apartment.net_effective_cents);
    var lines = [];
    if (gross) lines.push('<span class="toured-sqft-chip">$' + esc(gross) + '/sqft gross</span>');
    if (net) lines.push('<span class="toured-sqft-chip">$' + esc(net) + '/sqft net eff.</span>');
    if (!lines.length) return '';
    return '<div class="toured-sqft-row" aria-label="Price per square foot">' + lines.join('') + '</div>';
  }

  function renderSummaryStrip(apartment) {
    var rent = apartment.rent_cents
      ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(apartment.rent_cents / 100) + '/mo'
      : null;
    var specs = [];
    if (apartment.bedrooms != null) specs.push(apartment.bedrooms + ' bed');
    if (apartment.bathrooms != null) specs.push(apartment.bathrooms + ' bath');
    if (apartment.square_feet) specs.push(apartment.square_feet + ' sq ft');
    var chips = [rent].concat(specs.length ? [specs.join(' · ')] : []).filter(Boolean);
    var sqft = renderSqftLines(apartment);
    return '<div class="toured-summary-strip">' +
      '<h3 class="toured-apt-title">' + esc(apartment.title || 'Apartment') + '</h3>' +
      (chips.length
        ? '<div class="toured-summary-chips">' +
          chips.map(function (c) { return '<span class="pill">' + esc(c) + '</span>'; }).join('') +
          '</div>'
        : '') +
      sqft +
    '</div>';
  }

  function renderTristate(slug, current) {
    var opts = [
      { val: 'yes', label: '✓', title: 'Yes / done' },
      { val: 'no',  label: '✗', title: 'No / issue' },
      { val: 'na',  label: '—', title: 'N/A / skip' },
    ];
    return '<div class="toured-tristate" role="group" aria-label="' + esc(slug) + ' verdict">' +
      opts.map(function (o) {
        var active = current === o.val;
        return '<button type="button" class="toured-tri-btn toured-tri-btn--' + o.val + (active ? ' active' : '') + '"' +
          ' data-toured-tri="' + esc(slug) + '" data-toured-val="' + esc(o.val) + '"' +
          ' title="' + esc(o.title) + '" aria-pressed="' + (active ? 'true' : 'false') + '">' +
          o.label + '</button>';
      }).join('') +
    '</div>';
  }

  function renderChips(slug, chipOptions, current) {
    if (!chipOptions || !chipOptions.length) return '';
    var selected = current || '';
    return '<div class="toured-chip-row" aria-label="' + esc(slug) + ' options">' +
      chipOptions.map(function (c) {
        var isActive = selected === c;
        return '<button type="button" class="toured-chip' + (isActive ? ' active' : '') + '"' +
          ' data-toured-chip="' + esc(slug) + '" data-toured-chip-val="' + esc(c) + '"' +
          ' aria-pressed="' + (isActive ? 'true' : 'false') + '">' +
          esc(c) + '</button>';
      }).join('') +
    '</div>';
  }

  function renderRow(row, partnerData) {
    var rs = rowState(partnerData, row.slug);
    var noteOpen = Boolean(rs.note && rs.note.trim());
    return '<div class="toured-row" data-toured-row="' + esc(row.slug) + '">' +
      '<div class="toured-row-main">' +
        '<span class="toured-row-label">' + esc(row.label) + '</span>' +
        '<div class="toured-row-controls">' +
          renderTristate(row.slug, rs.value) +
          '<button type="button" class="toured-note-toggle" data-toured-note-toggle="' + esc(row.slug) + '"' +
            ' aria-expanded="' + (noteOpen ? 'true' : 'false') + '" title="Add note">+</button>' +
        '</div>' +
      '</div>' +
      (row.chips ? renderChips(row.slug, row.chips, rs.chips) : '') +
      '<div class="toured-note-panel" data-toured-note-panel="' + esc(row.slug) + '"' +
        (noteOpen ? '' : ' hidden') + '>' +
        '<textarea class="toured-note-input" data-toured-note-input="' + esc(row.slug) + '"' +
          ' rows="2" placeholder="Note…">' + esc(rs.note || '') + '</textarea>' +
      '</div>' +
    '</div>';
  }

  function renderTagsCombobox(tags) {
    var tagList = Array.isArray(tags) ? tags : [];
    return '<div class="toured-tags-section">' +
      '<div class="section-header"><h4 class="toured-section-label">Tags</h4></div>' +
      '<div class="toured-tags-list" id="toured-tags-list">' +
        tagList.map(function (t) {
          return '<span class="toured-tag">' + esc(t) +
            '<button type="button" class="toured-tag-remove" data-toured-tag-remove="' + esc(t) + '" aria-label="Remove ' + esc(t) + '">×</button>' +
            '</span>';
        }).join('') +
      '</div>' +
      '<div class="toured-tags-input-row">' +
        '<input type="text" class="toured-tags-input" id="toured-tags-input" placeholder="Add tag…" autocomplete="off" autocorrect="off" spellcheck="false">' +
        '<button type="button" class="toured-tags-add-btn" id="toured-tags-add-btn">Add</button>' +
      '</div>' +
    '</div>';
  }

  function renderChecklist(apartment, touredData, partner) {
    var partnerData = getPartnerData(touredData, partner);
    return SECTIONS.map(function (section) {
      return '<div class="toured-section">' +
        '<div class="section-header toured-section-header">' +
          '<h4 class="toured-section-label">' + esc(section.label) + '</h4>' +
        '</div>' +
        '<div class="toured-rows">' +
          section.rows.map(function (row) { return renderRow(row, partnerData); }).join('') +
        '</div>' +
      '</div>';
    }).join('') +
    renderTagsCombobox(partnerData.tags || []);
  }

  function renderToured(apartment, touredData, activePartner) {
    var partner = activePartner || 'peter';
    return '<div class="toured-shell">' +
      renderSummaryStrip(apartment) +
      renderPartnerSelector(partner) +
      '<div id="toured-checklist-body">' +
        renderChecklist(apartment, touredData, partner) +
      '</div>' +
      '<div class="toured-save-row">' +
        '<button type="button" class="primary-btn" id="toured-save-btn">Save</button>' +
        '<span class="toured-save-status" id="toured-save-status" aria-live="polite"></span>' +
      '</div>' +
    '</div>';
  }

  /* ------------------------------------------------------------------ */
  /* State management: live touredData object that accumulates edits     */
  /* ------------------------------------------------------------------ */

  function deepCloneTouredData(src) {
    try { return JSON.parse(JSON.stringify(src || {})); } catch (e) { return {}; }
  }

  function ensurePartner(td, partner) {
    if (!td[partner]) td[partner] = blankPartnerData();
    if (!td[partner].rows) td[partner].rows = {};
    if (!td[partner].tags) td[partner].tags = [];
  }

  function setRowValue(td, partner, slug, field, value) {
    ensurePartner(td, partner);
    if (!td[partner].rows[slug]) td[partner].rows[slug] = {};
    td[partner].rows[slug][field] = value;
  }

  /* ------------------------------------------------------------------ */
  /* Bind                                                                 */
  /* ------------------------------------------------------------------ */

  function mountToured(container, apartment, opts) {
    var saveApartment = opts && opts.saveApartment;
    var onSaved = opts && opts.onSaved;

    var activePartner = 'peter';
    var localData = deepCloneTouredData(apartment.toured_data);

    function refresh() {
      container.innerHTML = renderToured(apartment, localData, activePartner);
      bindEvents();
    }

    function rebuildChecklist() {
      var body = container.querySelector('#toured-checklist-body');
      if (!body) return;
      body.innerHTML = renderChecklist(apartment, localData, activePartner);
      bindChecklistEvents(body);
    }

    function bindPartnerSelector() {
      container.querySelectorAll('[data-toured-partner]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          activePartner = btn.getAttribute('data-toured-partner');
          container.querySelectorAll('[data-toured-partner]').forEach(function (b) {
            var isActive = b.getAttribute('data-toured-partner') === activePartner;
            b.classList.toggle('active', isActive);
            b.setAttribute('aria-pressed', isActive ? 'true' : 'false');
          });
          rebuildChecklist();
        });
      });
    }

    function bindChecklistEvents(root) {
      root = root || container;

      // Tristate buttons
      root.querySelectorAll('[data-toured-tri]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var slug = btn.getAttribute('data-toured-tri');
          var val = btn.getAttribute('data-toured-val');
          setRowValue(localData, activePartner, slug, 'value', val);
          // Update button active states within this row
          var rowEl = btn.closest('.toured-row');
          if (rowEl) {
            rowEl.querySelectorAll('[data-toured-tri]').forEach(function (b) {
              var isActive = b.getAttribute('data-toured-val') === val;
              b.classList.toggle('active', isActive);
              b.setAttribute('aria-pressed', isActive ? 'true' : 'false');
            });
          }
        });
      });

      // Chip buttons
      root.querySelectorAll('[data-toured-chip]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var slug = btn.getAttribute('data-toured-chip');
          var val = btn.getAttribute('data-toured-chip-val');
          var current = ((localData[activePartner] || {}).rows || {})[slug] || {};
          var newVal = current.chips === val ? '' : val; // toggle off if already selected
          setRowValue(localData, activePartner, slug, 'chips', newVal);
          var rowEl = btn.closest('.toured-row');
          if (rowEl) {
            rowEl.querySelectorAll('[data-toured-chip]').forEach(function (b) {
              var isActive = b.getAttribute('data-toured-chip-val') === newVal;
              b.classList.toggle('active', isActive);
              b.setAttribute('aria-pressed', isActive ? 'true' : 'false');
            });
          }
        });
      });

      // Note toggle
      root.querySelectorAll('[data-toured-note-toggle]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var slug = btn.getAttribute('data-toured-note-toggle');
          var panel = root.querySelector('[data-toured-note-panel="' + slug + '"]');
          if (!panel) return;
          var isHidden = panel.hasAttribute('hidden');
          if (isHidden) {
            panel.removeAttribute('hidden');
            btn.setAttribute('aria-expanded', 'true');
            var ta = panel.querySelector('[data-toured-note-input]');
            if (ta) try { ta.focus(); } catch (e) { /* empty */ }
          } else {
            panel.setAttribute('hidden', '');
            btn.setAttribute('aria-expanded', 'false');
          }
        });
      });

      // Note textarea — live sync to state
      root.querySelectorAll('[data-toured-note-input]').forEach(function (ta) {
        ta.addEventListener('input', function () {
          var slug = ta.getAttribute('data-toured-note-input');
          setRowValue(localData, activePartner, slug, 'note', ta.value);
        });
      });
    }

    function bindTagsInput() {
      var input = container.querySelector('#toured-tags-input');
      var addBtn = container.querySelector('#toured-tags-add-btn');
      var listEl = container.querySelector('#toured-tags-list');

      function addTag(raw) {
        var tag = String(raw || '').trim().toLowerCase();
        if (!tag) return;
        ensurePartner(localData, activePartner);
        var tags = localData[activePartner].tags;
        if (tags.indexOf(tag) === -1) tags.push(tag);
        renderTagsList();
        if (input) input.value = '';
      }

      function removeTag(tag) {
        ensurePartner(localData, activePartner);
        var tags = localData[activePartner].tags;
        var idx = tags.indexOf(tag);
        if (idx !== -1) tags.splice(idx, 1);
        renderTagsList();
      }

      function renderTagsList() {
        if (!listEl) return;
        var tags = (localData[activePartner] || {}).tags || [];
        listEl.innerHTML = tags.map(function (t) {
          return '<span class="toured-tag">' + esc(t) +
            '<button type="button" class="toured-tag-remove" data-toured-tag-remove="' + esc(t) + '" aria-label="Remove ' + esc(t) + '">×</button>' +
            '</span>';
        }).join('');
        listEl.querySelectorAll('[data-toured-tag-remove]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            removeTag(btn.getAttribute('data-toured-tag-remove'));
          });
        });
      }

      if (addBtn) {
        addBtn.addEventListener('click', function () {
          if (input) addTag(input.value);
        });
      }
      if (input) {
        input.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') {
            e.preventDefault();
            addTag(input.value);
          }
        });
      }
      // Bind existing remove buttons
      if (listEl) {
        listEl.querySelectorAll('[data-toured-tag-remove]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            removeTag(btn.getAttribute('data-toured-tag-remove'));
          });
        });
      }
    }

    function bindSave() {
      var saveBtn = container.querySelector('#toured-save-btn');
      var statusEl = container.querySelector('#toured-save-status');
      if (!saveBtn || !saveApartment) return;
      saveBtn.addEventListener('click', function () {
        saveBtn.disabled = true;
        if (statusEl) statusEl.textContent = 'Saving…';
        var payload = typeof NyhomeApartmentPayload !== 'undefined'
          ? NyhomeApartmentPayload.apartmentToSavePayload(apartment, { touredData: localData })
          : { id: apartment.id, touredData: localData };
        saveApartment(payload)
          .then(function () {
            apartment.toured_data = deepCloneTouredData(localData);
            if (statusEl) { statusEl.textContent = 'Saved'; setTimeout(function () { if (statusEl) statusEl.textContent = ''; }, 2000); }
            if (onSaved) onSaved(apartment);
          })
          .catch(function (err) {
            console.error('[toured] save error', err);
            var msg = 'Error — try again';
            if (err && err.code === 'MISSING_TOURED_DATA_COLUMN') {
              msg = 'Database missing toured_data. Run: npm run migrate';
            } else if (err && err.code === 'INVALID_TOURED_DATA') {
              msg = 'Invalid toured data — refresh and try again';
            }
            if (statusEl) statusEl.textContent = msg;
          })
          .then(function () { saveBtn.disabled = false; });
      });
    }

    function bindEvents() {
      bindPartnerSelector();
      bindChecklistEvents();
      bindTagsInput();
      bindSave();
    }

    refresh();
  }

  /** Whether this partner row has any saved vote, chip selection, or note. */
  function rowHasContent(rs) {
    if (!rs || typeof rs !== 'object') return false;
    if (rs.value && String(rs.value).trim()) return true;
    if (rs.chips != null && String(rs.chips).trim()) return true;
    if (rs.note != null && String(rs.note).trim()) return true;
    return false;
  }

  function formatVoteCell(rs) {
    if (!rowHasContent(rs)) return '';
    var bits = [];
    if (rs.value === 'yes') bits.push('Yes');
    else if (rs.value === 'no') bits.push('No');
    else if (rs.value === 'na') bits.push('N/A');
    if (rs.chips != null && String(rs.chips).trim()) bits.push(String(rs.chips).trim());
    var main = bits.join(' · ');
    var note = rs.note && String(rs.note).trim();
    return (
      '<div class="toured-ro-cell">' +
      (main ? '<span class="toured-ro-main">' + esc(main) + '</span>' : '') +
      (note ? '<span class="toured-ro-note">' + esc(note) + '</span>' : '') +
      '</div>'
    );
  }

  function tagsLine(tags) {
    var list = Array.isArray(tags) ? tags.filter(Boolean) : [];
    if (!list.length) return '';
    return list.map(function (t) {
      return '<span class="pill toured-ro-tag-pill">' + esc(String(t)) + '</span>';
    }).join(' ');
  }

  /**
   * Read-only summary for /details Toured tab: two columns (Peter | Kerv), rows omitted when neither voted.
   */
  function renderTouredReadOnlyHtml(apartment) {
    var id = apartment && apartment.id != null ? String(apartment.id) : '';
    var touredUrl = '/details/toured?id=' + encodeURIComponent(id);
    var td = apartment && apartment.toured_data;
    if (typeof td === 'string') {
      try { td = JSON.parse(td); } catch (e) { td = null; }
    }
    var peterD = getPartnerData(td, 'peter');
    var kervD = getPartnerData(td, 'kerv');
    var hasTags =
      (peterD.tags && peterD.tags.length) ||
      (kervD.tags && kervD.tags.length);

    var tables = [];
    SECTIONS.forEach(function (section) {
      var bodyRows = [];
      section.rows.forEach(function (row) {
        var pr = rowState(peterD, row.slug);
        var kr = rowState(kervD, row.slug);
        if (!rowHasContent(pr) && !rowHasContent(kr)) return;
        bodyRows.push(
          '<tr data-toured-ro-slug="' + esc(row.slug) + '">' +
          '<td class="toured-ro-prompt">' + esc(row.label) + '</td>' +
          '<td class="toured-ro-col toured-ro-col-peter">' + formatVoteCell(pr) + '</td>' +
          '<td class="toured-ro-col toured-ro-col-kerv">' + formatVoteCell(kr) + '</td>' +
          '</tr>'
        );
      });
      if (bodyRows.length) {
        tables.push(
          '<tbody class="toured-readonly-tbody">' +
          '<tr class="toured-ro-section-row"><td class="toured-ro-section" colspan="3">' + esc(section.label) + '</td></tr>' +
          bodyRows.join('') +
          '</tbody>'
        );
      }
    });

    var tagsBlock = '';
    if (hasTags) {
      tagsBlock =
        '<div class="toured-readonly-tags">' +
        '<h4 class="toured-section-label">Tags</h4>' +
        '<div class="toured-readonly-tags-cols">' +
        '<div class="toured-readonly-tag-col">' +
        '<span class="toured-ro-tag-heading">Peter</span>' +
        (tagsLine(peterD.tags) || '<span class="muted toured-ro-empty">—</span>') +
        '</div>' +
        '<div class="toured-readonly-tag-col">' +
        '<span class="toured-ro-tag-heading">Kerv</span>' +
        (tagsLine(kervD.tags) || '<span class="muted toured-ro-empty">—</span>') +
        '</div>' +
        '</div></div>';
    }

    var hasRows = tables.length > 0;
    var emptyMsg =
      !hasRows && !hasTags
        ? '<p class="muted toured-readonly-empty">No toured votes yet. Open the checklist to capture Peter and Kerv on the walk-through.</p>'
        : '';

    return (
      '<div class="toured-readonly">' +
      '<div class="toured-readonly-cta">' +
      '<a class="primary-btn" href="' + esc(touredUrl) + '">Open toured checklist</a>' +
      '</div>' +
      emptyMsg +
      (hasRows
        ? '<div class="toured-readonly-scroll">' +
          '<table class="toured-readonly-table" role="table">' +
          '<thead><tr>' +
          '<th scope="col" class="toured-ro-prompt">Prompt</th>' +
          '<th scope="col" class="toured-ro-col toured-ro-col-peter">Peter</th>' +
          '<th scope="col" class="toured-ro-col toured-ro-col-kerv">Kerv</th>' +
          '</tr></thead>' +
          tables.join('') +
          '</table></div>'
        : '') +
      tagsBlock +
      '</div>'
    );
  }

  global.NyhomeToured = {
    mountToured: mountToured,
    renderTouredReadOnlyHtml: renderTouredReadOnlyHtml,
  };

})(typeof self !== 'undefined' ? self : this);
