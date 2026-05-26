import express from 'express';
import cors from 'cors';
import { db } from './models/db.js';
import { rateLimiter } from './middlewares/rateLimiter.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { recipeRouter } from './routes/recipeRoutes.js';
import { ingredientRouter } from './routes/ingredientRoutes.js';
import { recipeService } from './services/recipeService.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Register standard core middlewares
app.use(cors());
app.use(express.json());

// Enable IP Rate Limiting for abuse prevention
app.use(rateLimiter);

// ═══════════════════════════════════════════════════════════
// 1. Modular Enterprise RESTful Router Mappings
// ═══════════════════════════════════════════════════════════
app.use('/api/recipes', recipeRouter);
app.use('/api/recipe', recipeRouter);
app.use('/api/ingredients', ingredientRouter);

// ═══════════════════════════════════════════════════════════
// 2. Legacy Autocomplete & Matchmaker Compatibility Layer
// ═══════════════════════════════════════════════════════════

/**
 * @desc Legacy fetch cuisines list matching frontend requirements
 */
app.get('/api/cuisines', async (req, res, next) => {
  try {
    const rows = await recipeService.getAllCuisines();
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

/**
 * @desc Legacy fetch specific cuisine details
 */
app.get('/api/cuisines/:id', async (req, res, next) => {
  try {
    const cuisine = await recipeService.getCuisineById(req.params.id);
    if (!cuisine) {
      return res.status(404).json({ error: 'Cuisine not found' });
    }
    res.json(cuisine);
  } catch (error) {
    next(error);
  }
});

/**
 * @desc Legacy list canonical ingredients GIV details
 */
app.get('/api/ingredients', async (req, res, next) => {
  try {
    const rows = await recipeService.getAllIngredients();
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

/**
 * @desc Legacy fetch recipes summaries list
 */
app.get('/api/recipes', async (req, res, next) => {
  try {
    const rows = await recipeService.getAllRecipes();
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

/**
 * @desc Legacy fetch recipe fully resolved details
 */
app.get('/api/recipes/:id', async (req, res, next) => {
  try {
    const recipe = await recipeService.getRecipeById(req.params.id);
    if (!recipe) {
      return res.status(404).json({ error: 'Recipe not found' });
    }
    res.json(recipe);
  } catch (error) {
    next(error);
  }
});

/**
 * @desc Legacy weighted matchmaking engine interface
 */
app.post('/api/match', async (req, res, next) => {
  try {
    const { ingredientIds = [], filters = {} } = req.body;
    const matches = await recipeService.matchRecipes(ingredientIds, filters);
    res.json(matches);
  } catch (error) {
    next(error);
  }
});

/**
 * @desc Legacy custom bespoke recipe generation interface
 */
app.post('/api/custom-recipe', async (req, res, next) => {
  try {
    const { ingredientIds = [], cuisineId = 'any' } = req.body;

    if (ingredientIds.length === 0) {
      return res.status(400).json({ error: 'Please select at least one ingredient to generate a custom recipe.' });
    }

    const apiKey = process.env.GEMINI_API_KEY || req.headers['x-gemini-key'];
    const customRecipe = await recipeService.generateCustomRecipe(ingredientIds, cuisineId, apiKey);

    res.json(customRecipe);
  } catch (error) {
    next(error);
  }
});

// Register Global Operational Error Handling Middleware
app.use(errorHandler);

// Boot bootstrapping port loader listener
app.listen(PORT, () => {
  console.log(`🚀 Modular Express Server is running on http://localhost:${PORT}`);
});
