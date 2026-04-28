const { normalizeStatus, STATUS_ORDER } = require('./apartmentStatus');

const TERMINAL_EXCLUDE = new Set(['rejected', 'blacklisted', 'archived']);
const SIGNED = 'signed';

/** Listings in the competitive pool (footer handles signed separately). */
const TOP_POOL_EXCLUDE = new Set([...TERMINAL_EXCLUDE, SIGNED]);

const POST_SHORTLIST_SCORE_STATUSES = new Set([
  'finalist',
  'applying',
  'applied',
  'approved',
  'lease_review',
]);

/** Default heuristics; tune via env in the function if needed later. */
const DEFAULT_ATTENTION = {
  deadlineDays: 7,
  tourHours: 48,
  stuckEvaluatingDays: 10,
  staleTourScheduledHoursAfter: 24,
};

function statusIndex(status) {
  const s = normalizeStatus(status);
  const i = STATUS_ORDER.indexOf(s);
  return i < 0 ? 0 : i;
}

function listingStarTier(apt) {
  const raw = apt.listing_star != null ? apt.listing_star : apt.listingStar;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1 || n > 3) return 0;
  return Math.round(n);
}

function parseTime(value) {
  if (value == null || value === '') return null;
  const t = Date.parse(String(value));
  return Number.isNaN(t) ? null : t;
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

const DIGEST_TZ = 'America/New_York';
const TODAY_TRANSITION_CAP = 35;

/** Neon-pastel palette: vivid tints, deep readable ink (email-safe: no SVG). */
const C = {
  pageBg: '#f1eef9',
  cardBg: '#fefdff',
  cardBorder: '#dfdaf0',
  ink: '#24202c',
  muted: '#5a5364',
  accent: '#5f4fb3',
  accentDeep: '#3d3278',
  wash: '#f0fdf8',
  wash2: '#fff5fb',
  tableLabelBg: '#e8f9ff',
  tableHead: '#354c64',
  tableHeadText: '#f4f8ff',
  tableBorder: '#dad4e8',
  tableValueBg: '#f7f5fc',
  tableValueTint: '#fff9ec',
  link: '#0a8a80',
  ok: '#23795b',
  heroGradient: 'linear-gradient(128deg, #ebe4ff 0%, #cff5ea 42%, #fff2c2 100%)',
  heroBadgeBg: '#7ee8d0',
  heroBadgeFg: '#083d34',
  badgeToday: '#8af0d4',
  badgeTodayFg: '#082f29',
  badgePulse: '#cfc2ff',
  badgePulseFg: '#2e2166',
  badgeBell: '#ffb8d9',
  badgeBellFg: '#4f1436',
  badgeStar: '#ffe98a',
  badgeStarFg: '#3d3510',
  badgeWeek: '#a8e2ff',
  badgeWeekFg: '#123a4d',
  badgeKey: '#7eeae3',
  badgeKeyFg: '#08403c',
  badgeShuffle: '#ffd4b8',
  badgeShuffleFg: '#4c2410',
  cardShadow: 'rgba(36, 32, 44, 0.07)',
};

function digestBadge(label, bg, fg) {
  const t = escapeHtml(String(label));
  return `<span style="display:inline-block;min-width:28px;height:28px;line-height:28px;padding:0 9px;text-align:center;border-radius:999px;background:${bg};color:${fg};font-size:11px;font-weight:700;letter-spacing:0.06em;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;vertical-align:middle;margin-right:10px;box-shadow:inset 0 -1px 0 rgba(0,0,0,0.06);">${t}</span>`;
}

function digestH2(badgeHtml, title, topMarginPx = 28) {
  return `<h2 style="font-size:18px;margin:${topMarginPx}px 0 8px;font-family:Georgia,'Times New Roman',serif;font-weight:600;color:${C.ink};letter-spacing:-0.02em;">${badgeHtml}${escapeHtml(title)}</h2>`;
}

/** iPhone / narrow mail clients: stack tables into labeled rows (Apple Mail supports this well). */
const DIGEST_EMAIL_HEAD_INNER = `<meta name="viewport" content="width=device-width, initial-scale=1" />
<style type="text/css">
html { -webkit-text-size-adjust: 100%; }
@media only screen and (max-width: 600px) {
  .nyhome-shell { padding: 20px 16px !important; border-radius: 0 !important; }
  .nyhome-kpi-table tr {
    display: block !important;
    margin-bottom: 12px !important;
    border: 1px solid ${C.tableBorder} !important;
    border-radius: 12px !important;
    overflow: hidden !important;
    background: ${C.cardBg} !important;
  }
  .nyhome-kpi-table td {
    display: block !important;
    width: 100% !important;
    box-sizing: border-box !important;
    border: none !important;
    border-bottom: 1px solid ${C.tableBorder} !important;
    padding: 12px 14px !important;
  }
  .nyhome-kpi-table td:last-child { border-bottom: none !important; }
  .nyhome-kpi-table td:before {
    content: attr(data-label);
    display: block;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: ${C.muted};
    margin-bottom: 6px;
  }
  .nyhome-kpi-table td:nth-child(1) { background: ${C.tableLabelBg} !important; font-weight: 700 !important; color: ${C.ink} !important; font-size: 15px !important; }
  .nyhome-kpi-table td:nth-child(2) { text-align: left !important; font-size: 22px !important; font-weight: 700 !important; color: ${C.accentDeep} !important; background: ${C.cardBg} !important; }
}
</style>`;

function calendarDateInTz(ms, timeZone) {
  if (ms == null || Number.isNaN(ms)) return '';
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
}

function normalizePartnerKeyDigest(key) {
  if (key === 'you') return 'kerv';
  if (key === 'partner') return 'peter';
  return String(key || '')
    .trim()
    .toLowerCase();
}

function rollupFlatListingEvents(flatRows) {
  let status = 0;
  let vote = 0;
  let kerv = 0;
  let peter = 0;
  let otherVotes = 0;
  const kervListingIds = new Set();
  const peterListingIds = new Set();
  const trans = new Map();
  flatRows.forEach((row) => {
    const type = String(row.ev.event_type || '');
    if (type === 'status') {
      status += 1;
      const fromS = row.ev.from_status ? normalizeStatus(row.ev.from_status) : 'start';
      const toS = normalizeStatus(row.ev.to_status || 'new');
      const k = `${fromS}→${toS}`;
      trans.set(k, (trans.get(k) || 0) + 1);
    } else if (type === 'vote') {
      vote += 1;
      const pk = normalizePartnerKeyDigest(row.ev.partner_key);
      const aptId = row.id;
      if (pk === 'kerv') {
        kerv += 1;
        if (aptId != null) kervListingIds.add(aptId);
      } else if (pk === 'peter') {
        peter += 1;
        if (aptId != null) peterListingIds.add(aptId);
      } else {
        otherVotes += 1;
      }
    }
  });
  return {
    status,
    vote,
    kerv,
    peter,
    otherVotes,
    kervListingsToday: kervListingIds.size,
    peterListingsToday: peterListingIds.size,
    trans,
    total: status + vote,
  };
}

function apartmentSheetMetrics(apartments, ymd, tz) {
  let listingsAddedToday = 0;
  let listingRowsSavedToday = 0;
  let existingListingsSavedToday = 0;
  (apartments || []).forEach((a) => {
    const c = parseTime(a.created_at);
    const u = parseTime(a.updated_at);
    if (c != null && calendarDateInTz(c, tz) === ymd) listingsAddedToday += 1;
    if (u != null && calendarDateInTz(u, tz) === ymd) {
      listingRowsSavedToday += 1;
      if (c == null || calendarDateInTz(c, tz) !== ymd) existingListingsSavedToday += 1;
    }
  });
  return { listingsAddedToday, listingRowsSavedToday, existingListingsSavedToday };
}

function dbListingEventRowToFlat(dbRow) {
  return {
    t: parseTime(dbRow.created_at),
    ev: {
      event_type: dbRow.event_type,
      from_status: dbRow.from_status,
      to_status: dbRow.to_status,
      partner_key: dbRow.partner_key,
      criterion_label: dbRow.criterion_label,
      score: dbRow.score,
    },
    title: dbRow.apartment_title || 'Listing',
    id: dbRow.apartment_id,
  };
}

function legacyFlatFromApartments(apartments, ymd, timeZone) {
  const rows = [];
  (apartments || []).forEach((apt) => {
    const title = apt.title || 'Listing';
    const id = apt.id;
    (apt.listing_events || []).forEach((ev) => {
      const t = parseTime(ev.created_at);
      if (t == null || calendarDateInTz(t, timeZone) !== ymd) return;
      rows.push({ t, ev, title, id });
    });
  });
  rows.sort((a, b) => b.t - a.t);
  return rows;
}

function humanizeTransitionKey(key) {
  const parts = String(key).split('→');
  if (parts.length !== 2) return key;
  const fromL = parts[0] === 'start' ? 'Start' : humanStatus(parts[0]);
  const toL = humanStatus(parts[1]);
  return `${fromL} → ${toL}`;
}

function buildTodayRollupHtml(rollup, aptMetrics, transitions) {
  const rows = [
    ['Status changes', String(rollup.status)],
    ['Score changes (any partner)', String(rollup.vote)],
    ['Kerv score changes', String(rollup.kerv)],
    ['Listings Kerv scored', String(rollup.kervListingsToday)],
    ['Peter score changes', String(rollup.peter)],
    ['Listings Peter scored', String(rollup.peterListingsToday)],
  ];
  if (rollup.otherVotes > 0) {
    rows.push(['Other score changes', String(rollup.otherVotes)]);
  }
  rows.push(['Total changes logged', String(rollup.total)]);
  rows.push(['New listings today', String(aptMetrics.listingsAddedToday)]);
  rows.push(['Existing listings updated today', String(aptMetrics.existingListingsSavedToday)]);
  rows.push(['Listings saved today (including new)', String(aptMetrics.listingRowsSavedToday)]);

  const summaryTable = `<table class="nyhome-kpi-table" role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 20px;border-collapse:collapse;font-size:14px;border-radius:12px;overflow:hidden;">
${rows
  .map(
    ([label, value]) =>
      `<tr>
<td data-label="Metric" style="padding:12px 14px;vertical-align:middle;border:1px solid ${C.tableBorder};background:${C.tableLabelBg};font-weight:600;color:${C.ink};width:62%;">${escapeHtml(label)}</td>
<td data-label="Count" style="padding:12px 14px;vertical-align:middle;border:1px solid ${C.tableBorder};background:${C.tableValueBg};font-weight:700;color:${C.accentDeep};text-align:center;width:38%;">${escapeHtml(value)}</td>
</tr>`
  )
  .join('')}
</table>`;

  if (transitions.length === 0) {
    const tail =
      rollup.total === 0
        ? `<p style="margin:0 0 16px;font-size:14px;color:${C.muted};line-height:1.55;">Quiet on the score-and-status front today—that happens. Saved listings still show up in the row counts above.</p>`
        : `<p style="margin:0 0 16px;font-size:14px;color:${C.muted};line-height:1.55;">No status hops today—maybe you were too busy actually seeing places (or sleeping).</p>`;
    return `${summaryTable}${tail}`;
  }

  const transRows = transitions
    .map(
      ([k, n]) =>
        `<tr>
<td data-label="Transition" style="padding:10px 12px;border:1px solid ${C.tableBorder};background:${C.cardBg};color:${C.ink};">${escapeHtml(humanizeTransitionKey(k))}</td>
<td data-label="Count" style="padding:10px 12px;border:1px solid ${C.tableBorder};background:${C.tableValueTint};font-weight:700;color:${C.accentDeep};text-align:center;width:88px;">${escapeHtml(String(n))}</td>
</tr>`
    )
    .join('');

  const transTable = `<h3 style="margin:0 0 8px;font-size:16px;font-family:Georgia,'Times New Roman',serif;font-weight:600;color:${C.ink};">${digestBadge('Sh', C.badgeShuffle, C.badgeShuffleFg)}Status shuffle (today)</h3>
<p style="margin:0 0 10px;font-size:14px;color:${C.muted};line-height:1.5;">Most popular moves—useful when you’re curious what got advanced.</p>
<table class="nyhome-kpi-table" role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 20px;border-collapse:collapse;font-size:14px;border-radius:12px;overflow:hidden;">
<thead><tr>
<th style="padding:10px 12px;text-align:left;font-size:10px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${C.tableHeadText};background:${C.tableHead};border-bottom:1px solid ${C.tableBorder};">Transition</th>
<th style="padding:10px 12px;text-align:center;font-size:10px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${C.tableHeadText};background:${C.tableHead};border-bottom:1px solid ${C.tableBorder};">Count</th>
</tr></thead>
<tbody>${transRows}</tbody>
</table>`;

  return `${summaryTable}${transTable}`;
}

function buildTodaySectionHtml({ apartments, listingEventsToday, digestBounds, nowMs, timeZone }) {
  const ymd = digestBounds && digestBounds.ymdET ? digestBounds.ymdET : calendarDateInTz(nowMs, timeZone);
  let flat;
  if (listingEventsToday != null) {
    flat = listingEventsToday.map(dbListingEventRowToFlat).filter((r) => r.t != null);
    flat.sort((a, b) => b.t - a.t);
  } else {
    flat = legacyFlatFromApartments(apartments, ymd, timeZone);
  }
  const rollup = rollupFlatListingEvents(flat);
  const aptMetrics = apartmentSheetMetrics(apartments, ymd, timeZone);
  const transitions = [...rollup.trans.entries()].sort((a, b) => b[1] - a[1]).slice(0, TODAY_TRANSITION_CAP);
  const rollupHtml = buildTodayRollupHtml(rollup, aptMetrics, transitions);
  return { html: rollupHtml, rollup };
}

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[ch]);
}

function normalizeBaseUrl(raw) {
  const t = String(raw == null ? '' : raw).trim();
  if (!t) return '';
  return t.replace(/\/+$/, '');
}

function detailHref(baseUrl, id) {
  const base = normalizeBaseUrl(baseUrl);
  const path = `/details/?id=${encodeURIComponent(id)}`;
  if (!base) return path;
  return `${base}${path}`;
}

/**
 * Star (desc) → workflow / status (desc) → combined score (desc, nulls last) → updated_at.
 */
function compareTopTen(a, b) {
  const sa = listingStarTier(a);
  const sb = listingStarTier(b);
  if (sb !== sa) return sb - sa;
  const ia = statusIndex(a.status);
  const ib = statusIndex(b.status);
  if (ib !== ia) return ib - ia;
  const ca = a.scores && a.scores.combined != null ? Number(a.scores.combined) : null;
  const cb = b.scores && b.scores.combined != null ? Number(b.scores.combined) : null;
  if (ca != null && cb != null) {
    if (cb !== ca) return cb - ca;
  } else if (ca != null && cb == null) return -1;
  else if (ca == null && cb != null) return 1;
  const ua = parseTime(a.updated_at) || 0;
  const ub = parseTime(b.updated_at) || 0;
  return ub - ua;
}

function isActiveHunt(apt) {
  const s = normalizeStatus(apt.status);
  return !TERMINAL_EXCLUDE.has(s) && s !== SIGNED;
}

function inTopPool(apt) {
  return !TOP_POOL_EXCLUDE.has(normalizeStatus(apt.status));
}

const EARLY_STATUSES = new Set(['new', 'evaluating', 'shortlisted']);
const TOUR_FLOW_STATUSES = new Set(['tour_scheduled', 'toured']);
const LATE_STAGE_STATUSES = new Set(['finalist', 'applying', 'applied', 'approved', 'lease_review']);

function buildPulseMetrics(activeHuntList, now, opts) {
  const msDay = 86400000;
  let starred = 0;
  let combinedSum = 0;
  let combinedN = 0;
  let early = 0;
  let tourFlow = 0;
  let late = 0;
  let tours7d = 0;
  let deadlines7d = 0;

  activeHuntList.forEach((a) => {
    if (listingStarTier(a) > 0) starred += 1;
    const c = a.scores && a.scores.combined != null ? Number(a.scores.combined) : null;
    if (c != null && !Number.isNaN(c)) {
      combinedSum += c;
      combinedN += 1;
    }
    const s = normalizeStatus(a.status);
    if (EARLY_STATUSES.has(s)) early += 1;
    else if (TOUR_FLOW_STATUSES.has(s)) tourFlow += 1;
    else if (LATE_STAGE_STATUSES.has(s)) late += 1;

    const v = a.next_visit && a.next_visit.visit_at ? parseTime(a.next_visit.visit_at) : null;
    if (v != null && v >= now && v <= now + 7 * msDay) tours7d += 1;

    const d = a.application && a.application.deadline_at ? parseTime(a.application.deadline_at) : null;
    if (d != null && (d < now || (d >= now && d <= now + opts.deadlineDays * msDay))) deadlines7d += 1;
  });

  return {
    starred,
    avgCombined: combinedN ? Math.round(combinedSum / combinedN) : null,
    scoredCount: combinedN,
    early,
    tourFlow,
    late,
    tours7d,
    deadlines7d,
  };
}

function pulseVoiceLine(metrics, activeCount, flagged) {
  if (activeCount === 0) {
    return 'Pipeline’s taking a nap—either you’re recharging or the city owes you fresh listings. Both are valid.';
  }
  const bits = [];
  if (flagged > 0) {
    bits.push(
      `<strong>${flagged}</strong> spot${flagged === 1 ? '' : 's'} are waving little flags (deadlines, tours, dusty statuses)—nothing dramatic, just a nudge.`
    );
  }
  if (metrics.late >= metrics.early && metrics.late > 0) {
    bits.push('You’re <strong>deep in the funnel</strong>—shortlists, paperwork, and “did we remember the guarantor?” energy.');
  } else if (metrics.early > metrics.late && metrics.early >= metrics.tourFlow) {
    bits.push('Still lots of <strong>discovery joy</strong>—totally normal when you just fed the beast new addresses.');
  }
  if (metrics.tourFlow > 0 && metrics.tourFlow >= metrics.late) {
    bits.push('<strong>Tours are live</strong>—keep those notes honest so Future You isn’t guessing what you thought of the closets.');
  }
  if (metrics.tours7d > 0) {
    bits.push(`<strong>${metrics.tours7d}</strong> tour date${metrics.tours7d === 1 ? '' : 's'} on deck this week—charge the phone, grab water.`);
  }
  if (metrics.deadlines7d > 0) {
    bits.push(
      `<strong>${metrics.deadlines7d}</strong> app deadline${metrics.deadlines7d === 1 ? '' : 's'} are tapping their watch. Fees love surprises—you don’t.`
    );
  }
  if (bits.length === 0) {
    bits.push('Numbers look mellow—good day to tighten scores, nudge statuses, and feel smug about being organized.');
  }
  return bits.slice(0, 4).join(' ');
}

function collectAttention(apt, now, opts) {
  const reasons = [];
  let suggest = '';
  const st = normalizeStatus(apt.status);
  if (TERMINAL_EXCLUDE.has(st)) return null;

  const app = apt.application || null;
  const visit = apt.next_visit || null;
  const deadlineMs = app && app.deadline_at ? parseTime(app.deadline_at) : null;
  if (deadlineMs != null) {
    const days = (deadlineMs - now) / (86400000);
    if (deadlineMs < now) {
      reasons.push('Application deadline passed');
      suggest = 'Update the listing or mark it withdrawn.';
    } else if (days <= opts.deadlineDays) {
      reasons.push(`Application deadline in ${Math.max(1, Math.ceil(days))} day(s)`);
      suggest = 'Confirm materials and fees before the date.';
    }
  }

  const visitMs = visit && visit.visit_at ? parseTime(visit.visit_at) : null;
  if (visitMs != null) {
    const hoursTo = (visitMs - now) / 3600000;
    const noteTrim = visit.notes ? String(visit.notes).trim() : '';
    if (hoursTo >= 0 && hoursTo <= opts.tourHours && !noteTrim) {
      reasons.push(`Tour within ${opts.tourHours}h with no visit notes`);
      suggest = 'Add a few tour notes.';
    }
    if (st === 'tour_scheduled' && hoursTo < -opts.staleTourScheduledHoursAfter) {
      reasons.push('Tour date passed; still marked tour scheduled');
      suggest = 'Mark as toured or pick a new date.';
    }
  }

  if (st === 'evaluating') {
    const up = parseTime(apt.updated_at);
    if (up != null && now - up > opts.stuckEvaluatingDays * 86400000) {
      reasons.push(`In evaluating for ${opts.stuckEvaluatingDays}+ days`);
      suggest = 'Shortlist, drop, or book a tour.';
    }
  }

  if (POST_SHORTLIST_SCORE_STATUSES.has(st)) {
    const comb = apt.scores && apt.scores.combined != null ? Number(apt.scores.combined) : null;
    if (comb == null || Number.isNaN(comb)) {
      reasons.push('No combined score yet at a late stage');
      suggest = 'Finish the scorecard for this listing.';
    }
  }

  if (reasons.length === 0) return null;
  return { apartment: apt, reasons, suggest };
}

function buildEmailHtml({
  apartments,
  publicBaseUrl,
  now = Date.now(),
  attentionOpts = DEFAULT_ATTENTION,
  listingEventsToday = null,
  digestBounds = null,
}) {
  const base = normalizeBaseUrl(publicBaseUrl);
  const activeHuntList = (apartments || []).filter(isActiveHunt);
  const activeCount = activeHuntList.length;
  const signedWins = (apartments || []).filter((a) => normalizeStatus(a.status) === SIGNED);

  const attentionRaw = activeHuntList.map((a) => collectAttention(a, now, attentionOpts)).filter(Boolean);
  const attentionList = dedupeAttention(attentionRaw);
  const pulseNeeds = attentionList.length;

  const topPool = activeHuntList.filter(inTopPool).sort(compareTopTen).slice(0, 10);

  const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'America/New_York' });
  const dayStr = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'America/New_York',
  });
  const dt = new Date(now);
  const headerDate = `${weekday.format(dt)}, ${dayStr.format(dt)}`;

  const pulseMetrics = buildPulseMetrics(activeHuntList, now, attentionOpts);
  const pulseNarrative = pulseVoiceLine(pulseMetrics, activeCount, pulseNeeds);

  const kpiRows = [
    ['Active listings', String(activeCount)],
    ['Flagged for you', String(pulseNeeds)],
    ['Starred', String(pulseMetrics.starred)],
    ['Average score', pulseMetrics.avgCombined != null ? `${pulseMetrics.avgCombined}%` : '—'],
    ['Early (new / evaluating / shortlist)', String(pulseMetrics.early)],
    ['Tours (scheduled or done)', String(pulseMetrics.tourFlow)],
    ['Late stage (finalist+)', String(pulseMetrics.late)],
    ['Tours in the next 7 days', String(pulseMetrics.tours7d)],
    ['Application deadlines (due or soon)', String(pulseMetrics.deadlines7d)],
  ];

  const kpiTableHtml = `<table class="nyhome-kpi-table" role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0;border-collapse:collapse;font-size:14px;border-radius:12px;overflow:hidden;">
${kpiRows
  .map(
    ([label, value]) =>
      `<tr>
<td data-label="Metric" style="padding:12px 14px;vertical-align:middle;border:1px solid ${C.tableBorder};background:${C.tableLabelBg};font-weight:600;color:${C.ink};width:62%;">${escapeHtml(label)}</td>
<td data-label="Count" style="padding:12px 14px;vertical-align:middle;border:1px solid ${C.tableBorder};background:${C.tableValueBg};font-weight:700;color:${C.accentDeep};width:38%;text-align:center;">${escapeHtml(value)}</td>
</tr>`
  )
  .join('')}
</table>`;

  const needsBlock =
    attentionList.length === 0
      ? `<p style="margin:12px 0;color:${C.muted};font-size:15px;">All clear—your future selves get a high five.</p>`
      : `<ul style="margin:8px 0;padding-left:20px;line-height:1.55;color:${C.ink};">
${attentionList
  .map(
    (row) => `<li style="margin:12px 0;"><strong style="color:${C.accentDeep};">${escapeHtml(row.apartment.title || 'Listing')}</strong> — ${escapeHtml(
      row.reasons.join('; ')
    )}<br><span style="color:${C.muted};font-size:14px;">Next up: ${escapeHtml(row.suggest)}</span>${
      row.apartment.id != null && base
        ? `<br><a href="${escapeHtml(detailHref(base, row.apartment.id))}" style="color:${C.link};font-weight:600;">Open listing</a>`
        : ''
    }</li>`
  )
  .join('\n')}
</ul>`;

  const topBlock =
    topPool.length === 0
      ? `<p style="margin:12px 0;color:${C.muted};">No contenders in this bracket right now—could mean you’re picky (good) or everything's paused (also fine).</p>`
      : `<ol style="margin:8px 0;padding-left:20px;line-height:1.6;color:${C.ink};">
${topPool
  .map((a) => {
    const comb = a.scores && a.scores.combined != null ? `${Math.round(Number(a.scores.combined))}% avg` : 'Avg TBD';
    const star = listingStarTier(a);
    const starLabel = star === 3 ? 'Star: both' : star === 2 ? 'Star: Kerv' : star === 1 ? 'Star: Peter' : '';
    const rent = formatMoneyCents(a.rent_cents);
    const link =
      a.id != null && base
        ? `<a href="${escapeHtml(detailHref(base, a.id))}" style="color:${C.link};font-weight:600;">Details</a>`
        : '';
    return `<li style="margin:14px 0;"><strong style="color:${C.accentDeep};">${escapeHtml(a.title || 'Listing')}</strong> — ${escapeHtml(
      a.neighborhood || '—'
    )} · ${escapeHtml(humanStatus(a.status))} · ${escapeHtml(comb)}${
      starLabel ? ` · ${escapeHtml(starLabel)}` : ''
    }${rent ? ` · ${escapeHtml(rent)}` : ''}${link ? ` · ${link}` : ''}</li>`;
  })
  .join('\n')}
</ol>`;

  const winsBlock =
    signedWins.length === 0
      ? ''
      : `${digestH2(digestBadge('Kt', C.badgeKey, C.badgeKeyFg), 'Keys in the door', 28)}
<p style="margin:0 0 10px;color:${C.muted};line-height:1.55;font-size:15px;">You actually did the thing. Celebrate, then file the lease somewhere you’ll find it.</p>
<ul style="margin:8px 0;padding-left:20px;line-height:1.55;color:${C.ink};">
${signedWins
  .map(
    (a) =>
      `<li style="margin:8px 0;"><strong>${escapeHtml(a.title || 'Listing')}</strong>${a.id != null && base ? ` — <a href="${escapeHtml(detailHref(base, a.id))}" style="color:${C.link};font-weight:600;">Peek again</a>` : ''}</li>`
  )
  .join('')}
</ul>`;

  const baseHint = !base
    ? `<p style="margin:0 0 18px;padding:14px 16px;background:linear-gradient(135deg,${C.wash} 0%,${C.wash2} 100%);border:1px solid ${C.tableBorder};border-radius:12px;font-size:14px;color:${C.accentDeep};line-height:1.5;">Almost there—pop your live site URL into <strong>Admin → Settings</strong> so the links in this letter actually go somewhere warm.</p>`
    : '';

  const todaySection = buildTodaySectionHtml({
    apartments,
    listingEventsToday,
    digestBounds,
    nowMs: now,
    timeZone: DIGEST_TZ,
  });
  const todayActivityInner = todaySection.html;
  const todayRollup = todaySection.rollup;

  const heroHtml = `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 8px;border-radius:16px;background:${C.heroGradient};border:1px solid ${C.cardBorder};">
<tr><td style="padding:22px 22px;">
<table role="presentation" cellspacing="0" cellpadding="0"><tr>
<td style="vertical-align:middle;padding-right:14px;">${digestBadge('NY', C.heroBadgeBg, C.heroBadgeFg)}</td>
<td style="vertical-align:middle;">
<p style="margin:0 0 2px;font-size:11px;color:${C.muted};text-transform:uppercase;letter-spacing:0.14em;">NYHome</p>
<h1 style="margin:0;font-size:24px;line-height:1.2;font-family:Georgia,'Times New Roman',serif;color:${C.ink};font-weight:600;">Your hunt, in one glance</h1>
<p style="margin:8px 0 0;font-size:15px;color:${C.muted};line-height:1.45;"><strong style="color:${C.accentDeep};">${escapeHtml(headerDate)}</strong> · New York time</p>
</td>
</tr></table>
</td></tr></table>`;

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">${DIGEST_EMAIL_HEAD_INNER}</head>
<body style="margin:0;padding:28px 16px;background:${C.pageBg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:${C.ink};-webkit-text-size-adjust:100%;">
<div class="nyhome-shell" style="max-width:640px;margin:0 auto;background:${C.cardBg};border-radius:16px;padding:28px 24px;border:1px solid ${C.cardBorder};box-shadow:0 4px 28px ${C.cardShadow};">
${baseHint}
${heroHtml}
<p style="margin:0 0 22px;color:${C.ink};font-size:16px;line-height:1.65;">Hi Peter &amp; Kerv — your <em style="font-style:italic;color:${C.accent};">quietly electric</em> briefing: what moved today, polite nudges, and the ten listings out in front (<strong>stars</strong>, then <strong>stage</strong>, then <strong>average score</strong>). Fewer group chats, same facts.</p>

${digestH2(digestBadge('Td', C.badgeToday, C.badgeTodayFg), 'Today', 4)}
<p style="margin:0 0 12px;font-size:15px;color:${C.muted};line-height:1.55;">The tally for <strong>${escapeHtml(headerDate)}</strong>. Score rows only appear when a slider actually moved.</p>
${todayActivityInner}

${digestH2(digestBadge('Pu', C.badgePulse, C.badgePulseFg), 'Pulse')}
<p style="margin:0 0 14px;font-size:15px;color:${C.ink};line-height:1.6;">${pulseNarrative}</p>
${kpiTableHtml}

${digestH2(digestBadge('Nt', C.badgeBell, C.badgeBellFg), 'Needs attention')}
<p style="margin:0 0 12px;font-size:15px;color:${C.muted};line-height:1.55;">Soft reminders—not a grade on your taste.</p>
${needsBlock}

${digestH2(digestBadge('10', C.badgeStar, C.badgeStarFg), 'Top ten')}
<p style="margin:0 0 12px;font-size:15px;color:${C.muted};line-height:1.55;">Stars first, then pipeline depth, then who’s scoring highest. A short list usually means you’re choosy (a feature).</p>
${topBlock}

${digestH2(digestBadge('Wk', C.badgeWeek, C.badgeWeekFg), 'This week')}
<ul style="margin:8px 0;padding-left:20px;line-height:1.6;color:${C.ink};">
<li>Tour math: lock times and schleps for anything in <strong>tour scheduled</strong> or <strong>toured</strong>.</li>
<li>Past <strong>finalist</strong>, re-read fees, broker quirks, and guarantor paths before the clock wins.</li>
<li>Tidy scorecards so averages tell the truth.</li>
<li>Crown a top three you’d happily sign for—plus backups, because New York loves plot twists.</li>
</ul>

${winsBlock}

<p style="margin:32px 0 0;padding-top:20px;border-top:1px solid ${C.tableBorder};font-size:14px;color:${C.muted};line-height:1.55;">Piped straight from NYHome the moment someone hit send. Refresh the app anytime—we’ll match like good roommates.</p>
</div>
</body></html>`;

  return {
    html,
    subject: `NYHome — ${headerDate}`,
    meta: {
      activeCount,
      attentionCount: pulseNeeds,
      topCount: topPool.length,
      loggedActionsToday: todayRollup.total,
      statusEventsToday: todayRollup.status,
      voteEventsToday: todayRollup.vote,
      kervVotesToday: todayRollup.kerv,
      peterVotesToday: todayRollup.peter,
      kervListingsToday: todayRollup.kervListingsToday,
      peterListingsToday: todayRollup.peterListingsToday,
    },
  };
}

function dedupeAttention(rows) {
  const byId = new Map();
  rows.forEach((row) => {
    const id = row.apartment.id;
    const key = id != null ? String(id) : row.apartment.title || Math.random();
    const prev = byId.get(key);
    if (!prev) {
      byId.set(key, { ...row, reasons: [...row.reasons] });
      return;
    }
    const reasons = new Set([...prev.reasons, ...row.reasons]);
    byId.set(key, {
      apartment: row.apartment,
      reasons: [...reasons],
      suggest: row.suggest || prev.suggest,
    });
  });
  return [...byId.values()];
}

module.exports = {
  buildEmailHtml,
  normalizeBaseUrl,
  detailHref,
  DEFAULT_ATTENTION,
  TERMINAL_EXCLUDE,
  TOP_POOL_EXCLUDE,
};
