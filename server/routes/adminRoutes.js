import express from 'express';
import { adminAuth, authenticateAdmin, invalidateAdminToken } from '../middlewares/adminAuth.js';
import { recipeService } from '../services/recipeService.js';

export const adminRouter = express.Router();

/**
 * @route   POST /api/admin/login
 * @desc    Authenticate admin and return session bearer token
 * @access  Public
 */
adminRouter.post('/login', (req, res) => {
  try {
    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ error: 'Bad Request', message: 'Password is required' });
    }

    const authResult = authenticateAdmin(password);
    if (!authResult.success) {
      return res.status(401).json({ error: 'Unauthorized', message: authResult.error });
    }

    res.json({
      success: true,
      token: authResult.token,
      message: 'Admin authentication successful'
    });
  } catch (error) {
    res.status(500).json({ error: 'Server Error', message: error.message });
  }
});

/**
 * @route   POST /api/admin/logout
 * @desc    Invalidate current admin session token
 * @access  Public
 */
adminRouter.post('/logout', (req, res) => {
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    invalidateAdminToken(token);
  }
  res.json({ success: true, message: 'Logged out successfully' });
});

/**
 * @route   GET /api/admin/me
 * @desc    Verify current admin session status
 * @access  Admin
 */
adminRouter.get('/me', adminAuth, (req, res) => {
  res.json({ authenticated: true, role: 'admin' });
});

/**
 * @route   GET /api/admin/stats
 * @desc    Aggregated analytics and metrics for dashboard
 * @access  Admin
 */
adminRouter.get('/stats', adminAuth, async (req, res, next) => {
  try {
    const stats = await recipeService.getAdminStats();
    res.json(stats);
  } catch (error) {
    next(error);
  }
});

// ══════════════════════════════════════════════════════════════
// RECIPES CRUD
// ══════════════════════════════════════════════════════════════

adminRouter.get('/recipes', adminAuth, async (req, res, next) => {
  try {
    const { search, cuisineId, difficulty, page, limit } = req.query;
    const result = await recipeService.adminGetRecipes({
      search,
      cuisineId,
      difficulty,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/recipes/:id', adminAuth, async (req, res, next) => {
  try {
    const recipe = await recipeService.adminGetRecipeById(req.params.id);
    if (!recipe) {
      return res.status(404).json({ error: 'Not Found', message: 'Recipe not found' });
    }
    res.json(recipe);
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/recipes', adminAuth, async (req, res, next) => {
  try {
    const created = await recipeService.adminCreateRecipe(req.body);
    res.status(201).json({
      success: true,
      message: 'Recipe created successfully',
      data: created
    });
  } catch (error) {
    if (error.message.includes('already exists') || error.message.includes('required')) {
      return res.status(400).json({ error: 'Bad Request', message: error.message });
    }
    next(error);
  }
});

adminRouter.put('/recipes/:id', adminAuth, async (req, res, next) => {
  try {
    const updated = await recipeService.adminUpdateRecipe(req.params.id, req.body);
    res.json({
      success: true,
      message: 'Recipe updated successfully',
      data: updated
    });
  } catch (error) {
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: 'Not Found', message: error.message });
    }
    next(error);
  }
});

adminRouter.delete('/recipes/:id', adminAuth, async (req, res, next) => {
  try {
    await recipeService.adminDeleteRecipe(req.params.id);
    res.json({ success: true, message: `Recipe "${req.params.id}" deleted successfully` });
  } catch (error) {
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: 'Not Found', message: error.message });
    }
    next(error);
  }
});

// ══════════════════════════════════════════════════════════════
// INGREDIENTS (GIV) CRUD
// ══════════════════════════════════════════════════════════════

adminRouter.get('/ingredients', adminAuth, async (req, res, next) => {
  try {
    const { search, category, page, limit } = req.query;
    const result = await recipeService.adminGetIngredients({
      search,
      category,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 50
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/ingredients', adminAuth, async (req, res, next) => {
  try {
    const created = await recipeService.adminCreateIngredient(req.body);
    res.status(201).json({
      success: true,
      message: 'Ingredient created in GIV',
      data: created
    });
  } catch (error) {
    if (error.message.includes('already exists') || error.message.includes('required')) {
      return res.status(400).json({ error: 'Bad Request', message: error.message });
    }
    next(error);
  }
});

adminRouter.put('/ingredients/:id', adminAuth, async (req, res, next) => {
  try {
    const updated = await recipeService.adminUpdateIngredient(req.params.id, req.body);
    res.json({
      success: true,
      message: 'Ingredient updated',
      data: updated
    });
  } catch (error) {
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: 'Not Found', message: error.message });
    }
    next(error);
  }
});

adminRouter.delete('/ingredients/:id', adminAuth, async (req, res, next) => {
  try {
    await recipeService.adminDeleteIngredient(req.params.id);
    res.json({ success: true, message: `Ingredient "${req.params.id}" deleted from GIV` });
  } catch (error) {
    if (error.message.includes('Cannot delete ingredient')) {
      return res.status(409).json({ error: 'Conflict', message: error.message });
    }
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: 'Not Found', message: error.message });
    }
    next(error);
  }
});

// ══════════════════════════════════════════════════════════════
// CUISINES CRUD
// ══════════════════════════════════════════════════════════════

adminRouter.get('/cuisines', adminAuth, async (req, res, next) => {
  try {
    const cuisines = await recipeService.adminGetCuisines();
    res.json(cuisines);
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/cuisines', adminAuth, async (req, res, next) => {
  try {
    const created = await recipeService.adminCreateCuisine(req.body);
    res.status(201).json({
      success: true,
      message: 'Cuisine created',
      data: created
    });
  } catch (error) {
    if (error.message.includes('already exists') || error.message.includes('required')) {
      return res.status(400).json({ error: 'Bad Request', message: error.message });
    }
    next(error);
  }
});

adminRouter.put('/cuisines/:id', adminAuth, async (req, res, next) => {
  try {
    const updated = await recipeService.adminUpdateCuisine(req.params.id, req.body);
    res.json({
      success: true,
      message: 'Cuisine updated',
      data: updated
    });
  } catch (error) {
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: 'Not Found', message: error.message });
    }
    next(error);
  }
});

adminRouter.delete('/cuisines/:id', adminAuth, async (req, res, next) => {
  try {
    await recipeService.adminDeleteCuisine(req.params.id);
    res.json({ success: true, message: `Cuisine "${req.params.id}" deleted` });
  } catch (error) {
    if (error.message.includes('Cannot delete cuisine')) {
      return res.status(409).json({ error: 'Conflict', message: error.message });
    }
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: 'Not Found', message: error.message });
    }
    next(error);
  }
});

// ══════════════════════════════════════════════════════════════
// SYSTEM LOGS & CACHE MANAGEMENT
// ══════════════════════════════════════════════════════════════

adminRouter.get('/system/logs', adminAuth, async (req, res, next) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit) : 50;
    const logs = await recipeService.adminGetSystemLogs(limit);
    res.json(logs);
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/system/cache/flush', adminAuth, async (req, res, next) => {
  try {
    await recipeService.invalidateCache();
    res.json({
      success: true,
      message: 'In-memory cache and LRU match cache successfully flushed and re-hydrated.'
    });
  } catch (error) {
    next(error);
  }
});
