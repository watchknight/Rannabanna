import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import express from 'express';
import { adminRouter } from '../routes/adminRoutes.js';
import { scaleIngredient, adjustTime, shouldScale } from '../../src/utils/servingsScaler.js';

describe('Admin Servings & Recipe Scaling Integration Tests', () => {
  let app;
  let server;
  let baseUrl;
  let adminToken;

  const testRecipeId = 'test-admin-servings-biryani';

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

    // Obtain admin token
    const res = await fetch(`${baseUrl}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'rannabanna2026' })
    });
    const data = await res.json();
    adminToken = data.token;
  });

  after(async () => {
    // Clean up test recipe if it exists
    try {
      await fetch(`${baseUrl}/api/admin/recipes/${testRecipeId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
    } catch {
      // ignore
    }

    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  test('1. Admin creates recipe with custom baseServings (6) and mixed scaling/non-scaling ingredients', async () => {
    const newRecipe = {
      id: testRecipeId,
      title: 'Grand Royal Kacchi Biryani',
      titleBn: 'গ্র্যান্ড রয়েল কাচ্চি বিরিয়ানি',
      cuisineId: 'bengali',
      difficulty: 'advanced',
      prepTime: 40,
      cookTime: 60,
      servings: 6,
      calories: 780,
      description: 'A feast-worthy royal mutton kacchi biryani infused with saffron and mace.',
      descriptionBn: 'জাফরান ও জয়ত্রী দিয়ে তৈরি ঐতিহ্যবাহী শাহী কাচ্চি বিরিয়ানি।',
      imageEmoji: '🍖',
      mealTypes: ['lunch', 'dinner'],
      dietaryTags: ['halal'],
      ingredients: [
        { ingredientId: 'mutton-cubes', quantity: 1500, unit: 'g', preparation: 'cut into large chunks', isEssential: true },
        { ingredientId: 'basmati-rice', quantity: 750, unit: 'g', preparation: 'soaked for 30 mins', isEssential: true },
        { ingredientId: 'ghee', quantity: 8, unit: 'tbsp', preparation: 'melted', isEssential: true },
        { ingredientId: 'salt', quantity: 1, unit: 'to taste', preparation: 'as needed', isEssential: true },
        { ingredientId: 'saffron', quantity: 2, unit: 'pinch', preparation: 'soaked in warm milk', isEssential: false },
        { ingredientId: 'mustard-oil', quantity: 4, unit: 'for frying', preparation: 'deep frying onions', isEssential: false }
      ],
      steps: [
        {
          step: 1,
          instruction: 'Marinate mutton with yogurt and ground spices for 3 hours.',
          instructionBn: 'টকদই ও বাটা মশলা দিয়ে খাসির মাংস ৩ ঘণ্টা মেরিনেট করে রাখুন।',
          duration: 15,
          technique: 'Marinating'
        },
        {
          step: 2,
          instruction: 'Parboil basmati rice with whole spices until 70% cooked.',
          instructionBn: 'আস্ত গরম মশলা সহ বাসমতী চাল ৭০% সেদ্ধ করে নিন।',
          duration: 15,
          technique: 'Boiling'
        },
        {
          step: 3,
          instruction: 'Layer meat and rice, seal with dough, and cook on dum.',
          instructionBn: 'মাংস ও ভাতের স্তর সাজিয়ে আটা দিয়ে হাঁড়ির মুখ বন্ধ করে দমে বসান।',
          duration: 45,
          technique: 'Dum Cooking'
        }
      ]
    };

    const res = await fetch(`${baseUrl}/api/admin/recipes`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(newRecipe)
    });

    assert.strictEqual(res.status, 201);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.data.id, testRecipeId);
    assert.strictEqual(data.data.servings, 6);
  });

  test('2. Retrieves recipe and verifies bilingual fields, steps, and baseServings persistence', async () => {
    const res = await fetch(`${baseUrl}/api/admin/recipes/${testRecipeId}`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });

    assert.strictEqual(res.status, 200);
    const recipe = await res.json();
    assert.strictEqual(recipe.titleBn, 'গ্র্যান্ড রয়েল কাচ্চি বিরিয়ানি');
    assert.strictEqual(recipe.servings, 6);
    assert.strictEqual(recipe.prepTime, 40);
    assert.strictEqual(recipe.cookTime, 60);
    assert.strictEqual(recipe.ingredients.length, 6);
    assert.strictEqual(recipe.steps.length, 3);
    assert.strictEqual(recipe.steps[0].instructionBn, 'টকদই ও বাটা মশলা দিয়ে খাসির মাংস ৩ ঘণ্টা মেরিনেট করে রাখুন।');
  });

  test('3. Dynamic Servings Scaling: Scales from base 6 servings to 12 servings (Scaling Up)', () => {
    const baseServings = 6;
    const targetServings = 12;

    // 1500g mutton-cubes scaled x2 = 3000g -> upconverts to 3 kg
    const mutton = { quantity: 1500, unit: 'g' };
    const scaledMutton = scaleIngredient(mutton, baseServings, targetServings);
    assert.strictEqual(scaledMutton.displayQuantity, '3');
    assert.strictEqual(scaledMutton.displayUnit, 'kg');
    assert.strictEqual(scaledMutton.isFixed, false);

    // 8 tbsp ghee scaled x2 = 16 tbsp -> upconverts to 1 cup
    const ghee = { quantity: 8, unit: 'tbsp' };
    const scaledGhee = scaleIngredient(ghee, baseServings, targetServings);
    assert.strictEqual(scaledGhee.displayQuantity, '1');
    assert.strictEqual(scaledGhee.displayUnit, 'cup');
    assert.strictEqual(scaledGhee.isFixed, false);

    // Non-scaling ingredient 'to taste' remains fixed
    const salt = { quantity: 1, unit: 'to taste' };
    assert.strictEqual(shouldScale(salt), false);
    const scaledSalt = scaleIngredient(salt, baseServings, targetServings);
    assert.strictEqual(scaledSalt.displayQuantity, '1');
    assert.strictEqual(scaledSalt.displayUnit, 'to taste');
    assert.strictEqual(scaledSalt.isFixed, true);

    // Non-scaling ingredient 'pinch' remains fixed
    const saffron = { quantity: 2, unit: 'pinch' };
    assert.strictEqual(shouldScale(saffron), false);
    const scaledSaffron = scaleIngredient(saffron, baseServings, targetServings);
    assert.strictEqual(scaledSaffron.displayQuantity, '2');
    assert.strictEqual(scaledSaffron.displayUnit, 'pinch');
    assert.strictEqual(scaledSaffron.isFixed, true);

    // Diminishing returns time adjustment
    const time = adjustTime(40, 60, baseServings, targetServings);
    assert.ok(time.prepTime > 40 && time.prepTime <= 60, 'Prep time scales smoothly');
    assert.ok(time.cookTime > 60 && time.cookTime <= 75, 'Cook time scales with diminishing returns log');
  });

  test('4. Dynamic Servings Scaling: Scales from base 6 servings to 3 servings (Scaling Down)', () => {
    const baseServings = 6;
    const targetServings = 3;

    // 750g rice scaled by 0.5 = 375g
    const rice = { quantity: 750, unit: 'g' };
    const scaledRice = scaleIngredient(rice, baseServings, targetServings);
    assert.strictEqual(scaledRice.displayQuantity, '375');
    assert.strictEqual(scaledRice.displayUnit, 'g');

    // 8 tbsp ghee scaled by 0.5 = 4 tbsp
    const ghee = { quantity: 8, unit: 'tbsp' };
    const scaledGhee = scaleIngredient(ghee, baseServings, targetServings);
    assert.strictEqual(scaledGhee.displayQuantity, '4');
    assert.strictEqual(scaledGhee.displayUnit, 'tbsp');

    // Time scaling down does not drop below safe cooking thresholds
    const time = adjustTime(40, 60, baseServings, targetServings);
    assert.ok(time.prepTime >= 24, 'Prep time stays above 60% floor');
    assert.ok(time.cookTime >= 45, 'Cook time stays above 75% floor');
  });

  test('5. Updates recipe baseServings to 8 and updates title', async () => {
    const updatePayload = {
      title: 'Grand Royal Kacchi Biryani (Family Pack)',
      titleBn: 'গ্র্যান্ড রয়েল কাচ্চি বিরিয়ানি (ফ্যামিলি প্যাক)',
      cuisineId: 'bengali',
      difficulty: 'advanced',
      prepTime: 45,
      cookTime: 70,
      servings: 8,
      calories: 820,
      description: 'Updated family pack size.',
      descriptionBn: 'পরিবারের সকলের জন্য বড় পরিবেশন।',
      imageEmoji: '🍖',
      mealTypes: ['lunch', 'dinner'],
      dietaryTags: ['halal'],
      ingredients: [
        { ingredientId: 'mutton-cubes', quantity: 2000, unit: 'g', preparation: 'cut into large chunks', isEssential: true },
        { ingredientId: 'basmati-rice', quantity: 1000, unit: 'g', preparation: 'soaked', isEssential: true }
      ],
      steps: [
        { step: 1, instruction: 'Prep all ingredients.', instructionBn: 'সকল উপকরণ গুছিয়ে নিন।', duration: 15, technique: 'Prep' }
      ]
    };

    const res = await fetch(`${baseUrl}/api/admin/recipes/${testRecipeId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updatePayload)
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.data.servings, 8);
    assert.strictEqual(data.data.title, 'Grand Royal Kacchi Biryani (Family Pack)');
  });

  test('6. Cleans up test recipe from database', async () => {
    const res = await fetch(`${baseUrl}/api/admin/recipes/${testRecipeId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);

    // Verify deletion
    const checkRes = await fetch(`${baseUrl}/api/admin/recipes/${testRecipeId}`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.strictEqual(checkRes.status, 404);
  });
});
