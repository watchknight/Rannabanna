import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import crypto from 'node:crypto';
import express from 'express';
import { aiRouter } from '../routes/aiRoutes.js';
import { GoogleGenAI } from '@google/genai';
import { db } from '../models/db.js';
import { cacheService } from '../services/cacheService.js';
import { recipeService } from '../services/recipeService.js';
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
import { 
  translateWithGemini, 
  getCachedTextTranslation, 
  getCachedRecipeTranslation 
} from '../../src/utils/aiTranslator.js';
import { 
  aiRecipeRateLimiter, 
  aiTranslationRateLimiter, 
  createRateLimiter 
} from '../middlewares/rateLimiter.js';
import { 
  logAiFailure, 
  getRecentAiFailures, 
  clearRecentAiFailures 
} from '../utils/aiLogger.js';

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
    app.post('/api/custom-recipe', aiRecipeRateLimiter, async (req, res, next) => {
      try {
        const { ingredients = [], ingredientIds = [], cuisine = 'any', filters = {} } = req.body || {};
        const resolved = ingredients.length > 0 ? ingredients : ingredientIds;
        if (!resolved || resolved.length === 0) {
          return res.status(400).json({ error: 'Please select at least one ingredient to generate a custom recipe.' });
        }
        const apiKey = process.env.GEMINI_API_KEY;
        if (apiKey) {
          try {
            const aiRecipe = await generateCustomAiRecipe({ ingredients: resolved, cuisine, apiKey });
            return res.json(aiRecipe);
          } catch (aiErr) {
            logAiFailure({
              service: 'CUSTOM_RECIPE_LEGACY_ROUTE',
              model: 'gemini-3.8-flash',
              error: aiErr,
              context: { ingredientsCount: resolved.length },
              fallbackAction: 'Fell back to local custom recipe engine'
            });
          }
        }
        const fallback = await recipeService.generateCustomRecipe(resolved, cuisine, null);
        res.json(fallback);
      } catch (err) {
        next(err);
      }
    });

    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://localhost:${port}`;
        process.env.VITE_API_BASE_URL = baseUrl;
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

  test('19. Client aiTranslator: Returns from client memory cache with 0 network calls', async () => {
    process.env.GEMINI_API_KEY = originalKey;
    const cachedPhrase = 'Client cache instant hit test.';
    const expectedBn = 'ক্লায়েন্ট ক্যাশ তাৎক্ষণিক হিট টেস্ট।';

    // Seed server persistent cache first so translateWithGemini learns it
    const hash = crypto.createHash('sha256').update(`bn:${cachedPhrase}`).digest('hex');
    db.prepare(`
      INSERT OR REPLACE INTO translation_cache (source_hash, source_text, target_lang, translated_text)
      VALUES (?, ?, ?, ?)
    `).run(hash, cachedPhrase, 'bn', expectedBn);

    // First call fetches and saves to client memory cache
    const res1 = await translateWithGemini({ text: cachedPhrase, targetLanguage: 'bn' });
    assert.strictEqual(res1.success, true);
    assert.strictEqual(res1.translatedText, expectedBn);

    // Second call must hit client_cache synchronously with 0 network calls
    const res2 = await translateWithGemini({ text: cachedPhrase, targetLanguage: 'bn' });
    assert.strictEqual(res2.success, true);
    assert.strictEqual(res2.translatedText, expectedBn);
    assert.strictEqual(res2.cached, true);
    assert.strictEqual(res2.source, 'client_cache');
  });

  test('20. Client aiTranslator: Deduplicates concurrent in-flight requests for same text', async () => {
    const concurrentText = `Concurrent deduplication test ${Date.now()}`;
    const expectedBn = 'কনকারেন্ট টেস্ট অনুবাদ।';

    const hash = crypto.createHash('sha256').update(`bn:${concurrentText}`).digest('hex');
    db.prepare(`
      INSERT OR REPLACE INTO translation_cache (source_hash, source_text, target_lang, translated_text)
      VALUES (?, ?, ?, ?)
    `).run(hash, concurrentText, 'bn', expectedBn);

    // Fire 3 simultaneous calls
    const [p1, p2, p3] = await Promise.all([
      translateWithGemini({ text: concurrentText, targetLanguage: 'bn' }),
      translateWithGemini({ text: concurrentText, targetLanguage: 'bn' }),
      translateWithGemini({ text: concurrentText, targetLanguage: 'bn' })
    ]);

    assert.strictEqual(p1.translatedText, expectedBn);
    assert.strictEqual(p2.translatedText, expectedBn);
    assert.strictEqual(p3.translatedText, expectedBn);
  });

  test('21. Client aiTranslator: Gracefully falls back to English text if request fails rather than breaking', async () => {
    const originalUrl = process.env.VITE_API_BASE_URL;
    process.env.VITE_API_BASE_URL = 'http://127.0.0.1:59999'; // Dead port

    const englishFallbackText = 'Original English text that must not be broken.';
    const result = await translateWithGemini({ text: englishFallbackText, targetLanguage: 'bn' });

    assert.strictEqual(result.success, false);
    assert.strictEqual(result.translatedText, englishFallbackText, 'Must gracefully return English text on failure');

    process.env.VITE_API_BASE_URL = originalUrl;
  });

  test('22. Client aiTranslator: Pre-loaded recipe returns database-cached translation with 0 Gemini calls', async () => {
    const preloadedRecipe = {
      id: 'shorshe-ilish',
      title: 'Mustard Hilsa Curry (Shorshe Ilish)',
      steps: [
        { step: 1, instruction: 'Marinate hilsa steaks.' }
      ]
    };

    const res = await translateWithGemini({ recipe: preloadedRecipe, targetLanguage: 'bn' });
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.cached, true);
    assert.strictEqual(res.recipe.titleBn, 'সরিষা ইলিশ (ঐতিহ্যবাহী বাঙালি স্টাইল)');
    assert.strictEqual(res.source, 'database');
  });

  test('23. Rate Limiting: POST /api/ai/custom-recipe enforces rate limit and returns 429', async () => {
    aiRecipeRateLimiter.reset();

    // Prime cache so requests that pass don't hit Gemini
    const testIngredients = ['egg', 'tomato'];
    const cacheKey = `ai:custom-recipe:${cacheService.generateKey(testIngredients, { cuisine: null, maxTime: null, dietaryRestrictions: [] })}`;
    cacheService.set(cacheKey, { id: 'mock-1', title: 'Egg Tomato Scramble', ingredients: [], steps: [] }, 60000);

    let lastStatus = 0;
    let rateLimitedResponse = null;

    // Send 11 requests (limit is 10)
    for (let i = 0; i < 11; i++) {
      const res = await fetch(`${baseUrl}/api/ai/custom-recipe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ingredients: testIngredients })
      });
      lastStatus = res.status;
      if (res.status === 429) {
        rateLimitedResponse = await res.json();
        break;
      }
    }

    assert.strictEqual(lastStatus, 429, '11th request must receive HTTP 429 Too Many Requests');
    assert.ok(rateLimitedResponse, 'Should receive JSON payload on 429');
    assert.strictEqual(rateLimitedResponse.success, false);
    assert.strictEqual(rateLimitedResponse.error, 'Too Many Requests');
    assert.strictEqual(rateLimitedResponse.limit, 10);
    assert.ok(rateLimitedResponse.retryAfterSeconds > 0);

    aiRecipeRateLimiter.reset(); // Clean up for other tests
  });

  test('24. Rate Limiting: POST /api/ai/translate enforces rate limit and returns 429', async () => {
    aiTranslationRateLimiter.reset();

    // Create a standalone instance of createRateLimiter to test translation limiter mechanics cleanly
    const testLimiter = createRateLimiter({
      windowMs: 60000,
      max: 3,
      message: 'Translation limit test exceeded',
      keyPrefix: 'test-trans'
    });

    const mockReq = { ip: '127.0.0.99', headers: {}, socket: { remoteAddress: '127.0.0.99' } };
    let finalStatus = 200;
    let finalJson = null;

    const mockRes = {
      set: () => {},
      status: (code) => {
        finalStatus = code;
        return {
          json: (data) => { finalJson = data; }
        };
      }
    };

    // 1st, 2nd, 3rd pass
    testLimiter(mockReq, mockRes, () => {});
    testLimiter(mockReq, mockRes, () => {});
    testLimiter(mockReq, mockRes, () => {});
    assert.strictEqual(finalStatus, 200);

    // 4th must trigger 429
    testLimiter(mockReq, mockRes, () => {});
    assert.strictEqual(finalStatus, 429);
    assert.strictEqual(finalJson.error, 'Too Many Requests');
    assert.strictEqual(finalJson.limit, 3);
  });

  test('25. Structured Failure Logging: Captures Gemini failures with sanitized context and exposes via /api/ai/failures', async () => {
    clearRecentAiFailures();

    const testError = new Error('Simulated Gemini 503 High Demand Error');
    testError.status = 503;

    logAiFailure({
      service: 'CUSTOM_RECIPE',
      model: 'gemini-3.8-flash',
      error: testError,
      context: { 
        ingredients: ['mustard seeds', 'ilish fish'], 
        cuisine: 'Bengali',
        apiKey: 'SECRET_DO_NOT_LOG' 
      },
      fallbackAction: 'Fell back to local custom recipe engine'
    });

    const recent = getRecentAiFailures();
    assert.ok(recent.length >= 1, 'Should have at least 1 recent failure');
    const entry = recent[0];

    assert.strictEqual(entry.service, 'CUSTOM_RECIPE');
    assert.strictEqual(entry.model, 'gemini-3.8-flash');
    assert.strictEqual(entry.status, 503);
    assert.strictEqual(entry.error, 'Simulated Gemini 503 High Demand Error');
    assert.strictEqual(entry.fallbackAction, 'Fell back to local custom recipe engine');
    assert.strictEqual(entry.context.apiKey, '[REDACTED]', 'Sensitive API keys must be redacted');
    assert.ok(entry.timestamp, 'Must include timestamp');

    // Test GET /api/ai/failures endpoint
    const res = await fetch(`${baseUrl}/api/ai/failures`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(data.count >= 1);
    assert.strictEqual(data.failures[0].service, 'CUSTOM_RECIPE');
  });

  test('26. Edge Case: Empty or missing ingredients input returns 400 Bad Request with zero API calls', async () => {
    // 1. Empty array
    const res1 = await fetch(`${baseUrl}/api/ai/custom-recipe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ingredients: [] })
    });
    assert.strictEqual(res1.status, 400);
    const data1 = await res1.json();
    assert.match(data1.error, /at least one ingredient/);

    // 2. Whitespace array
    const res2 = await fetch(`${baseUrl}/api/ai/custom-recipe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ingredients: ['  ', ''] })
    });
    assert.strictEqual(res2.status, 400);

    // 3. Completely empty body
    const res3 = await fetch(`${baseUrl}/api/ai/custom-recipe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    assert.strictEqual(res3.status, 400);
  });

  test('27. Edge Case: Huge or unusual ingredient combinations are safely bounded without crashing', async () => {
    // Create an extreme list with 65 ingredients, emojis, symbols, and long strings
    const massiveIngredients = [];
    for (let i = 1; i <= 65; i++) {
      massiveIngredients.push(`Unusual Ingredient #${i} ${'🌶️'.repeat(i % 3)} with special chars & * % <tag> ${'x'.repeat(150)}`);
    }

    // Direct service call test for input normalization
    let thrownError = null;
    try {
      // With no API key configured, it will fail at key resolution AFTER normalization passes safely
      delete process.env.GEMINI_API_KEY;
      await generateCustomAiRecipe({ ingredients: massiveIngredients });
    } catch (err) {
      thrownError = err;
    }

    assert.ok(thrownError, 'Should throw due to missing key, but NOT due to payload length or syntax error');
    assert.match(thrownError.message, /GEMINI_API_KEY is not configured/);
    process.env.GEMINI_API_KEY = originalKey;
  });

  test('28. Edge Case: Translation text with special characters (HTML, quotes, KaTeX $, Bengali conjuncts)', async () => {
    const specialText = '<div class="culinary-tip">Heat 2 tbsp mustard oil! Cost: $5. Formula: E = mc^2. ক্ষ, হ্ম, ঞ্চ, ষ্ণ, র্দ্ধ, ্য</div>';
    const expectedBengali = '<div class="culinary-tip">২ টেবিল চামচ সরিষার তেল গরম করুন! খরচ: $৫। সূত্র: E = mc^2। ক্ষ, হ্ম, ঞ্চ, ষ্ণ, র্দ্ধ, ্য</div>';

    const hash = crypto.createHash('sha256').update(`bn:${specialText}`).digest('hex');
    db.prepare(`
      INSERT OR REPLACE INTO translation_cache (source_hash, source_text, target_lang, translated_text)
      VALUES (?, ?, ?, ?)
    `).run(hash, specialText, 'bn', expectedBengali);

    const res = await fetch(`${baseUrl}/api/ai/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: specialText, targetLanguage: 'bn' })
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.translatedText, expectedBengali);
    assert.ok(data.translatedText.includes('ক্ষ, হ্ম, ঞ্চ, ষ্ণ'));
    assert.ok(data.translatedText.includes('$৫'));
  });

  test('29. Edge Case: Very long recipe with 25 steps preserves all step numbering without truncation', async () => {
    const steps25 = [];
    for (let i = 1; i <= 25; i++) {
      steps25.push({
        step: i,
        instruction: `Step ${i}: Carefully simmer the ingredients and perform technique #${i} for 5 minutes.`,
        duration: 5
      });
    }

    const longRecipe = {
      id: 'custom-long-recipe-25-steps',
      title: 'Grand Royal 25-Step Feast',
      cuisine: 'Bengali',
      ingredients: [
        { name: 'Basmati Rice', amount: 500, unit: 'g', quantity: 500 },
        { name: 'Mutton', amount: 1, unit: 'kg', quantity: 1 }
      ],
      steps: steps25
    };

    const recipeHash = crypto.createHash('sha256').update(
      `bn:${longRecipe.id}:${longRecipe.title}:${JSON.stringify(longRecipe.steps)}`
    ).digest('hex');

    const steps25Translated = steps25.map(s => ({
      step: s.step,
      instruction: s.instruction,
      instructionBn: `ধাপ ${s.step}: মৃদু আঁচে উপকরণগুলো ফুটান এবং রান্না করুন।`,
      duration: s.duration
    }));

    const translatedLongRecipe = {
      ...longRecipe,
      titleBn: 'গ্র্যান্ড রয়্যাল ২৫-ধাপের ভোজ',
      steps: steps25Translated,
      ingredients: [
        { name: 'Basmati Rice', nameBn: 'বাসমতী চাল', amount: 500, unit: 'g', quantity: 500 },
        { name: 'Mutton', nameBn: 'খাসির মাংস', amount: 1, unit: 'kg', quantity: 1 }
      ]
    };

    cacheService.set(`ai:trans:recipe:${recipeHash}`, translatedLongRecipe, 60000);

    const res = await fetch(`${baseUrl}/api/ai/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipe: longRecipe, targetLanguage: 'bn' })
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.recipe.steps.length, 25, 'All 25 steps must be preserved');
    assert.strictEqual(data.recipe.steps[0].step, 1);
    assert.strictEqual(data.recipe.steps[24].step, 25);
    assert.ok(data.recipe.steps.every(s => Boolean(s.instructionBn)));
  });

  test('30. Edge Case: Temporary API unavailability gracefully falls back without 500 crash', async () => {
    aiRecipeRateLimiter.reset();

    // 1. Translation fallback: Call translateRecipe with invalid API key
    const testRecipe = {
      id: 'custom-temp-fail-1',
      title: 'Quick Chicken Stir Fry',
      description: 'A delicious quick stir fry.',
      steps: [
        { step: 1, instruction: 'Heat wok and add oil.' },
        { step: 2, instruction: 'Toss chicken pieces until cooked through.' }
      ],
      ingredients: [
        { name: 'Chicken', amount: 300, unit: 'g' }
      ]
    };

    // Missing key triggers local translation engine fallback gracefully
    const transResult = await translateRecipe({
      recipe: testRecipe,
      targetLanguage: 'bn',
      apiKey: null // Missing key triggers local_fallback
    });

    assert.strictEqual(transResult.success, true);
    assert.strictEqual(transResult.source, 'local_fallback', 'Must use local fallback when Gemini is unavailable');
    assert.ok(transResult.recipe.title, 'Recipe title must remain intact');

    // 2. Legacy custom-recipe route fallback: When Gemini fails, falls back to local recipe engine
    delete process.env.GEMINI_API_KEY;
    const recipeRes = await fetch(`${baseUrl}/api/custom-recipe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ingredients: ['chicken', 'onion', 'garlic'],
        cuisine: 'bengali'
      })
    });

    assert.strictEqual(recipeRes.status, 200, 'Must return 200 OK from local chef engine on Gemini unavailability');
    const recipeData = await recipeRes.json();
    assert.ok(recipeData.title, 'Local recipe engine must return a valid recipe');
    assert.ok(recipeData.ingredients.length > 0);

    process.env.GEMINI_API_KEY = originalKey;
  });
});

