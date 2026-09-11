import { API_BASE, safeParseJson } from './apiConfig.js';

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
  try {
    const payload = {};
    if (typeof text === 'string') payload.text = text;
    if (recipe && typeof recipe === 'object') payload.recipe = recipe;
    payload.targetLanguage = targetLanguage;

    const response = await fetch(`${API_BASE}/api/ai/translate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await safeParseJson(response);

    if (!response.ok || !data.success) {
      throw new Error(data.error || data.message || `Translation failed with status ${response.status}`);
    }

    return data;
  } catch (error) {
    console.warn('⚠️ Gemini translation request failed:', error.message);
    return {
      success: false,
      error: error.message,
      cached: false,
      translatedText: typeof text === 'string' ? text : undefined,
      recipe: recipe || undefined
    };
  }
}
