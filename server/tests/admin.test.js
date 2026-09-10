import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import express from 'express';
import { adminRouter } from '../routes/adminRoutes.js';
import { recipeService } from '../services/recipeService.js';

describe('Admin Panel API Test Suite', () => {
  let app;
  let server;
  let baseUrl;
  let adminToken;

  before(async () => {
    app = express();
    app.use(express.json());
    app.use('/api/admin', adminRouter);

    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://localhost:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  test('1. Rejects login with invalid password', async () => {
    const res = await fetch(`${baseUrl}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'wrongpassword' })
    });
    assert.strictEqual(res.status, 401);
    const data = await res.json();
    assert.strictEqual(data.error, 'Unauthorized');
  });

  test('2. Successfully logs in with correct password and returns bearer token', async () => {
    const res = await fetch(`${baseUrl}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'rannabanna2026' })
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(data.token && data.token.startsWith('adm_'));
    adminToken = data.token;
  });

  test('3. Guards admin endpoints from unauthenticated requests', async () => {
    const res = await fetch(`${baseUrl}/api/admin/stats`);
    assert.strictEqual(res.status, 401);
  });

  test('4. Retrieves stats with valid bearer token', async () => {
    const res = await fetch(`${baseUrl}/api/admin/stats`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.strictEqual(res.status, 200);
    const stats = await res.json();
    assert.ok(stats.totalRecipes >= 395);
    assert.ok(stats.totalIngredients >= 180);
    assert.ok(stats.totalCuisines >= 10);
    assert.ok(Array.isArray(stats.cuisineDistribution));
    assert.ok(Array.isArray(stats.topIngredients));
  });

  test('5. Allows direct access using x-admin-key header', async () => {
    const res = await fetch(`${baseUrl}/api/admin/stats`, {
      headers: { 'x-admin-key': 'rannabanna2026' }
    });
    assert.strictEqual(res.status, 200);
  });

  test('6. Lists recipes with pagination and filtering', async () => {
    const res = await fetch(`${baseUrl}/api/admin/recipes?cuisineId=bengali&page=1&limit=5`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(data.recipes.length <= 5);
    assert.ok(data.total > 0);
    assert.strictEqual(data.page, 1);
  });

  test('7. Performs complete recipe lifecycle (Create, Read, Update, Delete)', async () => {
    const testRecipeId = 'test-admin-special-korma';

    // 1. Create
    const createRes = await fetch(`${baseUrl}/api/admin/recipes`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        id: testRecipeId,
        title: 'Admin Special Korma',
        titleBn: 'অ্যাডমিন স্পেশাল কোরমা',
        cuisineId: 'bengali',
        difficulty: 'intermediate',
        prepTime: 20,
        cookTime: 30,
        servings: 4,
        calories: 450,
        description: 'A rich and aromatic korma crafted for admin testing.',
        descriptionBn: 'একটি সমৃদ্ধ এবং সুস্বাদু কোরমা।',
        ingredients: [
          { ingredientId: 'chicken-breast', quantity: 500, unit: 'g', isEssential: true },
          { ingredientId: 'onion-red', quantity: 2, unit: 'whole', isEssential: true }
        ],
        steps: [
          { step: 1, instruction: 'Marinate chicken with yogurt and spices.', instructionBn: 'দই ও মশলা দিয়ে মুরগির মাংস মেরিনেট করুন।' },
          { step: 2, instruction: 'Slow simmer until tender and oil separates.', instructionBn: 'মাংস নরম না হওয়া পর্যন্ত ধিমে আঁচে রান্না করুন।' }
        ]
      })
    });
    assert.strictEqual(createRes.status, 201);
    const created = await createRes.json();
    assert.strictEqual(created.data.id, testRecipeId);

    // 2. Read
    const getRes = await fetch(`${baseUrl}/api/admin/recipes/${testRecipeId}`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.strictEqual(getRes.status, 200);
    const fetched = await getRes.json();
    assert.strictEqual(fetched.title, 'Admin Special Korma');
    assert.strictEqual(fetched.titleBn, 'অ্যাডমিন স্পেশাল কোরমা');
    assert.strictEqual(fetched.steps.length, 2);

    // 3. Update
    const updateRes = await fetch(`${baseUrl}/api/admin/recipes/${testRecipeId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title: 'Admin Royal Special Korma',
        cookTime: 35
      })
    });
    assert.strictEqual(updateRes.status, 200);
    const updated = await updateRes.json();
    assert.strictEqual(updated.data.title, 'Admin Royal Special Korma');
    assert.strictEqual(updated.data.cookTime, 35);

    // 4. Delete
    const deleteRes = await fetch(`${baseUrl}/api/admin/recipes/${testRecipeId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.strictEqual(deleteRes.status, 200);

    // Verify deleted
    const verifyRes = await fetch(`${baseUrl}/api/admin/recipes/${testRecipeId}`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.strictEqual(verifyRes.status, 404);
  });

  test('8. Prevents deleting an ingredient that is used in recipes (Safety Guard)', async () => {
    const res = await fetch(`${baseUrl}/api/admin/ingredients/salt`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.strictEqual(res.status, 409); // Conflict
    const data = await res.json();
    assert.ok(data.message.includes('Cannot delete ingredient'));
  });

  test('9. Allows creating and deleting an unused custom ingredient', async () => {
    const testIngId = 'test-dragonfruit-powder';

    // Create
    const createRes = await fetch(`${baseUrl}/api/admin/ingredients`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        id: testIngId,
        name: 'Dragonfruit Powder',
        nameBn: 'ড্রাগনফ্রুট পাউডার',
        category: 'Pantry & Spices',
        subCategory: 'Fruits',
        emoji: '🐉',
        sweet: 3
      })
    });
    assert.strictEqual(createRes.status, 201);

    // Delete
    const delRes = await fetch(`${baseUrl}/api/admin/ingredients/${testIngId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.strictEqual(delRes.status, 200);
  });

  test('10. Cache flush endpoint succeeds', async () => {
    const res = await fetch(`${baseUrl}/api/admin/system/cache/flush`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
  });
});
