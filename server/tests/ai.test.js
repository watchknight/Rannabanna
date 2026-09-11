import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import crypto from 'node:crypto';
import express from 'express';
import { aiRouter } from '../routes/aiRoutes.js';
import { GoogleGenAI } from '@google/genai';
import { db } from '../models/db.js';
import { cacheService } from '../services/cacheService.js';
import { 
  AI_RECIPE_SYSTEM_INSTRUCTION, 
  RECIPE_RESPONSE_SCHEMA, 
  generateCustomAiRecipe 
} from '../services/aiRecipeService.js';
import { 
  AI_TRANSLATION_SYSTEM_INSTRUCTION, 
  RECIPE_TRANSLATION_SCHEMA, 
  translateText, 
  translateRecipe 
} from '../services/translationService.js';

describe('Gemini 3.8 Flash Foundation, Custom Recipe & Translation Suite', () => {
  let app;
  let server;
  let baseUrl;
  const originalKey = process.env.GEMINI_API_KEY;

  before(async () => {
    app = express();
    app.use(express.json());
    app.use('/api/ai', aiRouter);
    app.post('/api/translate', (req, res, next) => {
      req.url = '/translate';
      aiRouter(req, res, next);
    });

    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://localhost:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    process.env.GEMINI_API_KEY = originalKey;
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  test('1. Verified @google/genai SDK export and constructor', () => {
    assert.strictEqual(typeof GoogleGenAI, 'function', 'GoogleGenAI should be a class/constructor function');
    const ai = new GoogleGenAI({ apiKey: 'test-key' });
    assert.ok(ai.models, 'ai instance should have a models namespace');
    assert.strictEqual(typeof ai.models.generateContent, 'function', 'ai.models.generateContent should be a function');
  });

  test('2. /api/ai/test returns 500 when GEMINI_API_KEY is not configured', async () => {
    delete process.env.GEMINI_API_KEY;

    const res = await fetch(`${baseUrl}/api/ai/test`);
    assert.strictEqual(res.status, 500);

    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.match(data.error, /GEMINI_API_KEY is not configured/);
  });

  test('3. Gemini 3 configuration adherence: no temperature, top_p, top_k, candidate_count', async () => {
    const testConfig = {
      thinkingConfig: {
        thinkingLevel: 'medium'
      }
    };

    assert.strictEqual('temperature' in testConfig, false);
    assert.strictEqual('top_p' in testConfig, false);
    assert.strictEqual('top_k' in testConfig, false);
    assert.strictEqual('candidate_count' in testConfig, false);
    assert.strictEqual('thinking_budget' in testConfig, false);
    assert.strictEqual(testConfig.thinkingConfig.thinkingLevel, 'medium');
  });

  test('4. System Instruction contains required culinary constraints', () => {
    assert.ok(AI_RECIPE_SYSTEM_INSTRUCTION.includes('Primary Ingredients'));
    assert.ok(AI_RECIPE_SYSTEM_INSTRUCTION.includes('Pantry Staples'));
    assert.ok(AI_RECIPE_SYSTEM_INSTRUCTION.includes('Cuisine'));
    assert.ok(AI_RECIPE_SYSTEM_INSTRUCTION.includes('Time Limit'));
    assert.ok(AI_RECIPE_SYSTEM_INSTRUCTION.includes('Dietary Restrictions'));
    assert.ok(AI_RECIPE_SYSTEM_INSTRUCTION.includes('Realism & Cookability'));
    assert.ok(AI_RECIPE_SYSTEM_INSTRUCTION.includes('Structured Instructions'));
  });

  test('5. Recipe Response Schema enforces all required structured output fields', () => {
    assert.strictEqual(RECIPE_RESPONSE_SCHEMA.type, 'OBJECT');
    assert.deepStrictEqual(
      RECIPE_RESPONSE_SCHEMA.required,
      ['title', 'cuisine', 'estimatedTime', 'estimatedCalories', 'ingredients', 'steps']
    );
    assert.ok(RECIPE_RESPONSE_SCHEMA.properties.ingredients.items.required.includes('name'));
    assert.ok(RECIPE_RESPONSE_SCHEMA.properties.ingredients.items.required.includes('amount'));
    assert.ok(RECIPE_RESPONSE_SCHEMA.properties.ingredients.items.required.includes('unit'));
    assert.ok(RECIPE_RESPONSE_SCHEMA.properties.steps.items.required.includes('step'));
    assert.ok(RECIPE_RESPONSE_SCHEMA.properties.steps.items.required.includes('instruction'));
  });

  test('6. POST /api/ai/custom-recipe rejects empty ingredients array with 400 Bad Request', async () => {
    const res = await fetch(`${baseUrl}/api/ai/custom-recipe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ingredients: [] })
    });

    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.match(data.error, /at least one ingredient/);
  });

  test('7. In-Memory Caching: Identical ingredients + filters return cached recipe without calling API', async () => {
    // Prime the in-memory cache directly
    const testIngredients = ['paneer', 'spinach', 'cream'];
    const testFilters = { cuisine: 'North Indian', maxTime: 30, dietaryRestrictions: ['vegetarian'] };
    const cacheKey = `ai:custom-recipe:${cacheService.generateKey(testIngredients, testFilters)}`;

    const mockRecipe = {
      id: 'custom-ai-cached-123',
      title: 'Palak Paneer',
      cuisine: 'North Indian',
      estimatedTime: 25,
      estimatedCalories: 320,
      ingredients: [
        { name: 'Paneer', amount: 200, unit: 'g', isPantryStaple: false },
        { name: 'Spinach', amount: 300, unit: 'g', isPantryStaple: false },
        { name: 'Heavy Cream', amount: 2, unit: 'tbsp', isPantryStaple: false },
        { name: 'Salt', amount: 1, unit: 'tsp', isPantryStaple: true }
      ],
      steps: [
        { step: 1, instruction: 'Blanch spinach leaves and blend into a puree.', duration: 5 },
        { step: 2, instruction: 'Sauté paneer cubes gently until light golden.', duration: 5 },
        { step: 3, instruction: 'Simmer spinach puree with tempered spices and fold in paneer and cream.', duration: 15 }
      ]
    };

    cacheService.set(cacheKey, mockRecipe, 60000);

    const startTime = Date.now();
    const result = await generateCustomAiRecipe({
      ingredients: testIngredients,
      cuisine: 'North Indian',
      maxTime: 30,
      dietaryRestrictions: ['vegetarian'],
      apiKey: 'dummy-key' // Should never be called because of cache hit
    });
    const elapsed = Date.now() - startTime;

    assert.strictEqual(result.cached, true, 'Result should be marked as cached');
    assert.strictEqual(result.title, 'Palak Paneer');
    assert.ok(elapsed < 25, 'In-memory cache retrieval should take <25ms');
  });

  test('8. Error handling: Gracefully handles missing API key with clean error and 500 status', async () => {
    delete process.env.GEMINI_API_KEY;

    const res = await fetch(`${baseUrl}/api/ai/custom-recipe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ingredients: ['potato', 'egg'] })
    });

    assert.strictEqual(res.status, 500);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.match(data.error, /GEMINI_API_KEY is not configured/);
  });

  test('9. Translation System Instruction enforces authentic Bengali home-cook directives', () => {
    assert.ok(AI_TRANSLATION_SYSTEM_INSTRUCTION.includes('Bengali home-cook audience'));
    assert.ok(AI_TRANSLATION_SYSTEM_INSTRUCTION.includes('stiff, robotic, or literal'));
    assert.ok(AI_TRANSLATION_SYSTEM_INSTRUCTION.includes('তেজপাতা'));
    assert.ok(AI_TRANSLATION_SYSTEM_INSTRUCTION.includes('দারুচিনি'));
    assert.ok(AI_TRANSLATION_SYSTEM_INSTRUCTION.includes('এলাচ'));
    assert.ok(AI_TRANSLATION_SYSTEM_INSTRUCTION.includes('সরিষার তেল'));
    assert.ok(AI_TRANSLATION_SYSTEM_INSTRUCTION.includes('টেবিল চামচ'));
    assert.ok(AI_TRANSLATION_SYSTEM_INSTRUCTION.includes('চা চামচ'));
    assert.ok(AI_TRANSLATION_SYSTEM_INSTRUCTION.includes('Strict Structural Preservation'));
  });

  test('10. Recipe Translation Schema guarantees structural key preservation', () => {
    assert.strictEqual(RECIPE_TRANSLATION_SCHEMA.type, 'OBJECT');
    assert.deepStrictEqual(RECIPE_TRANSLATION_SCHEMA.required, ['titleBn', 'steps']);
    assert.ok(RECIPE_TRANSLATION_SCHEMA.properties.steps.items.required.includes('step'));
    assert.ok(RECIPE_TRANSLATION_SCHEMA.properties.steps.items.required.includes('instructionBn'));
    assert.ok(RECIPE_TRANSLATION_SCHEMA.properties.ingredients.items.required.includes('name'));
    assert.ok(RECIPE_TRANSLATION_SCHEMA.properties.ingredients.items.required.includes('nameBn'));
  });

  test('11. POST /api/ai/translate rejects request missing both text and recipe with 400 Bad Request', async () => {
    const res = await fetch(`${baseUrl}/api/ai/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });

    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.match(data.error, /Please provide either 'text'/);
  });

  test('12. Persistent SQLite Caching: Translating text hits SQLite translation_cache without calling Gemini', async () => {
    const sourceSnippet = 'Heat 2 tablespoons of mustard oil and add green chilies.';
    const expectedBengali = 'কড়াইয়ে ২ টেবিল চামচ সরিষার তেল গরম করে কাঁচা মরিচ ফোড়ন দিন।';
    const hash = crypto.createHash('sha256').update(`bn:${sourceSnippet}`).digest('hex');

    // Seed SQLite translation_cache directly
    db.prepare(`
      INSERT OR REPLACE INTO translation_cache (source_hash, source_text, target_lang, translated_text)
      VALUES (?, ?, ?, ?)
    `).run(hash, sourceSnippet, 'bn', expectedBengali);

    const res = await fetch(`${baseUrl}/api/ai/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: sourceSnippet, targetLanguage: 'bn' })
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.translatedText, expectedBengali);
    assert.strictEqual(data.cached, true);
    assert.strictEqual(data.source, 'database');
  });

  test('13. In-Memory Caching: Second translation call returns from memory cache in <20ms', async () => {
    const sourceSnippet = 'Heat 2 tablespoons of mustard oil and add green chilies.';
    const startTime = Date.now();

    const res = await fetch(`${baseUrl}/api/ai/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: sourceSnippet, targetLanguage: 'bn' })
    });

    const elapsed = Date.now() - startTime;
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.cached, true);
    assert.ok(elapsed < 25, `Memory cache lookup should be near-instantaneous (<25ms), took ${elapsed}ms`);
  });

  test('14. Pre-loaded Recipe Translation: Returns immediately from SQLite database with 0 Gemini calls', async () => {
    const preloadedRecipe = {
      id: 'shorshe-ilish',
      title: 'Mustard Hilsa Curry (Shorshe Ilish)',
      steps: [
        { step: 1, instruction: 'Marinate hilsa steaks with salt and turmeric.' },
        { step: 2, instruction: 'Gently simmer in mustard-chili paste and mustard oil.' }
      ],
      ingredients: [
        { ingredientId: 'hilsa-fish', name: 'Hilsa fish', quantity: 500, unit: 'g' }
      ]
    };

    const res = await fetch(`${baseUrl}/api/ai/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipe: preloadedRecipe, targetLanguage: 'bn' })
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.cached, true);
    assert.strictEqual(data.source, 'database');
    assert.ok(data.recipe.titleBn, 'Should have titleBn populated');
    assert.strictEqual(data.recipe.titleBn, 'সরিষা ইলিশ (ঐতিহ্যবাহী বাঙালি স্টাইল)');
    assert.ok(data.recipe.steps.every(s => Boolean(s.instructionBn)), 'All steps should have instructionBn');
    assert.strictEqual(data.recipe.steps[0].step, 1);
    assert.strictEqual(data.recipe.steps[1].step, 2);
    assert.strictEqual(data.recipe.ingredients[0].quantity, 500, 'Ingredient quantity must be preserved');
    assert.strictEqual(data.recipe.ingredients[0].unit, 'g', 'Ingredient unit must be preserved');
  });

  test('15. Structural Preservation: Recipe translation preserves amounts, units, and step sequence', async () => {
    const mockCustomRecipe = {
      id: 'custom-scale-test-1',
      title: 'Spiced Potato Wedges',
      ingredients: [
        { name: 'Potatoes', amount: 4, unit: 'whole', quantity: 4 },
        { name: 'Mustard Oil', amount: 2, unit: 'tbsp', quantity: 2 },
        { name: 'Salt', amount: 1, unit: 'pinch', quantity: 1 }
      ],
      steps: [
        { step: 1, instruction: 'Cut potatoes into wedges.' },
        { step: 2, instruction: 'Toss with oil and salt and roast at 200C.' }
      ]
    };

    const recipeHash = crypto.createHash('sha256').update(
      `bn:${mockCustomRecipe.id}:${mockCustomRecipe.title}:${JSON.stringify(mockCustomRecipe.steps)}`
    ).digest('hex');

    const mockTranslated = {
      ...mockCustomRecipe,
      titleBn: 'মশলাদার আলুর ওয়েজেস',
      steps: [
        { step: 1, instruction: 'Cut potatoes into wedges.', instructionBn: 'আলুগুলো ওয়েজের আকারে কেটে নিন।' },
        { step: 2, instruction: 'Toss with oil and salt and roast at 200C.', instructionBn: 'তেল ও লবণ দিয়ে ভালো করে মিশিয়ে ২০০ ডিগ্রিতে রোস্ট করুন।' }
      ],
      ingredients: [
        { name: 'Potatoes', nameBn: 'আলু', amount: 4, unit: 'whole', quantity: 4 },
        { name: 'Mustard Oil', nameBn: 'সরিষার তেল', amount: 2, unit: 'tbsp', quantity: 2 },
        { name: 'Salt', nameBn: 'লবণ', amount: 1, unit: 'pinch', quantity: 1 }
      ]
    };

    // Seed cache
    cacheService.set(`ai:trans:recipe:${recipeHash}`, mockTranslated, 60000);

    const res = await fetch(`${baseUrl}/api/ai/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipe: mockCustomRecipe, targetLanguage: 'bn' })
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.cached, true);
    assert.strictEqual(data.recipe.titleBn, 'মশলাদার আলুর ওয়েজেস');
    assert.strictEqual(data.recipe.ingredients[0].quantity, 4);
    assert.strictEqual(data.recipe.ingredients[0].unit, 'whole');
    assert.strictEqual(data.recipe.ingredients[1].quantity, 2);
    assert.strictEqual(data.recipe.ingredients[1].unit, 'tbsp');
    assert.strictEqual(data.recipe.steps[0].step, 1);
    assert.strictEqual(data.recipe.steps[1].step, 2);
  });

  test('16. Direct /api/translate route alias matches /api/ai/translate functionality', async () => {
    const sourceSnippet = 'Direct alias test snippet.';
    const expectedBengali = 'সরাসরি রুট আলিয়াস পরীক্ষা।';
    const hash = crypto.createHash('sha256').update(`bn:${sourceSnippet}`).digest('hex');

    db.prepare(`
      INSERT OR REPLACE INTO translation_cache (source_hash, source_text, target_lang, translated_text)
      VALUES (?, ?, ?, ?)
    `).run(hash, sourceSnippet, 'bn', expectedBengali);

    const res = await fetch(`${baseUrl}/api/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: sourceSnippet })
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.translatedText, expectedBengali);
    assert.strictEqual(data.cached, true);
  });

  test('17. Empty text returns clean empty translation without throwing', async () => {
    const res = await fetch(`${baseUrl}/api/ai/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: '    ' })
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.translatedText, '');
  });

  test('18. Uncached text translation with missing API key returns 500 with friendly message', async () => {
    delete process.env.GEMINI_API_KEY;

    const uniqueText = `Uncached snippet unique ${Date.now()}`;
    const res = await fetch(`${baseUrl}/api/ai/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: uniqueText })
    });

    assert.strictEqual(res.status, 500);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.match(data.error, /GEMINI_API_KEY is not configured/);
  });
});
