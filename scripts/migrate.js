require('dotenv').config({ path: process.env.DOTENV_CONFIG_PATH || '.env.local' });
require('dotenv').config();
const { execute } = require('../lib/db');

const TABLES = [
  `CREATE TABLE IF NOT EXISTS nyp_apartments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    address VARCHAR(255) DEFAULT NULL,
    apt_number VARCHAR(80) DEFAULT NULL,
    neighborhood VARCHAR(120) DEFAULT NULL,
    rent_cents INT DEFAULT NULL,
    net_effective_cents INT DEFAULT NULL,
    broker_fee_cents INT DEFAULT NULL,
    deposit_cents INT DEFAULT NULL,
    amenities_fees_cents INT DEFAULT NULL,
    total_move_in_cents INT DEFAULT NULL,
    bedrooms DECIMAL(4,1) DEFAULT NULL,
    bathrooms DECIMAL(4,1) DEFAULT NULL,
    square_feet INT DEFAULT NULL,
    unit_features TEXT DEFAULT NULL,
    amenities TEXT DEFAULT NULL,
    move_in_date DATE DEFAULT NULL,
    listing_url TEXT DEFAULT NULL,
    source_url TEXT DEFAULT NULL,
    import_status VARCHAR(40) DEFAULT 'manual',
    status VARCHAR(40) DEFAULT 'new',
    notes TEXT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_nyp_apartments_status (status),
    INDEX idx_nyp_apartments_neighborhood (neighborhood)
  )`,

  `CREATE TABLE IF NOT EXISTS nyp_apartment_images (
    id INT AUTO_INCREMENT PRIMARY KEY,
    apartment_id INT NOT NULL,
    image_url MEDIUMTEXT NOT NULL,
    caption VARCHAR(255) DEFAULT NULL,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_nyp_apartment_images_apartment (apartment_id)
  )`,

  `CREATE TABLE IF NOT EXISTS nyp_criteria (
    id INT AUTO_INCREMENT PRIMARY KEY,
    label VARCHAR(120) NOT NULL,
    definition TEXT DEFAULT NULL,
    weight DECIMAL(5,2) DEFAULT 1,
    sort_order INT DEFAULT 0,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE TABLE IF NOT EXISTS nyp_neighborhoods (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(120) NOT NULL UNIQUE,
    sort_order INT DEFAULT 0,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE TABLE IF NOT EXISTS nyp_ratings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    apartment_id INT NOT NULL,
    partner_key VARCHAR(40) NOT NULL,
    criterion_id INT NOT NULL,
    score TINYINT NULL,
    notes TEXT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_nyp_rating (apartment_id, partner_key, criterion_id),
    INDEX idx_nyp_ratings_apartment (apartment_id)
  )`,

  `CREATE TABLE IF NOT EXISTS nyp_visits (
    id INT AUTO_INCREMENT PRIMARY KEY,
    apartment_id INT NOT NULL,
    visit_at DATETIME DEFAULT NULL,
    notes TEXT DEFAULT NULL,
    outcome VARCHAR(80) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_nyp_visits_apartment (apartment_id),
    INDEX idx_nyp_visits_time (visit_at)
  )`,

  `CREATE TABLE IF NOT EXISTS nyp_applications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    apartment_id INT NOT NULL,
    status VARCHAR(80) DEFAULT NULL,
    broker_name VARCHAR(120) DEFAULT NULL,
    broker_contact VARCHAR(255) DEFAULT NULL,
    deadline_at DATETIME DEFAULT NULL,
    notes TEXT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_nyp_applications_apartment (apartment_id),
    INDEX idx_nyp_applications_deadline (deadline_at)
  )`,

  `CREATE TABLE IF NOT EXISTS nyp_listing_events (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    apartment_id INT NOT NULL,
    event_type VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    from_status VARCHAR(40) DEFAULT NULL,
    to_status VARCHAR(40) DEFAULT NULL,
    partner_key VARCHAR(40) DEFAULT NULL,
    criterion_id INT DEFAULT NULL,
    criterion_label VARCHAR(255) DEFAULT NULL,
    score TINYINT NULL,
    INDEX idx_nyp_listing_events_apt_time (apartment_id, created_at)
  )`,

  `CREATE TABLE IF NOT EXISTS nyp_building_blacklist (
    id INT AUTO_INCREMENT PRIMARY KEY,
    normalized_key VARCHAR(768) NOT NULL,
    display_address VARCHAR(255) DEFAULT NULL,
    notes TEXT DEFAULT NULL,
    source_apartment_id INT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_nyp_blacklist_key (normalized_key),
    INDEX idx_nyp_blacklist_source_apt (source_apartment_id)
  )`,
];

const DEFAULT_CRITERIA = [
  ['Building location', 'Manhattan LEW, UWS, UES, East Village, Brooklyn Heights, Downtown BK, Boerum Hill, Cobble Hill, Prospect Heights, Gowanus, Fort Greene, Carroll Gardens, Crown Heights'],
  ['Transit Access', 'Walking distance to specific subway lines, express vs. local service, and weekend service reliability.'],
  ['Financials', 'Monthly rent (Gross vs. Net Effective), security deposit, and utility responsibilities (heat/hot water included or separate).'],
  ['Floor Level', 'Garden/Basement (flood risk), mid-floor, or top-floor (walk-up effort vs. light).'],
  ['Kitchen Features', 'Dishwasher, gas vs. electric stove, counter space, and appliance age.'],
  ['Building Policies', 'Pet policy, smoking policy, and subletting rules.'],
  ['Building Type', 'High-rise amenity building, walk-up brownstone, or multi-family house.'],
  ['Climate Control', 'Central AC, through-the-wall sleeves, or window unit requirements.'],
  ['Bedroom location', 'Front back of the building for noise'],
  ['Laundry', 'In-unit, in-building, or proximity to a laundromat.'],
  ['Maintenance', 'On-site super vs. off-site management and trash disposal systems.'],
  ['Natural Light', 'Window orientation (North/South/East/West) and "view" obstructions.'],
  ['Noise Profile', 'Proximity to construction, subways (elevated lines), hospitals/sirens, or nightlife.'],
  ['Outdoor Space', 'Private (balcony/backyard) vs. shared (roof deck/courtyard).'],
  ['Safety & Tech', 'Intercom system (virtual vs. buzzer), package security, and available ISP (Fios vs. Spectrum).'],
  ['Storage', 'Number of closets and availability of basement/bike storage.'],
  ['Unit Layout', 'Number of true bedrooms, presence of a home office/flex space, and square footage.'],
];

const DEFAULT_NEIGHBORHOODS = [
  'Manhattan LEW',
  'UWS',
  'UES',
  'East Village',
  'Brooklyn Heights',
  'Downtown BK',
  'Boerum Hill',
  'Cobble Hill',
  'Prospect Heights',
  'Gowanus',
  'Fort Greene',
  'Carroll Gardens',
  'Crown Heights',
];

async function safeAlter(sql, description) {
  try {
    await execute(sql);
    console.log(`[MIGRATE] OK: ${description}`);
  } catch (err) {
    const msg = err.message || '';
    if (msg.includes('Duplicate column') || msg.includes('already exists')) return;
    throw err;
  }
}

async function migrate() {
  console.log('[MIGRATE] Starting nyhome schema migration...');

  for (const sql of TABLES) {
    const tableName = sql.match(/CREATE TABLE IF NOT EXISTS (\w+)/)[1];
    await execute(sql);
    console.log(`[MIGRATE] OK: ${tableName}`);
  }

  await safeAlter(
    'ALTER TABLE nyp_criteria ADD COLUMN definition TEXT DEFAULT NULL',
    'nyp_criteria.definition added'
  );

  await safeAlter(
    'ALTER TABLE nyp_apartments ADD COLUMN apt_number VARCHAR(80) DEFAULT NULL',
    'nyp_apartments.apt_number added'
  );
  await safeAlter(
    'ALTER TABLE nyp_apartments ADD COLUMN net_effective_cents INT DEFAULT NULL',
    'nyp_apartments.net_effective_cents added'
  );
  await safeAlter(
    'ALTER TABLE nyp_apartments ADD COLUMN deposit_cents INT DEFAULT NULL',
    'nyp_apartments.deposit_cents added'
  );
  await safeAlter(
    'ALTER TABLE nyp_apartments ADD COLUMN amenities_fees_cents INT DEFAULT NULL',
    'nyp_apartments.amenities_fees_cents added'
  );
  await safeAlter(
    'ALTER TABLE nyp_apartments ADD COLUMN total_move_in_cents INT DEFAULT NULL',
    'nyp_apartments.total_move_in_cents added'
  );
  await safeAlter(
    'ALTER TABLE nyp_apartments ADD COLUMN unit_features TEXT DEFAULT NULL',
    'nyp_apartments.unit_features added'
  );
  await safeAlter(
    'ALTER TABLE nyp_apartments ADD COLUMN amenities TEXT DEFAULT NULL',
    'nyp_apartments.amenities added'
  );

  const activeLabels = DEFAULT_CRITERIA.map(([label]) => label);
  await execute(
    `UPDATE nyp_criteria SET active = FALSE WHERE label NOT IN (${activeLabels.map(() => '?').join(',')})`,
    activeLabels
  );

  for (let i = 0; i < DEFAULT_CRITERIA.length; i++) {
    const [label, definition] = DEFAULT_CRITERIA[i];
    const { rows } = await execute('SELECT id FROM nyp_criteria WHERE label = ? LIMIT 1', [label]);
    if (rows.length) {
      await execute(
        `UPDATE nyp_criteria
         SET definition = ?, weight = ?, sort_order = ?, active = TRUE
         WHERE id = ?`,
        [definition, 1, i + 1, rows[0].id]
      );
    } else {
      await execute(
        `INSERT INTO nyp_criteria (label, definition, weight, sort_order, active)
         VALUES (?, ?, ?, ?, TRUE)`,
        [label, definition, 1, i + 1]
      );
    }
  }
  console.log('[MIGRATE] OK: apartment criteria imported');

  for (let i = 0; i < DEFAULT_NEIGHBORHOODS.length; i++) {
    await execute(
      `INSERT INTO nyp_neighborhoods (name, sort_order, active)
       VALUES (?, ?, TRUE)
       ON DUPLICATE KEY UPDATE sort_order = VALUES(sort_order), active = TRUE`,
      [DEFAULT_NEIGHBORHOODS[i], i + 1]
    );
  }
  console.log('[MIGRATE] OK: neighborhoods imported');

  await execute("UPDATE nyp_ratings SET partner_key = 'kerv' WHERE partner_key = 'you'");
  await execute("UPDATE nyp_ratings SET partner_key = 'peter' WHERE partner_key = 'partner'");
  console.log('[MIGRATE] OK: rating partner labels normalized');

  await safeAlter(
    'ALTER TABLE nyp_ratings MODIFY COLUMN score TINYINT NULL',
    'nyp_ratings.score nullable (N/A)'
  );
  await execute('UPDATE nyp_ratings SET score = NULL WHERE score = 0');
  console.log('[MIGRATE] OK: historical score 0 converted to N/A (NULL)');

  await safeAlter(
    'ALTER TABLE nyp_apartments ADD COLUMN listing_star TINYINT NULL DEFAULT NULL',
    'nyp_apartments.listing_star (1 Peter, 2 Kerv, 3 both)'
  );

  await safeAlter(
    'ALTER TABLE nyp_apartments ADD COLUMN listing_scores_complete_email_sent TINYINT(1) NOT NULL DEFAULT 0',
    'nyp_apartments.listing_scores_complete_email_sent (auto scores-complete digest)'
  );

  console.log('[MIGRATE] Complete.');
}

migrate().catch((err) => {
  console.error('[MIGRATE] FAIL:', err.message);
  process.exit(1);
});
