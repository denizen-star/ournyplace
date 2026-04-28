const { normalizeStatus } = require('./apartmentStatus');
const {
  rollupFlatListingEvents,
  apartmentSheetMetrics,
  dbListingEventRowToFlat,
  buildPulseMetrics,
  collectAttention,
  dedupeAttention,
  calendarDateInTz,
  humanizeTransitionKey,
  humanStatus,
  isActiveHunt,
  DEFAULT_ATTENTION,
} = require('./pipelineDigest');

const ANALYTICS_TZ = 'America/New_York';

/** Number of Eastern calendar days to include in the activity log window. */
const ACTIVITY_LOG_DAYS = 14;

/** Maximum total event rows returned; excess is noted as "older history in DB only". */
const ACTIVITY_ROW_CAP = 2000;

/** Statuses excluded from the "least voted listings" view. */
const VOTED_EXCLUDE = new Set(['rejected', 'blacklisted', 'archived', 'signed']);

/** Max rows in the least-voted table. */
const LEAST_VOTED_LIMIT = 15;

/** Format an epoch ms as a 12-hour clock time string in the given timezone (e.g. "3:47 PM"). */
function formatTimeInTz(ms, timeZone) {
  if (!ms) return '';
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone,
  }).format(new Date(ms));
}

/**
 * Build a one-line human summary for a flat event `ev` object.
 *   status event → "Evaluating → Shortlisted"
 *   vote event   → "Kerv: Natural light = 4"  /  "Peter: Location = N/A"
 */
function buildEventSummary(ev) {
  const type = String(ev.event_type || '');
  if (type === 'status') {
    const from = ev.from_status ? humanStatus(ev.from_status) : 'Start';
    const to = humanStatus(ev.to_status || 'new');
    return `${from} → ${to}`;
  }
  if (type === 'vote') {
    const pk = ev.partner_key ? String(ev.partner_key) : 'Unknown';
    const partner = pk.charAt(0).toUpperCase() + pk.slice(1);
    const criterion = ev.criterion_label || 'Criterion';
    const scoreStr = ev.score == null ? 'N/A' : String(ev.score);
    return `${partner}: ${criterion} = ${scoreStr}`;
  }
  return type || 'event';
}

/**
 * Group an array of flat rows `{ t, ev, title, id }` by Eastern calendar day.
 * Returns `[{ ymd, label, count, events }]` sorted newest-day-first.
 * Events within each day are sorted newest-first.
 */
function groupListingEventsByEasternDay(flatRows, timeZone) {
  const dayMap = new Map();
  flatRows.forEach((row) => {
    const t = row.t;
    if (t == null) return;
    const ymd = calendarDateInTz(t, timeZone);
    if (!dayMap.has(ymd)) dayMap.set(ymd, []);
    dayMap.get(ymd).push(row);
  });

  const days = [];
  dayMap.forEach((events, ymd) => {
    events.sort((a, b) => (b.t || 0) - (a.t || 0));
    // Build a display label like "Mon Apr 27, 2026" from the YYYY-MM-DD string.
    const [Y, M, D] = ymd.split('-').map(Number);
    const label = new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(Date.UTC(Y, M - 1, D)));
    days.push({ ymd, label, count: events.length, events });
  });

  days.sort((a, b) => b.ymd.localeCompare(a.ymd));
  return days;
}

/**
 * Listings (active hunt only) sorted by fewest total numeric votes combined.
 * Helps surface listings where Peter or Kerv hasn't scored many criteria yet.
 */
function buildLeastVotedListings(apartments, criteria) {
  const total = criteria.length;
  if (total === 0) return [];

  const rows = apartments
    .filter((apt) => !VOTED_EXCLUDE.has(String(apt.status || '').toLowerCase()))
    .map((apt) => {
      const r = apt.ratings || {};
      const kr = r.kerv || {};
      const pr = r.peter || {};
      const kervVoted = criteria.filter((c) => kr[c.id] != null).length;
      const peterVoted = criteria.filter((c) => pr[c.id] != null).length;
      return {
        id: apt.id,
        title: apt.title || apt.address || String(apt.id),
        status: apt.status || 'new',
        kervVoted,
        peterVoted,
        total,
      };
    });

  rows.sort((a, b) => {
    const diff = (a.kervVoted + a.peterVoted) - (b.kervVoted + b.peterVoted);
    return diff !== 0 ? diff : String(a.title).localeCompare(String(b.title));
  });

  return rows.slice(0, LEAST_VOTED_LIMIT);
}

/**
 * Per-criterion rating stats across all apartments.
 * Returns criteria sorted highest → lowest by combined average.
 * Each entry carries `kervDist` / `peterDist` — int arrays [count_at_0 .. count_at_5].
 */
function buildCriterionStats(apartments, criteria) {
  if (!criteria.length) return [];

  const statsMap = {};
  criteria.forEach((c) => {
    statsMap[c.id] = {
      id: c.id,
      label: c.label,
      weight: Number(c.weight) || 1,
      kerv: { sum: 0, count: 0, dist: [0, 0, 0, 0, 0, 0] },
      peter: { sum: 0, count: 0, dist: [0, 0, 0, 0, 0, 0] },
    };
  });

  apartments.forEach((apt) => {
    const r = apt.ratings || {};
    ['kerv', 'peter'].forEach((partner) => {
      const pr = r[partner] || {};
      criteria.forEach((c) => {
        if (!statsMap[c.id]) return;
        const score = pr[c.id];
        if (score == null) return; // null = N/A; undefined = not voted — skip both
        const n = Number(score);
        if (!Number.isFinite(n)) return;
        const s = statsMap[c.id][partner];
        s.sum += n;
        s.count++;
        s.dist[Math.min(5, Math.max(0, Math.round(n)))]++;
      });
    });
  });

  let grandTotal = 0;
  criteria.forEach((c) => {
    const s = statsMap[c.id];
    if (s) grandTotal += s.kerv.count + s.peter.count;
  });

  const result = criteria.map((c) => {
    const s = statsMap[c.id];
    if (!s) return null;
    const kervAvg = s.kerv.count > 0 ? Math.round((s.kerv.sum / s.kerv.count) * 10) / 10 : null;
    const peterAvg = s.peter.count > 0 ? Math.round((s.peter.sum / s.peter.count) * 10) / 10 : null;
    const combinedAvg =
      kervAvg != null && peterAvg != null
        ? Math.round(((kervAvg + peterAvg) / 2) * 10) / 10
        : (kervAvg ?? peterAvg);
    const bothCount = s.kerv.count + s.peter.count;
    return {
      id: s.id,
      label: s.label,
      weight: s.weight,
      kervAvg,
      peterAvg,
      combinedAvg,
      kervCount: s.kerv.count,
      peterCount: s.peter.count,
      bothCount,
      kervDist: s.kerv.dist.slice(),
      peterDist: s.peter.dist.slice(),
      pctOfTotal: grandTotal > 0 ? Math.round((bothCount / grandTotal) * 100) : 0,
    };
  }).filter(Boolean);

  result.sort((a, b) => ((b.combinedAvg ?? -1) - (a.combinedAvg ?? -1)));
  return result;
}

/**
 * Build the complete analytics JSON payload.
 *
 * @param {object} opts
 * @param {Array}  opts.apartments        - full apartment list (from getApartmentPayload)
 * @param {Array}  opts.criteria          - active criteria rows (from getApartmentPayload)
 * @param {Array}  opts.listingEventsRows - DB rows from fetchListingEventsBetweenCreatedAt
 * @param {object} opts.digestBounds      - Eastern day bounds from boundsForInstantInTz
 * @param {number} [opts.now]             - epoch ms (defaults to Date.now())
 * @param {object} [opts.attentionOpts]   - overrides for DEFAULT_ATTENTION heuristics
 *
 * @returns {{ pulse, todayRollup, transitions, activityByDay, capped, leastVotedListings, criterionStats }}
 */
function buildAnalyticsPayload({
  apartments,
  criteria = [],
  listingEventsRows,
  digestBounds,
  now = Date.now(),
  attentionOpts = DEFAULT_ATTENTION,
}) {
  const timeZone = ANALYTICS_TZ;
  const ymd =
    digestBounds && digestBounds.ymdET
      ? digestBounds.ymdET
      : calendarDateInTz(now, timeZone);

  // ── Pulse ──────────────────────────────────────────────────────────────────
  const activeHuntList = (apartments || []).filter(isActiveHunt);
  const activeCount = activeHuntList.length;
  const pulseMetrics = buildPulseMetrics(activeHuntList, now, attentionOpts);
  const attentionRaw = activeHuntList
    .map((a) => collectAttention(a, now, attentionOpts))
    .filter(Boolean);
  const attention = dedupeAttention(attentionRaw);
  const signedCount = (apartments || []).filter(
    (a) => normalizeStatus(a.status) === 'signed'
  ).length;

  const pulse = {
    activeCount,
    attentionCount: attention.length,
    starred: pulseMetrics.starred,
    avgCombined: pulseMetrics.avgCombined,
    scoredCount: pulseMetrics.scoredCount,
    early: pulseMetrics.early,
    tourFlow: pulseMetrics.tourFlow,
    late: pulseMetrics.late,
    tours7d: pulseMetrics.tours7d,
    deadlines7d: pulseMetrics.deadlines7d,
    signedCount,
    attention: attention.map((row) => ({
      id: row.apartment.id,
      title: row.apartment.title || 'Listing',
      reasons: row.reasons,
      suggest: row.suggest,
    })),
  };

  // ── Today rollup (events that fall on today's Eastern date) ───────────────
  const allFlat = (listingEventsRows || [])
    .map(dbListingEventRowToFlat)
    .filter((r) => r.t != null);

  const todayFlat = allFlat.filter(
    (r) => calendarDateInTz(r.t, timeZone) === ymd
  );
  todayFlat.sort((a, b) => b.t - a.t);

  const rollup = rollupFlatListingEvents(todayFlat);
  const aptMetrics = apartmentSheetMetrics(apartments, ymd, timeZone);

  const todayRollup = {
    ymd,
    status: rollup.status,
    vote: rollup.vote,
    kerv: rollup.kerv,
    peter: rollup.peter,
    otherVotes: rollup.otherVotes,
    kervListingsToday: rollup.kervListingsToday,
    peterListingsToday: rollup.peterListingsToday,
    total: rollup.total,
    listingsAddedToday: aptMetrics.listingsAddedToday,
    listingRowsSavedToday: aptMetrics.listingRowsSavedToday,
    existingListingsSavedToday: aptMetrics.existingListingsSavedToday,
  };

  // ── Status transitions (from today's events only) ────────────────────────
  const transitions = [...rollup.trans.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([key, count]) => ({ key, label: humanizeTransitionKey(key), count }));

  // ── Activity by day (full multi-day window, row-capped) ───────────────────
  const capped = allFlat.length > ACTIVITY_ROW_CAP;
  const cappedFlat = capped ? allFlat.slice(0, ACTIVITY_ROW_CAP) : allFlat;

  const rawDays = groupListingEventsByEasternDay(cappedFlat, timeZone);

  const activityByDay = rawDays.map((day) => ({
    ymd: day.ymd,
    label: day.label,
    count: day.count,
    events: day.events.map((row) => ({
      t: row.t,
      timeLabel: formatTimeInTz(row.t, timeZone),
      eventType: row.ev.event_type,
      fromStatus: row.ev.from_status || null,
      toStatus: row.ev.to_status || null,
      partnerKey: row.ev.partner_key || null,
      criterionLabel: row.ev.criterion_label || null,
      score: row.ev.score !== undefined ? row.ev.score : null,
      title: row.title,
      id: row.id,
      summary: buildEventSummary(row.ev),
    })),
  }));

  // ── Scoring completeness + criteria distribution ──────────────────────────
  const leastVotedListings = buildLeastVotedListings(apartments || [], criteria);
  const criterionStats = buildCriterionStats(apartments || [], criteria);

  return { pulse, todayRollup, transitions, activityByDay, capped, leastVotedListings, criterionStats };
}

module.exports = {
  buildAnalyticsPayload,
  groupListingEventsByEasternDay,
  buildLeastVotedListings,
  buildCriterionStats,
  ACTIVITY_LOG_DAYS,
  ACTIVITY_ROW_CAP,
  ANALYTICS_TZ,
};
