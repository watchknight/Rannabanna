import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { rateLimiter } from './middlewares/rateLimiter.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { recipeRouter } from './routes/recipeRoutes.js';
import { ingredientRouter } from './routes/ingredientRoutes.js';
import { adminRouter } from './routes/adminRoutes.js';
import { aiRouter } from './routes/aiRoutes.js';
import { recipeService } from './services/recipeService.js';
import { cacheService } from './services/cacheService.js';
import { generateCustomAiRecipe } from './services/aiRecipeService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.resolve(__dirname, '..', 'dist');

// Secure server-side environment variables loader
const envPaths = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(__dirname, '..', '.env'),
  path.resolve(__dirname, '.env')
];
for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    try {
      if (typeof process.loadEnvFile === 'function') {
        process.loadEnvFile(envPath);
      }
      break;
    } catch {
      // Gracefully continue if already loaded or unavailable
    }
  }
}

const app = express();
const PORT = process.env.PORT || 3001;

// Enable trust proxy for secure header and IP resolution
app.set('trust proxy', 1);

// Security Headers Middleware
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

// Register standard core middlewares with CORS whitelist
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'];

app.use(cors({
  origin: (origin, callback) => {
    if (
      !origin || 
      allowedOrigins.includes('*') || 
      allowedOrigins.includes(origin) || 
      process.env.NODE_ENV !== 'production' ||
      origin.endsWith('.onrender.com') ||
      origin.includes('localhost')
    ) {
      callback(null, true);
    } else {
      callback(new Error('Blocked by CORS policy'));
    }
  },
  credentials: true
}));
app.use(express.json({ limit: '1mb' }));

// Health check endpoint for Render / monitoring
app.get(['/health', '/api/health'], (req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

// Enable IP Rate Limiting for abuse prevention
app.use(rateLimiter);

// ═══════════════════════════════════════════════════════════
// 1. Modular Enterprise RESTful Router Mappings
// ═══════════════════════════════════════════════════════════
app.use('/api/recipes', recipeRouter);
app.use('/api/recipe', recipeRouter);
app.use('/api/ingredients', ingredientRouter);
app.use('/api/admin', adminRouter);
app.use('/api/ai', aiRouter);

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
app.post(['/api/match', '/api/recipes/match'], async (req, res, next) => {
  try {
    const { ingredientIds = [], filters = {} } = req.body;

    if (!Array.isArray(ingredientIds)) {
      return res.status(400).json({ error: 'ingredientIds must be an array' });
    }

    const cacheKey = cacheService.generateKey('match', { ingredientIds: [...ingredientIds].sort(), filters });
    const cached = cacheService.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const matches = await recipeService.matchRecipes(ingredientIds, filters);
    cacheService.set(cacheKey, matches, 10 * 60 * 1000); // 10 minutes TTL
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
    const { 
      ingredientIds = [], 
      ingredients = [], 
      cuisineId = 'any', 
      cuisine = null,
      filters = {} 
    } = req.body || {};

    const resolvedIngredients = ingredients.length > 0 ? ingredients : ingredientIds;

    if (!resolvedIngredients || resolvedIngredients.length === 0) {
      return res.status(400).json({ error: 'Please select at least one ingredient to generate a custom recipe.' });
    }

    const apiKey = process.env.GEMINI_API_KEY || req.headers['x-gemini-key'];

    if (apiKey) {
      try {
        const aiRecipe = await generateCustomAiRecipe({
          ingredients: resolvedIngredients,
          cuisine: cuisine || cuisineId,
          maxTime: filters.maxTime,
          dietaryRestrictions: filters.dietaryRestrictions || filters.dietary,
          apiKey
        });
        return res.json(aiRecipe);
      } catch (aiError) {
        console.warn('⚠️ Gemini AI recipe generation failed, falling back to local recipe engine:', aiError.message);
      }
    }

    // High-precision local chef engine failover
    const fallbackRecipe = await recipeService.generateCustomRecipe(resolvedIngredients, cuisineId, null);
    res.json(fallbackRecipe);
  } catch (error) {
    next(error);
  }
});

// ═══════════════════════════════════════════════════════════
// 3. Static Asset Delivery & SPA Fallback for Production
// ═══════════════════════════════════════════════════════════
if (fs.existsSync(distPath)) {
  console.log(`📦 Serving production static build from: ${distPath}`);
  
  // Serve static assets (js, css, images, robots.txt, etc.) without automatic index.html serving
  app.use(express.static(distPath, { index: false }));

  // Dynamic HTML handler for root and client-side SPA routes
  const serveHtml = (req, res) => {
    try {
      const indexPath = path.join(distPath, 'index.html');
      let html = fs.readFileSync(indexPath, 'utf-8');
      
      const host = req.get('host') || 'rannabanna.onrender.com';
      const cleanUrl = `https://${host}${req.originalUrl || '/'}`;

      // Dynamically synchronize OpenGraph & Twitter canonical URLs with requested URL
      html = html
        .replace(/<meta property="og:url" content="[^"]*"/, `<meta property="og:url" content="${cleanUrl}"`)
        .replace(/<link rel="canonical" href="[^"]*"/, `<link rel="canonical" href="${cleanUrl}"`)
        .replace(/<meta name="twitter:url" content="[^"]*"/, `<meta name="twitter:url" content="${cleanUrl}"`);

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      return res.status(200).send(html);
    } catch (err) {
      return res.sendFile(path.join(distPath, 'index.html'));
    }
  };

  app.get('/', serveHtml);

  // Client-side SPA routing fallback for non-API GET routes (Express 5 compatible)
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.originalUrl.startsWith('/api')) {
      return serveHtml(req, res);
    }
    next();
  });
}

// 404 Catch-All for unmatched API routes
app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    statusCode: 404,
    message: `Route not found: ${req.method} ${req.originalUrl}`
  });
});

// Register Global Operational Error Handling Middleware
app.use(errorHandler);

// Boot bootstrapping port loader listener
app.listen(PORT, () => {
  console.log(`🚀 Modular Express Server is running on http://localhost:${PORT}`);
});
