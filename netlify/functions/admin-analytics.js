const { getApartmentPayload, fetchListingEventsBetweenCreatedAt } = require('../../lib/apartmentRepository');
const { boundsForInstantInTz, ymdInTz, startMsOfYmdInTz } = require('../../lib/etDayBounds');
const { buildAnalyticsPayload, ANALYTICS_TZ } = require('../../lib/adminAnalytics');
const { json } = require('../../lib/http');

// Number of calendar days to load for each period key.
const PERIOD_DAYS = { today: 1, yesterday: 1, '7d': 7, '30d': 30, all: 90 };

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return json(405, { error: 'Method not allowed' });
  }

  const params = event.queryStringParameters || {};
  const period = PERIOD_DAYS[params.period] !== undefined ? params.period : 'today';
  const isYesterday = period === 'yesterday';
  const days = PERIOD_DAYS[period];

  const now = Date.now();
  const todayBounds = boundsForInstantInTz(now, ANALYTICS_TZ);

  let rangeStartMs, rangeEndMs, digestBounds;
  if (isYesterday) {
    // yesterday's bounds = [start of yesterday, start of today)
    const yesterdayBounds = boundsForInstantInTz(todayBounds.startMs - 1, ANALYTICS_TZ);
    rangeStartMs = yesterdayBounds.startMs;
    rangeEndMs = todayBounds.startMs;
    digestBounds = yesterdayBounds;
  } else {
    // Walk back (days - 1) calendar days from today for the window start.
    const [Y, M, D] = todayBounds.ymdET.split('-').map(Number);
    const oldUtcMs = Date.UTC(Y, M - 1, D - (days - 1));
    const rangeStartYmd = ymdInTz(oldUtcMs, ANALYTICS_TZ);
    rangeStartMs = startMsOfYmdInTz(rangeStartYmd, ANALYTICS_TZ);
    rangeEndMs = todayBounds.endExclusiveMs;
    digestBounds = todayBounds;
  }

  let apartments = [];
  let criteria = [];
  let listingEventsRows = [];

  try {
    const payload = await getApartmentPayload();
    apartments = payload.apartments || [];
    criteria = payload.criteria || [];
  } catch (e) {
    console.error('[admin-analytics] getApartmentPayload', e);
    return json(500, { error: 'Could not load apartments' });
  }

  try {
    listingEventsRows = await fetchListingEventsBetweenCreatedAt(
      new Date(rangeStartMs),
      new Date(rangeEndMs)
    );
  } catch (e) {
    console.error('[admin-analytics] fetchListingEventsBetweenCreatedAt', e);
    listingEventsRows = [];
  }

  const analytics = buildAnalyticsPayload({
    apartments,
    criteria,
    listingEventsRows,
    digestBounds,
    now,
  });

  return json(200, { ...analytics, period });
};
