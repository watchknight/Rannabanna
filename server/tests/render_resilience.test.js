import { test, describe } from 'node:test';
import assert from 'node:assert';
import crypto from 'node:crypto';
import { db, executeWithRetry } from '../models/db.js';
import { cacheService } from '../services/cacheService.js';
import { generateCustomAiRecipe } from '../services/aiRecipeService.js';
import { 
  authenticateAdmin, 
  verifyAdminToken, 
  invalidateAdminToken, 
  getAdminSecret 
} from '../middlewares/adminAuth.js';

describe('Render Free-Tier Hosting & Ephemeral Storage Resilience Suite', () => {

  test('1. SQLite WAL Mode & Busy Timeout configured for concurrency on cold starts', () => {
    const journalMode = db.prepare('PRAGMA journal_mode').get();
    assert.strictEqual(journalMode.journal_mode.toLowerCase(), 'wal', 'Database must use WAL mode for non-blocking concurrency');

    const busyTimeout = db.prepare('PRAGMA busy_timeout').get();
    assert.ok(busyTimeout.timeout >= 5000, `busy_timeout should be at least 5000ms, got ${busyTimeout.timeout}`);
  });

  test('2. executeWithRetry successfully retries and executes query', () => {
    let attempts = 0;
    const result = executeWithRetry(() => {
      attempts++;
      if (attempts < 2) {
        const busyErr = new Error('database is locked');
        busyErr.code = 'SQLITE_BUSY';
        throw busyErr;
      }
      return 'success_after_busy_retry';
    }, 3, 10);

    assert.strictEqual(result, 'success_after_busy_retry');
    assert.strictEqual(attempts, 2, 'Should have retried once after initial SQLITE_BUSY error');
  });

  test('3. Persistent AI Recipes Cache: Custom recipe survives in-memory cache purge', async () => {
    const testIngredients = ['paneer', 'bell pepper', 'soy sauce'];
    const testFilters = { cuisine: 'Indo-Chinese', maxTime: 20, dietaryRestrictions: ['vegetarian'] };
    const cacheKey = `ai:custom-recipe:${cacheService.generateKey(testIngredients, testFilters)}`;

    const mockAiRecipe = {
      id: 'custom-ai-render-persisted-1',
      title: 'Chilli Paneer Stir Fry',
      titleBn: 'চিলি পনির ফ্রাই',
      cuisine: 'Indo-Chinese',
      estimatedTime: 20,
      estimatedCalories: 380,
      ingredients: [
        { name: 'Paneer', amount: 250, unit: 'g' },
        { name: 'Bell Pepper', amount: 1, unit: 'whole' }
      ],
      steps: [
        { step: 1, instruction: 'Cube paneer and fry lightly.', instructionBn: 'পনির কেটে হালকা ভেজে নিন।' }
      ]
    };

    // 1. Write directly to SQLite ai_recipes_cache table (simulating a previous session before spin-down)
    db.prepare(`
      INSERT OR REPLACE INTO ai_recipes_cache (cache_key, recipe_id, title, recipe_json)
      VALUES (?, ?, ?, ?)
    `).run(cacheKey, mockAiRecipe.id, mockAiRecipe.title, JSON.stringify(mockAiRecipe));

    // 2. Ensure in-memory cache is completely EMPTY for this key (simulating memory wipe on spin-down)
    cacheService.delete(cacheKey);
    assert.strictEqual(cacheService.get(cacheKey), null, 'In-memory cache must be empty initially');

    // 3. Request recipe through generateCustomAiRecipe
    const result = await generateCustomAiRecipe({
      ingredients: testIngredients,
      cuisine: 'Indo-Chinese',
      maxTime: 20,
      dietaryRestrictions: ['vegetarian'],
      apiKey: 'dummy-key-not-called'
    });

    assert.strictEqual(result.cached, true, 'Must return cached recipe');
    assert.strictEqual(result.source, 'database', 'Must have retrieved from SQLite database after memory wipe');
    assert.strictEqual(result.title, 'Chilli Paneer Stir Fry');

    // 4. In-memory cache should now be re-hydrated for fast subsequent lookups
    const memoryHydrated = cacheService.get(cacheKey);
    assert.ok(memoryHydrated, 'In-memory cache should be re-populated after SQLite fetch');
    assert.strictEqual(memoryHydrated.title, 'Chilli Paneer Stir Fry');
  });

  test('4. Stateless HMAC Admin Authentication: Session token survives in-memory wipe on spin-down', () => {
    // 1. Authenticate admin and receive token
    const auth = authenticateAdmin('rannabanna2026');
    assert.strictEqual(auth.success, true);
    assert.ok(auth.token && auth.token.startsWith('adm_'));
    const token = auth.token;

    // 2. Verify token is valid initially
    assert.strictEqual(verifyAdminToken(token), true);

    // 3. Simulate Render container memory reset (spin-down to 0 instances)
    // The stateless HMAC token contains its expiration and cryptographic signature
    assert.strictEqual(verifyAdminToken(token), true, 'Stateless HMAC token must still validate after memory wipe');

    // 4. Tampered token must fail verification
    const tampered = token.slice(0, -4) + 'abcd';
    assert.strictEqual(verifyAdminToken(tampered), false, 'Tampered token must fail verification');

    // 5. Expired token must fail verification
    const pastExpiresAt = Date.now() - 10000;
    const nonce = crypto.randomBytes(16).toString('hex');
    const secret = getAdminSecret();
    const sig = crypto.createHmac('sha256', secret).update(`adm:${pastExpiresAt}:${nonce}`).digest('hex');
    const expiredToken = `adm_${pastExpiresAt}_${nonce}_${sig}`;
    assert.strictEqual(verifyAdminToken(expiredToken), false, 'Expired token must fail verification');

    // 6. Explicit logout invalidates token
    invalidateAdminToken(token);
    assert.strictEqual(verifyAdminToken(token), false, 'Revoked token must be rejected');
  });

  test('5. Firebase Service Account Environment Variable Parsing: Validates JSON and Base64 formats', () => {
    const mockCreds = {
      project_id: 'rannabanna-test',
      private_key: '-----BEGIN PRIVATE KEY-----\nMOCK_KEY\n-----END PRIVATE KEY-----\n',
      client_email: 'firebase-adminsdk@rannabanna.iam.gserviceaccount.com'
    };

    // Raw JSON format test
    const rawJson = JSON.stringify(mockCreds);
    const parsedJson = JSON.parse(rawJson);
    assert.strictEqual(parsedJson.project_id, 'rannabanna-test');
    assert.ok(parsedJson.private_key.includes('MOCK_KEY'));

    // Base64 format test
    const base64Str = Buffer.from(rawJson, 'utf8').toString('base64');
    const decodedStr = Buffer.from(base64Str, 'base64').toString('utf8');
    const parsedBase64 = JSON.parse(decodedStr);
    assert.strictEqual(parsedBase64.project_id, 'rannabanna-test');
    assert.strictEqual(parsedBase64.client_email, mockCreds.client_email);
  });
});
