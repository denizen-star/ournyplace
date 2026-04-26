const { execute, insert } = require('./db');
const { normalizeBuildingKey } = require('./addressNormalize');

async function listBuildingBlacklist() {
  const { rows } = await execute(
    `SELECT id, normalized_key, display_address, notes, source_apartment_id, created_at, updated_at
     FROM nyp_building_blacklist ORDER BY display_address ASC, id ASC`
  );
  return rows;
}

async function findByNormalizedKey(normalizedKey) {
  if (!normalizedKey) return null;
  const { rows } = await execute(
    `SELECT id, normalized_key, display_address, notes FROM nyp_building_blacklist WHERE normalized_key = ? LIMIT 1`,
    [normalizedKey]
  );
  return rows.length ? rows[0] : null;
}

async function createBlacklistEntry({ address, notes, sourceApartmentId }) {
  const normalizedKey = normalizeBuildingKey(address);
  if (!normalizedKey) {
    const err = new Error('Could not normalize address');
    err.code = 'INVALID_ADDRESS';
    throw err;
  }
  const display = String(address || '').trim().slice(0, 255);
  try {
    const id = await insert(
      `INSERT INTO nyp_building_blacklist (normalized_key, display_address, notes, source_apartment_id)
       VALUES (?, ?, ?, ?)`,
      [normalizedKey, display || null, notes || null, sourceApartmentId || null]
    );
    return id;
  } catch (err) {
    if (String(err.message || '').includes('Duplicate') || err.code === 'ER_DUP_ENTRY') {
      const e = new Error('This building is already on the blacklist');
      e.code = 'DUPLICATE_BLACKLIST';
      throw e;
    }
    throw err;
  }
}

async function updateBlacklistEntry(id, { displayAddress, notes }) {
  const nid = Number(id);
  if (!Number.isFinite(nid) || nid <= 0) return;
  await execute(
    `UPDATE nyp_building_blacklist SET display_address = ?, notes = ?, updated_at = NOW() WHERE id = ?`,
    [displayAddress != null ? String(displayAddress).trim().slice(0, 255) : null, notes || null, nid]
  );
}

async function deleteBlacklistEntry(id) {
  const nid = Number(id);
  if (!Number.isFinite(nid) || nid <= 0) return;
  await execute('DELETE FROM nyp_building_blacklist WHERE id = ?', [nid]);
}

/** When a listing is marked blacklisted, ensure the building row exists. */
async function upsertBlacklistFromApartment({ address, notes, sourceApartmentId }) {
  const normalizedKey = normalizeBuildingKey(address);
  if (!normalizedKey) return;
  const display = String(address || '').trim().slice(0, 255);
  const noteTrim = notes != null ? String(notes).trim().slice(0, 65000) : null;
  await execute(
    `INSERT INTO nyp_building_blacklist (normalized_key, display_address, notes, source_apartment_id)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       display_address = VALUES(display_address),
       notes = COALESCE(VALUES(notes), nyp_building_blacklist.notes),
       source_apartment_id = COALESCE(VALUES(source_apartment_id), nyp_building_blacklist.source_apartment_id),
       updated_at = NOW()`,
    [normalizedKey, display || null, noteTrim, sourceApartmentId || null]
  );
}

module.exports = {
  listBuildingBlacklist,
  findByNormalizedKey,
  createBlacklistEntry,
  updateBlacklistEntry,
  deleteBlacklistEntry,
  upsertBlacklistFromApartment,
};
