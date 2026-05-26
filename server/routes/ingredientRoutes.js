import express from 'express';
import { recipeService } from '../services/recipeService.js';

export const ingredientRouter = express.Router();

/**
 * @route   GET /api/ingredients/search
 * @desc    Autocomplete search query against GIV ingredients database
 * @access  Public
 */
ingredientRouter.get('/search', async (req, res, next) => {
  try {
    const { q } = req.query;

    if (!q || q.trim().length === 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Query parameter "q" is required and cannot be empty.'
      });
    }

    const mapped = await recipeService.searchIngredients(q);
    res.json(mapped);
  } catch (error) {
    next(error);
  }
});
