import { GoogleGenAI, Type } from '@google/genai';
import { cacheService } from './cacheService.js';
import { decorateRecipeTranslations, ingredientTranslations } from '../utils/translation_engine.js';

/**
 * System Instruction strictly instructing the Gemini 3.8 Flash culinary expert
 */
export const AI_RECIPE_SYSTEM_INSTRUCTION = `You are the Executive Master Chef for Rannabanna (রান্নাবান্না), an authentic global culinary platform.
Your task is to craft realistic, cookable, gourmet custom recipes based strictly on the user's available ingredients and cooking preferences.

Mandatory Culinary Directives:
1. Primary Ingredients: Build the recipe primarily around the user's selected ingredients.
2. Minimal Pantry Staples: Only add essential pantry staples (salt, cooking oil, water, or basic black pepper) if genuinely required for basic culinary preparation. Do NOT invent a recipe that demands unselected specialty ingredients (e.g. exotic sauces, special cheeses, or unusual spices not provided).
3. Filter Compliance:
   - Cuisine: If a cuisine is specified (e.g. Bengali, Italian, North Indian, Chinese, Mexican), authentically reflect that style in flavor profile, spices, and cooking techniques. If 'any' or unspecified, select the most harmonious cuisine for the ingredients.
   - Time Limit: If a maximum time (maxTime) is provided, the total estimated time (prepTime + cookTime) MUST NOT exceed that limit.
   - Dietary Restrictions: Strictly respect all dietary restrictions (e.g. vegetarian, vegan, gluten-free, dairy-free, halal). NEVER include forbidden ingredients.
4. Realism & Cookability: All cooking steps, temperatures, and proportions must be realistic, tested, and safe. Do not generate fantastical or uncookable combinations.
5. Structured Instructions: Write clear, numbered, chronological steps matching professional recipe standards, including duration in minutes for every active or passive step where relevant.
6. Bilingual Content: Provide both English and natural, idiomatic Bangla (বাংলা) for the title and steps.`;

/**
 * Gemini 3 Structured Output Schema conforming to Rannabanna's recipe data model
 */
export const RECIPE_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Appetizing, realistic name of the recipe in English"
    },
    titleBn: {
      type: Type.STRING,
      description: "Appetizing recipe title in authentic, natural Bangla"
    },
    cuisine: {
      type: Type.STRING,
      description: "Culinary tradition or cuisine (e.g. Bengali, North Indian, Italian, Chinese, Mexican)"
    },
    description: {
      type: Type.STRING,
      description: "Engaging 1-2 sentence description of the dish in English"
    },
    descriptionBn: {
      type: Type.STRING,
      description: "Engaging 1-2 sentence description of the dish in Bangla"
    },
    estimatedTime: {
      type: Type.INTEGER,
      description: "Total estimated time (prep + cook) in minutes"
    },
    prepTime: {
      type: Type.INTEGER,
      description: "Preparation time in minutes"
    },
    cookTime: {
      type: Type.INTEGER,
      description: "Active cooking time in minutes"
    },
    estimatedCalories: {
      type: Type.INTEGER,
      description: "Estimated calories per serving"
    },
    servings: {
      type: Type.INTEGER,
      description: "Number of standard servings (e.g. 2 or 4)"
    },
    difficulty: {
      type: Type.STRING,
      description: "Skill level required: beginner, intermediate, or hard"
    },
    ingredients: {
      type: Type.ARRAY,
      description: "List of ingredients required for this recipe",
      items: {
        type: Type.OBJECT,
        properties: {
          name: {
            type: Type.STRING,
            description: "Ingredient name in English"
          },
          nameBn: {
            type: Type.STRING,
            description: "Ingredient name in Bangla"
          },
          amount: {
            type: Type.NUMBER,
            description: "Numerical practical quantity (e.g. 2, 0.5, 1)"
          },
          unit: {
            type: Type.STRING,
            description: "Standard unit (e.g. piece, tbsp, tsp, cup, g, kg, pinch, to taste)"
          },
          isPantryStaple: {
            type: Type.BOOLEAN,
            description: "True if this was added as a common pantry staple (salt, oil, water), false if selected by user"
          }
        },
        required: ["name", "amount", "unit"]
      }
    },
    steps: {
      type: Type.ARRAY,
      description: "Numbered cooking instructions",
      items: {
        type: Type.OBJECT,
        properties: {
          step: {
            type: Type.INTEGER,
            description: "Chronological step number starting at 1"
          },
          instruction: {
            type: Type.STRING,
            description: "Cooking step instruction in English"
          },
          instructionBn: {
            type: Type.STRING,
            description: "Cooking step instruction in natural Bangla"
          },
          duration: {
            type: Type.INTEGER,
            description: "Estimated duration for this step in minutes"
          }
        },
        required: ["step", "instruction"]
      }
    }
  },
  required: [
    "title",
    "cuisine",
    "estimatedTime",
    "estimatedCalories",
    "ingredients",
    "steps"
  ]
};

/**
 * Normalizes input ingredients whether passed as strings, IDs, or objects.
 */
function normalizeIngredients(ingredients = []) {
  if (!Array.isArray(ingredients)) return [];
  return ingredients.map(item => {
    if (typeof item === 'string') return item.trim();
    if (item && typeof item === 'object') return item.name || item.nameEn || item.id || '';
    return String(item);
  }).filter(Boolean);
}

/**
 * Normalizes filter inputs into consistent types.
 */
function normalizeFilters(filters = {}) {
  const cuisine = filters.cuisine || filters.cuisineId || 'any';
  const maxTime = filters.maxTime ? Number(filters.maxTime) : null;
  let dietary = filters.dietaryRestrictions || filters.dietary || filters.preferences || [];
  if (typeof dietary === 'string') {
    dietary = [dietary];
  } else if (!Array.isArray(dietary)) {
    dietary = Object.keys(dietary).filter(k => dietary[k]);
  }
  return {
    cuisine: cuisine === 'any' ? null : cuisine,
    maxTime: maxTime && !isNaN(maxTime) ? maxTime : null,
    dietaryRestrictions: dietary.filter(Boolean)
  };
}

/**
 * Core service to generate custom recipes using Gemini 3.8 Flash
 */
export async function generateCustomAiRecipe({
  ingredients = [],
  cuisine = null,
  maxTime = null,
  dietaryRestrictions = [],
  thinkingLevel = 'medium',
  apiKey = null,
  timeoutMs = 30000
} = {}) {
  const normalizedIngredients = normalizeIngredients(ingredients);
  if (normalizedIngredients.length === 0) {
    const error = new Error('Please select at least one ingredient to generate a custom recipe.');
    error.status = 400;
    throw error;
  }

  const normalizedFilters = normalizeFilters({ cuisine, maxTime, dietaryRestrictions });

  // 1. Basic In-Memory Caching: Check cache for identical ingredients + filters combination
  const cacheKey = `ai:custom-recipe:${cacheService.generateKey(normalizedIngredients, normalizedFilters)}`;
  const cachedResult = cacheService.get(cacheKey);
  if (cachedResult) {
    console.log('⚡ Returning custom AI recipe from in-memory cache:', cachedResult.title);
    return {
      ...cachedResult,
      cached: true
    };
  }

  // 2. Resolve Server-side API key
  const effectiveApiKey = apiKey || process.env.GEMINI_API_KEY;
  if (!effectiveApiKey) {
    const error = new Error('GEMINI_API_KEY is not configured on the server. Please add it to your server .env file.');
    error.status = 500;
    throw error;
  }

  const ai = new GoogleGenAI({ apiKey: effectiveApiKey });

  // 3. Construct user prompt with clear structured context
  const promptParts = [
    `Selected Ingredients: ${normalizedIngredients.join(', ')}.`
  ];
  if (normalizedFilters.cuisine) {
    promptParts.push(`Desired Cuisine: ${normalizedFilters.cuisine}.`);
  }
  if (normalizedFilters.maxTime) {
    promptParts.push(`Maximum Total Cooking Time: ${normalizedFilters.maxTime} minutes.`);
  }
  if (normalizedFilters.dietaryRestrictions && normalizedFilters.dietaryRestrictions.length > 0) {
    promptParts.push(`Dietary Restrictions: ${normalizedFilters.dietaryRestrictions.join(', ')}.`);
  }
  promptParts.push('Please create a realistic, delicious, authentic custom recipe conforming to the schema.');
  const userContent = promptParts.join(' ');

  // 4. Call Gemini 3.8 Flash with structured schema, system instruction, and thinking level
  const allowedThinkingLevels = ['low', 'medium', 'high'];
  let currentThinkingLevel = allowedThinkingLevels.includes(thinkingLevel) ? thinkingLevel : 'medium';

  let rawJsonText = '';
  let lastError = null;

  // Retry loop with backoff for transient 503 high-demand spikes
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      // Setup timeout controller
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          const timeoutErr = new Error(`Recipe generation timed out after ${timeoutMs / 1000} seconds.`);
          timeoutErr.status = 504;
          reject(timeoutErr);
        }, timeoutMs);
      });

      const generatePromise = ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: userContent,
        config: {
          systemInstruction: AI_RECIPE_SYSTEM_INSTRUCTION,
          responseMimeType: 'application/json',
          responseSchema: RECIPE_RESPONSE_SCHEMA,
          thinkingConfig: {
            thinkingLevel: currentThinkingLevel
          }
        }
      });

      const response = await Promise.race([generatePromise, timeoutPromise]);
      rawJsonText = (response.text || '').trim();

      // Gemini 3 rough edge workaround:
      // If structured output returns empty with thinkingLevel 'medium', lower to 'low' and retry
      if (!rawJsonText && currentThinkingLevel === 'medium') {
        console.warn('⚠️ Gemini 3 returned empty structured text with thinkingLevel: "medium". Retrying with "low"...');
        currentThinkingLevel = 'low';
        continue;
      }

      if (rawJsonText) {
        break; // Successfully got non-empty JSON
      }
    } catch (err) {
      lastError = err;
      console.warn(`⚠️ Gemini custom-recipe call attempt ${attempt} failed (status: ${err.status || err.code}): ${err.message}`);

      // If it's a 429 quota error, format friendly message and stop retrying immediately
      if (err.status === 429 || (err.message && err.message.includes('Quota exceeded'))) {
        const quotaErr = new Error('AI Chef is currently experiencing high demand. Free tier quota limit reached; please retry in a few moments.');
        quotaErr.status = 429;
        throw quotaErr;
      }

      // If it's a 503 or transient network issue and we have retries left, back off and retry
      if ((err.status === 503 || err.status === 500) && attempt < 3) {
        currentThinkingLevel = 'low';
        await new Promise(r => setTimeout(r, 2000 * attempt));
        continue;
      }

      // Format clean human-readable message if error message contains raw JSON
      let cleanMessage = err.message || 'AI Chef service is currently unavailable. Please try again.';
      try {
        const parsed = JSON.parse(cleanMessage);
        if (parsed?.error?.message) {
          cleanMessage = parsed.error.message;
        }
      } catch {}

      const formattedErr = new Error(cleanMessage);
      formattedErr.status = err.status || 500;
      throw formattedErr;
    }
  }

  if (!rawJsonText) {
    const error = new Error('AI Chef was unable to generate a recipe response. Please try again with different ingredients.');
    error.status = 502;
    throw error;
  }

  // 5. Parse and validate structured output
  let recipeData;
  try {
    recipeData = JSON.parse(rawJsonText);
  } catch (parseErr) {
    console.error('Failed to parse Gemini recipe JSON output:', rawJsonText);
    const error = new Error('AI Chef produced an invalid recipe response structure. Please try again.');
    error.status = 502;
    throw error;
  }

  // Verify minimal schema fields required by the application
  if (!recipeData.title || !Array.isArray(recipeData.ingredients) || !Array.isArray(recipeData.steps)) {
    const error = new Error('AI Chef output did not meet the required recipe structure.');
    error.status = 502;
    throw error;
  }

  // 6. Enrich with Rannabanna metadata (unique ID, emojis, fallback translations)
  const recipeId = `custom-ai-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const enrichedRecipe = {
    id: recipeId,
    title: recipeData.title,
    titleBn: recipeData.titleBn || recipeData.title,
    cuisine: recipeData.cuisine || normalizedFilters.cuisine || 'Global',
    cuisineId: (recipeData.cuisine || normalizedFilters.cuisine || 'custom').toLowerCase().replace(/\s+/g, '-'),
    description: recipeData.description || `A gourmet custom creation crafted from ${normalizedIngredients.slice(0, 3).join(', ')}.`,
    descriptionBn: recipeData.descriptionBn || recipeData.description || '',
    estimatedTime: recipeData.estimatedTime || (recipeData.prepTime || 10) + (recipeData.cookTime || 20),
    prepTime: recipeData.prepTime || Math.round((recipeData.estimatedTime || 30) * 0.35),
    cookTime: recipeData.cookTime || Math.round((recipeData.estimatedTime || 30) * 0.65),
    estimatedCalories: recipeData.estimatedCalories || 350,
    calories: recipeData.estimatedCalories || 350,
    servings: recipeData.servings || 4,
    difficulty: recipeData.difficulty || 'intermediate',
    imageEmoji: '🍳',
    isAiGenerated: true,
    model: 'gemini-3.8-flash',
    thinkingLevelUsed: currentThinkingLevel,
    ingredients: recipeData.ingredients.map((ing, idx) => ({
      ingredientId: `ing-${idx + 1}-${(ing.name || '').toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
      name: ing.name,
      nameBn: ing.nameBn || ingredientTranslations[ing.name?.toLowerCase()] || ing.name,
      amount: ing.amount,
      quantity: ing.amount,
      unit: ing.unit,
      isPantryStaple: Boolean(ing.isPantryStaple),
      isEssential: !ing.isPantryStaple,
      group: ing.isPantryStaple ? 'Staples' : 'Main'
    })),
    steps: recipeData.steps.map((st, idx) => ({
      step: st.step || idx + 1,
      instruction: st.instruction,
      instructionBn: st.instructionBn || st.instruction,
      duration: st.duration || null
    })),
    createdAt: new Date().toISOString()
  };

  // Run through Rannabanna's translation decorator for 100% bilingual UI consistency
  const finalRecipe = decorateRecipeTranslations(enrichedRecipe);

  // 7. Store in memory cache (TTL: 15 minutes = 900,000 ms)
  cacheService.set(cacheKey, finalRecipe, 15 * 60 * 1000);

  return finalRecipe;
}
