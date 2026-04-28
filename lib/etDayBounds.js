/**
 * Calendar-day bounds in a named IANA timezone (digest uses America/New_York).
 * Used for SQL ranges on `created_at` without relying on MySQL session TZ.
 */

function ymdInTz(ms, timeZone) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(ms));
}

/** First instant where `timeZone` wall-clock date is `ymd` (YYYY-MM-DD). */
function startMsOfYmdInTz(ymd, timeZone) {
  const [Y, M, D] = ymd.split('-').map(Number);
  let lo = Date.UTC(Y, M - 1, D - 1, 4, 0, 0);
  let hi = Date.UTC(Y, M - 1, D + 1, 4, 0, 0);
  while (lo < hi - 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (ymdInTz(mid, timeZone) < ymd) lo = mid;
    else hi = mid;
  }
  return hi;
}

/** First instant after `ymd` in `timeZone` (end-exclusive for SQL `< end`). */
function endExclusiveMsOfYmdInTz(ymd, timeZone) {
  const start = startMsOfYmdInTz(ymd, timeZone);
  let lo = start;
  let hi = start + 48 * 3600000;
  while (lo < hi - 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (ymdInTz(mid, timeZone) === ymd) lo = mid;
    else hi = mid;
  }
  return hi;
}

function boundsForInstantInTz(nowMs, timeZone) {
  const ymd = ymdInTz(nowMs, timeZone);
  return {
    ymdET: ymd,
    startMs: startMsOfYmdInTz(ymd, timeZone),
    endExclusiveMs: endExclusiveMsOfYmdInTz(ymd, timeZone),
  };
}

module.exports = {
  ymdInTz,
  startMsOfYmdInTz,
  endExclusiveMsOfYmdInTz,
  boundsForInstantInTz,
};
