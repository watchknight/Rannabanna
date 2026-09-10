import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { db as firestoreDb, isFirebaseInitialized } from '../models/firebase.js';
import { db as sqliteDb } from '../models/db.js';
import { cacheService } from './cacheService.js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { generateLocalCustomRecipe } from '../../src/utils/customChefEngine.js';
import { matchIngredient } from '../../src/utils/ingredientResolver.js';
import { adjustTime, checkQuantitySatisfaction } from '../../src/utils/servingsScaler.js';
import { 
  decorateRecipeTranslations, 
  ingredientTranslations, 
  cuisineTranslations 
} from '../utils/translation_engine.js';

/**
 * High-performance bilingual Recipe Service with self-hydrating in-memory database caching.
 * Decouples controllers from storage layers, serving lookups in <2ms from memory
 * while seamlessly backing up and falling back between Cloud Firestore and local SQLite.
 */
class RecipeService {
  constructor() {
    this.cuisinesCache = null;
    this.ingredientsCache = null;
    this.recipesCache = null;
    this.lastHydrated = 0;
  }

  /**
   * Self-hydrates the memory caches from Cloud Firestore (primary) or SQLite (failover).
   * Holds a 2-hour sliding TTL cache.
   */
  async _ensureCache() {
    const cacheDuration = 2 * 60 * 60 * 1000; // 2 hours
    if (
      this.cuisinesCache &&
      this.ingredientsCache &&
      this.recipesCache &&
      (Date.now() - this.lastHydrated < cacheDuration)
    ) {
      return; // Cache is active and fresh
    }

    console.log('⚡ Hydrating recipeService in-memory database cache...');
    try {
      if (isFirebaseInitialized) {
        // 1. Hydrate Cuisines from Firestore
        const cuisinesSnapshot = await firestoreDb.collection('cuisines').get();
        const cuisinesList = [];
        cuisinesSnapshot.forEach(doc => {
          const data = doc.data();
          const trans = cuisineTranslations[doc.id] || {};
          cuisinesList.push({
            id: doc.id,
            ...data,
            ...trans
          });
        });
        this.cuisinesCache = cuisinesList;

        // 2. Hydrate Ingredients from Firestore
        const ingredientsSnapshot = await firestoreDb.collection('ingredients').get();
        const ingredientsList = [];
        ingredientsSnapshot.forEach(doc => {
          const data = doc.data();
          const nameBn = ingredientTranslations[doc.id] || data.name;
          ingredientsList.push({
            id: doc.id,
            ...data,
            nameBn
          });
        });
        this.ingredientsCache = ingredientsList;

        // 3. Hydrate Recipes from Firestore
        const recipesSnapshot = await firestoreDb.collection('recipes').get();
        const recipesList = [];
        recipesSnapshot.forEach(doc => {
          const decorated = decorateRecipeTranslations({ id: doc.id, ...doc.data() });
          recipesList.push(decorated);
        });
        this.recipesCache = recipesList;

        console.log('🔥 Live Cloud Firestore collections cached successfully in memory!');
      } else {
        this._hydrateFromSqlite();
      }
      this.lastHydrated = Date.now();
      console.log(`✅ Cache hydrated: ${this.cuisinesCache.length} cuisines, ${this.ingredientsCache.length} ingredients, and ${this.recipesCache.length} recipes ready.`);
    } catch (error) {
      console.error('❌ Firestore cache hydration failed. Falling back to local SQLite:', error.message);
      this._hydrateFromSqlite();
      this.lastHydrated = Date.now();
    }
  }

  _hydrateFromSqlite() {
    console.warn('⚠️ Hydrating caches directly from local SQLite database.');
    
    // 1. Cuisines
    this.cuisinesCache = sqliteDb.prepare('SELECT * FROM cuisines').all().map(c => ({
      ...c,
      ...(cuisineTranslations[c.id] || {})
    }));

    // 2. Ingredients
    this.ingredientsCache = this._getAllIngredientsSqlite().map(i => ({
      ...i,
      nameBn: ingredientTranslations[i.id] || i.name
    }));

    // 3. Recipes (High-performance bulk hydration — eliminates N+1 query loop)
    const recipes = sqliteDb.prepare('SELECT * FROM recipes').all();
    const mealTypes = sqliteDb.prepare('SELECT * FROM recipe_meal_types').all();
    const dietaryTags = sqliteDb.prepare('SELECT * FROM recipe_dietary_tags').all();
    const steps = sqliteDb.prepare('SELECT recipeId, stepNumber as step, instruction, instructionBn, duration, technique FROM recipe_steps ORDER BY recipeId, stepNumber').all();
    const ingredients = sqliteDb.prepare(`
      SELECT ri.recipeId, ri.ingredientId, ri.quantity, ri.unit, ri.preparation, ri.isEssential, ri.ingredientGroup as 'group', i.name, i.emoji
      FROM recipe_ingredients ri
      JOIN ingredients i ON ri.ingredientId = i.id
    `).all();

    const mtMap = new Map();
    for (const m of mealTypes) {
      if (!mtMap.has(m.recipeId)) mtMap.set(m.recipeId, []);
      mtMap.get(m.recipeId).push(m.mealType);
    }

    const dtMap = new Map();
    for (const d of dietaryTags) {
      if (!dtMap.has(d.recipeId)) dtMap.set(d.recipeId, []);
      dtMap.get(d.recipeId).push(d.dietaryTag);
    }

    const stMap = new Map();
    for (const s of steps) {
      if (!stMap.has(s.recipeId)) stMap.set(s.recipeId, []);
      stMap.get(s.recipeId).push(s);
    }

    const ingMap = new Map();
    for (const i of ingredients) {
      if (!ingMap.has(i.recipeId)) ingMap.set(i.recipeId, []);
      ingMap.get(i.recipeId).push({
        ingredientId: i.ingredientId,
        quantity: i.quantity,
        unit: i.unit,
        preparation: i.preparation,
        isEssential: i.isEssential === 1,
        group: i.group,
        name: i.name,
        emoji: i.emoji
      });
    }

    this.recipesCache = recipes.map(r => {
      const detailed = {
        ...r,
        baseServings: r.baseServings || r.servings || 4,
        mealType: mtMap.get(r.id) || [],
        dietaryTags: dtMap.get(r.id) || [],
        steps: stMap.get(r.id) || [],
        ingredients: ingMap.get(r.id) || []
      };
      return decorateRecipeTranslations(detailed);
    });
  }

  /**
   * Invalidates the caches to trigger re-hydration on next request (e.g. after generating a custom recipe).
   */
  invalidateCache() {
    this.cuisinesCache = null;
    this.ingredientsCache = null;
    this.recipesCache = null;
    console.log('🗑️ recipeService database cache invalidated.');
  }

  /**
   * Fetches all cuisines list.
   */
  async getAllCuisines() {
    await this._ensureCache();
    return this.cuisinesCache;
  }

  /**
   * Fetches a specific cuisine by ID.
   */
  async getCuisineById(id) {
    await this._ensureCache();
    return this.cuisinesCache.find(c => c.id === id) || null;
  }

  /**
   * Fetches the complete list of canonical GIV ingredients.
   */
  async getAllIngredients() {
    await this._ensureCache();
    return this.ingredientsCache;
  }

  _getAllIngredientsSqlite() {
    const rows = sqliteDb.prepare('SELECT * FROM ingredients').all();
    return rows.map(r => ({
      id: r.id,
      name: r.name,
      category: r.category,
      subCategory: r.subCategory,
      emoji: r.emoji,
      flavorProfile: {
        sweet: r.sweet,
        salty: r.salty,
        sour: r.sour,
        bitter: r.bitter,
        umami: r.umami,
        spicy: r.spicy
      },
      isCommon: r.isCommon === 1
    }));
  }

  /**
   * Fetches a basic summary list of all recipes.
   */
  async getAllRecipes() {
    await this._ensureCache();
    return this.recipesCache.map(r => ({
      id: r.id,
      title: r.title,
      titleBn: r.titleBn,
      cuisineId: r.cuisineId,
      difficulty: r.difficulty,
      prepTime: r.prepTime,
      cookTime: r.cookTime,
      servings: r.servings,
      baseServings: r.baseServings || r.servings || 4,
      calories: r.calories,
      description: r.description,
      descriptionBn: r.descriptionBn,
      imageEmoji: r.imageEmoji
    }));
  }
  
  /**
   * Performs blazingly fast in-memory matchmaking over cached collections.
   * Runs in under 2ms!
   */
  async matchRecipes(ingredientIds = [], filters = {}) {
    if (!Array.isArray(ingredientIds) || ingredientIds.length === 0) {
      return { perfect: [], great: [], good: [], exploratory: [], totalCount: 0 };
    }

    await this._ensureCache();

    try {
      const selectedSet = new Set(ingredientIds);
      const ingredientMap = new Map(this.ingredientsCache.map(i => [i.id, i]));
      const matchedRecipes = [];
      const globalTargetServings = filters.servings ? Number(filters.servings) : null;
      const onHandMap = filters.onHand || {};

      for (const r of this.recipesCache) {
        const rIngredients = r.ingredients || [];

        // Check if there is at least one overlap with the selected ingredients
        const hasAnyMatch = rIngredients.some(ri => selectedSet.has(ri.ingredientId));
        if (!hasAnyMatch) continue;

        const base = r.baseServings || r.servings || 4;
        const currentTargetServings = globalTargetServings || base;

        // Verify if on-hand quantity satisfies the requirement
        const isSatisfied = (ri) => {
          if (!selectedSet.has(ri.ingredientId)) return false;
          if (onHandMap[ri.ingredientId] !== undefined) {
            const check = checkQuantitySatisfaction(ri, onHandMap[ri.ingredientId], base, currentTargetServings);
            return check.satisfied;
          }
          return true;
        };

        const essential = rIngredients.filter(ri => ri.isEssential === true || ri.isEssential === 1);
        const optional = rIngredients.filter(ri => ri.isEssential === false || ri.isEssential === 0);

        const essentialTotal = essential.length;
        const optionalTotal = optional.length;

        const essentialMatched = essential.filter(ri => isSatisfied(ri)).length;
        const optionalMatched = optional.filter(ri => isSatisfied(ri)).length;

        let matchPercentage = 0;

        // Scoring Engine v2 logic
        if (essentialTotal === 0) {
          matchPercentage = optionalTotal > 0 ? Math.round((optionalMatched / optionalTotal) * 100) : 0;
        } else if (optionalTotal === 0) {
          matchPercentage = Math.round((essentialMatched / essentialTotal) * 100);
        } else {
          const essentialScore = (essentialMatched / essentialTotal) * 85;
          const optionalScore = (optionalMatched / optionalTotal) * 15;
          matchPercentage = Math.round(essentialScore + optionalScore);
        }

        // Bonus: All essentials matched
        if (essentialMatched === essentialTotal && essentialTotal > 0) {
          matchPercentage = Math.min(100, matchPercentage + 5);
        }

        // Bonus: Highly matching volume
        const totalMatched = essentialMatched + optionalMatched;
        if (totalMatched >= 5) {
          matchPercentage = Math.min(100, matchPercentage + 3);
        }

        if (matchPercentage < 10) continue;

        const mealTypes = r.mealType || [];
        const dietaryTags = r.dietaryTags || [];

        // Compile missing details (including shortfall for insufficient quantities)
        const missingEssential = essential
          .filter(ri => !isSatisfied(ri))
          .map(ri => {
            const ingObj = ingredientMap.get(ri.ingredientId);
            if (!ingObj) return null;
            const onHand = onHandMap[ri.ingredientId];
            const check = checkQuantitySatisfaction(ri, onHand, base, currentTargetServings);
            return {
              id: ingObj.id,
              name: ingObj.name,
              nameBn: ingObj.nameBn,
              emoji: ingObj.emoji,
              shortfall: check.missingQuantity || 0,
              unit: ri.unit
            };
          }).filter(Boolean);

        const missingOptional = optional
          .filter(ri => !isSatisfied(ri))
          .map(ri => {
            const ingObj = ingredientMap.get(ri.ingredientId);
            if (!ingObj) return null;
            const onHand = onHandMap[ri.ingredientId];
            const check = checkQuantitySatisfaction(ri, onHand, base, currentTargetServings);
            return {
              id: ingObj.id,
              name: ingObj.name,
              nameBn: ingObj.nameBn,
              emoji: ingObj.emoji,
              shortfall: check.missingQuantity || 0,
              unit: ri.unit
            };
          }).filter(Boolean);

        matchedRecipes.push({
          ...r,
          mealType: mealTypes,
          dietaryTags: dietaryTags,
          matchPercentage,
          essentialMatched,
          essentialTotal,
          optionalMatched,
          optionalTotal,
          missingEssential,
          missingOptional
        });
      }

      // Apply specific criteria filters
      const filteredRecipes = matchedRecipes.filter(recipe => {
        if (filters.cuisines && filters.cuisines.length > 0) {
          if (!filters.cuisines.includes(recipe.cuisineId)) return false;
        }
        if (filters.mealType && filters.mealType !== 'all') {
          if (!recipe.mealType.includes(filters.mealType)) return false;
        }
        if (filters.difficulty && filters.difficulty !== 'all') {
          if (recipe.difficulty !== filters.difficulty) return false;
        }
        if (filters.maxTime) {
          const base = recipe.baseServings || recipe.servings || 4;
          const target = globalTargetServings || base;
          const timeStats = adjustTime(recipe.prepTime, recipe.cookTime, base, target, recipe.timeAdjustment);
          if (timeStats.totalTime > filters.maxTime) return false;
        }
        if (filters.dietary && filters.dietary.length > 0) {
          const recipeTags = Array.isArray(recipe.dietaryTags) ? recipe.dietaryTags : [];
          const hasAllTags = filters.dietary.every(tag => recipeTags.includes(tag));
          if (!hasAllTags) return false;
        }
        return true;
      });

      // Sort descending by match percentage
      filteredRecipes.sort((a, b) => b.matchPercentage - a.matchPercentage);

      // Segment into distinct match bands
      const perfect = filteredRecipes.filter(r => r.matchPercentage >= 90);
      const great = filteredRecipes.filter(r => r.matchPercentage >= 60 && r.matchPercentage < 90);
      const good = filteredRecipes.filter(r => r.matchPercentage >= 35 && r.matchPercentage < 60);
      const exploratory = filteredRecipes.filter(r => r.matchPercentage >= 10 && r.matchPercentage < 35);

      return {
        perfect,
        great,
        good,
        exploratory,
        totalCount: filteredRecipes.length
      };
    } catch (error) {
      console.error('❌ Cache matchmaking error, falling back to SQLite:', error.message);
      return this._matchRecipesSqlite(ingredientIds, filters);
    }
  }

  _matchRecipesSqlite(ingredientIds = [], filters = {}) {
    const selectedSet = new Set(ingredientIds);

    const recipesList = sqliteDb.prepare('SELECT * FROM recipes').all();
    const allIngredients = sqliteDb.prepare('SELECT * FROM ingredients').all();
    const ingredientMap = new Map(allIngredients.map(i => [i.id, i]));

    const allRecipeIngredients = sqliteDb.prepare('SELECT recipeId, ingredientId, isEssential FROM recipe_ingredients').all();
    const recipeIngMap = new Map();
    for (const ri of allRecipeIngredients) {
      if (!recipeIngMap.has(ri.recipeId)) recipeIngMap.set(ri.recipeId, []);
      recipeIngMap.get(ri.recipeId).push(ri);
    }

    const allMealTypes = sqliteDb.prepare('SELECT recipeId, mealType FROM recipe_meal_types').all();
    const mealTypeMap = new Map();
    for (const mt of allMealTypes) {
      if (!mealTypeMap.has(mt.recipeId)) mealTypeMap.set(mt.recipeId, []);
      mealTypeMap.get(mt.recipeId).push(mt.mealType);
    }

    const allDietaryTags = sqliteDb.prepare('SELECT recipeId, dietaryTag FROM recipe_dietary_tags').all();
    const dietaryTagMap = new Map();
    for (const dt of allDietaryTags) {
      if (!dietaryTagMap.has(dt.recipeId)) dietaryTagMap.set(dt.recipeId, []);
      dietaryTagMap.get(dt.recipeId).push(dt.dietaryTag);
    }

    const matchedRecipes = [];

    for (const r of recipesList) {
      const rIngredients = recipeIngMap.get(r.id) || [];
      const hasAnyMatch = rIngredients.some(ri => selectedSet.has(ri.ingredientId));
      if (!hasAnyMatch) continue;

      const essential = rIngredients.filter(ri => ri.isEssential === 1);
      const optional = rIngredients.filter(ri => ri.isEssential === 0);

      const essentialTotal = essential.length;
      const optionalTotal = optional.length;

      const essentialMatched = essential.filter(ri => selectedSet.has(ri.ingredientId)).length;
      const optionalMatched = optional.filter(ri => selectedSet.has(ri.ingredientId)).length;

      let matchPercentage = 0;

      if (essentialTotal === 0) {
        matchPercentage = optionalTotal > 0 ? Math.round((optionalMatched / optionalTotal) * 100) : 0;
      } else if (optionalTotal === 0) {
        matchPercentage = Math.round((essentialMatched / essentialTotal) * 100);
      } else {
        const essentialScore = (essentialMatched / essentialTotal) * 85;
        const optionalScore = (optionalMatched / optionalTotal) * 15;
        matchPercentage = Math.round(essentialScore + optionalScore);
      }

      if (essentialMatched === essentialTotal && essentialTotal > 0) {
        matchPercentage = Math.min(100, matchPercentage + 5);
      }

      const totalMatched = essentialMatched + optionalMatched;
      if (totalMatched >= 5) {
        matchPercentage = Math.min(100, matchPercentage + 3);
      }

      if (matchPercentage < 10) continue;

      const mealTypes = mealTypeMap.get(r.id) || [];
      const dietaryTags = dietaryTagMap.get(r.id) || [];

      const missingEssential = essential
        .filter(ri => !selectedSet.has(ri.ingredientId))
        .map(ri => {
          const ingObj = ingredientMap.get(ri.ingredientId);
          return ingObj ? { id: ingObj.id, name: ingObj.name, nameBn: ingObj.nameBn || ingObj.name, emoji: ingObj.emoji } : null;
        }).filter(Boolean);

      const missingOptional = optional
        .filter(ri => !selectedSet.has(ri.ingredientId))
        .map(ri => {
          const ingObj = ingredientMap.get(ri.ingredientId);
          return ingObj ? { id: ingObj.id, name: ingObj.name, nameBn: ingObj.nameBn || ingObj.name, emoji: ingObj.emoji } : null;
        }).filter(Boolean);

      matchedRecipes.push(decorateRecipeTranslations({
        ...r,
        mealType: mealTypes,
        dietaryTags: dietaryTags,
        matchPercentage,
        essentialMatched,
        essentialTotal,
        optionalMatched,
        optionalTotal,
        missingEssential,
        missingOptional
      }));
    }

    const filteredRecipes = matchedRecipes.filter(recipe => {
      if (filters.cuisines && filters.cuisines.length > 0) {
        if (!filters.cuisines.includes(recipe.cuisineId)) return false;
      }
      if (filters.mealType && filters.mealType !== 'all') {
        if (!recipe.mealType.includes(filters.mealType)) return false;
      }
      if (filters.difficulty && filters.difficulty !== 'all') {
        if (recipe.difficulty !== filters.difficulty) return false;
      }
      if (filters.maxTime) {
        const totalTime = (recipe.prepTime || 0) + (recipe.cookTime || 0);
        if (totalTime > filters.maxTime) return false;
      }
      if (filters.dietary && filters.dietary.length > 0) {
        const recipeTags = Array.isArray(recipe.dietaryTags) ? recipe.dietaryTags : [];
        const hasAllTags = filters.dietary.every(tag => recipeTags.includes(tag));
        if (!hasAllTags) return false;
      }
      return true;
    });

    filteredRecipes.sort((a, b) => b.matchPercentage - a.matchPercentage);

    const perfect = filteredRecipes.filter(r => r.matchPercentage >= 90);
    const great = filteredRecipes.filter(r => r.matchPercentage >= 60 && r.matchPercentage < 90);
    const good = filteredRecipes.filter(r => r.matchPercentage >= 35 && r.matchPercentage < 60);
    const exploratory = filteredRecipes.filter(r => r.matchPercentage >= 10 && r.matchPercentage < 35);

    return {
      perfect,
      great,
      good,
      exploratory,
      totalCount: filteredRecipes.length
    };
  }

  /**
   * Fetches detailed recipe.
   */
  async getRecipeById(recipeId) {
    await this._ensureCache();
    return this.recipesCache.find(r => r.id === recipeId) || null;
  }

  _getRecipeByIdSqlite(recipeId) {
    const recipe = sqliteDb.prepare('SELECT * FROM recipes WHERE id = ?').get(recipeId);
    if (!recipe) return null;

    const mealTypes = sqliteDb.prepare('SELECT mealType FROM recipe_meal_types WHERE recipeId = ?').all(recipe.id).map(r => r.mealType);
    const dietaryTags = sqliteDb.prepare('SELECT dietaryTag FROM recipe_dietary_tags WHERE recipeId = ?').all(recipe.id).map(r => r.dietaryTag);
    const steps = sqliteDb.prepare('SELECT stepNumber as step, instruction, instructionBn, duration, technique FROM recipe_steps WHERE recipeId = ? ORDER BY stepNumber').all(recipe.id);

    const recipeIngredients = sqliteDb.prepare(`
      SELECT ri.ingredientId, ri.quantity, ri.unit, ri.preparation, ri.isEssential, ri.ingredientGroup as 'group', i.name, i.emoji
      FROM recipe_ingredients ri
      JOIN ingredients i ON ri.ingredientId = i.id
      WHERE ri.recipeId = ?
    `).all(recipe.id).map(r => ({
      ingredientId: r.ingredientId,
      quantity: r.quantity,
      unit: r.unit,
      preparation: r.preparation,
      isEssential: r.isEssential === 1,
      group: r.group,
      name: r.name,
      emoji: r.emoji
    }));

    const detailed = {
      ...recipe,
      baseServings: recipe.baseServings || recipe.servings || 4,
      mealType: mealTypes,
      dietaryTags: dietaryTags,
      steps: steps,
      ingredients: recipeIngredients
    };

    return decorateRecipeTranslations(detailed);
  }

  /**
   * Generates a custom, GIV-aligned bespoke recipe and seeds it in Firestore / SQLite.
   */
  async generateCustomRecipe(ingredientIds = [], cuisineId = 'any', apiKey = null, userId = null) {
    await this._ensureCache();
    
    const ingredientsList = this.ingredientsCache.filter(i => ingredientIds.includes(i.id));

    let recipe = null;

    if (apiKey) {
      try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

        const prompt = `You are a world-class professional chef. Create an authentic, gourmet, high-quality custom recipe using these selected ingredients: ${ingredientsList.map(i => `${i.name} (${i.id})`).join(', ')}.
You can also include standard household pantry staples if absolutely necessary (e.g. salt, garlic, water, oil, onions), but prioritize using the selected ingredients.

Return ONLY a valid JSON object matching this structure EXACTLY (do not wrap in markdown codeblocks or put any extra text):
{
  "title": "A highly creative, authentic, gourmet title in English",
  "titleBn": "A highly creative, authentic, gourmet title in perfect, natural, grammatically correct Bangla",
  "cuisineId": "one of: 'bengali', 'north-indian', 'pakistani', 'chinese', 'thai', 'italian', 'mexican'",
  "difficulty": "one of: 'beginner', 'intermediate', 'hard'",
  "prepTime": 15,
  "cookTime": 25,
  "servings": 4,
  "calories": 350,
  "description": "A very engaging, appetizing, multi-sentence description in English",
  "descriptionBn": "A very engaging, appetizing, multi-sentence description in perfect, natural, grammatically correct Bangla",
  "culturalNote": "A fascinating cultural or historical background about the cooking technique or style used in English",
  "culturalNoteBn": "A fascinating cultural or historical background about the cooking technique or style used in perfect, natural, grammatically correct Bangla",
  "imageEmoji": "A single highly relevant food emoji",
  "mealType": ["lunch", "dinner"],
  "dietaryTags": ["gluten-free", "vegetarian"],
  "ingredients": [
    { "ingredientId": "ingredient-id-from-list-or-staples", "quantity": 2, "unit": "tbsp", "preparation": "finely chopped", "isEssential": true, "group": "Main" }
  ],
  "steps": [
    { "step": 1, "instruction": "Step 1 instruction in English", "instructionBn": "Step 1 instruction in perfect, natural, grammatically correct Bangla (put the verb at the end of clauses)", "duration": 5, "technique": "sautéing" }
  ]
}`;

        const result = await model.generateContent(prompt);
        let text = result.response.text().trim();
        if (text.startsWith('```json')) {
          text = text.substring(7, text.length - 3);
        } else if (text.startsWith('```')) {
          text = text.substring(3, text.length - 3);
        }
        recipe = JSON.parse(text.trim());
      } catch (aiError) {
        console.error('⚠️ AI generation failed. Falling back to local culinary expert engine:', aiError);
      }
    }

    if (!recipe) {
      recipe = generateLocalCustomRecipe(ingredientsList, cuisineId);
    }

    // Save dynamic recipe directly to the database
    const recipeId = `custom-${crypto.randomUUID()}`;
    const finalRecipeObj = decorateRecipeTranslations({
      id: recipeId,
      ...recipe,
      mealType: recipe.mealType || ['lunch', 'dinner'],
      dietaryTags: recipe.dietaryTags || []
    });

    if (isFirebaseInitialized) {
      try {
        await firestoreDb.collection('recipes').doc(recipeId).set(finalRecipeObj);
        
        await firestoreDb.collection('generation_history').add({
          user_id: userId,
          ingredient_ids: ingredientIds,
          cuisine_id: cuisineId,
          generated_recipe_id: recipeId,
          timestamp: new Date().toISOString()
        });
        console.log(`🔥 Custom recipe ${recipeId} successfully saved to Firestore!`);
      } catch (error) {
        console.error('❌ Firestore save generated recipe error, falling back to SQLite:', error.message);
        this._saveCustomRecipeSqlite(recipeId, finalRecipeObj, ingredientIds, cuisineId, userId);
      }
    } else {
      this._saveCustomRecipeSqlite(recipeId, finalRecipeObj, ingredientIds, cuisineId, userId);
    }

    // Invalidate the cache to ensure the new custom recipe is loaded on subsequent calls
    this.invalidateCache();

    return finalRecipeObj;
  }

  _saveCustomRecipeSqlite(recipeId, recipe, ingredientIds, cuisineId, userId) {
    sqliteDb.transaction(() => {
      sqliteDb.prepare(`
        INSERT INTO recipes (id, title, cuisineId, difficulty, prepTime, cookTime, servings, calories, description, culturalNote, imageEmoji)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        recipeId,
        recipe.title,
        recipe.cuisineId || 'bengali',
        recipe.difficulty || 'intermediate',
        recipe.prepTime || 15,
        recipe.cookTime || 20,
        recipe.servings || 4,
        recipe.calories || 300,
        recipe.description || 'A unique custom recipe crafted by our Chef.',
        recipe.culturalNote || '',
        recipe.imageEmoji || '🍲'
      );

      if (recipe.mealType) {
        const insertMeal = sqliteDb.prepare('INSERT OR REPLACE INTO recipe_meal_types (recipeId, mealType) VALUES (?, ?)');
        for (const mt of recipe.mealType) {
          insertMeal.run(recipeId, mt);
        }
      }

      if (recipe.dietaryTags) {
        const insertDiet = sqliteDb.prepare('INSERT OR REPLACE INTO recipe_dietary_tags (recipeId, dietaryTag) VALUES (?, ?)');
        for (const dt of recipe.dietaryTags) {
          insertDiet.run(recipeId, dt);
        }
      }

      if (recipe.steps) {
        const insertStep = sqliteDb.prepare(`
          INSERT INTO recipe_steps (recipeId, stepNumber, instruction, instructionBn, duration, technique)
          VALUES (?, ?, ?, ?, ?, ?)
        `);
        for (const s of recipe.steps) {
          insertStep.run(recipeId, s.step, s.instruction, s.instructionBn || '', s.duration || 0, s.technique || 'cooking');
        }
      }

      if (recipe.ingredients) {
        const insertIng = sqliteDb.prepare(`
          INSERT INTO recipe_ingredients (recipeId, ingredientId, quantity, unit, preparation, isEssential, ingredientGroup)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        for (const ing of recipe.ingredients) {
          const exists = sqliteDb.prepare('SELECT 1 FROM ingredients WHERE id = ?').get(ing.ingredientId);
          if (!exists) {
            console.warn(`⚠️ Skipping unrecognized AI ingredient: ${ing.ingredientId}`);
            continue;
          }
          const validatedId = ing.ingredientId;
          insertIng.run(
            recipeId,
            validatedId,
            ing.quantity || 1,
            ing.unit || 'unit',
            ing.preparation || '',
            ing.isEssential ? 1 : 0,
            ing.group || 'Main'
          );
        }
      }

      sqliteDb.prepare(`
        INSERT INTO generation_history (user_id, ingredient_ids, cuisine_id, generated_recipe_id)
        VALUES (?, ?, ?, ?)
      `).run(
        userId,
        JSON.stringify(ingredientIds),
        cuisineId,
        recipeId
      );
    })();
  }

  /**
   * Relational transaction to save a recipe to a user account.
   */
  async saveRecipe(userId, recipeId) {
    if (!isFirebaseInitialized) {
      console.warn('⚠️ Firebase not initialized. Falling back to SQLite for saveRecipe.');
      return this._saveRecipeSqlite(userId, recipeId);
    }

    try {
      // Assert recipe exists
      const recipeRef = firestoreDb.collection('recipes').doc(recipeId);
      const recipeDoc = await recipeRef.get();
      if (!recipeDoc.exists) {
        throw new Error(`Recipe not found: "${recipeId}".`);
      }

      // Check if already saved
      const savedQuery = await firestoreDb.collection('saved_recipes')
        .where('user_id', '==', userId)
        .where('recipe_id', '==', recipeId)
        .get();

      if (!savedQuery.empty) {
        return false; // Already saved
      }

      await firestoreDb.collection('saved_recipes').add({
        user_id: userId,
        recipe_id: recipeId,
        timestamp: new Date().toISOString()
      });

      return true;
    } catch (error) {
      console.error('❌ Firestore saveRecipe error, falling back to SQLite:', error.message);
      return this._saveRecipeSqlite(userId, recipeId);
    }
  }

  _saveRecipeSqlite(userId, recipeId) {
    const user = sqliteDb.prepare('SELECT 1 FROM users WHERE id = ?').get(userId);
    if (!user) {
      throw new Error(`User not found: "${userId}".`);
    }

    const recipe = sqliteDb.prepare('SELECT 1 FROM recipes WHERE id = ?').get(recipeId);
    if (!recipe) {
      throw new Error(`Recipe not found: "${recipeId}".`);
    }

    const exists = sqliteDb.prepare('SELECT 1 FROM saved_recipes WHERE user_id = ? AND recipe_id = ?').get(userId, recipeId);
    if (exists) {
      return false; 
    }

    sqliteDb.prepare('INSERT INTO saved_recipes (user_id, recipe_id) VALUES (?, ?)').run(userId, recipeId);
    return true;
  }

  /**
   * Searches the ingredients database for matches.
   */
  async searchIngredients(queryText) {
    await this._ensureCache();
    if (!queryText || !queryText.trim()) return [];
    return this.ingredientsCache
      .filter(ing => matchIngredient(ing, queryText, 'en') || matchIngredient(ing, queryText, 'bn'))
      .slice(0, 15);
  }

  /**
   * Invalidates in-memory caches and clears LRU match cache.
   */
  async invalidateCache() {
    this.cuisinesCache = null;
    this.ingredientsCache = null;
    this.recipesCache = null;
    this.lastHydrated = 0;
    cacheService.clear();
    await this._ensureCache();
  }

  /**
   * Retrieves aggregated statistics and health metrics for the admin dashboard.
   */
  async getAdminStats() {
    await this._ensureCache();

    const totalRecipes = sqliteDb.prepare('SELECT COUNT(*) as count FROM recipes').get().count;
    const totalIngredients = sqliteDb.prepare('SELECT COUNT(*) as count FROM ingredients').get().count;
    const totalCuisines = sqliteDb.prepare('SELECT COUNT(*) as count FROM cuisines').get().count;
    const totalUsers = sqliteDb.prepare('SELECT COUNT(*) as count FROM users').get().count;
    const totalSaved = sqliteDb.prepare('SELECT COUNT(*) as count FROM saved_recipes').get().count;
    const totalGenerations = sqliteDb.prepare('SELECT COUNT(*) as count FROM generation_history').get().count;

    // Cuisine distribution
    const cuisineDistribution = sqliteDb.prepare(`
      SELECT c.id, c.name, c.nameBn, c.emoji, c.color, COUNT(r.id) as count
      FROM cuisines c
      LEFT JOIN recipes r ON c.id = r.cuisineId
      GROUP BY c.id
      ORDER BY count DESC
    `).all();

    // Top used ingredients
    const topIngredients = sqliteDb.prepare(`
      SELECT i.id, i.name, i.nameBn, i.emoji, i.category, COUNT(ri.recipeId) as count
      FROM ingredients i
      JOIN recipe_ingredients ri ON i.id = ri.ingredientId
      GROUP BY i.id
      ORDER BY count DESC
      LIMIT 10
    `).all();

    // Database file size
    let dbSizeBytes = 0;
    try {
      const dbFile = path.resolve(process.cwd(), 'server', 'rannabanna.db');
      if (fs.existsSync(dbFile)) {
        dbSizeBytes = fs.statSync(dbFile).size;
      }
    } catch {
      // fallback
    }

    return {
      totalRecipes,
      totalIngredients,
      totalCuisines,
      totalUsers,
      totalSaved,
      totalGenerations,
      dbSizeBytes,
      dbSizeFormatted: (dbSizeBytes / (1024 * 1024)).toFixed(2) + ' MB',
      uptimeSeconds: Math.floor(process.uptime()),
      memoryUsageMB: (process.memoryUsage().heapUsed / (1024 * 1024)).toFixed(1),
      cuisineDistribution,
      topIngredients
    };
  }

  /**
   * Paginated, searchable recipes list for admin.
   */
  async adminGetRecipes({ search = '', cuisineId = '', difficulty = '', page = 1, limit = 20 } = {}) {
    await this._ensureCache();

    let filtered = this.recipesCache || [];

    if (cuisineId && cuisineId !== 'all') {
      filtered = filtered.filter(r => r.cuisineId === cuisineId);
    }
    if (difficulty && difficulty !== 'all') {
      filtered = filtered.filter(r => r.difficulty === difficulty);
    }
    if (search && search.trim()) {
      const q = search.toLowerCase().trim();
      filtered = filtered.filter(r =>
        (r.id && r.id.toLowerCase().includes(q)) ||
        (r.title && r.title.toLowerCase().includes(q)) ||
        (r.titleBn && r.titleBn.toLowerCase().includes(q))
      );
    }

    const total = filtered.length;
    const offset = (page - 1) * limit;
    const paginated = filtered.slice(offset, offset + limit);

    return {
      recipes: paginated,
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / limit)
    };
  }

  /**
   * Full recipe details for editing in admin.
   */
  async adminGetRecipeById(id) {
    return this.getRecipeById(id);
  }

  /**
   * Admin create recipe in SQLite.
   */
  async adminCreateRecipe(data) {
    const {
      id,
      title,
      titleBn = '',
      cuisineId,
      difficulty = 'intermediate',
      prepTime = 15,
      cookTime = 20,
      servings = 4,
      calories = 350,
      description = '',
      descriptionBn = '',
      culturalNote = '',
      culturalNoteBn = '',
      imageEmoji = '🍲',
      mealTypes = [],
      dietaryTags = [],
      ingredients = [],
      steps = []
    } = data;

    if (!id || !title || !cuisineId) {
      throw new Error('Recipe "id", "title", and "cuisineId" are required.');
    }

    // Assert cuisine exists
    const cuisineExists = sqliteDb.prepare('SELECT 1 FROM cuisines WHERE id = ?').get(cuisineId);
    if (!cuisineExists) {
      throw new Error(`Cuisine with id "${cuisineId}" does not exist.`);
    }

    // Assert id is unique
    const idExists = sqliteDb.prepare('SELECT 1 FROM recipes WHERE id = ?').get(id);
    if (idExists) {
      throw new Error(`A recipe with id "${id}" already exists.`);
    }

    const tx = sqliteDb.transaction(() => {
      // 1. Insert recipe
      sqliteDb.prepare(`
        INSERT INTO recipes (id, title, titleBn, cuisineId, difficulty, prepTime, cookTime, servings, calories, description, descriptionBn, culturalNote, culturalNoteBn, imageEmoji)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, title, titleBn, cuisineId, difficulty, prepTime, cookTime, servings, calories, description, descriptionBn, culturalNote, culturalNoteBn, imageEmoji);

      // 2. Meal types
      const insertMealType = sqliteDb.prepare('INSERT INTO recipe_meal_types (recipeId, mealType) VALUES (?, ?)');
      for (const mt of mealTypes) {
        insertMealType.run(id, mt);
      }

      // 3. Dietary tags
      const insertDietaryTag = sqliteDb.prepare('INSERT INTO recipe_dietary_tags (recipeId, dietaryTag) VALUES (?, ?)');
      for (const dt of dietaryTags) {
        insertDietaryTag.run(id, dt);
      }

      // 4. Ingredients
      const insertIng = sqliteDb.prepare(`
        INSERT INTO recipe_ingredients (recipeId, ingredientId, quantity, unit, preparation, isEssential, ingredientGroup)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      for (const ing of ingredients) {
        insertIng.run(
          id,
          ing.ingredientId || ing.id,
          ing.quantity !== undefined ? ing.quantity : 1,
          ing.unit || '',
          ing.preparation || '',
          ing.isEssential !== undefined ? (ing.isEssential ? 1 : 0) : 1,
          ing.group || ing.ingredientGroup || 'Main'
        );
      }

      // 5. Steps
      const insertStep = sqliteDb.prepare(`
        INSERT INTO recipe_steps (recipeId, stepNumber, instruction, instructionBn, duration, technique)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      let stepNum = 1;
      for (const st of steps) {
        insertStep.run(
          id,
          st.step || stepNum,
          st.instruction || '',
          st.instructionBn || '',
          st.duration || 0,
          st.technique || 'Cook'
        );
        stepNum++;
      }
    });

    tx();
    await this.invalidateCache();
    return this.getRecipeById(id);
  }

  /**
   * Admin update recipe in SQLite.
   */
  async adminUpdateRecipe(id, data) {
    const existing = sqliteDb.prepare('SELECT 1 FROM recipes WHERE id = ?').get(id);
    if (!existing) {
      throw new Error(`Recipe with id "${id}" not found.`);
    }

    const {
      title,
      titleBn,
      cuisineId,
      difficulty,
      prepTime,
      cookTime,
      servings,
      calories,
      description,
      descriptionBn,
      culturalNote,
      culturalNoteBn,
      imageEmoji,
      mealTypes,
      dietaryTags,
      ingredients,
      steps
    } = data;

    const tx = sqliteDb.transaction(() => {
      // 1. Update recipe fields
      sqliteDb.prepare(`
        UPDATE recipes SET
          title = COALESCE(?, title),
          titleBn = COALESCE(?, titleBn),
          cuisineId = COALESCE(?, cuisineId),
          difficulty = COALESCE(?, difficulty),
          prepTime = COALESCE(?, prepTime),
          cookTime = COALESCE(?, cookTime),
          servings = COALESCE(?, servings),
          calories = COALESCE(?, calories),
          description = COALESCE(?, description),
          descriptionBn = COALESCE(?, descriptionBn),
          culturalNote = COALESCE(?, culturalNote),
          culturalNoteBn = COALESCE(?, culturalNoteBn),
          imageEmoji = COALESCE(?, imageEmoji)
        WHERE id = ?
      `).run(
        title, titleBn, cuisineId, difficulty, prepTime, cookTime, servings, calories,
        description, descriptionBn, culturalNote, culturalNoteBn, imageEmoji, id
      );

      // 2. Refresh meal types if provided
      if (Array.isArray(mealTypes)) {
        sqliteDb.prepare('DELETE FROM recipe_meal_types WHERE recipeId = ?').run(id);
        const insertMealType = sqliteDb.prepare('INSERT INTO recipe_meal_types (recipeId, mealType) VALUES (?, ?)');
        for (const mt of mealTypes) {
          insertMealType.run(id, mt);
        }
      }

      // 3. Refresh dietary tags if provided
      if (Array.isArray(dietaryTags)) {
        sqliteDb.prepare('DELETE FROM recipe_dietary_tags WHERE recipeId = ?').run(id);
        const insertDietaryTag = sqliteDb.prepare('INSERT INTO recipe_dietary_tags (recipeId, dietaryTag) VALUES (?, ?)');
        for (const dt of dietaryTags) {
          insertDietaryTag.run(id, dt);
        }
      }

      // 4. Refresh ingredients if provided
      if (Array.isArray(ingredients)) {
        sqliteDb.prepare('DELETE FROM recipe_ingredients WHERE recipeId = ?').run(id);
        const insertIng = sqliteDb.prepare(`
          INSERT INTO recipe_ingredients (recipeId, ingredientId, quantity, unit, preparation, isEssential, ingredientGroup)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        for (const ing of ingredients) {
          insertIng.run(
            id,
            ing.ingredientId || ing.id,
            ing.quantity !== undefined ? ing.quantity : 1,
            ing.unit || '',
            ing.preparation || '',
            ing.isEssential !== undefined ? (ing.isEssential ? 1 : 0) : 1,
            ing.group || ing.ingredientGroup || 'Main'
          );
        }
      }

      // 5. Refresh steps if provided
      if (Array.isArray(steps)) {
        sqliteDb.prepare('DELETE FROM recipe_steps WHERE recipeId = ?').run(id);
        const insertStep = sqliteDb.prepare(`
          INSERT INTO recipe_steps (recipeId, stepNumber, instruction, instructionBn, duration, technique)
          VALUES (?, ?, ?, ?, ?, ?)
        `);
        let stepNum = 1;
        for (const st of steps) {
          insertStep.run(
            id,
            st.step || stepNum,
            st.instruction || '',
            st.instructionBn || '',
            st.duration || 0,
            st.technique || 'Cook'
          );
          stepNum++;
        }
      }
    });

    tx();
    await this.invalidateCache();
    return this.getRecipeById(id);
  }

  /**
   * Admin delete recipe in SQLite.
   */
  async adminDeleteRecipe(id) {
    const existing = sqliteDb.prepare('SELECT 1 FROM recipes WHERE id = ?').get(id);
    if (!existing) {
      throw new Error(`Recipe with id "${id}" not found.`);
    }

    sqliteDb.prepare('DELETE FROM recipes WHERE id = ?').run(id);
    await this.invalidateCache();
    return true;
  }

  /**
   * Paginated, searchable ingredients list with usage count for admin.
   */
  async adminGetIngredients({ search = '', category = '', page = 1, limit = 50 } = {}) {
    await this._ensureCache();

    let query = `
      SELECT i.*, COUNT(ri.recipeId) as recipeCount
      FROM ingredients i
      LEFT JOIN recipe_ingredients ri ON i.id = ri.ingredientId
    `;
    const whereClauses = [];
    const params = [];

    if (category && category !== 'all') {
      whereClauses.push('i.category = ?');
      params.push(category);
    }
    if (search && search.trim()) {
      whereClauses.push('(i.id LIKE ? OR i.name LIKE ? OR i.nameBn LIKE ?)');
      const q = `%${search.trim()}%`;
      params.push(q, q, q);
    }

    if (whereClauses.length > 0) {
      query += ' WHERE ' + whereClauses.join(' AND ');
    }

    query += ' GROUP BY i.id ORDER BY recipeCount DESC, i.name ASC';

    const allRows = sqliteDb.prepare(query).all(...params);
    const total = allRows.length;
    const offset = (page - 1) * limit;
    const paginated = allRows.slice(offset, offset + limit);

    return {
      ingredients: paginated,
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / limit)
    };
  }

  /**
   * Admin create ingredient in GIV.
   */
  async adminCreateIngredient(data) {
    const {
      id,
      name,
      nameBn = '',
      category = 'Pantry & Spices',
      subCategory = 'General',
      emoji = '🧂',
      sweet = 0,
      salty = 0,
      sour = 0,
      bitter = 0,
      umami = 0,
      spicy = 0,
      isCommon = 0
    } = data;

    if (!id || !name) {
      throw new Error('Ingredient "id" and "name" are required.');
    }

    const exists = sqliteDb.prepare('SELECT 1 FROM ingredients WHERE id = ?').get(id);
    if (exists) {
      throw new Error(`Ingredient with id "${id}" already exists.`);
    }

    sqliteDb.prepare(`
      INSERT INTO ingredients (id, name, nameBn, category, subCategory, emoji, sweet, salty, sour, bitter, umami, spicy, isCommon)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, name, nameBn, category, subCategory, emoji, sweet, salty, sour, bitter, umami, spicy, isCommon ? 1 : 0);

    await this.invalidateCache();
    return sqliteDb.prepare('SELECT * FROM ingredients WHERE id = ?').get(id);
  }

  /**
   * Admin update ingredient in GIV.
   */
  async adminUpdateIngredient(id, data) {
    const exists = sqliteDb.prepare('SELECT 1 FROM ingredients WHERE id = ?').get(id);
    if (!exists) {
      throw new Error(`Ingredient with id "${id}" not found.`);
    }

    const {
      name,
      nameBn,
      category,
      subCategory,
      emoji,
      sweet,
      salty,
      sour,
      bitter,
      umami,
      spicy,
      isCommon
    } = data;

    sqliteDb.prepare(`
      UPDATE ingredients SET
        name = COALESCE(?, name),
        nameBn = COALESCE(?, nameBn),
        category = COALESCE(?, category),
        subCategory = COALESCE(?, subCategory),
        emoji = COALESCE(?, emoji),
        sweet = COALESCE(?, sweet),
        salty = COALESCE(?, salty),
        sour = COALESCE(?, sour),
        bitter = COALESCE(?, bitter),
        umami = COALESCE(?, umami),
        spicy = COALESCE(?, spicy),
        isCommon = COALESCE(?, isCommon)
      WHERE id = ?
    `).run(
      name, nameBn, category, subCategory, emoji, sweet, salty, sour, bitter, umami, spicy,
      isCommon !== undefined ? (isCommon ? 1 : 0) : null,
      id
    );

    await this.invalidateCache();
    return sqliteDb.prepare('SELECT * FROM ingredients WHERE id = ?').get(id);
  }

  /**
   * Admin delete ingredient from GIV (with safety check against recipes).
   */
  async adminDeleteIngredient(id) {
    const usage = sqliteDb.prepare('SELECT COUNT(*) as count FROM recipe_ingredients WHERE ingredientId = ?').get(id);
    if (usage && usage.count > 0) {
      throw new Error(`Cannot delete ingredient "${id}": It is used in ${usage.count} recipe(s). Remove it from those recipes first.`);
    }

    const result = sqliteDb.prepare('DELETE FROM ingredients WHERE id = ?').run(id);
    if (result.changes === 0) {
      throw new Error(`Ingredient with id "${id}" not found.`);
    }

    await this.invalidateCache();
    return true;
  }

  /**
   * Admin get cuisines with recipe count.
   */
  async adminGetCuisines() {
    await this._ensureCache();
    return sqliteDb.prepare(`
      SELECT c.*, COUNT(r.id) as recipeCount
      FROM cuisines c
      LEFT JOIN recipes r ON c.id = r.cuisineId
      GROUP BY c.id
      ORDER BY c.name ASC
    `).all();
  }

  /**
   * Admin create cuisine.
   */
  async adminCreateCuisine(data) {
    const {
      id,
      name,
      nameBn = '',
      region = 'Global',
      regionBn = '',
      continent = 'Global',
      description = '',
      descriptionBn = '',
      color = '#FF6B35',
      emoji = '🌍'
    } = data;

    if (!id || !name) {
      throw new Error('Cuisine "id" and "name" are required.');
    }

    const exists = sqliteDb.prepare('SELECT 1 FROM cuisines WHERE id = ?').get(id);
    if (exists) {
      throw new Error(`Cuisine with id "${id}" already exists.`);
    }

    sqliteDb.prepare(`
      INSERT INTO cuisines (id, name, nameBn, region, regionBn, continent, description, descriptionBn, color, emoji)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, name, nameBn, region, regionBn, continent, description, descriptionBn, color, emoji);

    await this.invalidateCache();
    return sqliteDb.prepare('SELECT * FROM cuisines WHERE id = ?').get(id);
  }

  /**
   * Admin update cuisine.
   */
  async adminUpdateCuisine(id, data) {
    const exists = sqliteDb.prepare('SELECT 1 FROM cuisines WHERE id = ?').get(id);
    if (!exists) {
      throw new Error(`Cuisine with id "${id}" not found.`);
    }

    const {
      name,
      nameBn,
      region,
      regionBn,
      continent,
      description,
      descriptionBn,
      color,
      emoji
    } = data;

    sqliteDb.prepare(`
      UPDATE cuisines SET
        name = COALESCE(?, name),
        nameBn = COALESCE(?, nameBn),
        region = COALESCE(?, region),
        regionBn = COALESCE(?, regionBn),
        continent = COALESCE(?, continent),
        description = COALESCE(?, description),
        descriptionBn = COALESCE(?, descriptionBn),
        color = COALESCE(?, color),
        emoji = COALESCE(?, emoji)
      WHERE id = ?
    `).run(name, nameBn, region, regionBn, continent, description, descriptionBn, color, emoji, id);

    await this.invalidateCache();
    return sqliteDb.prepare('SELECT * FROM cuisines WHERE id = ?').get(id);
  }

  /**
   * Admin delete cuisine.
   */
  async adminDeleteCuisine(id) {
    const count = sqliteDb.prepare('SELECT COUNT(*) as count FROM recipes WHERE cuisineId = ?').get(id);
    if (count && count.count > 0) {
      throw new Error(`Cannot delete cuisine "${id}": ${count.count} recipe(s) belong to this cuisine.`);
    }

    const result = sqliteDb.prepare('DELETE FROM cuisines WHERE id = ?').run(id);
    if (result.changes === 0) {
      throw new Error(`Cuisine with id "${id}" not found.`);
    }

    await this.invalidateCache();
    return true;
  }

  /**
   * Admin get system history / logs.
   */
  async adminGetSystemLogs(limit = 50) {
    const generations = sqliteDb.prepare(`
      SELECT gh.*, u.name as userName, u.email as userEmail, r.title as recipeTitle
      FROM generation_history gh
      LEFT JOIN users u ON gh.user_id = u.id
      LEFT JOIN recipes r ON gh.generated_recipe_id = r.id
      ORDER BY gh.created_at DESC
      LIMIT ?
    `).all(limit);

    const users = sqliteDb.prepare(`
      SELECT u.id, u.name, u.email, u.created_at, COUNT(sr.recipe_id) as savedCount
      FROM users u
      LEFT JOIN saved_recipes sr ON u.id = sr.user_id
      GROUP BY u.id
      ORDER BY u.created_at DESC
      LIMIT ?
    `).all(limit);

    return { generations, users };
  }
}

export const recipeService = new RecipeService();
