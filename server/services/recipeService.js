import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { db as firestoreDb, isFirebaseInitialized } from '../models/firebase.js';
import { pool, query } from '../models/db.js';
import { cacheService } from './cacheService.js';
import { GoogleGenAI } from '@google/genai';
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
        await this._hydrateFromPostgres();
      }
      this.lastHydrated = Date.now();
      console.log(`✅ Cache hydrated: ${this.cuisinesCache.length} cuisines, ${this.ingredientsCache.length} ingredients, and ${this.recipesCache.length} recipes ready.`);
    } catch (error) {
      console.error('❌ Cache hydration failed, retrying from PostgreSQL:', error.message);
      await this._hydrateFromPostgres();
      this.lastHydrated = Date.now();
    }
  }

  async _hydrateFromPostgres() {
    console.log('🐘 Hydrating caches directly from PostgreSQL (Supabase)...');
    
    // 1. Cuisines
    const cuisinesRes = await query('SELECT * FROM cuisines');
    this.cuisinesCache = cuisinesRes.rows.map(c => ({
      ...c,
      ...(cuisineTranslations[c.id] || {})
    }));

    // 2. Ingredients
    const ingredientsRows = await this._getAllIngredientsPostgres();
    this.ingredientsCache = ingredientsRows.map(i => ({
      ...i,
      nameBn: ingredientTranslations[i.id] || i.name
    }));

    // 3. Recipes (High-performance bulk hydration)
    const [recipesRes, mealTypesRes, dietaryTagsRes, stepsRes, ingredientsRes] = await Promise.all([
      query('SELECT * FROM recipes'),
      query('SELECT * FROM recipe_meal_types'),
      query('SELECT * FROM recipe_dietary_tags'),
      query('SELECT "recipeId", "stepNumber" as step, "instruction", "instructionBn", "duration", "technique" FROM recipe_steps ORDER BY "recipeId", "stepNumber"'),
      query(`
        SELECT ri."recipeId", ri."ingredientId", ri."quantity", ri."unit", ri."preparation", ri."isEssential", ri."ingredientGroup" as "group", i."name", i."emoji"
        FROM recipe_ingredients ri
        JOIN ingredients i ON ri."ingredientId" = i."id"
      `)
    ]);

    const mtMap = new Map();
    for (const m of mealTypesRes.rows) {
      if (!mtMap.has(m.recipeId)) mtMap.set(m.recipeId, []);
      mtMap.get(m.recipeId).push(m.mealType);
    }

    const dtMap = new Map();
    for (const d of dietaryTagsRes.rows) {
      if (!dtMap.has(d.recipeId)) dtMap.set(d.recipeId, []);
      dtMap.get(d.recipeId).push(d.dietaryTag);
    }

    const stMap = new Map();
    for (const s of stepsRes.rows) {
      if (!stMap.has(s.recipeId)) stMap.set(s.recipeId, []);
      stMap.get(s.recipeId).push(s);
    }

    const ingMap = new Map();
    for (const i of ingredientsRes.rows) {
      if (!ingMap.has(i.recipeId)) ingMap.set(i.recipeId, []);
      ingMap.get(i.recipeId).push({
        ingredientId: i.ingredientId,
        quantity: i.quantity !== null ? Number(i.quantity) : 1,
        unit: i.unit,
        preparation: i.preparation,
        isEssential: Boolean(i.isEssential),
        group: i.group,
        name: i.name,
        emoji: i.emoji
      });
    }

    this.recipesCache = recipesRes.rows.map(r => {
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

  _hydrateFromSqlite() {
    return this._hydrateFromPostgres();
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

  async _getAllIngredientsPostgres() {
    const res = await query('SELECT * FROM ingredients');
    return res.rows.map(r => ({
      id: r.id,
      name: r.name,
      category: r.category,
      subCategory: r.subCategory,
      emoji: r.emoji,
      flavorProfile: {
        sweet: r.sweet || 0,
        salty: r.salty || 0,
        sour: r.sour || 0,
        bitter: r.bitter || 0,
        umami: r.umami || 0,
        spicy: r.spicy || 0
      },
      isCommon: Boolean(r.isCommon)
    }));
  }

  _getAllIngredientsSqlite() {
    return this._getAllIngredientsPostgres();
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
      console.error('❌ Cache matchmaking error, falling back to PostgreSQL:', error.message);
      return await this._matchRecipesPostgres(ingredientIds, filters);
    }
  }

  async _matchRecipesPostgres(ingredientIds = [], filters = {}) {
    const selectedSet = new Set(ingredientIds);

    const [recipesRes, allIngredientsRes, allRecipeIngredientsRes, allMealTypesRes, allDietaryTagsRes] = await Promise.all([
      query('SELECT * FROM recipes'),
      query('SELECT * FROM ingredients'),
      query('SELECT "recipeId", "ingredientId", "isEssential" FROM recipe_ingredients'),
      query('SELECT "recipeId", "mealType" FROM recipe_meal_types'),
      query('SELECT "recipeId", "dietaryTag" FROM recipe_dietary_tags')
    ]);

    const recipesList = recipesRes.rows;
    const allIngredients = allIngredientsRes.rows;
    const ingredientMap = new Map(allIngredients.map(i => [i.id, i]));

    const recipeIngMap = new Map();
    for (const ri of allRecipeIngredientsRes.rows) {
      if (!recipeIngMap.has(ri.recipeId)) recipeIngMap.set(ri.recipeId, []);
      recipeIngMap.get(ri.recipeId).push({
        ...ri,
        isEssential: Boolean(ri.isEssential)
      });
    }

    const mealTypeMap = new Map();
    for (const mt of allMealTypesRes.rows) {
      if (!mealTypeMap.has(mt.recipeId)) mealTypeMap.set(mt.recipeId, []);
      mealTypeMap.get(mt.recipeId).push(mt.mealType);
    }

    const dietaryTagMap = new Map();
    for (const dt of allDietaryTagsRes.rows) {
      if (!dietaryTagMap.has(dt.recipeId)) dietaryTagMap.set(dt.recipeId, []);
      dietaryTagMap.get(dt.recipeId).push(dt.dietaryTag);
    }

    const matchedRecipes = [];

    for (const r of recipesList) {
      const rIngredients = recipeIngMap.get(r.id) || [];
      const hasAnyMatch = rIngredients.some(ri => selectedSet.has(ri.ingredientId));
      if (!hasAnyMatch) continue;

      const essential = rIngredients.filter(ri => ri.isEssential);
      const optional = rIngredients.filter(ri => !ri.isEssential);

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

  _matchRecipesSqlite(ingredientIds = [], filters = {}) {
    return this._matchRecipesPostgres(ingredientIds, filters);
  }

  /**
   * Fetches detailed recipe.
   */
  async getRecipeById(recipeId) {
    await this._ensureCache();
    const cached = this.recipesCache ? this.recipesCache.find(r => r.id === recipeId) : null;
    if (cached) return cached;
    return this._getRecipeByIdPostgres(recipeId);
  }

  async _getRecipeByIdPostgres(recipeId) {
    const recipeRes = await query('SELECT * FROM recipes WHERE "id" = $1', [recipeId]);
    if (recipeRes.rows.length === 0) return null;
    const recipe = recipeRes.rows[0];

    const [mealTypesRes, dietaryTagsRes, stepsRes, ingredientsRes] = await Promise.all([
      query('SELECT "mealType" FROM recipe_meal_types WHERE "recipeId" = $1', [recipe.id]),
      query('SELECT "dietaryTag" FROM recipe_dietary_tags WHERE "recipeId" = $1', [recipe.id]),
      query('SELECT "stepNumber" as step, "instruction", "instructionBn", "duration", "technique" FROM recipe_steps WHERE "recipeId" = $1 ORDER BY "stepNumber"', [recipe.id]),
      query(`
        SELECT ri."ingredientId", ri."quantity", ri."unit", ri."preparation", ri."isEssential", ri."ingredientGroup" as "group", i."name", i."emoji"
        FROM recipe_ingredients ri
        JOIN ingredients i ON ri."ingredientId" = i."id"
        WHERE ri."recipeId" = $1
      `, [recipe.id])
    ]);

    const mealTypes = mealTypesRes.rows.map(r => r.mealType);
    const dietaryTags = dietaryTagsRes.rows.map(r => r.dietaryTag);
    const steps = stepsRes.rows;
    const recipeIngredients = ingredientsRes.rows.map(r => ({
      ingredientId: r.ingredientId,
      quantity: r.quantity !== null ? Number(r.quantity) : 1,
      unit: r.unit,
      preparation: r.preparation,
      isEssential: Boolean(r.isEssential),
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

  _getRecipeByIdSqlite(recipeId) {
    return this._getRecipeByIdPostgres(recipeId);
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
        const ai = new GoogleGenAI({ apiKey });
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

        const result = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: prompt,
          config: {
            thinkingConfig: {
              thinkingLevel: 'low'
            }
          }
        });
        let text = (result.text || '').trim();
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
        console.error('❌ Firestore save generated recipe error, falling back to PostgreSQL:', error.message);
        await this._saveCustomRecipePostgres(recipeId, finalRecipeObj, ingredientIds, cuisineId, userId);
      }
    } else {
      await this._saveCustomRecipePostgres(recipeId, finalRecipeObj, ingredientIds, cuisineId, userId);
    }

    // Invalidate the cache to ensure the new custom recipe is loaded on subsequent calls
    this.invalidateCache();

    return finalRecipeObj;
  }

  async _saveCustomRecipePostgres(recipeId, recipe, ingredientIds, cuisineId, userId) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(`
        INSERT INTO recipes ("id", "title", "titleBn", "cuisineId", "difficulty", "prepTime", "cookTime", "servings", "baseServings", "calories", "description", "descriptionBn", "culturalNote", "culturalNoteBn", "imageEmoji")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        ON CONFLICT ("id") DO NOTHING
      `, [
        recipeId,
        recipe.title,
        recipe.titleBn || '',
        recipe.cuisineId || 'bengali',
        recipe.difficulty || 'intermediate',
        recipe.prepTime || 15,
        recipe.cookTime || 20,
        recipe.servings || 4,
        recipe.baseServings || recipe.servings || 4,
        recipe.calories || 300,
        recipe.description || 'A unique custom recipe crafted by our Chef.',
        recipe.descriptionBn || '',
        recipe.culturalNote || '',
        recipe.culturalNoteBn || '',
        recipe.imageEmoji || '🍲'
      ]);

      if (Array.isArray(recipe.mealType)) {
        for (const mt of recipe.mealType) {
          await client.query(`
            INSERT INTO recipe_meal_types ("recipeId", "mealType")
            VALUES ($1, $2)
            ON CONFLICT ("recipeId", "mealType") DO NOTHING
          `, [recipeId, mt]);
        }
      }

      if (Array.isArray(recipe.dietaryTags)) {
        for (const dt of recipe.dietaryTags) {
          await client.query(`
            INSERT INTO recipe_dietary_tags ("recipeId", "dietaryTag")
            VALUES ($1, $2)
            ON CONFLICT ("recipeId", "dietaryTag") DO NOTHING
          `, [recipeId, dt]);
        }
      }

      if (Array.isArray(recipe.steps)) {
        for (const s of recipe.steps) {
          await client.query(`
            INSERT INTO recipe_steps ("recipeId", "stepNumber", "instruction", "instructionBn", "duration", "technique")
            VALUES ($1, $2, $3, $4, $5, $6)
          `, [
            recipeId,
            s.step || 1,
            s.instruction,
            s.instructionBn || '',
            s.duration || 0,
            s.technique || 'cooking'
          ]);
        }
      }

      if (Array.isArray(recipe.ingredients)) {
        for (const ing of recipe.ingredients) {
          const exists = await client.query('SELECT 1 FROM ingredients WHERE "id" = $1', [ing.ingredientId]);
          if (exists.rowCount === 0) {
            console.warn(`⚠️ Skipping unrecognized AI ingredient: ${ing.ingredientId}`);
            continue;
          }
          await client.query(`
            INSERT INTO recipe_ingredients ("recipeId", "ingredientId", "quantity", "unit", "preparation", "isEssential", "ingredientGroup")
            VALUES ($1, $2, $3, $4, $5, $6, $7)
          `, [
            recipeId,
            ing.ingredientId,
            ing.quantity || 1,
            ing.unit || 'unit',
            ing.preparation || '',
            Boolean(ing.isEssential),
            ing.group || ing.ingredientGroup || 'Main'
          ]);
        }
      }

      // Check if user exists before adding foreign key reference
      let validUserId = null;
      if (userId) {
        const userCheck = await client.query('SELECT 1 FROM users WHERE "id" = $1', [userId]);
        if (userCheck.rowCount > 0) {
          validUserId = userId;
        }
      }

      await client.query(`
        INSERT INTO generation_history ("user_id", "ingredient_ids", "cuisine_id", "generated_recipe_id")
        VALUES ($1, $2, $3, $4)
      `, [
        validUserId,
        JSON.stringify(ingredientIds),
        cuisineId || 'any',
        recipeId
      ]);

      await client.query('COMMIT');
      this.invalidateCache();
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  _saveCustomRecipeSqlite(recipeId, recipe, ingredientIds, cuisineId, userId) {
    return this._saveCustomRecipePostgres(recipeId, recipe, ingredientIds, cuisineId, userId);
  }

  /**
   * Relational transaction to save a recipe to a user account.
   */
  async saveRecipe(userId, recipeId) {
    if (!isFirebaseInitialized) {
      console.warn('⚠️ Firebase not initialized. Falling back to PostgreSQL for saveRecipe.');
      return this._saveRecipePostgres(userId, recipeId);
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
      console.error('❌ Firestore saveRecipe error, falling back to PostgreSQL:', error.message);
      return this._saveRecipePostgres(userId, recipeId);
    }
  }

  async _saveRecipePostgres(userId, recipeId) {
    const user = await query('SELECT 1 FROM users WHERE "id" = $1', [userId]);
    if (user.rowCount === 0) {
      throw new Error(`User not found: "${userId}".`);
    }

    const recipe = await query('SELECT 1 FROM recipes WHERE "id" = $1', [recipeId]);
    if (recipe.rowCount === 0) {
      throw new Error(`Recipe not found: "${recipeId}".`);
    }

    const exists = await query('SELECT 1 FROM saved_recipes WHERE "user_id" = $1 AND "recipe_id" = $2', [userId, recipeId]);
    if (exists.rowCount > 0) {
      return false; 
    }

    await query('INSERT INTO saved_recipes ("user_id", "recipe_id") VALUES ($1, $2) ON CONFLICT ("user_id", "recipe_id") DO NOTHING', [userId, recipeId]);
    return true;
  }

  _saveRecipeSqlite(userId, recipeId) {
    return this._saveRecipePostgres(userId, recipeId);
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

    const [
      recipesRes,
      ingredientsRes,
      cuisinesRes,
      usersRes,
      savedRes,
      generationsRes,
      cuisineDistRes,
      topIngRes,
      dbSizeRes
    ] = await Promise.all([
      query('SELECT COUNT(*)::int as count FROM recipes'),
      query('SELECT COUNT(*)::int as count FROM ingredients'),
      query('SELECT COUNT(*)::int as count FROM cuisines'),
      query('SELECT COUNT(*)::int as count FROM users'),
      query('SELECT COUNT(*)::int as count FROM saved_recipes'),
      query('SELECT COUNT(*)::int as count FROM generation_history'),
      query(`
        SELECT c."id", c."name", c."nameBn", c."emoji", c."color", COUNT(r."id")::int as count
        FROM cuisines c
        LEFT JOIN recipes r ON c."id" = r."cuisineId"
        GROUP BY c."id", c."name", c."nameBn", c."emoji", c."color"
        ORDER BY count DESC
      `),
      query(`
        SELECT i."id", i."name", i."nameBn", i."emoji", i."category", COUNT(ri."recipeId")::int as count
        FROM ingredients i
        JOIN recipe_ingredients ri ON i."id" = ri."ingredientId"
        GROUP BY i."id", i."name", i."nameBn", i."emoji", i."category"
        ORDER BY count DESC
        LIMIT 10
      `),
      query('SELECT pg_database_size(current_database())::bigint as size').catch(() => ({ rows: [{ size: 0 }] }))
    ]);

    const totalRecipes = recipesRes.rows[0]?.count || 0;
    const totalIngredients = ingredientsRes.rows[0]?.count || 0;
    const totalCuisines = cuisinesRes.rows[0]?.count || 0;
    const totalUsers = usersRes.rows[0]?.count || 0;
    const totalSaved = savedRes.rows[0]?.count || 0;
    const totalGenerations = generationsRes.rows[0]?.count || 0;
    const cuisineDistribution = cuisineDistRes.rows;
    const topIngredients = topIngRes.rows;

    let dbSizeBytes = Number(dbSizeRes.rows[0]?.size) || 0;
    if (dbSizeBytes === 0) {
      try {
        const dbFile = path.resolve(process.cwd(), 'server', 'rannabanna.db');
        if (fs.existsSync(dbFile)) {
          dbSizeBytes = fs.statSync(dbFile).size;
        }
      } catch {
        // fallback
      }
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
    const cuisineExists = await query('SELECT 1 FROM cuisines WHERE "id" = $1', [cuisineId]);
    if (cuisineExists.rowCount === 0) {
      throw new Error(`Cuisine with id "${cuisineId}" does not exist.`);
    }

    // Assert id is unique
    const idExists = await query('SELECT 1 FROM recipes WHERE "id" = $1', [id]);
    if (idExists.rowCount > 0) {
      throw new Error(`A recipe with id "${id}" already exists.`);
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Insert recipe
      await client.query(`
        INSERT INTO recipes ("id", "title", "titleBn", "cuisineId", "difficulty", "prepTime", "cookTime", "servings", "baseServings", "calories", "description", "descriptionBn", "culturalNote", "culturalNoteBn", "imageEmoji")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      `, [
        id, title, titleBn, cuisineId, difficulty, prepTime, cookTime, servings, servings, calories, description, descriptionBn, culturalNote, culturalNoteBn, imageEmoji
      ]);

      // 2. Meal types
      for (const mt of mealTypes) {
        await client.query(`
          INSERT INTO recipe_meal_types ("recipeId", "mealType")
          VALUES ($1, $2)
          ON CONFLICT ("recipeId", "mealType") DO NOTHING
        `, [id, mt]);
      }

      // 3. Dietary tags
      for (const dt of dietaryTags) {
        await client.query(`
          INSERT INTO recipe_dietary_tags ("recipeId", "dietaryTag")
          VALUES ($1, $2)
          ON CONFLICT ("recipeId", "dietaryTag") DO NOTHING
        `, [id, dt]);
      }

      // 4. Ingredients
      for (const ing of ingredients) {
        await client.query(`
          INSERT INTO recipe_ingredients ("recipeId", "ingredientId", "quantity", "unit", "preparation", "isEssential", "ingredientGroup")
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
          id,
          ing.ingredientId || ing.id,
          ing.quantity !== undefined ? ing.quantity : 1,
          ing.unit || '',
          ing.preparation || '',
          ing.isEssential !== undefined ? Boolean(ing.isEssential) : true,
          ing.group || ing.ingredientGroup || 'Main'
        ]);
      }

      // 5. Steps
      let stepNum = 1;
      for (const st of steps) {
        await client.query(`
          INSERT INTO recipe_steps ("recipeId", "stepNumber", "instruction", "instructionBn", "duration", "technique")
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [
          id,
          st.step || stepNum,
          st.instruction || '',
          st.instructionBn || '',
          st.duration || 0,
          st.technique || 'Cook'
        ]);
        stepNum++;
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    await this.invalidateCache();
    return this.getRecipeById(id);
  }

  /**
   * Admin update recipe in PostgreSQL.
   */
  async adminUpdateRecipe(id, data) {
    const existing = await query('SELECT 1 FROM recipes WHERE "id" = $1', [id]);
    if (existing.rowCount === 0) {
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

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Update recipe fields
      await client.query(`
        UPDATE recipes SET
          "title" = COALESCE($1, "title"),
          "titleBn" = COALESCE($2, "titleBn"),
          "cuisineId" = COALESCE($3, "cuisineId"),
          "difficulty" = COALESCE($4, "difficulty"),
          "prepTime" = COALESCE($5, "prepTime"),
          "cookTime" = COALESCE($6, "cookTime"),
          "servings" = COALESCE($7, "servings"),
          "baseServings" = COALESCE($7, "baseServings"),
          "calories" = COALESCE($8, "calories"),
          "description" = COALESCE($9, "description"),
          "descriptionBn" = COALESCE($10, "descriptionBn"),
          "culturalNote" = COALESCE($11, "culturalNote"),
          "culturalNoteBn" = COALESCE($12, "culturalNoteBn"),
          "imageEmoji" = COALESCE($13, "imageEmoji")
        WHERE "id" = $14
      `, [
        title, titleBn, cuisineId, difficulty, prepTime, cookTime, servings, calories,
        description, descriptionBn, culturalNote, culturalNoteBn, imageEmoji, id
      ]);

      // 2. Refresh meal types if provided
      if (Array.isArray(mealTypes)) {
        await client.query('DELETE FROM recipe_meal_types WHERE "recipeId" = $1', [id]);
        for (const mt of mealTypes) {
          await client.query(`
            INSERT INTO recipe_meal_types ("recipeId", "mealType")
            VALUES ($1, $2)
            ON CONFLICT ("recipeId", "mealType") DO NOTHING
          `, [id, mt]);
        }
      }

      // 3. Refresh dietary tags if provided
      if (Array.isArray(dietaryTags)) {
        await client.query('DELETE FROM recipe_dietary_tags WHERE "recipeId" = $1', [id]);
        for (const dt of dietaryTags) {
          await client.query(`
            INSERT INTO recipe_dietary_tags ("recipeId", "dietaryTag")
            VALUES ($1, $2)
            ON CONFLICT ("recipeId", "dietaryTag") DO NOTHING
          `, [id, dt]);
        }
      }

      // 4. Refresh ingredients if provided
      if (Array.isArray(ingredients)) {
        await client.query('DELETE FROM recipe_ingredients WHERE "recipeId" = $1', [id]);
        for (const ing of ingredients) {
          await client.query(`
            INSERT INTO recipe_ingredients ("recipeId", "ingredientId", "quantity", "unit", "preparation", "isEssential", "ingredientGroup")
            VALUES ($1, $2, $3, $4, $5, $6, $7)
          `, [
            id,
            ing.ingredientId || ing.id,
            ing.quantity !== undefined ? ing.quantity : 1,
            ing.unit || '',
            ing.preparation || '',
            ing.isEssential !== undefined ? Boolean(ing.isEssential) : true,
            ing.group || ing.ingredientGroup || 'Main'
          ]);
        }
      }

      // 5. Refresh steps if provided
      if (Array.isArray(steps)) {
        await client.query('DELETE FROM recipe_steps WHERE "recipeId" = $1', [id]);
        let stepNum = 1;
        for (const st of steps) {
          await client.query(`
            INSERT INTO recipe_steps ("recipeId", "stepNumber", "instruction", "instructionBn", "duration", "technique")
            VALUES ($1, $2, $3, $4, $5, $6)
          `, [
            id,
            st.step || stepNum,
            st.instruction || '',
            st.instructionBn || '',
            st.duration || 0,
            st.technique || 'Cook'
          ]);
          stepNum++;
        }
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    await this.invalidateCache();
    return this.getRecipeById(id);
  }

  /**
   * Admin delete recipe in PostgreSQL.
   */
  async adminDeleteRecipe(id) {
    const existing = await query('SELECT 1 FROM recipes WHERE "id" = $1', [id]);
    if (existing.rowCount === 0) {
      throw new Error(`Recipe with id "${id}" not found.`);
    }

    await query('DELETE FROM recipes WHERE "id" = $1', [id]);
    await this.invalidateCache();
    return true;
  }

  /**
   * Paginated, searchable ingredients list with usage count for admin.
   */
  async adminGetIngredients({ search = '', category = '', page = 1, limit = 50 } = {}) {
    await this._ensureCache();

    let sql = `
      SELECT i.*, COUNT(ri."recipeId")::int as "recipeCount"
      FROM ingredients i
      LEFT JOIN recipe_ingredients ri ON i."id" = ri."ingredientId"
    `;
    const whereClauses = [];
    const params = [];

    if (category && category !== 'all') {
      params.push(category);
      whereClauses.push(`i."category" = $${params.length}`);
    }
    if (search && search.trim()) {
      params.push(`%${search.trim()}%`);
      const pIdx = params.length;
      whereClauses.push(`(i."id" ILIKE $${pIdx} OR i."name" ILIKE $${pIdx} OR i."nameBn" ILIKE $${pIdx})`);
    }

    if (whereClauses.length > 0) {
      sql += ' WHERE ' + whereClauses.join(' AND ');
    }

    sql += ' GROUP BY i."id" ORDER BY "recipeCount" DESC, i."name" ASC';

    const result = await query(sql, params);
    const allRows = result.rows;
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
      isCommon = false
    } = data;

    if (!id || !name) {
      throw new Error('Ingredient "id" and "name" are required.');
    }

    const exists = await query('SELECT 1 FROM ingredients WHERE "id" = $1', [id]);
    if (exists.rowCount > 0) {
      throw new Error(`Ingredient with id "${id}" already exists.`);
    }

    await query(`
      INSERT INTO ingredients ("id", "name", "nameBn", "category", "subCategory", "emoji", "sweet", "salty", "sour", "bitter", "umami", "spicy", "isCommon")
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    `, [
      id, name, nameBn, category, subCategory, emoji, sweet, salty, sour, bitter, umami, spicy, Boolean(isCommon)
    ]);

    await this.invalidateCache();
    const created = await query('SELECT * FROM ingredients WHERE "id" = $1', [id]);
    return created.rows[0];
  }

  /**
   * Admin update ingredient in GIV.
   */
  async adminUpdateIngredient(id, data) {
    const exists = await query('SELECT 1 FROM ingredients WHERE "id" = $1', [id]);
    if (exists.rowCount === 0) {
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

    await query(`
      UPDATE ingredients SET
        "name" = COALESCE($1, "name"),
        "nameBn" = COALESCE($2, "nameBn"),
        "category" = COALESCE($3, "category"),
        "subCategory" = COALESCE($4, "subCategory"),
        "emoji" = COALESCE($5, "emoji"),
        "sweet" = COALESCE($6, "sweet"),
        "salty" = COALESCE($7, "salty"),
        "sour" = COALESCE($8, "sour"),
        "bitter" = COALESCE($9, "bitter"),
        "umami" = COALESCE($10, "umami"),
        "spicy" = COALESCE($11, "spicy"),
        "isCommon" = COALESCE($12, "isCommon")
      WHERE "id" = $13
    `, [
      name, nameBn, category, subCategory, emoji, sweet, salty, sour, bitter, umami, spicy,
      isCommon !== undefined ? Boolean(isCommon) : null,
      id
    ]);

    await this.invalidateCache();
    const updated = await query('SELECT * FROM ingredients WHERE "id" = $1', [id]);
    return updated.rows[0];
  }

  /**
   * Admin delete ingredient from GIV (with safety check against recipes).
   */
  async adminDeleteIngredient(id) {
    const usage = await query('SELECT COUNT(*)::int as count FROM recipe_ingredients WHERE "ingredientId" = $1', [id]);
    const usageCount = usage.rows[0]?.count || 0;
    if (usageCount > 0) {
      throw new Error(`Cannot delete ingredient "${id}": It is used in ${usageCount} recipe(s). Remove it from those recipes first.`);
    }

    const result = await query('DELETE FROM ingredients WHERE "id" = $1', [id]);
    if (result.rowCount === 0) {
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
    const res = await query(`
      SELECT c.*, COUNT(r."id")::int as "recipeCount"
      FROM cuisines c
      LEFT JOIN recipes r ON c."id" = r."cuisineId"
      GROUP BY c."id"
      ORDER BY c."name" ASC
    `);
    return res.rows;
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

    const exists = await query('SELECT 1 FROM cuisines WHERE "id" = $1', [id]);
    if (exists.rowCount > 0) {
      throw new Error(`Cuisine with id "${id}" already exists.`);
    }

    await query(`
      INSERT INTO cuisines ("id", "name", "nameBn", "region", "regionBn", "continent", "description", "descriptionBn", "color", "emoji")
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `, [id, name, nameBn, region, regionBn, continent, description, descriptionBn, color, emoji]);

    await this.invalidateCache();
    const res = await query('SELECT * FROM cuisines WHERE "id" = $1', [id]);
    return res.rows[0];
  }

  /**
   * Admin update cuisine.
   */
  async adminUpdateCuisine(id, data) {
    const exists = await query('SELECT 1 FROM cuisines WHERE "id" = $1', [id]);
    if (exists.rowCount === 0) {
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

    await query(`
      UPDATE cuisines SET
        "name" = COALESCE($1, "name"),
        "nameBn" = COALESCE($2, "nameBn"),
        "region" = COALESCE($3, "region"),
        "regionBn" = COALESCE($4, "regionBn"),
        "continent" = COALESCE($5, "continent"),
        "description" = COALESCE($6, "description"),
        "descriptionBn" = COALESCE($7, "descriptionBn"),
        "color" = COALESCE($8, "color"),
        "emoji" = COALESCE($9, "emoji")
      WHERE "id" = $10
    `, [name, nameBn, region, regionBn, continent, description, descriptionBn, color, emoji, id]);

    await this.invalidateCache();
    const res = await query('SELECT * FROM cuisines WHERE "id" = $1', [id]);
    return res.rows[0];
  }

  /**
   * Admin delete cuisine.
   */
  async adminDeleteCuisine(id) {
    const countRes = await query('SELECT COUNT(*)::int as count FROM recipes WHERE "cuisineId" = $1', [id]);
    const count = countRes.rows[0]?.count || 0;
    if (count > 0) {
      throw new Error(`Cannot delete cuisine "${id}": ${count} recipe(s) belong to this cuisine.`);
    }

    const result = await query('DELETE FROM cuisines WHERE "id" = $1', [id]);
    if (result.rowCount === 0) {
      throw new Error(`Cuisine with id "${id}" not found.`);
    }

    await this.invalidateCache();
    return true;
  }

  /**
   * Admin get system history / logs.
   */
  async adminGetSystemLogs(limit = 50) {
    const generationsRes = await query(`
      SELECT gh.*, u."name" as "userName", u."email" as "userEmail", r."title" as "recipeTitle"
      FROM generation_history gh
      LEFT JOIN users u ON gh."user_id" = u."id"
      LEFT JOIN recipes r ON gh."generated_recipe_id" = r."id"
      ORDER BY gh."created_at" DESC
      LIMIT $1
    `, [limit]);

    const usersRes = await query(`
      SELECT u."id", u."name", u."email", u."created_at", COUNT(sr."recipe_id")::int as "savedCount"
      FROM users u
      LEFT JOIN saved_recipes sr ON u."id" = sr."user_id"
      GROUP BY u."id", u."name", u."email", u."created_at"
      ORDER BY u."created_at" DESC
      LIMIT $1
    `, [limit]);

    return { generations: generationsRes.rows, users: usersRes.rows };
  }
}

export const recipeService = new RecipeService();
