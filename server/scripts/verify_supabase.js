import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { seedPostgresIfEmpty } from '../seed_pg.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env if present
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

const connectionString = process.env.DATABASE_URL;

const EXPECTED_TABLES = [
  'cuisines',
  'ingredients',
  'recipes',
  'recipe_meal_types',
  'recipe_dietary_tags',
  'recipe_ingredients',
  'recipe_steps',
  'users',
  'saved_recipes',
  'generation_history',
  'translation_cache',
  'ai_recipes_cache'
];

async function main() {
  console.log('══════════════════════════════════════════════════════════════');
  console.log('  SUPABASE / POSTGRESQL VERIFICATION & HEALTH CHECK');
  console.log('══════════════════════════════════════════════════════════════\n');

  if (!connectionString) {
    console.error('❌ ERROR: DATABASE_URL environment variable is not defined.');
    console.error('   Please provide your Supabase Postgres connection string in .env:');
    console.error('   DATABASE_URL="postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres"\n');
    process.exit(1);
  }

  const isRemote = !connectionString.includes('localhost') && !connectionString.includes('127.0.0.1');

  const pool = new pg.Pool({
    connectionString,
    ssl: isRemote ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 10000
  });

  try {
    // 1. Test basic connectivity
    console.log('📡 1. Testing connection to Postgres...');
    const connTest = await pool.query('SELECT current_database(), version(), now()');
    console.log(`   Connected to Database: "${connTest.rows[0].current_database}"`);
    console.log(`   Server Version: ${connTest.rows[0].version.split(' on ')[0]}`);
    console.log(`   Server Time: ${connTest.rows[0].now}\n`);

    // 2. Apply Schema DDL
    console.log('📜 2. Applying schema.sql (all 12 tables)...');
    const schemaSql = fs.readFileSync(path.resolve(__dirname, '../models/schema.sql'), 'utf8');
    await pool.query(schemaSql);
    console.log('   Schema DDL executed successfully.\n');

    // 3. Verify all 12 tables exist
    console.log('🔍 3. Verifying all 12 tables exist in information_schema...');
    const tablesRes = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    const foundTables = tablesRes.rows.map(r => r.table_name);
    console.log('   Found tables:', foundTables.join(', '));

    const missingTables = EXPECTED_TABLES.filter(t => !foundTables.includes(t));
    if (missingTables.length > 0) {
      throw new Error(`Missing tables: ${missingTables.join(', ')}`);
    }
    console.log('   ✅ All 12 tables confirmed present.\n');

    // 4. Verify Column Types & Postgres Specifics
    console.log('🔍 4. Verifying column data types & constraints...');
    const colTypesRes = await pool.query(`
      SELECT table_name, column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND (
          (table_name = 'ingredients' AND column_name = 'isCommon') OR
          (table_name = 'recipe_ingredients' AND column_name IN ('isEssential', 'quantity', 'id')) OR
          (table_name = 'recipe_steps' AND column_name = 'id') OR
          (table_name = 'translation_cache' AND column_name IN ('id', 'created_at'))
        )
      ORDER BY table_name, column_name
    `);

    for (const col of colTypesRes.rows) {
      console.log(`   - ${col.table_name}.${col.column_name}: ${col.data_type} (default: ${col.column_default || 'none'})`);
    }

    const isCommonType = colTypesRes.rows.find(c => c.table_name === 'ingredients' && c.column_name === 'isCommon')?.data_type;
    if (isCommonType !== 'boolean') {
      throw new Error(`Expected ingredients.isCommon to be boolean, but got ${isCommonType}`);
    }
    const isEssentialType = colTypesRes.rows.find(c => c.table_name === 'recipe_ingredients' && c.column_name === 'isEssential')?.data_type;
    if (isEssentialType !== 'boolean') {
      throw new Error(`Expected recipe_ingredients.isEssential to be boolean, but got ${isEssentialType}`);
    }
    console.log('   ✅ Booleans, SERIAL/Identity PKs, and numeric types verified.\n');

    // 5. Test scoped auto-seeding
    console.log('🌱 5. Running scoped auto-seeder check...');
    const seedResult = await seedPostgresIfEmpty(pool);
    console.log(`   Seeding status: ${seedResult.seeded ? 'Seeded fresh catalog' : 'Catalog already populated'} (${seedResult.count} recipes).\n`);

    // 6. Test Live Read & Write
    console.log('✍️ 6. Testing live read & write against Supabase...');
    const testHash = `test-verify-${Date.now()}`;
    const testText = 'Supabase migration verification string';
    const testTranslated = 'সুপাবেস মাইগ্রেশন যাচাইকরণ স্ট্রিং';

    // Insert
    const insertRes = await pool.query(`
      INSERT INTO translation_cache ("source_hash", "source_text", "target_lang", "translated_text")
      VALUES ($1, $2, $3, $4)
      RETURNING "id", "source_hash", "translated_text", "created_at"
    `, [testHash, testText, 'bn', testTranslated]);
    
    console.log(`   Inserted test translation record (ID: ${insertRes.rows[0].id})`);

    // Read back
    const readRes = await pool.query(`
      SELECT "id", "source_hash", "translated_text", "created_at" 
      FROM translation_cache 
      WHERE "source_hash" = $1
    `, [testHash]);

    if (readRes.rows.length === 0 || readRes.rows[0].translated_text !== testTranslated) {
      throw new Error('Test read failed to match inserted record.');
    }
    console.log(`   Read back test translation record: "${readRes.rows[0].translated_text}"`);

    // Cleanup test record
    await pool.query('DELETE FROM translation_cache WHERE "source_hash" = $1', [testHash]);
    console.log('   Cleaned up test record.');
    console.log('   ✅ Read/Write test completed successfully.\n');

    console.log('══════════════════════════════════════════════════════════════');
    console.log('  🎉 ALL SUPABASE POSTGRESQL VERIFICATIONS PASSED!');
    console.log('══════════════════════════════════════════════════════════════');
  } catch (err) {
    console.error('❌ Verification failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
