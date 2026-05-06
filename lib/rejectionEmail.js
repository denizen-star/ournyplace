/**
 * HTML for “property rejected” notification. Keep TOURED_SECTIONS row slugs/labels in
 * sync with assets/js/toured.js (SECTIONS).
 */
const { normalizeBaseUrl, detailHref } = require('./pipelineDigest');

const C = {
  pageBg: '#f1eef9',
  ink: '#24202c',
  muted: '#5a5364',
  link: '#0a8a80',
};

/** Mirrors toured.js SECTIONS — prompt slugs and labels only */
const TOURED_SECTIONS = [
  {
    label: 'Location & exterior',
    rows: [
      { slug: 'night_weekend_noise', label: 'Late-night / weekend noise reality' },
      { slug: 'transit_walk', label: 'Walk to subway: entrance, lighting' },
      { slug: 'scaffolding', label: 'Scaffolding / façade work nearby?' },
    ],
  },
  {
    label: 'Kitchen & appliances',
    rows: [
      { slug: 'dishwasher_size', label: 'Dishwasher: plates fit? (slimline vs full)' },
      { slug: 'dishwasher_smell', label: 'Dishwasher: standing water or musty smell?' },
      { slug: 'cooktop_type', label: 'Gas vs induction/electric' },
    ],
  },
  {
    label: 'Lighting & view',
    rows: [
      { slug: 'pov_bed_desk', label: 'From bed/desk: privacy, brick wall, stare-in' },
      { slug: 'light_direction', label: 'Window direction / natural light quality' },
      { slug: 'overhead_vs_switched', label: 'Overhead lights vs switched outlets for lamps' },
    ],
  },
  {
    label: 'Noise & comfort',
    rows: [
      { slug: 'window_seal', label: 'Window closed: street noise acceptable?' },
      { slug: 'floor_squeak', label: 'Floor squeak; hear upstairs?' },
      { slug: 'ac_type', label: 'AC type' },
    ],
  },
  {
    label: 'Cleanliness & maintenance',
    rows: [
      { slug: 'hallway_sniff', label: 'Hallways: smell, carpets, trash chute' },
      { slug: 'elevator_wait', label: 'Elevator wait off-peak acceptable?' },
      { slug: 'refresh_vs_reno', label: 'Real renovation vs cosmetic refresh?' },
    ],
  },
  {
    label: 'Storage & space',
    rows: [
      { slug: 'closet_depth', label: 'Closets deep enough for hangers?' },
      { slug: 'amenity_rooms', label: 'Bike/storage rooms—usable?' },
      { slug: 'layout_utility', label: 'Layout fits furniture vs raw sq ft' },
    ],
  },
  {
    label: 'Building entrance',
    rows: [
      { slug: 'packages', label: 'Package room vs lobby piles' },
      { slug: 'lobby_signal', label: 'Lobby cleanliness / dead bulbs—management signal' },
    ],
  },
  {
    label: 'Physical must-checks',
    rows: [
      { slug: 'water_pressure', label: 'Shower + kitchen: pressure & hot water delay' },
      { slug: 'pests', label: 'Under-sink / baseboards—pest signs' },
      { slug: 'windows_all', label: 'Every window opens, closes, seals' },
      { slug: 'cell_signal', label: 'Cell signal in main rooms' },
    ],
  },
  {
    label: 'Quick alignment',
    rows: [
      { slug: 'value_sqft', label: 'Rent ÷ sq ft vs alternatives' },
      { slug: 'days_on_market', label: 'Why still available—broker answer satisfactory?' },
    ],
  },
];

const PARTNERS = [
  { key: 'peter', name: 'Peter' },
  { key: 'kerv', name: 'Kerv' },
];

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(
    /[&<>"']/g,
    (ch) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[ch]
  );
}

function formatChipLabel(slug) {
  if (!slug) return '';
  return String(slug)
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function tristateWord(v) {
  const s = v == null ? '' : String(v).trim().toLowerCase();
  if (s === 'yes') return 'Yes';
  if (s === 'no') return 'No';
  if (s === 'na' || s === 'n/a') return 'N/A';
  return '';
}

function rowSnapshot(rs) {
  if (!rs || typeof rs !== 'object') return '';
  const parts = [];
  const tw = tristateWord(rs.value);
  if (tw) parts.push(tw);
  if (rs.chips != null && String(rs.chips).trim()) parts.push(formatChipLabel(rs.chips));
  if (rs.note != null && String(rs.note).trim()) parts.push(String(rs.note).trim());
  return parts.join(' · ');
}

function compactTouredHtml(touredData) {
  if (!touredData || typeof touredData !== 'object') return '';

  const chunks = [];

  for (let pi = 0; pi < PARTNERS.length; pi++) {
    const { key, name } = PARTNERS[pi];
    const partnerData = touredData[key];
    if (!partnerData || typeof partnerData !== 'object') continue;
    const rows = partnerData.rows && typeof partnerData.rows === 'object' ? partnerData.rows : {};

    for (let si = 0; si < TOURED_SECTIONS.length; si++) {
      const sec = TOURED_SECTIONS[si];
      for (let ri = 0; ri < sec.rows.length; ri++) {
        const row = sec.rows[ri];
        const snap = rowSnapshot(rows[row.slug]);
        if (!snap) continue;
        chunks.push(
          `<li style="margin:0 0 6px 0"><strong>${escapeHtml(sec.label)}</strong> — ${escapeHtml(
            row.label
          )} <em>(${escapeHtml(name)})</em>: ${escapeHtml(snap)}</li>`
        );
      }
    }

    const tags = Array.isArray(partnerData.tags) ? partnerData.tags.filter(Boolean) : [];
    if (tags.length) {
      chunks.push(
        `<li style="margin:0 0 6px 0"><strong>Tags (${escapeHtml(name)})</strong>: ${escapeHtml(
          tags.join(', ')
        )}</li>`
      );
    }
  }

  if (!chunks.length) return '';

  return (
    `<h3 style="font-family:Georgia,serif;color:${C.ink};margin:16px 0 8px">Toured checklist</h3>` +
    `<ul style="margin:0;padding-left:20px;color:${C.muted};font-size:14px;line-height:1.45">${chunks.join(
      ''
    )}</ul>`
  );
}

function buildTourNotesHtml(apartment) {
  const blocks = [];
  const n = apartment.notes != null && String(apartment.notes).trim();
  if (n) {
    blocks.push(
      `<p style="margin:8px 0;color:${C.muted};font-size:14px"><strong>Listing notes</strong><br/>${escapeHtml(
        String(apartment.notes).trim()
      )}</p>`
    );
  }
  const v = apartment.next_visit;
  if (v && typeof v === 'object') {
    const sch = v.scheduling_notes != null && String(v.scheduling_notes).trim();
    const tour = v.toured_notes != null && String(v.toured_notes).trim();
    if (sch) {
      blocks.push(
        `<p style="margin:8px 0;color:${C.muted};font-size:14px"><strong>Scheduling notes</strong><br/>${escapeHtml(
          String(v.scheduling_notes).trim()
        )}</p>`
      );
    }
    if (tour) {
      blocks.push(
        `<p style="margin:8px 0;color:${C.muted};font-size:14px"><strong>During-tour notes</strong><br/>${escapeHtml(
          String(v.toured_notes).trim()
        )}</p>`
      );
    }
  }
  if (!blocks.length) return '';
  return (
    `<h3 style="font-family:Georgia,serif;color:${C.ink};margin:16px 0 8px">Notes</h3>` +
    blocks.join('')
  );
}

/**
 * @param {{ apartment: object, publicBaseUrl: string }} opts
 * @returns {{ html: string, subject: string }}
 */
function buildRejectionEmailHtml(opts) {
  const apartment = opts && opts.apartment;
  const publicBaseUrl = normalizeBaseUrl(opts && opts.publicBaseUrl) || '';
  if (!apartment) {
    return { html: '', subject: 'bummer' };
  }

  const title = apartment.title || apartment.address || 'Listing';
  const shortlistHref = publicBaseUrl ? `${publicBaseUrl}/` : '/';
  const detailsLink = publicBaseUrl ? detailHref(publicBaseUrl, apartment.id) : `/details/?id=${encodeURIComponent(apartment.id)}`;

  const notesBlock = buildTourNotesHtml(apartment);
  const touredBlock = compactTouredHtml(apartment.toured_data);

  const bodyIntro =
    `<p style="margin:12px 0 16px;color:${C.muted};font-size:15px;line-height:1.5">` +
    `This one must go but plenty better in the queue… ` +
    (publicBaseUrl
      ? `<a href="${escapeHtml(shortlistHref)}" style="color:${C.link}">Open shortlist</a>`
      : `<span>Open shortlist at your nyhome URL</span>`) +
    ` · ` +
    `<a href="${escapeHtml(detailsLink)}" style="color:${C.link}">Listing details</a>` +
    `</p>`;

  const html =
    `<div style="background:${C.pageBg};padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">` +
    `<div style="max-width:560px;margin:0 auto">` +
    `<p style="margin:0 0 12px;font-size:24px;font-weight:700;color:#c62828;font-family:Georgia,serif">Bummer</p>` +
    bodyIntro +
    notesBlock +
    touredBlock +
    `<p style="margin:20px 0 0;color:${C.ink};font-size:15px">Bye bye!</p>` +
    `</div></div>`;

  const subject = `${String(title).replace(/\s+/g, ' ').trim()} bummer`;

  return { html, subject };
}

module.exports = {
  buildRejectionEmailHtml,
};
