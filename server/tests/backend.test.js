import assert from 'assert';
import { db } from '../models/db.js';
import { validateCustomRecipeInput } from '../utils/validation.js';
import { recipeService } from '../services/recipeService.js';

// Global tracking of tests count
let passedTests = 0;
let failedTests = 0;

/**
 * Custom asynchronous assertions runner log utility
 * @param {string} name 
 * @param {function} fn 
 */
async function test(name, fn) {
  try {
    await fn();
    console.log(`✅ [PASS] ${name}`);
    passedTests++;
  } catch (error) {
    console.error(`❌ [FAIL] ${name}`);
    console.error(error);
    failedTests++;
  }
}

console.log('\n🧪 ====================================================');
console.log('🧪 RUNNING RANNABANNA BACKEND CORE ENGINE INTEGRATION TESTS');
console.log('🧪 ====================================================\n');

// ═══════════════════════════════════════════════════════════
// 1. Validation Engine Unit Tests (Synchronous)
// ═══════════════════════════════════════════════════════════

await test('Validation Engine: Empty ingredient lists throw 400 Bad Request', () => {
  const result = validateCustomRecipeInput([], {}, db);
  assert.strictEqual(result.isValid, false);
  assert.strictEqual(result.statusCode, 400);
  assert.match(result.message, /at least one ingredient/);
});

await test('Validation Engine: Single ingredient suggests complementary staples', () => {
  const result = validateCustomRecipeInput(['beef-cubes'], {}, db);
  assert.strictEqual(result.isValid, false);
  assert.strictEqual(result.statusCode, 400);
  assert.match(result.message, /only one ingredient/);
  assert.ok(result.suggestions.length > 0);
  
  const suggestionsIds = result.suggestions.map(s => s.id);
  assert.ok(suggestionsIds.includes('salt'));
  assert.ok(suggestionsIds.includes('garlic'));
});

await test('Validation Engine: Gibberish unknown ingredients trigger suggestions', () => {
  const result = validateCustomRecipeInput(['asdfghjkl'], {}, db);
  assert.strictEqual(result.isValid, false);
  assert.strictEqual(result.statusCode, 422);
  assert.match(result.message, /Unknown ingredient detected/);
  assert.ok(result.suggestions.length > 0);
  console.log(`   └─ Suggestions for "asdfghjkl": [${result.suggestions.join(', ')}]`);
});

await test('Validation Engine: Vegetarian conflict detection is triggered', () => {
  const result = validateCustomRecipeInput(['chicken-breast', 'onion-red'], { dietary: ['vegetarian'] }, db);
  assert.strictEqual(result.isValid, false);
  assert.strictEqual(result.statusCode, 422);
  assert.match(result.message, /Dietary Conflict: You requested a Vegetarian recipe/);
});

await test('Validation Engine: Vegan conflict detection is triggered with eggs/paneer', () => {
  const result1 = validateCustomRecipeInput(['egg', 'onion-red'], { dietary: ['vegan'] }, db);
  assert.strictEqual(result1.isValid, false);
  assert.strictEqual(result1.statusCode, 422);
  assert.match(result1.message, /Dietary Conflict: You requested a Vegan recipe/);

  const result2 = validateCustomRecipeInput(['paneer', 'onion-red'], { dietary: ['vegan'] }, db);
  assert.strictEqual(result2.isValid, false);
  assert.strictEqual(result2.statusCode, 422);
  assert.match(result2.message, /Dietary Conflict: You requested a Vegan recipe/);
});

await test('Validation Engine: Dairy-free conflict detection is triggered', () => {
  const result = validateCustomRecipeInput(['paneer', 'onion-red'], { dietary: ['dairy-free'] }, db);
  assert.strictEqual(result.isValid, false);
  assert.strictEqual(result.statusCode, 422);
  assert.match(result.message, /Dietary Conflict: You requested a Dairy-Free recipe/);
});

// ═══════════════════════════════════════════════════════════
// 2. Weighted Matchmaking & Scoring System Integration Tests (Asynchronous)
// ═══════════════════════════════════════════════════════════

await test('Matchmaking Engine: Empty query returns blank result arrays', async () => {
  const result = await recipeService.matchRecipes([], {});
  assert.strictEqual(result.totalCount, 0);
  assert.strictEqual(result.perfect.length, 0);
});

await test('Matchmaking Engine: Exact match returns perfect score', async () => {
  const sampleRecipe = db.prepare('SELECT id, title FROM recipes LIMIT 1').get();
  
  if (!sampleRecipe) {
    console.warn('   ⚠️ Skipping exact match test (database has no recipes yet).');
    return;
  }

  const recipeIngredients = db.prepare('SELECT ingredientId FROM recipe_ingredients WHERE recipeId = ? AND isEssential = 1').all(sampleRecipe.id);
  const ingredientIds = recipeIngredients.map(ri => ri.ingredientId);

  if (ingredientIds.length === 0) {
    console.warn(`   ⚠️ Skipping exact match test for recipe "${sampleRecipe.title}" (no essential ingredients).`);
    return;
  }

  const result = await recipeService.matchRecipes(ingredientIds, {});
  
  const matchedSample = [...result.perfect, ...result.great].find(r => r.id === sampleRecipe.id);
  
  assert.ok(matchedSample, `Recipe "${sampleRecipe.title}" should be matched successfully.`);
  assert.ok(matchedSample.matchPercentage >= 85, `Recipe match score ${matchedSample.matchPercentage}% should be high.`);
});

await test('Matchmaking Engine: Invalid filters filter out matched recipes', async () => {
  const sampleRecipe = db.prepare('SELECT id, cuisineId FROM recipes LIMIT 1').get();
  if (!sampleRecipe) return;

  const recipeIngredients = db.prepare('SELECT ingredientId FROM recipe_ingredients WHERE recipeId = ?').all(sampleRecipe.id);
  const ingredientIds = recipeIngredients.map(ri => ri.ingredientId);

  const wrongCuisine = sampleRecipe.cuisineId === 'bengali' ? 'italian' : 'bengali';
  const result = await recipeService.matchRecipes(ingredientIds, { cuisines: [wrongCuisine] });
  
  const matchedSample = [...result.perfect, ...result.great, ...result.good, ...result.exploratory].find(r => r.id === sampleRecipe.id);
  assert.strictEqual(matchedSample, undefined, 'Recipe should be filtered out by conflicting cuisine criteria.');
});

// ═══════════════════════════════════════════════════════════
// Final Reports Summaries
// ═══════════════════════════════════════════════════════════
console.log('\n📊 ====================================================');
console.log('📊 RANNABANNA TEST SUITE RESULTS REPORT');
console.log('📊 ====================================================');
console.log(`📈 Passed Tests: ${passedTests}`);
console.log(`📉 Failed Tests: ${failedTests}`);
console.log(`🌍 Test Success Ratio: ${((passedTests / (passedTests + failedTests)) * 100).toFixed(1)}%`);
console.log('📊 ====================================================\n');

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
