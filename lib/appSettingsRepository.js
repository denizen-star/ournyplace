const { execute } = require('./db');

const KEY_COMPACT_VOTING = 'compact_voting';

async function getCompactVoting() {
  try {
    const { rows } = await execute(
      `SELECT setting_value FROM nyp_app_settings WHERE setting_key = ? LIMIT 1`,
      [KEY_COMPACT_VOTING]
    );
    if (!rows || !rows.length) return false;
    const v = String(rows[0].setting_value || '').trim().toLowerCase();
    return v === '1' || v === 'true' || v === 'yes';
  } catch (e) {
    console.warn('[app-settings] getCompactVoting failed; compact mode off until DB is reachable:', e.message);
    return false;
  }
}

async function setCompactVoting(on) {
  const val = on ? '1' : '0';
  await execute(
    `INSERT INTO nyp_app_settings (setting_key, setting_value) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
    [KEY_COMPACT_VOTING, val]
  );
}

module.exports = {
  getCompactVoting,
  setCompactVoting,
};
