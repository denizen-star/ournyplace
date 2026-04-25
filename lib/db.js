const { connect } = require('@planetscale/database');
require('dotenv').config({ path: process.env.DOTENV_CONFIG_PATH || '.env.local' });
require('dotenv').config();

let connection = null;

function getConnection() {
  if (!connection) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error('DATABASE_URL environment variable is not set');
    }
    connection = connect({ url });
  }
  return connection;
}

async function execute(query, params = []) {
  return getConnection().execute(query, params);
}

async function insert(query, params = []) {
  const result = await execute(query, params);
  return Number(result.insertId);
}

module.exports = { execute, insert };
