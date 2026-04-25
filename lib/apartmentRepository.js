const { execute, insert } = require('./db');
const { normalizeStatus, STATUS_ORDER } = require('./apartmentStatus');

const PARTNERS = ['kerv', 'peter'];

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

  return {
    criteria,
    neighborhoods,
    apartments: apartments.map((apartment) => {
      const apartmentRatings = ratingMap[apartment.id] || {};
      return {
        ...apartment,
        unit_features: parseList(apartment.unit_features),
        amenities: parseList(apartment.amenities),
        images: imageMap[apartment.id] || [],
        ratings: apartmentRatings,
        scores: calculateScores(criteria, apartmentRatings),
        next_visit: (visitMap[apartment.id] || [])[0] || null,
        application: (applicationMap[apartment.id] || [])[0] || null,
      };
    }),
  };
}

async function saveApartment(data) {
  await ensureNeighborhood(data.neighborhood);
  const title = buildApartmentTitle(data.address, data.aptNumber);
  const status = normalizeStatus(data.status);

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
  ];

  let id = Number(data.id || 0);
  if (id > 0) {
    await execute(
      `UPDATE nyp_apartments
       SET title = ?, address = ?, apt_number = ?, neighborhood = ?, rent_cents = ?,
           net_effective_cents = ?, broker_fee_cents = ?, deposit_cents = ?,
           amenities_fees_cents = ?, total_move_in_cents = ?,
           bedrooms = ?, bathrooms = ?, square_feet = ?, unit_features = ?, amenities = ?,
           move_in_date = ?, listing_url = ?,
           source_url = ?, import_status = ?, status = ?, notes = ?, updated_at = NOW()
       WHERE id = ?`,
      [...params, id]
    );
  } else {
    id = await insert(
      `INSERT INTO nyp_apartments
         (title, address, apt_number, neighborhood, rent_cents, net_effective_cents,
          broker_fee_cents, deposit_cents, amenities_fees_cents, total_move_in_cents,
          bedrooms, bathrooms, square_feet, unit_features, amenities, move_in_date,
          listing_url, source_url, import_status, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params
    );
  }

  await replaceImages(id, data.imageUrls || []);
  return id;
}

async function deleteApartment(id) {
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
  await execute('UPDATE nyp_criteria SET active = FALSE WHERE id = ?', [id]);
}

async function saveRating(data) {
  await execute(
    `INSERT INTO nyp_ratings (apartment_id, partner_key, criterion_id, score, notes)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE score = VALUES(score), notes = VALUES(notes), updated_at = NOW()`,
    [data.apartmentId, data.partnerKey, data.criterionId, data.score, data.notes || null]
  );
}

async function saveVisit(data) {
  await execute(
    `INSERT INTO nyp_visits (apartment_id, visit_at, notes, outcome)
     VALUES (?, ?, ?, ?)`,
    [data.apartmentId, data.visitAt || null, data.notes || null, data.outcome || null]
  );
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
  const totalWeight = criteria.reduce((sum, criterion) => sum + Number(criterion.weight || 0), 0);
  PARTNERS.forEach((partner) => {
    let weighted = 0;
    criteria.forEach((criterion) => {
      const score = Number((ratings[partner] || {})[criterion.id] || 0);
      weighted += score * Number(criterion.weight || 0);
    });
    result[partner] = totalWeight > 0 ? (weighted / totalWeight) * 20 : null;
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

module.exports = {
  getApartmentPayload,
  saveApartment,
  deleteApartment,
  saveCriterion,
  deleteCriterion,
  saveRating,
  saveVisit,
  saveApplication,
};
