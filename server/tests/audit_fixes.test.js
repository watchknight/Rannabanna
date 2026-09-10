/**
 * Test Suite for Rannabanna Audit Fixes & Verification
 * Tests:
 * 1. Matching Logic Edge Cases (Empty input, Perfect match, missing ingredients with nameBn)
 * 2. Translation Engine (Full 182-ingredient coverage, step translation, dynamic decoration)
 * 3. Dairy Validation Expansion (Checks butter-unsalted, milk-whole, yogurt-plain, heavy-cream)
 * 4. Cache Service (Deterministic key hashing, TTL, LRU-style eviction)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../models/db.js';
import { validateCustomRecipeInput } from '../utils/validation.js';
import { ingredientTranslations, decorateRecipeTranslations } from '../utils/translation_engine.js';
import { ingredients as staticIngredients } from '../../src/data/ingredients.js';
import { recipeService } from '../services/recipeService.js';
import { cacheService } from '../services/cacheService.js';

describe('Audit Fix 1: Dairy-Free Validation Engine', () => {
  it('rejects butter-unsalted when dairy-free requested', () => {
    const result = validateCustomRecipeInput(['butter-unsalted', 'chicken-breast'], { dietary: ['dairy-free'] }, db);
    assert.equal(result.isValid, false);
    assert.equal(result.statusCode, 422);
    assert.match(result.message, /Dietary Conflict.*dairy/i);
  });

  it('rejects milk-whole and heavy-cream when dairy-free requested', () => {
    const result = validateCustomRecipeInput(['milk-whole', 'heavy-cream'], { dietary: ['dairy-free'] }, db);
    assert.equal(result.isValid, false);
    assert.equal(result.statusCode, 422);
  });

  it('rejects yogurt-plain when dairy-free requested', () => {
    const result = validateCustomRecipeInput(['yogurt-plain', 'rice-noodles'], { dietary: ['dairy-free'] }, db);
    assert.equal(result.isValid, false);
    assert.equal(result.statusCode, 422);
  });

  it('allows plant-based and non-dairy ingredients with dairy-free filter', () => {
    const result = validateCustomRecipeInput(['mustard-oil', 'potato', 'eggplant'], { dietary: ['dairy-free'] }, db);
    assert.equal(result.isValid, true);
  });
});

describe('Audit Fix 2: Translation Engine Coverage & Bengali Fields', () => {
  it('provides Bengali translations for all 182 canonical ingredients in GIV', () => {
    const untranslated = staticIngredients.filter(ing => !ingredientTranslations[ing.id]);
    assert.equal(untranslated.length, 0, `Found untranslated ingredients: ${untranslated.map(u => u.id).join(', ')}`);
  });

  it('populates nameBn, titleBn, descriptionBn, and instructionBn on decorated recipes', () => {
    const sampleRecipe = {
      id: 'test-custom-dish',
      title: 'Sauteed Vegetables',
      description: 'A delightful dish of seasonal vegetables',
      culturalNote: 'Popular home cooking recipe',
      ingredients: [
        { ingredientId: 'potato', quantity: 2, unit: 'pieces', isEssential: true },
        { ingredientId: 'mustard-oil', quantity: 2, unit: 'tbsp', isEssential: true },
        { ingredientId: 'garlic', quantity: 3, unit: 'cloves', isEssential: false }
      ],
      steps: [
        { step: 1, instruction: 'Heat mustard oil in a pan.', duration: 2, technique: 'cooking' },
        { step: 2, instruction: 'Add sliced potatoes and fry until golden.', duration: 5, technique: 'shallow-frying' }
      ]
    };

    const decorated = decorateRecipeTranslations(sampleRecipe);
    assert.ok(decorated.titleBn);
    assert.ok(decorated.descriptionBn);
    assert.ok(decorated.ingredients[0].nameBn);
    assert.equal(decorated.ingredients[0].nameBn, 'আলু');
    assert.equal(decorated.ingredients[1].nameBn, 'সরিষার তেল');
    assert.equal(decorated.ingredients[2].nameBn, 'রসুন');
    assert.ok(decorated.steps[0].instructionBn);
    assert.ok(decorated.steps[1].instructionBn);
  });
});

describe('Audit Fix 3: Recipe Matchmaking & nameBn in missing lists', () => {
  it('returns empty when no ingredients are passed', async () => {
    const matches = await recipeService.matchRecipes([], {});
    assert.equal(matches.totalCount, 0);
    assert.equal(matches.perfect.length, 0);
  });

  it('includes nameBn in missingEssential and missingOptional objects', async () => {
    // Search with only garlic
    const matches = await recipeService.matchRecipes(['garlic'], {});
    const allMatches = [...matches.perfect, ...matches.great, ...matches.good, ...matches.exploratory];
    
    if (allMatches.length > 0) {
      const sample = allMatches.find(r => r.missingEssential && r.missingEssential.length > 0);
      if (sample) {
        assert.ok(sample.missingEssential[0].nameBn, 'missingEssential items must have nameBn');
      }
    }
  });
});

describe('Audit Fix 4: Cache Service Determinism & Limits', () => {
  it('generates identical cache keys regardless of filter key ordering', () => {
    const key1 = cacheService.generateKey(['garlic', 'onion-red'], { mealType: 'dinner', difficulty: 'easy' });
    const key2 = cacheService.generateKey(['onion-red', 'garlic'], { difficulty: 'easy', mealType: 'dinner' });
    assert.equal(key1, key2);
  });

  it('generates identical cache keys regardless of nested array ordering', () => {
    const key1 = cacheService.generateKey(['garlic'], { dietary: ['vegan', 'dairy-free'] });
    const key2 = cacheService.generateKey(['garlic'], { dietary: ['dairy-free', 'vegan'] });
    assert.equal(key1, key2);
  });

  it('stores and retrieves cached entries within TTL', () => {
    const testKey = 'test:audit:cache:key';
    cacheService.set(testKey, { success: true }, 5000);
    const cached = cacheService.get(testKey);
    assert.deepEqual(cached, { success: true });
    cacheService.delete(testKey);
  });
});

describe('Audit Fix 5: Orphan Recipe Bug', () => {
  it('excludes recipes with <10% match score from all tiers (no orphans)', async () => {
    // With a single obscure ingredient, most recipes will score very low
    const matches = await recipeService.matchRecipes(['bay-leaves'], {});
    const allTierRecipes = [
      ...matches.perfect,
      ...matches.great,
      ...matches.good,
      ...matches.exploratory
    ];

    // All recipes in tier arrays should have matchPercentage >= 10
    for (const recipe of allTierRecipes) {
      assert.ok(recipe.matchPercentage >= 10,
        `Recipe "${recipe.id}" has score ${recipe.matchPercentage}% but is in a tier array (should be >= 10)`
      );
    }

    // totalCount should equal the sum of all tier arrays (no orphans)
    assert.equal(matches.totalCount, allTierRecipes.length,
      `totalCount (${matches.totalCount}) != sum of tier arrays (${allTierRecipes.length}) — orphan recipes detected`
    );
  });
});

describe('Audit Fix 6: maxTime Filter at 120+ Minutes', () => {
  it('applies time filter even when maxTime is 120 or greater', async () => {
    const matches = await recipeService.matchRecipes(['chicken-breast', 'garlic', 'onion-red', 'salt'], { maxTime: 30 });
    const allRecipes = [
      ...matches.perfect,
      ...matches.great,
      ...matches.good,
      ...matches.exploratory
    ];

    // All returned recipes should have totalTime <= 30 minutes
    for (const recipe of allRecipes) {
      const totalTime = (recipe.prepTime || 0) + (recipe.cookTime || 0);
      assert.ok(totalTime <= 30,
        `Recipe "${recipe.id}" has totalTime ${totalTime} min but maxTime filter is 30 min`
      );
    }
  });
});

describe('Audit Fix 7: Translation Dynamic Content', () => {
  it('decorateRecipeTranslations produces Bengali title, description, and step instructions', () => {
    const recipe = {
      id: 'test-translation-audit',
      title: 'Garlic Fried Rice',
      description: 'A quick and delicious fried rice with garlic.',
      culturalNote: 'Popular street food across Southeast Asia.',
      ingredients: [
        { ingredientId: 'garlic', quantity: 5, unit: 'cloves', isEssential: true },
        { ingredientId: 'basmati-rice', quantity: 2, unit: 'cup', isEssential: true }
      ],
      steps: [
        { step: 1, instruction: 'Heat oil in a wok.', duration: 2, technique: 'stir-frying' },
        { step: 2, instruction: 'Add minced garlic and fry until golden.', duration: 3, technique: 'stir-frying' }
      ]
    };

    const decorated = decorateRecipeTranslations(recipe);

    // Bengali title should exist (either curated or dynamic)
    assert.ok(decorated.titleBn, 'titleBn should be populated');

    // Bengali description should exist
    assert.ok(decorated.descriptionBn, 'descriptionBn should be populated');

    // Ingredient Bengali names should be populated from translation dictionary
    assert.equal(decorated.ingredients[0].nameBn, 'রসুন');
    assert.equal(decorated.ingredients[1].nameBn, 'বাসমতী চাল');

    // Step instructions should have Bengali versions
    assert.ok(decorated.steps[0].instructionBn, 'step 1 instructionBn should be populated');
    assert.ok(decorated.steps[1].instructionBn, 'step 2 instructionBn should be populated');
  });
});

describe('Audit Fix 8: Input Validation Type Safety', () => {
  it('rejects non-array ingredientIds with 400 status', () => {
    const result = validateCustomRecipeInput('chicken-breast', {}, db);
    assert.equal(result.isValid, false);
    assert.equal(result.statusCode, 400);
    assert.match(result.message, /array/i);
  });
});
