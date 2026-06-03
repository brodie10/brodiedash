const { Pool } = require("pg");

let pool;
let schemaReady = false;

function getDatabaseUrl() {
  return process.env.POSTGRES_URL
    || process.env.DATABASE_URL
    || process.env.POSTGRES_PRISMA_URL
    || process.env.POSTGRES_URL_NON_POOLING
    || "";
}

function getPool() {
  const rawConnectionString = getDatabaseUrl();
  if (!rawConnectionString) {
    throw new Error("No Vercel Postgres connection string is configured.");
  }
  if (!pool) {
    const connectionString = normalizeConnectionString(rawConnectionString);
    const needsSsl = process.env.NODE_ENV === "production"
      || process.env.VERCEL
      || /sslmode=/i.test(rawConnectionString)
      || /neon\.tech/i.test(rawConnectionString);
    pool = new Pool({
      connectionString,
      ssl: needsSsl ? { rejectUnauthorized: false } : undefined
    });
  }
  return pool;
}

function normalizeConnectionString(connectionString) {
  try {
    const url = new URL(connectionString);
    url.searchParams.delete("sslmode");
    url.searchParams.delete("sslcert");
    url.searchParams.delete("sslkey");
    url.searchParams.delete("sslrootcert");
    return url.toString();
  } catch {
    return connectionString;
  }
}

async function query(sql, params = []) {
  return getPool().query(sql, params);
}

async function ensureSchema() {
  if (schemaReady) return;
  await query(`
    CREATE TABLE IF NOT EXISTS brodiedash_users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      reviewed_at TIMESTAMPTZ,
      reviewed_by TEXT
    );
  `);
  await query("ALTER TABLE brodiedash_users ADD COLUMN IF NOT EXISTS display_name TEXT NOT NULL DEFAULT '';");
  await query("ALTER TABLE brodiedash_users ADD COLUMN IF NOT EXISTS notes TEXT NOT NULL DEFAULT '';");
  await query("ALTER TABLE brodiedash_users ADD COLUMN IF NOT EXISTS module_permissions JSONB NOT NULL DEFAULT '[]'::jsonb;");
  await query("ALTER TABLE brodiedash_users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;");
  await query(`
    CREATE TABLE IF NOT EXISTS brodiedash_dashboard_state (
      username TEXT PRIMARY KEY,
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  schemaReady = true;
}

module.exports = {
  ensureSchema,
  query
};
