import express from 'express';
import { GoogleGenAI } from '@google/genai';
import { generateCustomAiRecipe } from '../services/aiRecipeService.js';
import { translateText, translateRecipe } from '../services/translationService.js';
import { aiRecipeRateLimiter, aiTranslationRateLimiter } from '../middlewares/rateLimiter.js';
import { logAiFailure, getRecentAiFailures } from '../utils/aiLogger.js';

export const aiRouter = express.Router();

/**
 * @route   GET /api/ai/health
 * @desc    Check Gemini AI service status and recent activity
 * @access  Public / Diagnostics
 */
aiRouter.get('/health', (req, res) => {
  const hasApiKey = Boolean(process.env.GEMINI_API_KEY);
  const recentFailures = getRecentAiFailures(5);
  res.json({
    status: 'ok',
    geminiConfigured: hasApiKey,
    model: 'gemini-3.8-flash',
    recentFailuresCount: recentFailures.length,
    timestamp: new Date().toISOString()
  });
});

/**
 * @route   GET /api/ai/failures
 * @desc    View structured Gemini API failure log buffer
 * @access  Internal / Diagnostics
 */
aiRouter.get('/failures', (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 50;
  res.json({
    success: true,
    count: getRecentAiFailures(limit).length,
    failures: getRecentAiFailures(limit)
  });
});

/**
 * @route   GET /api/ai/test
 * @route   POST /api/ai/test
 * @desc    Minimal test endpoint to verify Gemini 3.8 Flash connectivity and configuration
 * @access  Public / Server-side
 */
aiRouter.all('/test', async (req, res, next) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY || req.headers['x-gemini-key'];

    if (!apiKey) {
      const err = new Error('GEMINI_API_KEY is not configured on the server. Please add your GEMINI_API_KEY to the server .env file.');
      err.status = 500;
      logAiFailure({
        service: 'TEST_ENDPOINT',
        model: 'gemini-3.8-flash',
        error: err,
        context: { route: '/api/ai/test' },
        fallbackAction: 'Returned 500 error'
      });
      return res.status(500).json({
        success: false,
        error: err.message,
        message: 'Please add your GEMINI_API_KEY to the server .env file.',
        status: 500
      });
    }

    const prompt = req.body?.prompt || req.query?.prompt || 'Say hello from Rannabanna in English and Bengali in one short sentence.';

    const ai = new GoogleGenAI({ apiKey });

    // Important Gemini 3 model configuration constraints:
    // 1. Omit temperature, top_p, top_k (removed in Gemini 3)
    // 2. Use thinkingConfig with thinkingLevel ("low", "medium", "high" — "minimal" is unsupported on 3.8 Flash)
    // 3. Do not pass candidate_count
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        thinkingConfig: {
          thinkingLevel: 'low'
        }
      }
    });

    const responseText = response.text || '';

    return res.json({
      success: true,
      model: 'gemini-3.8-flash',
      thinkingLevel: 'low',
      prompt,
      response: responseText,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logAiFailure({
      service: 'TEST_ENDPOINT',
      model: 'gemini-3.8-flash',
      error,
      context: { route: '/api/ai/test' },
      fallbackAction: 'Returned error to client'
    });
    console.error('Gemini 3.8 Flash test endpoint error:', error);
    return res.status(error.status || 500).json({
      success: false,
      error: error.message || 'Gemini API call failed',
      status: error.status || 500
    });
  }
});

/**
 * @route   POST /api/ai/custom-recipe
 * @desc    Generate a bespoke custom recipe using Gemini 3.8 Flash with rate limiting, structured JSON output and caching
 * @access  Public / Server-side
 */
aiRouter.post('/custom-recipe', aiRecipeRateLimiter, async (req, res, next) => {
  try {
    const {
      ingredients = [],
      ingredientIds = [],
      cuisine,
      cuisineId,
      maxTime,
      dietaryRestrictions,
      dietary,
      preferences,
      thinkingLevel = 'medium'
    } = req.body || {};

    const resolvedIngredients = ingredients.length > 0 ? ingredients : ingredientIds;
    const resolvedCuisine = cuisine || cuisineId;
    const resolvedDietary = dietaryRestrictions || dietary || preferences;

    if (!resolvedIngredients || resolvedIngredients.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Please select at least one ingredient to generate a custom recipe.',
        status: 400
      });
    }

    const recipe = await generateCustomAiRecipe({
      ingredients: resolvedIngredients,
      cuisine: resolvedCuisine,
      maxTime,
      dietaryRestrictions: resolvedDietary,
      thinkingLevel,
      apiKey: req.headers['x-gemini-key'] || process.env.GEMINI_API_KEY
    });

    return res.json({
      success: true,
      recipe
    });
  } catch (error) {
    logAiFailure({
      service: 'CUSTOM_RECIPE',
      model: 'gemini-3.8-flash',
      error,
      context: { 
        ingredientsCount: (req.body?.ingredients || req.body?.ingredientIds || []).length,
        cuisine: req.body?.cuisine || req.body?.cuisineId 
      },
      fallbackAction: 'Returned error response to client'
    });
    console.error('Custom recipe endpoint error:', error.message);
    return res.status(error.status || 500).json({
      success: false,
      error: error.message || 'Unable to generate custom recipe at this time.',
      status: error.status || 500
    });
  }
});

/**
 * @route   POST /api/ai/translate
 * @desc    Translate culinary text or a full recipe object to natural Bangla using Gemini 3.8 Flash with rate limiting and persistent caching
 * @access  Public / Server-side
 */
aiRouter.post('/translate', aiTranslationRateLimiter, async (req, res, next) => {
  try {
    const {
      text,
      recipe,
      targetLanguage = 'bn',
      targetLang = 'bn'
    } = req.body || {};

    const resolvedTargetLang = (targetLanguage || targetLang || 'bn').toLowerCase().trim();
    const apiKey = req.headers['x-gemini-key'] || process.env.GEMINI_API_KEY;

    // 1. Case: Recipe translation
    if (recipe && typeof recipe === 'object') {
      const result = await translateRecipe({
        recipe,
        targetLanguage: resolvedTargetLang,
        apiKey
      });
      return res.json({
        success: true,
        ...result
      });
    }

    // 2. Case: Text snippet translation
    if (typeof text === 'string') {
      const result = await translateText({
        text,
        targetLanguage: resolvedTargetLang,
        apiKey
      });
      return res.json({
        success: true,
        ...result
      });
    }

    // 3. Neither provided
    return res.status(400).json({
      success: false,
      error: "Please provide either 'text' (string) or 'recipe' (object) to translate.",
      status: 400
    });
  } catch (error) {
    logAiFailure({
      service: 'TRANSLATE_ENDPOINT',
      model: 'gemini-3.8-flash',
      error,
      context: { hasText: Boolean(req.body?.text), hasRecipe: Boolean(req.body?.recipe) },
      fallbackAction: 'Returned error response to client'
    });
    console.error('Translation endpoint error:', error.message);
    return res.status(error.status || 500).json({
      success: false,
      error: error.message || 'Translation failed.',
      status: error.status || 500
    });
  }
});
