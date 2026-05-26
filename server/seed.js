import Database from 'better-sqlite3';
import { cuisines } from '../src/data/cuisines.js';
import { ingredients } from '../src/data/ingredients.js';
import { recipes } from '../src/data/recipes.js';
import { newRecipes } from './new_recipes.js';
import { expansionRecipes } from './expansion_recipes.js';
import { subcontinentalRecipes } from './subcontinental_recipes.js';
import { restRecipes } from './rest_recipes.js';
import { sauceRecipes } from './sauce_recipes.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { 
  decorateRecipeTranslations, 
  ingredientTranslations, 
  cuisineTranslations 
} from './utils/translation_engine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.resolve(__dirname, 'rannabanna.db');

console.log('🌱 Initializing SQLite database at:', dbPath);

const db = new Database(dbPath);

// Enable foreign key support
db.pragma('foreign_keys = ON');

// 1. Create schemas (incorporating bilingual columns)
db.exec(`
  DROP TABLE IF EXISTS recipe_steps;
  DROP TABLE IF EXISTS recipe_ingredients;
  DROP TABLE IF EXISTS recipe_dietary_tags;
  DROP TABLE IF EXISTS recipe_meal_types;
  DROP TABLE IF EXISTS recipes;
  DROP TABLE IF EXISTS ingredients;
  DROP TABLE IF EXISTS cuisines;
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS cuisines (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      nameBn TEXT,
      region TEXT,
      regionBn TEXT,
      continent TEXT,
      description TEXT,
      descriptionBn TEXT,
      color TEXT,
      emoji TEXT
  );

  CREATE TABLE IF NOT EXISTS ingredients (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      nameBn TEXT,
      category TEXT,
      subCategory TEXT,
      emoji TEXT,
      sweet INTEGER DEFAULT 0,
      salty INTEGER DEFAULT 0,
      sour INTEGER DEFAULT 0,
      bitter INTEGER DEFAULT 0,
      umami INTEGER DEFAULT 0,
      spicy INTEGER DEFAULT 0,
      isCommon INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS recipes (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      titleBn TEXT,
      cuisineId TEXT,
      difficulty TEXT DEFAULT 'intermediate',
      prepTime INTEGER,
      cookTime INTEGER,
      servings INTEGER,
      calories INTEGER,
      description TEXT,
      descriptionBn TEXT,
      culturalNote TEXT,
      culturalNoteBn TEXT,
      imageEmoji TEXT,
      FOREIGN KEY (cuisineId) REFERENCES cuisines(id)
  );

  CREATE TABLE IF NOT EXISTS recipe_meal_types (
      recipeId TEXT,
      mealType TEXT,
      PRIMARY KEY (recipeId, mealType),
      FOREIGN KEY (recipeId) REFERENCES recipes(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS recipe_dietary_tags (
      recipeId TEXT,
      dietaryTag TEXT,
      PRIMARY KEY (recipeId, dietaryTag),
      FOREIGN KEY (recipeId) REFERENCES recipes(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS recipe_ingredients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recipeId TEXT,
      ingredientId TEXT,
      quantity REAL,
      unit TEXT,
      preparation TEXT,
      isEssential INTEGER DEFAULT 1,
      ingredientGroup TEXT,
      FOREIGN KEY (recipeId) REFERENCES recipes(id) ON DELETE CASCADE,
      FOREIGN KEY (ingredientId) REFERENCES ingredients(id)
  );

  CREATE TABLE IF NOT EXISTS recipe_steps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recipeId TEXT,
      stepNumber INTEGER,
      instruction TEXT,
      instructionBn TEXT,
      duration INTEGER,
      technique TEXT,
      FOREIGN KEY (recipeId) REFERENCES recipes(id) ON DELETE CASCADE
  );
`);

console.log('✅ SQLite Tables Created.');

// 2. Insert cuisines
const insertCuisine = db.prepare(`
  INSERT OR REPLACE INTO cuisines (id, name, nameBn, region, regionBn, continent, description, descriptionBn, color, emoji)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertCuisinesTx = db.transaction((list) => {
  for (const item of list) {
    const trans = cuisineTranslations[item.id] || {};
    insertCuisine.run(
      item.id, 
      item.name, 
      trans.nameBn || item.name, 
      item.region, 
      trans.regionBn || item.region, 
      item.continent, 
      item.description, 
      trans.descriptionBn || item.description, 
      item.color, 
      item.emoji
    );
  }
});
insertCuisinesTx(cuisines);
console.log(`✅ Seeded ${cuisines.length} cuisines.`);

// 3. Insert ingredients
const insertIngredient = db.prepare(`
  INSERT OR REPLACE INTO ingredients (id, name, nameBn, category, subCategory, emoji, sweet, salty, sour, bitter, umami, spicy, isCommon)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertIngredientsTx = db.transaction((list) => {
  for (const item of list) {
    const nameBn = ingredientTranslations[item.id] || item.name;
    insertIngredient.run(
      item.id,
      item.name,
      nameBn,
      item.category,
      item.subCategory,
      item.emoji || '🧂',
      item.flavorProfile?.sweet || 0,
      item.flavorProfile?.salty || 0,
      item.flavorProfile?.sour || 0,
      item.flavorProfile?.bitter || 0,
      item.flavorProfile?.umami || 0,
      item.flavorProfile?.spicy || 0,
      item.isCommon ? 1 : 0
    );
  }
});
insertIngredientsTx(ingredients);
console.log(`✅ Seeded ${ingredients.length} canonical ingredients into GIV.`);

// 4. Merge and insert recipes
const allRecipes = [...recipes, ...newRecipes, ...expansionRecipes, ...subcontinentalRecipes, ...restRecipes, ...sauceRecipes];

const insertRecipe = db.prepare(`
  INSERT OR REPLACE INTO recipes (id, title, titleBn, cuisineId, difficulty, prepTime, cookTime, servings, calories, description, descriptionBn, culturalNote, culturalNoteBn, imageEmoji)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertMealType = db.prepare(`
  INSERT OR REPLACE INTO recipe_meal_types (recipeId, mealType)
  VALUES (?, ?)
`);

const insertDietaryTag = db.prepare(`
  INSERT OR REPLACE INTO recipe_dietary_tags (recipeId, dietaryTag)
  VALUES (?, ?)
`);

const insertRecipeIngredient = db.prepare(`
  INSERT INTO recipe_ingredients (recipeId, ingredientId, quantity, unit, preparation, isEssential, ingredientGroup)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const insertRecipeStep = db.prepare(`
  INSERT INTO recipe_steps (recipeId, stepNumber, instruction, instructionBn, duration, technique)
  VALUES (?, ?, ?, ?, ?, ?)
`);

const insertRecipesTx = db.transaction((list) => {
  // Clear existing junction data for clean seed
  db.prepare('DELETE FROM recipe_meal_types').run();
  db.prepare('DELETE FROM recipe_dietary_tags').run();
  db.prepare('DELETE FROM recipe_ingredients').run();
  db.prepare('DELETE FROM recipe_steps').run();

  for (const rawItem of list) {
    const item = decorateRecipeTranslations(rawItem);
    insertRecipe.run(
      item.id,
      item.title,
      item.titleBn,
      item.cuisineId,
      item.difficulty || 'intermediate',
      item.prepTime,
      item.cookTime,
      item.servings,
      item.calories,
      item.description,
      item.descriptionBn,
      item.culturalNote || '',
      item.culturalNoteBn || '',
      item.imageEmoji || '🍲'
    );

    if (item.mealType) {
      for (const mt of item.mealType) {
        insertMealType.run(item.id, mt);
      }
    }

    if (item.dietaryTags) {
      for (const dt of item.dietaryTags) {
        insertDietaryTag.run(item.id, dt);
      }
    }

    if (item.ingredients) {
      for (const ing of item.ingredients) {
        try {
          insertRecipeIngredient.run(
            item.id,
            ing.ingredientId,
            ing.quantity,
            ing.unit,
            ing.preparation || '',
            ing.isEssential ? 1 : 0,
            ing.group || 'Main'
          );
        } catch (err) {
          console.error(`❌ FAILED on Recipe: "${item.id}" -> Ingredient: "${ing.ingredientId}"`);
          throw err;
        }
      }
    }

    if (item.steps) {
      for (const st of item.steps) {
        insertRecipeStep.run(
          item.id,
          st.step,
          st.instruction,
          st.instructionBn,
          st.duration || 0,
          st.technique || 'cooking'
        );
      }
    }
  }
});

insertRecipesTx(allRecipes);
console.log(`✅ Seeded ${allRecipes.length} recipes with junction mappings (70 original + 35 wave 1 + ${expansionRecipes.length} wave 2 expansion + ${subcontinentalRecipes.length} subcontinental wave 3 + ${restRecipes.length} global cuisines wave 4!).`);
console.log('🌿 Database Seeding Complete!');
