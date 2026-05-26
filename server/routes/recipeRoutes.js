import express from 'express';
import { recipeService } from '../services/recipeService.js';
import { cacheService } from '../services/cacheService.js';
import { validateCustomRecipeInput } from '../utils/validation.js';
import { db } from '../models/db.js';

export const recipeRouter = express.Router();

/**
 * @route   POST /api/recipe/generate
 * @desc    Generate a dynamic bespoke recipe using selected GIV ingredients
 * @access  Public
 */
recipeRouter.post('/generate', async (req, res, next) => {
  try {
    const { ingredientIds = [], cuisineId = 'any', preferences = {}, userId = null } = req.body;

    // Run input validation safeguards
    const validation = validateCustomRecipeInput(ingredientIds, preferences, db);
    if (!validation.isValid) {
      return res.status(validation.statusCode).json({
        error: validation.statusCode === 422 ? 'Unprocessable Entity' : 'Bad Request',
        message: validation.message,
        resolution: validation.resolution,
        suggestions: validation.suggestions
      });
    }

    // High-performance Redis-style memory cache check
    const cacheKey = cacheService.generateKey(ingredientIds, { cuisineId, preferences });
    const cachedRecipe = cacheService.get(cacheKey);

    if (cachedRecipe) {
      console.log('⚡ Serving identical custom recipe generation from cache.');
      return res.json(cachedRecipe);
    }

    // Call dynamic bespoke generation engine
    const apiKey = process.env.GEMINI_API_KEY || req.headers['x-gemini-key'];
    const generatedRecipe = await recipeService.generateCustomRecipe(ingredientIds, cuisineId, apiKey, userId);

    // Cache the generated recipe for 10 minutes
    cacheService.set(cacheKey, generatedRecipe);

    res.json(generatedRecipe);
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/recipe/:id
 * @desc    Fetch a fully detailed recipe matching relational indices
 * @access  Public
 */
recipeRouter.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const recipe = await recipeService.getRecipeById(id);

    if (!recipe) {
      return res.status(404).json({
        error: 'Not Found',
        message: `Recipe not found with id: "${id}".`
      });
    }

    res.json(recipe);
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/recipe/save
 * @desc    Save a dynamic custom or standard recipe to user account
 * @access  Private / Logged In
 */
recipeRouter.post('/save', async (req, res, next) => {
  try {
    const { userId, recipeId } = req.body;

    if (!userId || !recipeId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Both "userId" and "recipeId" are required parameters to save a recipe.'
      });
    }

    const saved = await recipeService.saveRecipe(userId, recipeId);

    if (!saved) {
      return res.status(409).json({
        error: 'Conflict',
        message: 'This recipe is already saved to the user account.'
      });
    }

    res.json({
      status: 'success',
      message: 'Recipe successfully saved to the user account.'
    });
  } catch (error) {
    // Map custom relational errors to bad request status codes
    if (error.message.includes('User not found') || error.message.includes('Recipe not found')) {
      return res.status(400).json({
        error: 'Bad Request',
        message: error.message
      });
    }
    next(error);
  }
});
