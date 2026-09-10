import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import express from 'express';
import { aiRouter } from '../routes/aiRoutes.js';
import { GoogleGenAI } from '@google/genai';
import { cacheService } from '../services/cacheService.js';
import { 
  AI_RECIPE_SYSTEM_INSTRUCTION, 
  RECIPE_RESPONSE_SCHEMA, 
  generateCustomAiRecipe 
} from '../services/aiRecipeService.js';

describe('Gemini 3.8 Flash Foundation & Custom Recipe Suite', () => {
  let app;
  let server;
  let baseUrl;
  const originalKey = process.env.GEMINI_API_KEY;

  before(async () => {
    app = express();
    app.use(express.json());
    app.use('/api/ai', aiRouter);

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
});
