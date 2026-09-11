import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { seedDatabase } from '../seed.js';

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

// Self-healing check: Ensure core catalog tables exist and are populated
try {
  const tableCheck = db.prepare("SELECT count(*) as count FROM sqlite_master WHERE type='table' AND name='recipes'").get();
  if (!tableCheck || tableCheck.count === 0) {
    console.log('🌱 Core tables missing in SQLite database. Auto-seeding catalog...');
    seedDatabase(db);
  } else {
    const countCheck = db.prepare("SELECT count(*) as count FROM recipes").get();
    if (!countCheck || countCheck.count === 0) {
      console.log('🌱 Recipes table is empty. Auto-seeding catalog...');
      seedDatabase(db);
    }
  }
} catch (catalogInitErr) {
  console.log('🌱 Auto-seeding SQLite database on initial boot:', catalogInitErr.message);
  seedDatabase(db);
}

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

    // 4. Recipe baseServings column migration
    const recipeColumns = db.prepare('PRAGMA table_info(recipes)').all().map(c => c.name);
    if (recipeColumns.length > 0 && !recipeColumns.includes('baseServings')) {
      db.prepare('ALTER TABLE recipes ADD COLUMN baseServings INTEGER DEFAULT 4').run();
      db.prepare('UPDATE recipes SET baseServings = servings WHERE servings IS NOT NULL').run();
    }

    // 5. Persistent Translation Cache table
    db.prepare(`
      CREATE TABLE IF NOT EXISTS translation_cache (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_hash TEXT UNIQUE NOT NULL,
        source_text TEXT NOT NULL,
        target_lang TEXT NOT NULL DEFAULT 'bn',
        translated_text TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();

    db.prepare(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_trans_cache_hash ON translation_cache(source_hash)
    `).run();
  })();
  console.log('✅ SQLite Migrations completed successfully.');
} catch (migrationError) {
  console.error('❌ Failed running SQLite database migrations:', migrationError);
}
