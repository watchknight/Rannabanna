import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolve path to the database in the server root
const dbPath = path.resolve(__dirname, '..', 'rannabanna.db');

console.log('⚡ Connecting to SQLite Database at:', dbPath);

/**
 * High-performance synchronous SQLite connection pool
 * @type {Database.Database}
 */
export const db = new Database(dbPath);

// Enable foreign keys constraints
db.pragma('foreign_keys = ON');

// Automatically run DDL migrations for User management and Generation History
try {
  db.transaction(() => {
    // 1. Users table
    db.prepare(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();

    db.prepare(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email)
    `).run();

    // 2. Saved Recipes table
    db.prepare(`
      CREATE TABLE IF NOT EXISTS saved_recipes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        recipe_id TEXT NOT NULL,
        saved_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE,
        UNIQUE(user_id, recipe_id)
      )
    `).run();

    db.prepare(`
      CREATE INDEX IF NOT EXISTS idx_saved_recipes_user ON saved_recipes(user_id)
    `).run();

    // 3. Generation History table
    db.prepare(`
      CREATE TABLE IF NOT EXISTS generation_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT,
        ingredient_ids TEXT NOT NULL,
        cuisine_id TEXT DEFAULT 'any',
        generated_recipe_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (generated_recipe_id) REFERENCES recipes(id) ON DELETE SET NULL
      )
    `).run();

    db.prepare(`
      CREATE INDEX IF NOT EXISTS idx_gen_history_user ON generation_history(user_id)
    `).run();
  })();
  console.log('✅ SQLite Migrations completed successfully.');
} catch (migrationError) {
  console.error('❌ Failed running SQLite database migrations:', migrationError);
}
