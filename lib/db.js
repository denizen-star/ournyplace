const { Client } = require('@planetscale/database');
require('dotenv').config({ path: process.env.DOTENV_CONFIG_PATH || '.env.local' });
require('dotenv').config();

/** Cached config only; `Client#execute` creates a fresh Connection each call (correct for Netlify/serverless). */
let client = null;

function getClient() {
  if (!client) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error('DATABASE_URL environment variable is not set');
    }
    client = new Client({ url });
  }
  return client;
}

async function execute(query, params = []) {
  return getClient().execute(query, params);
}

async function insert(query, params = []) {
  const result = await execute(query, params);
  return Number(result.insertId);
}

module.exports = { execute, insert };
