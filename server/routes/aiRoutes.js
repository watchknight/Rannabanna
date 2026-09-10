import express from 'express';
import { GoogleGenAI } from '@google/genai';
import { generateCustomAiRecipe } from '../services/aiRecipeService.js';

export const aiRouter = express.Router();

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
      return res.status(500).json({
        success: false,
        error: 'GEMINI_API_KEY is not configured on the server.',
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
 * @desc    Generate a bespoke custom recipe using Gemini 3.8 Flash with structured JSON output and caching
 * @access  Public / Server-side
 */
aiRouter.post('/custom-recipe', async (req, res, next) => {
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
    console.error('Custom recipe endpoint error:', error.message);
    return res.status(error.status || 500).json({
      success: false,
      error: error.message || 'Unable to generate custom recipe at this time.',
      status: error.status || 500
    });
  }
});
