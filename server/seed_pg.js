import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cuisines } from '../src/data/cuisines.js';
import { ingredients } from '../src/data/ingredients.js';
import { recipes } from '../src/data/recipes.js';
import { 
  cuisineTranslations, 
  ingredientTranslations 
} from './utils/translation_engine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Fast multi-row parameterized batch insert for remote PostgreSQL.
 */
async function batchInsert(client, table, columns, rows, chunkSize = 100) {
  if (!rows || rows.length === 0) return;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const valuePlaceholders = [];
    const params = [];
    let paramIdx = 1;

    for (const row of chunk) {
      const placeholders = [];
      for (const col of columns) {
        placeholders.push(`$${paramIdx++}`);
        params.push(row[col] !== undefined ? row[col] : null);
      }
      valuePlaceholders.push(`(${placeholders.join(', ')})`);
    }

    const colNames = columns.map(c => `"${c}"`).join(', ');
    const queryStr = `INSERT INTO "${table}" (${colNames}) VALUES ${valuePlaceholders.join(', ')} ON CONFLICT DO NOTHING`;
    await client.query(queryStr, params);
  }
}

/**
 * Initializes the PostgreSQL schema and seeds catalog data ONLY IF recipes table is empty.
 *
 * @param {import('pg').Pool|import('pg').Client} pool - Active Postgres pool or client
 * @returns {Promise<{ seeded: boolean, count: number }>}
 */
export async function seedPostgresIfEmpty(pool) {
  console.log('⚡ Checking PostgreSQL database schema and catalog status...');

  // 1. Ensure all 12 tables exist by executing schema.sql
  const schemaPath = path.resolve(__dirname, 'models/schema.sql');
  if (fs.existsSync(schemaPath)) {
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    await pool.query(schemaSql);
    console.log('✅ PostgreSQL Schema verified (12 tables ensured).');
  }

  // 2. Scoped Check: Only seed if the recipes table is genuinely empty
  const countCheck = await pool.query('SELECT COUNT(*) as count FROM recipes');
  const existingCount = parseInt(countCheck.rows[0].count, 10);

  if (existingCount > 0) {
    console.log(`ℹ️ Recipes table already contains ${existingCount} recipes. Skipping seed.`);
    return { seeded: false, count: existingCount };
  }

  console.log('🌱 Recipes table is empty. Executing batch catalog seed into PostgreSQL...');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Prepare Cuisines
    const cuisineRows = cuisines.map(item => {
      const trans = cuisineTranslations[item.id] || {};
      return {
        id: item.id,
        name: item.name,
        nameBn: trans.nameBn || item.name,
        region: item.region || '',
        regionBn: trans.regionBn || item.region || '',
        continent: item.continent || '',
        description: item.description || '',
        descriptionBn: trans.descriptionBn || item.description || '',
        color: item.color || '#333333',
        emoji: item.emoji || '🍽️'
      };
    });
    await batchInsert(client, 'cuisines', ['id', 'name', 'nameBn', 'region', 'regionBn', 'continent', 'description', 'descriptionBn', 'color', 'emoji'], cuisineRows);
    console.log(`✅ Seeded ${cuisineRows.length} cuisines.`);

    // 2. Prepare Ingredients
    const ingredientRows = ingredients.map(item => {
      const nameBn = ingredientTranslations[item.id] || item.name;
      return {
        id: item.id,
        name: item.name,
        nameBn,
        category: item.category || 'General',
        subCategory: item.subCategory || 'General',
        emoji: item.emoji || '🧂',
        sweet: item.flavorProfile?.sweet || 0,
        salty: item.flavorProfile?.salty || 0,
        sour: item.flavorProfile?.sour || 0,
        bitter: item.flavorProfile?.bitter || 0,
        umami: item.flavorProfile?.umami || 0,
        spicy: item.flavorProfile?.spicy || 0,
        isCommon: Boolean(item.isCommon)
      };
    });
    await batchInsert(client, 'ingredients', ['id', 'name', 'nameBn', 'category', 'subCategory', 'emoji', 'sweet', 'salty', 'sour', 'bitter', 'umami', 'spicy', 'isCommon'], ingredientRows, 50);
    console.log(`✅ Seeded ${ingredientRows.length} canonical ingredients.`);

    // 3. Prepare Recipes & Junction Tables
    const recipeRows = [];
    const mealTypeRows = [];
    const dietaryTagRows = [];
    const recipeIngredientRows = [];
    const recipeStepRows = [];

    for (const r of recipes) {
      recipeRows.push({
        id: r.id,
        title: r.title,
        titleBn: r.titleBn || r.title,
        cuisineId: r.cuisineId,
        difficulty: r.difficulty || 'intermediate',
        prepTime: r.prepTime || 15,
        cookTime: r.cookTime || 20,
        servings: r.servings || 4,
        baseServings: r.baseServings || r.servings || 4,
        calories: r.calories || 350,
        description: r.description || '',
        descriptionBn: r.descriptionBn || r.description || '',
        culturalNote: r.culturalNote || '',
        culturalNoteBn: r.culturalNoteBn || r.culturalNote || '',
        imageEmoji: r.imageEmoji || '🍲'
      });

      if (Array.isArray(r.mealTypes)) {
        for (const mt of r.mealTypes) {
          mealTypeRows.push({ recipeId: r.id, mealType: mt });
        }
      }

      if (Array.isArray(r.dietaryTags)) {
        for (const dt of r.dietaryTags) {
          dietaryTagRows.push({ recipeId: r.id, dietaryTag: dt });
        }
      }

      if (Array.isArray(r.ingredients)) {
        for (const ing of r.ingredients) {
          recipeIngredientRows.push({
            recipeId: r.id,
            ingredientId: ing.ingredientId || ing.id,
            quantity: ing.quantity !== undefined ? ing.quantity : 1,
            unit: ing.unit || '',
            preparation: ing.preparation || '',
            isEssential: ing.isEssential !== undefined ? Boolean(ing.isEssential) : true,
            ingredientGroup: ing.group || ing.ingredientGroup || 'Main'
          });
        }
      }

      if (Array.isArray(r.steps)) {
        let stepNum = 1;
        for (const st of r.steps) {
          recipeStepRows.push({
            recipeId: r.id,
            stepNumber: st.step || stepNum,
            instruction: st.instruction || '',
            instructionBn: st.instructionBn || st.instruction || '',
            duration: st.duration || 0,
            technique: st.technique || 'Cook'
          });
          stepNum++;
        }
      }
    }

    // Batch insert recipes (chunk of 50 to avoid parameter limit of 65,535)
    await batchInsert(client, 'recipes', [
      'id', 'title', 'titleBn', 'cuisineId', 'difficulty', 'prepTime', 'cookTime', 
      'servings', 'baseServings', 'calories', 'description', 'descriptionBn', 
      'culturalNote', 'culturalNoteBn', 'imageEmoji'
    ], recipeRows, 50);

    // Batch insert child relations (chunks of 100)
    await batchInsert(client, 'recipe_meal_types', ['recipeId', 'mealType'], mealTypeRows, 150);
    await batchInsert(client, 'recipe_dietary_tags', ['recipeId', 'dietaryTag'], dietaryTagRows, 150);
    await batchInsert(client, 'recipe_ingredients', [
      'recipeId', 'ingredientId', 'quantity', 'unit', 'preparation', 'isEssential', 'ingredientGroup'
    ], recipeIngredientRows, 100);
    await batchInsert(client, 'recipe_steps', [
      'recipeId', 'stepNumber', 'instruction', 'instructionBn', 'duration', 'technique'
    ], recipeStepRows, 100);

    await client.query('COMMIT');
    console.log(`🎉 Successfully seeded ${recipes.length} recipes and relationships into PostgreSQL.`);
    return { seeded: true, count: recipes.length };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Failed seeding PostgreSQL database:', error.message);
    throw error;
  } finally {
    client.release();
  }
}
