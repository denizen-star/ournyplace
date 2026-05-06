const { normalizeStatus } = require('./apartmentStatus');
const { isBothPartnersVotingComplete } = require('./votingComplete');
const { detailHref, normalizeBaseUrl } = require('./pipelineDigest');

const C = {
  pageBg: '#f1eef9',
  cardBg: '#fefdff',
  cardBorder: '#dfdaf0',
  ink: '#24202c',
  muted: '#5a5364',
  accent: '#5f4fb3',
  accentDeep: '#3d3278',
  link: '#0a8a80',
  tableBorder: '#dad4e8',
  tableLabelBg: '#e8f9ff',
  tableValueBg: '#f7f5fc',
};

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

function formatMoneyCents(cents) {
  if (cents == null || cents === '') return '';
  const n = Number(cents);
  if (!Number.isFinite(n)) return '';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(
    n / 100
  );
}

function humanStatus(status) {
  const s = normalizeStatus(status);
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatChipLabel(slug) {
  if (!slug) return '';
  return String(slug)
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function unitSummary(apt) {
  const parts = [];
  if (apt.bedrooms != null && apt.bedrooms !== '') parts.push(`${apt.bedrooms} bed`);
  if (apt.bathrooms != null && apt.bathrooms !== '') parts.push(`${apt.bathrooms} bath`);
  if (apt.square_feet != null && apt.square_feet !== '') parts.push(`${apt.square_feet} sq ft`);
  return parts.join(', ');
}

function listingStarLabel(apt) {
  const raw = apt.listing_star != null ? apt.listing_star : apt.listingStar;
  const n = Number(raw);
  if (n === 1) return 'Peter starred';
  if (n === 2) return 'Kerv starred';
  if (n === 3) return 'Peter & Kerv starred';
  return '';
}

function scorePct(v) {
  if (v == null || Number.isNaN(Number(v))) return '—';
  return `${Math.round(Number(v))}%`;
}

function votingScoreCell(v) {
  if (v === null) return 'N/A';
  if (v === undefined || v === '') return '—';
  return escapeHtml(String(v));
}

/** Remote URLs only; data: URLs break or bloat in many clients. */
function emailSafeImageUrls(images) {
  const list = Array.isArray(images) ? images : [];
  const safe = [];
  let dataEmbedded = 0;
  for (let i = 0; i < list.length; i++) {
    const u = list[i] && list[i].image_url != null ? String(list[i].image_url).trim() : '';
    if (!u) continue;
    if (/^https?:\/\//i.test(u)) safe.push(u);
    else if (/^data:image\//i.test(u)) dataEmbedded += 1;
  }
  return { safe, dataEmbedded };
}

function twoColTable(rows, emptyLabel) {
  if (!rows.length) {
    return `<p style="margin:0;color:${C.muted};font-size:14px;">${escapeHtml(emptyLabel)}</p>`;
  }
  const body = rows
    .map(
      ([label, val]) =>
        `<tr><td style="padding:8px 12px;border:1px solid ${C.tableBorder};background:${C.tableLabelBg};font-weight:600;color:${C.ink};width:38%;">${escapeHtml(label)}</td>` +
        `<td style="padding:8px 12px;border:1px solid ${C.tableBorder};background:${C.tableValueBg};color:${C.ink};">${val == null || val === '' ? `<span style="color:${C.muted};">—</span>` : typeof val === 'string' && val.indexOf('<') >= 0 ? val : escapeHtml(String(val))}</td></tr>`
    )
    .join('');
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;border-collapse:collapse;font-size:14px;margin:8px 0;">${body}</table>`;
}

function buildListingDetailEmailHtml({ apartment, criteria, publicBaseUrl, kind, manual, compactVoting }) {
  const k = kind === 'scores_complete' ? 'scores_complete' : 'listing_added';
  const isScoresComplete = k === 'scores_complete';
  const cv = Boolean(compactVoting);

  const base = normalizeBaseUrl(publicBaseUrl || '');
  const id = apartment.id;
  const detailsUrl = detailHref(base, id);
  const absDetails = base ? detailsUrl : null;

  const scores = apartment.scores || {};
  const starLine = listingStarLabel(apartment);
  const urls = emailSafeImageUrls(apartment.images);

  const summaryRows = [
    ['Title', apartment.title || 'Untitled'],
    ['Status', humanStatus(apartment.status)],
    ['Neighborhood', apartment.neighborhood || '—'],
    ['Address', apartment.address || '—'],
    ['Unit', apartment.apt_number || '—'],
    ['Rent', formatMoneyCents(apartment.rent_cents) || '—'],
    ['Unit snapshot', unitSummary(apartment) || '—'],
    ['Move-in', apartment.move_in_date || '—'],
    ['Avg score', scorePct(scores.combined)],
    ['Peter', scorePct(scores.peter)],
    ['Kerv', scorePct(scores.kerv)],
  ];
  if (starLine) summaryRows.push(['Star', starLine]);

  const extUrl = apartment.listing_url ? String(apartment.listing_url).trim() : '';
  const extLink =
    extUrl && /^https?:\/\//i.test(extUrl)
      ? `<p style="margin:16px 0 8px;"><a href="${escapeHtml(extUrl)}" style="color:${C.link};font-weight:600;">Open external listing</a></p>`
      : '';

  const nyhomeLinkHtml = absDetails
    ? `<p style="margin:20px 0 16px;"><a href="${escapeHtml(absDetails)}" style="display:inline-block;padding:12px 22px;background:${C.accentDeep};color:#fff;text-decoration:none;border-radius:10px;font-weight:600;font-size:15px;">Open in nyhome (full details)</a></p>` +
      `<p style="margin:0 0 8px;font-size:13px;color:${C.muted};word-break:break-all;">${escapeHtml(absDetails)}</p>`
    : `<p style="margin:16px 0 8px;font-size:14px;color:${C.muted};">Set <strong>NYHOME_PUBLIC_URL</strong> for clickable nyhome links. Path: <code style="font-size:13px;">/details/?id=${escapeHtml(String(id))}</code></p>`;

  const scorecardCostRows = [
    ['Rent', formatMoneyCents(apartment.rent_cents) || '—'],
    ['Net effective', formatMoneyCents(apartment.net_effective_cents) || '—'],
    ['Broker fee', formatMoneyCents(apartment.broker_fee_cents) || '—'],
    ['Deposit', formatMoneyCents(apartment.deposit_cents) || '—'],
    ['Amenities fees', formatMoneyCents(apartment.amenities_fees_cents) || '—'],
    ['Total move-in', formatMoneyCents(apartment.total_move_in_cents) || '—'],
    ['Move-in date', apartment.move_in_date || '—'],
  ];

  const uf = (apartment.unit_features || []).map(formatChipLabel).filter(Boolean);
  const am = (apartment.amenities || []).map(formatChipLabel).filter(Boolean);
  const scorecardUnitRows = [
    ['Unit', unitSummary(apartment) || '—'],
    ['Unit features', uf.length ? uf.join(', ') : '—'],
    ['Amenities', am.length ? am.join(', ') : '—'],
  ];

  const notesHtml = apartment.notes
    ? `<div style="margin:12px 0;padding:12px 14px;background:${C.tableValueBg};border:1px solid ${C.tableBorder};border-radius:8px;font-size:14px;line-height:1.5;color:${C.ink};white-space:pre-wrap;">${escapeHtml(apartment.notes)}</div>`
    : `<p style="color:${C.muted};margin:8px 0;">No notes yet.</p>`;

  let photosHtml = '';
  if (urls.safe.length) {
    photosHtml += `<div style="margin:12px 0;">`;
    for (let i = 0; i < urls.safe.length; i++) {
      const u = urls.safe[i];
      photosHtml += `<div style="margin:0 0 12px;"><img src="${escapeHtml(u)}" alt="" style="max-width:100%;width:100%;max-height:320px;object-fit:cover;border-radius:8px;border:1px solid ${C.tableBorder};" /></div>`;
    }
    photosHtml += `</div>`;
  } else {
    photosHtml = `<p style="color:${C.muted};margin:8px 0;">No remote image URLs yet.</p>`;
  }
  if (urls.dataEmbedded > 0) {
    photosHtml += `<p style="color:${C.muted};font-size:13px;margin:8px 0;">${urls.dataEmbedded} photo(s) are stored inline on the listing — open nyhome to view them.</p>`;
  }

  const crit = Array.isArray(criteria) ? criteria : [];
  const r = apartment.ratings || {};
  const rp = r.peter || {};
  const rk = r.kerv || {};
  let criteriaTable = '';
  if (!crit.length) {
    criteriaTable = `<p style="color:${C.muted};">No criteria configured.</p>`;
  } else {
    const thead = `<thead><tr><th style="padding:8px 10px;border:1px solid ${C.tableBorder};background:${C.accentDeep};color:#fff;text-align:left;">Criterion</th><th style="padding:8px 10px;border:1px solid ${C.tableBorder};background:${C.accentDeep};color:#fff;">Peter</th><th style="padding:8px 10px;border:1px solid ${C.tableBorder};background:${C.accentDeep};color:#fff;">Kerv</th></tr></thead>`;
    const tbody = crit
      .map((c) => {
        const label = c.label || String(c.id);
        return `<tr><td style="padding:8px 10px;border:1px solid ${C.tableBorder};background:${C.cardBg};text-align:left;">${escapeHtml(label)}</td><td style="padding:8px 10px;border:1px solid ${C.tableBorder};background:${C.tableValueBg};text-align:center;">${votingScoreCell(rp[c.id])}</td><td style="padding:8px 10px;border:1px solid ${C.tableBorder};background:${C.tableValueBg};text-align:center;">${votingScoreCell(rk[c.id])}</td></tr>`;
      })
      .join('');
    criteriaTable = `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;border-collapse:collapse;font-size:14px;margin:12px 0;">${thead}<tbody>${tbody}</tbody></table>`;
  }

  const title = apartment.title || 'Listing';
  const scorecardFullyScored =
    isScoresComplete &&
    isBothPartnersVotingComplete(Array.isArray(criteria) ? criteria : [], apartment.ratings || {}, cv);

  let subject;
  let h1;
  let intro;
  if (!isScoresComplete) {
    subject = `nyhome: Listing added — ${title}`;
    h1 = 'Listing added';
    intro = 'A new place was saved to the pipeline.';
  } else if (scorecardFullyScored) {
    subject = `nyhome: Scoring complete — ${title}`;
    h1 = 'Scoring complete';
    intro = cv
      ? 'Peter and Kerv have scored every primary criterion. The combined average (Avg) uses those rows only.'
      : 'Peter and Kerv have scored every criterion. The combined average (Avg) is ready.';
  } else {
    subject = `nyhome: Scoring summary — ${title}`;
    h1 = 'Scoring summary';
    intro =
      'Snapshot of this listing and scorecard as of now. Some rows may still be open or marked N/A—open nyhome for the live view.';
  }

  let footerLine = 'Sent by nyhome when a listing is created.';
  if (isScoresComplete) {
    footerLine = manual
      ? 'Sent from nyhome listing details (e-mail summary).'
      : 'Sent by nyhome when both partners finished every criterion score.';
  }

  const html =
    `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1" /></head>` +
    `<body style="margin:0;padding:0;background:${C.pageBg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:${C.ink};">` +
    `<div style="max-width:640px;margin:0 auto;padding:28px 20px;">` +
    `<div style="background:${C.cardBg};border:1px solid ${C.cardBorder};border-radius:16px;padding:24px 22px;box-shadow:0 4px 24px rgba(36,32,44,0.07);">` +
    `<h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:${C.accentDeep};letter-spacing:-0.02em;">${escapeHtml(h1)}</h1>` +
    `<p style="margin:0 0 4px;font-size:15px;color:${C.muted};">${escapeHtml(intro)}</p>` +
    nyhomeLinkHtml +
    extLink +
    `<h2 style="font-size:17px;margin:28px 0 10px;font-weight:600;color:${C.accentDeep};border-bottom:2px solid ${C.tableBorder};padding-bottom:6px;">Summary</h2>` +
    twoColTable(summaryRows, '—') +
    `<h2 style="font-size:17px;margin:28px 0 10px;font-weight:600;color:${C.accentDeep};border-bottom:2px solid ${C.tableBorder};padding-bottom:6px;">Scorecard</h2>` +
    `<h3 style="font-size:15px;margin:16px 0 8px;color:${C.ink};">Costs &amp; timing</h3>` +
    twoColTable(scorecardCostRows, 'No cost details.') +
    `<h3 style="font-size:15px;margin:16px 0 8px;color:${C.ink};">Unit snapshot</h3>` +
    twoColTable(scorecardUnitRows, 'No unit details.') +
    `<h3 style="font-size:15px;margin:16px 0 8px;color:${C.ink};">Listing notes</h3>` +
    notesHtml +
    `<h3 style="font-size:15px;margin:16px 0 8px;color:${C.ink};">Photos</h3>` +
    photosHtml +
    `<h2 style="font-size:17px;margin:28px 0 10px;font-weight:600;color:${C.accentDeep};border-bottom:2px solid ${C.tableBorder};padding-bottom:6px;">Images &amp; scores</h2>` +
    `<p style="font-size:14px;color:${C.muted};margin:0 0 8px;">Per-criterion scores (same as the Images tab). Photos above are repeated here for a quick scan.</p>` +
    criteriaTable +
    (urls.safe.length
      ? `<div style="margin:16px 0 0;">${urls.safe
          .map(
            (u) =>
              `<div style="margin:0 0 10px;"><a href="${escapeHtml(u)}" style="color:${C.link};font-weight:600;font-size:13px;word-break:break-all;">${escapeHtml(u)}</a></div>`
          )
          .join('')}</div>`
      : '') +
    `<p style="margin:28px 0 0;font-size:12px;color:${C.muted};">${escapeHtml(footerLine)}</p>` +
    `</div></div></body></html>`;

  return { subject, html };
}

function buildListingAddedEmailHtml(opts) {
  return buildListingDetailEmailHtml({ ...opts, kind: 'listing_added', manual: false });
}

module.exports = {
  buildListingDetailEmailHtml,
  buildListingAddedEmailHtml,
};
