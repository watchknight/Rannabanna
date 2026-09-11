import pg from 'pg';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { seedPostgresIfEmpty } from '../seed_pg.js';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure .env is loaded if DATABASE_URL is not yet defined in environment
if (!process.env.DATABASE_URL) {
  try {
    const envPath = path.resolve(__dirname, '../../.env');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      for (const line of envContent.split('\n')) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
          const [key, ...rest] = trimmed.split('=');
          const val = rest.join('=').trim().replace(/^["']|["']$/g, '');
          if (!process.env[key.trim()]) {
            process.env[key.trim()] = val;
          }
        }
      }
    }
  } catch {
    // Ignore if unreadable
  }
}

const connectionString = process.env.DATABASE_URL;

const isRemote = Boolean(
  connectionString && 
  !connectionString.includes('localhost') && 
  !connectionString.includes('127.0.0.1')
);

console.log('⚡ Initializing PostgreSQL Database Client (Supabase pg pool)...');
if (!connectionString) {
  console.warn('⚠️ DATABASE_URL environment variable is not defined. PostgreSQL client is waiting for connection string.');
}

/**
 * Enterprise PostgreSQL Connection Pool for Supabase / Cloud Postgres
 */
export const pool = new Pool({
  connectionString: connectionString || undefined,
  ssl: isRemote ? { rejectUnauthorized: false } : false,
  max: process.env.DB_POOL_MAX ? parseInt(process.env.DB_POOL_MAX, 10) : 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  allowExitOnIdle: true,
});

pool.on('error', (err) => {
  console.error('❌ Unexpected error on idle PostgreSQL client:', err.message);
});

/**
 * Executes a parameterized SQL query against the PostgreSQL pool.
 *
 * @param {string} text - SQL query string
 * @param {any[]} [params] - Query parameters
 * @returns {Promise<import('pg').QueryResult>}
 */
export async function query(text, params) {
  return pool.query(text, params);
}

// Scoped auto-seed trigger: only executes if DATABASE_URL is set and recipes table is empty
if (connectionString) {
  seedPostgresIfEmpty(pool).catch((err) => {
    console.error('❌ Error during PostgreSQL schema check or auto-seed:', err.message);
  });
}

/**
 * Resilient query executor with automatic exponential backoff retry.
 * Supports both synchronous SQLite operations and asynchronous PostgreSQL queries.
 *
 * @template T
 * @param {() => T|Promise<T>} fn - Database operation to execute
 * @param {number} [maxRetries=3] - Maximum retry attempts
 * @param {number} [baseDelayMs=50] - Initial retry backoff in ms
 * @returns {T|Promise<T>}
 */
export function executeWithRetry(fn, maxRetries = 3, baseDelayMs = 50) {
  let attempt = 0;
  while (true) {
    try {
      const res = fn();
      if (res && typeof res.then === 'function') {
        return (async () => {
          try {
            return await res;
          } catch (err) {
            let asyncAttempt = attempt + 1;
            while (true) {
              const isRetryable = err?.code === 'SQLITE_BUSY' || err?.code === 'SQLITE_LOCKED' || err?.code === 'ECONNRESET' || (err?.message && (err.message.includes('locked') || err.message.includes('connection')));
              if (isRetryable && asyncAttempt <= maxRetries) {
                const delay = baseDelayMs * Math.pow(2, asyncAttempt - 1);
                await new Promise((resolve) => setTimeout(resolve, delay));
                try {
                  return await fn();
                } catch (retryErr) {
                  err = retryErr;
                  asyncAttempt++;
                  continue;
                }
              }
              throw err;
            }
          }
        })();
      }
      return res;
    } catch (err) {
      attempt++;
      const isRetryable = err?.code === 'SQLITE_BUSY' || err?.code === 'SQLITE_LOCKED' || err?.code === 'ECONNRESET' || (err?.message && (err.message.includes('locked') || err.message.includes('connection')));
      if (isRetryable && attempt <= maxRetries) {
        const delay = baseDelayMs * Math.pow(2, attempt - 1);
        const start = Date.now();
        while (Date.now() - start < delay) {
          // Spin-wait for synchronous retry
        }
        continue;
      }
      throw err;
    }
  }
}

// Transitional bridge: maintains .prepare() compatibility for untouched service files until converted
const sqliteFallbackPath = path.resolve(__dirname, '..', 'rannabanna.db');
let _sqliteDb = null;
function getSqliteFallback() {
  if (!_sqliteDb) {
    _sqliteDb = new Database(sqliteFallbackPath, { timeout: 7000 });
    _sqliteDb.pragma('foreign_keys = ON');
  }
  return _sqliteDb;
}

export const db = new Proxy(pool, {
  get(target, prop) {
    if (prop in target) {
      return target[prop];
    }
    // Transitional backward-compatibility for untouched service files
    const fallback = getSqliteFallback();
    if (prop in fallback) {
      return typeof fallback[prop] === 'function' ? fallback[prop].bind(fallback) : fallback[prop];
    }
    return undefined;
  }
});
