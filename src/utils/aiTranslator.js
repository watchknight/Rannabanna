import { API_BASE, getApiBase, safeParseJson } from './apiConfig.js';

// Client-side in-memory & localStorage persistent cache
const CLIENT_CACHE_KEY = 'rannabanna-gemini-client-cache';

let memoryCache = {
  text: {},
  recipes: {}
};

// Initialize memory cache from localStorage safely
try {
  if (typeof window !== 'undefined' && window.localStorage) {
    const raw = localStorage.getItem(CLIENT_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        memoryCache = {
          text: parsed.text || {},
          recipes: parsed.recipes || {}
        };
      }
    }
  }
} catch (e) {
  console.warn('Could not read translation client cache from localStorage:', e.message);
}

function saveCacheToStorage() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(CLIENT_CACHE_KEY, JSON.stringify(memoryCache));
    }
  } catch (e) {
    console.warn('Could not persist translation cache to localStorage:', e.message);
  }
}

// Map to deduplicate concurrent in-flight requests for identical strings or recipes
const inFlightPromises = new Map();

// Listeners for reactive cache updates
const listeners = new Set();

export function subscribeToTranslations(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function notifyListeners(type, key, value) {
  for (const fn of listeners) {
    try {
      fn({ type, key, value });
    } catch {}
  }
}

/**
 * Check if a text translation exists in the client-side cache
 */
export function getCachedTextTranslation(text, targetLang = 'bn') {
  if (!text || typeof text !== 'string') return null;
  const clean = text.trim();
  const cacheKey = `${targetLang}:${clean}`;
  return memoryCache.text[cacheKey] || null;
}

/**
 * Check if a recipe translation exists in the client-side cache
 */
export function getCachedRecipeTranslation(recipeId, targetLang = 'bn') {
  if (!recipeId) return null;
  const cacheKey = `${targetLang}:${recipeId}`;
  return memoryCache.recipes[cacheKey] || null;
}

/**
 * Client-side interface to request natural Bengali culinary translation from Gemini 3.8 Flash.
 * All API calls are executed securely through the server backend.
 *
 * @param {Object} options
 * @param {string} [options.text] - Single text string to translate
 * @param {Object} [options.recipe] - Recipe object to translate
 * @param {string} [options.targetLanguage='bn'] - Target language (defaults to 'bn')
 * @returns {Promise<{ success: boolean, translatedText?: string, recipe?: Object, cached?: boolean, source?: string, error?: string }>}
 */
export async function translateWithGemini({ text, recipe, targetLanguage = 'bn' }) {
  const normLang = (targetLanguage || 'bn').toLowerCase().trim();

  // 1. Check client-side cache first (Zero Network Hit!)
  if (typeof text === 'string') {
    const cleanText = text.trim();
    if (!cleanText) {
      return { success: true, translatedText: '', cached: true, source: 'empty' };
    }
    const cachedText = getCachedTextTranslation(cleanText, normLang);
    if (cachedText) {
      return {
        success: true,
        originalText: text,
        translatedText: cachedText,
        cached: true,
        source: 'client_cache',
        targetLanguage: normLang
      };
    }
  }

  if (recipe && typeof recipe === 'object' && recipe.id) {
    const cachedRecipe = getCachedRecipeTranslation(recipe.id, normLang);
    if (cachedRecipe) {
      return {
        success: true,
        recipe: cachedRecipe,
        cached: true,
        source: 'client_cache',
        targetLanguage: normLang
      };
    }
  }

  // 2. Deduplicate in-flight requests
  const requestKey = typeof text === 'string'
    ? `text:${normLang}:${text.trim()}`
    : `recipe:${normLang}:${recipe?.id || recipe?.title}`;

  if (inFlightPromises.has(requestKey)) {
    return inFlightPromises.get(requestKey);
  }

  const promise = (async () => {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), 12000) : null;

    try {
      const payload = {};
      if (typeof text === 'string') payload.text = text;
      if (recipe && typeof recipe === 'object') payload.recipe = recipe;
      payload.targetLanguage = normLang;

      const base = (typeof getApiBase === 'function' ? getApiBase() : '') || API_BASE;

      // Try primary route /api/ai/translate
      let response = await fetch(`${base}/api/ai/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller?.signal
      });

      // Failover to /api/translate alias if 404
      if (response.status === 404) {
        response = await fetch(`${base}/api/translate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller?.signal
        });
      }

      if (timeoutId) clearTimeout(timeoutId);

      const data = await safeParseJson(response);

      if (!response.ok || !data.success) {
        throw new Error(data.error || data.message || `Translation failed with status ${response.status}`);
      }

      // 3. Save successful translation into client-side cache
      if (typeof text === 'string' && data.translatedText) {
        const cacheKey = `${normLang}:${text.trim()}`;
        memoryCache.text[cacheKey] = data.translatedText;
        saveCacheToStorage();
        notifyListeners('text', cacheKey, data.translatedText);
      }

      if (recipe && typeof recipe === 'object' && (recipe.id || data.recipe?.id) && data.recipe) {
        const rId = recipe.id || data.recipe.id;
        const cacheKey = `${normLang}:${rId}`;
        memoryCache.recipes[cacheKey] = data.recipe;
        saveCacheToStorage();
        notifyListeners('recipe', cacheKey, data.recipe);
      }

      return data;
    } catch (error) {
      if (timeoutId) clearTimeout(timeoutId);
      const isTimeout = error.name === 'AbortError';
      if (isTimeout) {
        console.warn('⚠️ Gemini translation request timed out (12s limit).');
      } else {
        console.warn('⚠️ Gemini translation request failed:', error.message);
      }
      // Graceful fallback to English text/original recipe
      return {
        success: false,
        error: isTimeout ? 'Translation timed out' : error.message,
        cached: false,
        translatedText: typeof text === 'string' ? text : undefined,
        recipe: recipe || undefined,
        targetLanguage: normLang
      };
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
      inFlightPromises.delete(requestKey);
    }
  })();

  inFlightPromises.set(requestKey, promise);
  return promise;
}
