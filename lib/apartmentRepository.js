const { execute, insert } = require('./db');
const { normalizeStatus, STATUS_ORDER } = require('./apartmentStatus');
const { normalizeBuildingKey, normalizeListingKey } = require('./addressNormalize');
const { findByNormalizedKey, upsertBlacklistFromApartment } = require('./buildingBlacklistRepository');

const PARTNERS = ['kerv', 'peter'];

/** Inline data URLs are multi‑MB each; bulk GET must stay under Netlify’s ~6MB function response cap. */
function sanitizeImageUrlsForListPayload(rows) {
  if (!rows || !rows.length) return rows;
  return rows.map((row) => {
    const u = row.image_url;
    if (u != null && typeof u === 'string' && u.startsWith('data:')) {
      return { ...row, image_url: null };
    }
    return row;
  });
}

async function getApartmentPayload() {
  const [{ rows: apartments }, { rows: criteria }, { rows: neighborhoods }] = await Promise.all([
    execute(
      `SELECT * FROM nyp_apartments
       ORDER BY FIELD(status, ${STATUS_ORDER.map(() => '?').join(',')}), updated_at DESC`,
      STATUS_ORDER
    ),
    execute(`SELECT * FROM nyp_criteria WHERE active = TRUE ORDER BY sort_order ASC, id ASC`),
    execute(`SELECT * FROM nyp_neighborhoods WHERE active = TRUE ORDER BY sort_order ASC, name ASC`),
  ]);

  if (apartments.length === 0) return { apartments: [], criteria, neighborhoods };

  const ids = apartments.map((a) => a.id);
  const placeholders = ids.map(() => '?').join(',');
  const [images, ratings, visits, applications] = await Promise.all([
    execute(`SELECT * FROM nyp_apartment_images WHERE apartment_id IN (${placeholders}) ORDER BY sort_order ASC, id ASC`, ids),
    execute(`SELECT * FROM nyp_ratings WHERE apartment_id IN (${placeholders})`, ids),
    execute(`SELECT * FROM nyp_visits WHERE apartment_id IN (${placeholders}) ORDER BY visit_at ASC, id ASC`, ids),
    execute(`SELECT * FROM nyp_applications WHERE apartment_id IN (${placeholders}) ORDER BY updated_at DESC, id DESC`, ids),
  ]);

  const imageMap = groupBy(images.rows, 'apartment_id');
  const visitMap = groupBy(visits.rows, 'apartment_id');
  const applicationMap = groupBy(applications.rows, 'apartment_id');
  const ratingMap = buildRatingMap(ratings.rows);

  const listingEventsByApt = await fetchListingEventsForApartments(ids);

  return {
    criteria,
    neighborhoods,
    apartments: apartments.map((apartment) => {
      const apartmentRatings = ratingMap[apartment.id] || {};
      return {
        ...apartment,
        unit_features: parseList(apartment.unit_features),
        amenities: parseList(apartment.amenities),
        toured_data: parseJson(apartment.toured_data),
        images: sanitizeImageUrlsForListPayload(imageMap[apartment.id] || []),
        ratings: apartmentRatings,
        scores: calculateScores(criteria, apartmentRatings),
        next_visit: (visitMap[apartment.id] || [])[0] || null,
        application: (applicationMap[apartment.id] || [])[0] || null,
        listing_events: listingEventsByApt[apartment.id] || [],
      };
    }),
  };
}

/**
 * One apartment in the same shape as `getApartmentPayload().apartments[i]` (full `image_url` values),
 * plus `criteria` and `neighborhoods` row lists. Used by `GET /api/apartments?id=`, emails, and ratings.
 */
async function getApartmentById(rawId) {
  const n = Number(rawId);
  if (!Number.isFinite(n) || n < 1) return null;
  const { rows: arows } = await execute('SELECT * FROM nyp_apartments WHERE id = ? LIMIT 1', [n]);
  if (!arows.length) return null;
  const apartment = arows[0];
  const [{ rows: criteria }, images, ratings, visits, applications, { rows: neighborhoods }] = await Promise.all([
    execute(`SELECT * FROM nyp_criteria WHERE active = TRUE ORDER BY sort_order ASC, id ASC`),
    execute(`SELECT * FROM nyp_apartment_images WHERE apartment_id = ? ORDER BY sort_order ASC, id ASC`, [n]),
    execute(`SELECT * FROM nyp_ratings WHERE apartment_id = ?`, [n]),
    execute(`SELECT * FROM nyp_visits WHERE apartment_id = ? ORDER BY visit_at ASC, id ASC`, [n]),
    execute(`SELECT * FROM nyp_applications WHERE apartment_id = ? ORDER BY updated_at DESC, id DESC`, [n]),
    execute(`SELECT * FROM nyp_neighborhoods WHERE active = TRUE ORDER BY sort_order ASC, name ASC`),
  ]);
  const ratingMap = buildRatingMap(ratings.rows || []);
  const apartmentRatings = ratingMap[n] || {};
  const listingEventsByApt = await fetchListingEventsForApartments([n]);
  const visitRows = visits.rows || [];
  const appRows = applications.rows || [];
  return {
    criteria,
    neighborhoods,
    apartment: {
      ...apartment,
      unit_features: parseList(apartment.unit_features),
      amenities: parseList(apartment.amenities),
      toured_data: parseJson(apartment.toured_data),
      images: images.rows || [],
      ratings: apartmentRatings,
      scores: calculateScores(criteria, apartmentRatings),
      next_visit: visitRows[0] || null,
      application: appRows[0] || null,
      listing_events: listingEventsByApt[n] || [],
    },
  };
}

const LISTING_EVENTS_PER_APARTMENT = 50;

async function fetchListingEventsForApartments(ids) {
  const map = {};
  if (!ids.length) return map;
  ids.forEach((id) => {
    map[id] = [];
  });
  const placeholders = ids.map(() => '?').join(',');
  let rows = [];
  try {
    const result = await execute(
      `SELECT id, apartment_id, event_type, created_at, from_status, to_status, partner_key, criterion_id, criterion_label, score
       FROM nyp_listing_events WHERE apartment_id IN (${placeholders}) ORDER BY created_at DESC`,
      ids
    );
    rows = result.rows || [];
  } catch (err) {
    console.error('[apartmentRepository] listing_events query skipped:', err.message);
    return map;
  }
  const counts = {};
  ids.forEach((id) => {
    counts[id] = 0;
  });
  rows.forEach((row) => {
    const aid = row.apartment_id;
    if (counts[aid] < LISTING_EVENTS_PER_APARTMENT) {
      map[aid].push(row);
      counts[aid] += 1;
    }
  });
  return map;
}

async function insertListingEvent(payload) {
  await execute(
    `INSERT INTO nyp_listing_events
      (apartment_id, event_type, from_status, to_status, partner_key, criterion_id, criterion_label, score)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      payload.apartmentId,
      payload.eventType,
      payload.fromStatus ?? null,
      payload.toStatus ?? null,
      payload.partnerKey ?? null,
      payload.criterionId ?? null,
      payload.criterionLabel ?? null,
      payload.score === undefined ? null : payload.score,
    ]
  );
}

async function tryInsertListingEvent(payload) {
  try {
    await insertListingEvent(payload);
  } catch (err) {
    console.error('[apartmentRepository] listing event not recorded (run npm run migrate if needed):', err.message);
  }
}

function normalizeListingStarForDb(raw) {
  if (raw === null || raw === undefined || raw === '') return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1 || n > 3) return null;
  return n;
}

function isRejectedStatus(status) {
  return normalizeStatus(status) === 'rejected';
}

async function findDuplicateListingConflict(address, aptNumber, excludeId) {
  const want = normalizeListingKey(address, aptNumber);
  const { rows } = await execute('SELECT id, address, apt_number, status FROM nyp_apartments');
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (excludeId && Number(row.id) === Number(excludeId)) continue;
    if (normalizeListingKey(row.address, row.apt_number) !== want) continue;
    if (!isRejectedStatus(row.status)) {
      return { id: row.id, status: normalizeStatus(row.status) };
    }
  }
  return null;
}

async function saveApartment(data) {
  await ensureNeighborhood(data.neighborhood);
  const title = buildApartmentTitle(data.address, data.aptNumber);
  const status = normalizeStatus(data.status);
  const ignoreBlacklist = Boolean(data.ignoreBlacklist);

  let id = Number(data.id || 0);

  const dup = await findDuplicateListingConflict(data.address, data.aptNumber, id > 0 ? id : null);
  if (dup) {
    const err = new Error(
      'A listing already exists for this address and unit. Reject the existing listing before adding another.'
    );
    err.code = 'DUPLICATE_LISTING';
    err.existingId = dup.id;
    throw err;
  }

  if (!ignoreBlacklist) {
    const bKey = normalizeBuildingKey(data.address);
    if (bKey) {
      const bl = await findByNormalizedKey(bKey);
      if (bl) {
        const err = new Error('This building is on your blacklist. You can still save if you confirm.');
        err.code = 'BLACKLISTED';
        err.blacklistId = bl.id;
        err.displayAddress = bl.display_address;
        throw err;
      }
    }
  }

  const listingStarNorm = normalizeListingStarForDb(data.listingStar);
  let touredDataJson = null;
  if (data.touredData != null) {
    try {
      touredDataJson = JSON.stringify(data.touredData);
    } catch (e) {
      const err = new Error('touredData must be JSON-serializable');
      err.code = 'INVALID_TOURED_DATA';
      throw err;
    }
  }

  const params = [
    title,
    data.address,
    data.aptNumber,
    data.neighborhood,
    data.rentCents,
    data.netEffectiveCents,
    data.brokerFeeCents,
    data.depositCents,
    data.amenitiesFeesCents,
    data.totalMoveInCents,
    data.bedrooms,
    data.bathrooms,
    data.squareFeet,
    stringifyList(data.unitFeatures),
    stringifyList(data.amenities),
    data.moveInDate,
    data.listingUrl,
    data.sourceUrl || data.listingUrl,
    data.importStatus || 'manual',
    status,
    data.notes,
    listingStarNorm,
    touredDataJson,
  ];

  let previousStatusForReturn = null;
  if (id > 0) {
    const { rows: prevRows } = await execute('SELECT status FROM nyp_apartments WHERE id = ? LIMIT 1', [id]);
    const prevStatus = prevRows.length ? normalizeStatus(prevRows[0].status) : null;
    previousStatusForReturn = prevStatus;
    await execute(
      `UPDATE nyp_apartments
       SET title = ?, address = ?, apt_number = ?, neighborhood = ?, rent_cents = ?,
           net_effective_cents = ?, broker_fee_cents = ?, deposit_cents = ?,
           amenities_fees_cents = ?, total_move_in_cents = ?,
           bedrooms = ?, bathrooms = ?, square_feet = ?, unit_features = ?, amenities = ?,
           move_in_date = ?, listing_url = ?,
           source_url = ?, import_status = ?, status = ?, notes = ?,
           listing_star = ?, toured_data = ?, updated_at = NOW()
       WHERE id = ?`,
      [...params, id]
    );
    if (prevStatus !== status) {
      await tryInsertListingEvent({
        apartmentId: id,
        eventType: 'status',
        fromStatus: prevStatus,
        toStatus: status,
      });
    }
  } else {
    id = await insert(
      `INSERT INTO nyp_apartments
         (title, address, apt_number, neighborhood, rent_cents, net_effective_cents,
          broker_fee_cents, deposit_cents, amenities_fees_cents, total_move_in_cents,
          bedrooms, bathrooms, square_feet, unit_features, amenities, move_in_date,
          listing_url, source_url, import_status, status, notes, listing_star, toured_data)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params
    );
    await tryInsertListingEvent({
      apartmentId: id,
      eventType: 'status',
      fromStatus: null,
      toStatus: status,
    });
  }

  await replaceImages(id, data.imageUrls || []);

  if (status === 'blacklisted') {
    try {
      await upsertBlacklistFromApartment({
        address: data.address,
        notes: data.notes,
        sourceApartmentId: id,
      });
    } catch (err) {
      console.error('[apartmentRepository] blacklist upsert:', err.message);
    }
  }

  return {
    id,
    previousStatus: id > 0 ? previousStatusForReturn : null,
    newStatus: status,
  };
}

async function deleteApartment(id) {
  try {
    await execute('DELETE FROM nyp_listing_events WHERE apartment_id = ?', [id]);
  } catch (err) {
    console.error('[apartmentRepository] listing_events delete skipped:', err.message);
  }
  await execute('DELETE FROM nyp_ratings WHERE apartment_id = ?', [id]);
  await execute('DELETE FROM nyp_visits WHERE apartment_id = ?', [id]);
  await execute('DELETE FROM nyp_applications WHERE apartment_id = ?', [id]);
  await execute('DELETE FROM nyp_apartment_images WHERE apartment_id = ?', [id]);
  await execute('DELETE FROM nyp_apartments WHERE id = ?', [id]);
}

async function replaceImages(apartmentId, urls) {
  await execute('DELETE FROM nyp_apartment_images WHERE apartment_id = ?', [apartmentId]);
  for (let i = 0; i < urls.length; i++) {
    await execute(
      `INSERT INTO nyp_apartment_images (apartment_id, image_url, sort_order)
       VALUES (?, ?, ?)`,
      [apartmentId, urls[i], i + 1]
    );
  }
}

async function saveCriterion(label, definition, weight) {
  const { rows } = await execute('SELECT COALESCE(MAX(sort_order), 0) AS max_order FROM nyp_criteria');
  return insert(
    `INSERT INTO nyp_criteria (label, definition, weight, sort_order, active)
     VALUES (?, ?, ?, ?, TRUE)`,
    [label, definition || null, weight, Number(rows[0].max_order || 0) + 1]
  );
}

async function deleteCriterion(id) {
  await execute(
    'UPDATE nyp_criteria SET active = FALSE, sort_order = 99 WHERE id = ?',
    [id]
  );
}

async function updateCriterion(id, label, definition, weight) {
  await execute(
    `UPDATE nyp_criteria SET label = ?, definition = ?, weight = ? WHERE id = ? AND active = TRUE`,
    [label, definition || null, weight, id]
  );
}

async function reorderCriteria(orderedIds) {
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) return;
  let order = 1;
  for (const raw of orderedIds) {
    const id = Number(raw);
    if (!Number.isFinite(id)) continue;
    await execute('UPDATE nyp_criteria SET sort_order = ? WHERE id = ? AND active = TRUE', [order, id]);
    order += 1;
  }
}

async function saveRating(data) {
  const { rows: prevRows } = await execute(
    `SELECT score FROM nyp_ratings WHERE apartment_id = ? AND partner_key = ? AND criterion_id = ? LIMIT 1`,
    [data.apartmentId, data.partnerKey, data.criterionId]
  );
  await execute(
    `INSERT INTO nyp_ratings (apartment_id, partner_key, criterion_id, score, notes)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE score = VALUES(score), notes = VALUES(notes), updated_at = NOW()`,
    [data.apartmentId, data.partnerKey, data.criterionId, data.score, data.notes || null]
  );
  let changed = true;
  if (prevRows.length) {
    const p = prevRows[0].score;
    const n = data.score;
    const pNull = p == null;
    const nNull = n == null;
    changed = pNull !== nNull || (!pNull && !nNull && Number(p) !== Number(n));
  }
  if (!changed) return false;

  const { rows: critRows } = await execute('SELECT label FROM nyp_criteria WHERE id = ? LIMIT 1', [data.criterionId]);
  const criterionLabel = critRows.length ? critRows[0].label : 'Criterion';

  await tryInsertListingEvent({
    apartmentId: data.apartmentId,
    eventType: 'vote',
    partnerKey: data.partnerKey,
    criterionId: data.criterionId,
    criterionLabel,
    score: data.score === undefined ? null : data.score,
  });
  return true;
}

async function saveVisit(data) {
  const { rows } = await execute('SELECT id FROM nyp_visits WHERE apartment_id = ? LIMIT 1', [data.apartmentId]);
  // Prefer explicit schedulingNotes; fall back to legacy notes field for backward compat
  const schedulingNotes = data.schedulingNotes !== undefined ? (data.schedulingNotes || null) : (data.notes || null);
  const params = [data.visitAt || null, schedulingNotes, data.touredNotes || null, data.outcome || null];
  if (rows.length) {
    await execute(
      `UPDATE nyp_visits
       SET visit_at = ?, scheduling_notes = ?, toured_notes = ?, outcome = ?, updated_at = NOW()
       WHERE id = ?`,
      [...params, rows[0].id]
    );
    return rows[0].id;
  }
  return insert(
    `INSERT INTO nyp_visits (apartment_id, visit_at, scheduling_notes, toured_notes, outcome)
     VALUES (?, ?, ?, ?, ?)`,
    [data.apartmentId, ...params]
  );
}

async function deleteVisit(apartmentId) {
  await execute('DELETE FROM nyp_visits WHERE apartment_id = ?', [apartmentId]);
}

async function saveApplication(data) {
  const { rows } = await execute('SELECT id FROM nyp_applications WHERE apartment_id = ? LIMIT 1', [data.apartmentId]);
  const params = [data.status || null, data.brokerName || null, data.brokerContact || null, data.deadlineAt || null, data.notes || null];
  if (rows.length) {
    await execute(
      `UPDATE nyp_applications
       SET status = ?, broker_name = ?, broker_contact = ?, deadline_at = ?, notes = ?, updated_at = NOW()
       WHERE id = ?`,
      [...params, rows[0].id]
    );
    return rows[0].id;
  }
  return insert(
    `INSERT INTO nyp_applications (apartment_id, status, broker_name, broker_contact, deadline_at, notes)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [data.apartmentId, ...params]
  );
}

async function ensureNeighborhood(name) {
  const normalized = name ? String(name).trim() : '';
  if (!normalized) return;
  const { rows } = await execute('SELECT COALESCE(MAX(sort_order), 0) AS max_order FROM nyp_neighborhoods');
  await execute(
    `INSERT INTO nyp_neighborhoods (name, sort_order, active)
     VALUES (?, ?, TRUE)
     ON DUPLICATE KEY UPDATE active = TRUE`,
    [normalized, Number(rows[0].max_order || 0) + 1]
  );
}

function calculateScores(criteria, ratings) {
  const result = {};
  PARTNERS.forEach((partner) => {
    let weighted = 0;
    let includedWeight = 0;
    criteria.forEach((criterion) => {
      const raw = (ratings[partner] || {})[criterion.id];
      if (raw == null) return;
      const score = Number(raw);
      if (Number.isNaN(score)) return;
      const w = Number(criterion.weight || 0);
      weighted += score * w;
      includedWeight += w;
    });
    result[partner] = includedWeight > 0 ? (weighted / includedWeight) * 20 : null;
  });
  const available = PARTNERS.map((p) => result[p]).filter((value) => value != null);
  result.combined = available.length ? available.reduce((sum, value) => sum + value, 0) / available.length : null;
  return result;
}

function buildApartmentTitle(address, aptNumber) {
  const base = address ? String(address).trim() : '';
  const apt = aptNumber ? String(aptNumber).trim() : '';
  if (base && apt) return `${base} #${apt.replace(/^#/, '')}`;
  return base || (apt ? `#${apt.replace(/^#/, '')}` : 'Untitled apartment');
}

function stringifyList(values) {
  const list = Array.isArray(values) ? values.map((value) => String(value).trim()).filter(Boolean) : [];
  return list.length ? JSON.stringify(list) : null;
}

function parseList(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return String(raw).split(',').map((value) => value.trim()).filter(Boolean);
  }
}

function parseJson(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function buildRatingMap(rows) {
  const map = {};
  rows.forEach((row) => {
    const partnerKey = normalizePartnerKey(row.partner_key);
    if (!map[row.apartment_id]) map[row.apartment_id] = {};
    if (!map[row.apartment_id][partnerKey]) map[row.apartment_id][partnerKey] = {};
    map[row.apartment_id][partnerKey][row.criterion_id] = row.score;
  });
  return map;
}

function normalizePartnerKey(key) {
  if (key === 'you') return 'kerv';
  if (key === 'partner') return 'peter';
  return key;
}

function groupBy(rows, key) {
  return rows.reduce((map, row) => {
    const value = row[key];
    if (!map[value]) map[value] = [];
    map[value].push(row);
    return map;
  }, {});
}

/**
 * All listing events in [start, end) with apartment title — for digest rollups (no per-apt cap).
 * `start`/`end` are JS Dates (Eastern calendar day bounds from etDayBounds).
 */
async function fetchListingEventsBetweenCreatedAt(start, end) {
  const { rows } = await execute(
    `SELECT e.id, e.apartment_id, e.event_type, e.created_at, e.from_status, e.to_status,
            e.partner_key, e.criterion_id, e.criterion_label, e.score,
            a.title AS apartment_title
     FROM nyp_listing_events e
     INNER JOIN nyp_apartments a ON a.id = e.apartment_id
     WHERE e.created_at >= ? AND e.created_at < ?
     ORDER BY e.created_at DESC`,
    [start, end]
  );
  return rows || [];
}

async function setListingScoresCompleteEmailSent(apartmentId, sent) {
  const n = Number(apartmentId);
  if (!Number.isFinite(n) || n < 1) return;
  await execute('UPDATE nyp_apartments SET listing_scores_complete_email_sent = ? WHERE id = ?', [sent ? 1 : 0, n]);
}

module.exports = {
  getApartmentPayload,
  getApartmentById,
  fetchListingEventsBetweenCreatedAt,
  saveApartment,
  deleteApartment,
  saveCriterion,
  deleteCriterion,
  updateCriterion,
  reorderCriteria,
  saveRating,
  saveVisit,
  deleteVisit,
  saveApplication,
  setListingScoresCompleteEmailSent,
};
