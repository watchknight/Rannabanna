import crypto from 'node:crypto';
import { GoogleGenAI, Type } from '@google/genai';
import { db } from '../models/db.js';
import { cacheService } from './cacheService.js';
import { recipeService } from './recipeService.js';
import { 
  decorateRecipeTranslations, 
  ingredientTranslations, 
  cuisineTranslations 
} from '../utils/translation_engine.js';
import { logAiFailure } from '../utils/aiLogger.js';

/**
 * Authentic Bengali Culinary Translator System Instruction for Gemini 3.8 Flash
 */
export const AI_TRANSLATION_SYSTEM_INSTRUCTION = `You are an authentic Bengali culinary translator and master chef for Rannabanna (রান্নাবান্না).
Your mission is to translate culinary texts, recipes, instructions, and cooking terms into authentic, natural Bangla (বাংলা) specifically tailored for a Bengali home-cook audience.

Mandatory Translation Principles:
1. Natural Bengali Tone: Translate naturally and idiomatically as spoken and written in authentic Bengali kitchens. Do NOT produce stiff, robotic, or literal word-for-word translation.
2. Authentic Culinary Vocabulary: Use the ingredients, spices, cookware, and culinary actions Bengali home cooks actually use:
   - Bay leaf -> তেজপাতা
   - Cinnamon -> দারুচিনি
   - Green Cardamom -> এলাচ / সবুজ এলাচ
   - Cumin -> জিরা
   - Coriander -> ধনে
   - Turmeric -> হলুদ
   - Mustard oil -> সরিষার তেল
   - Sauté / Fry spices -> মশলা কষানো
   - Tempering / Baghar -> ফোড়ন / বাঘার দেওয়া
   - Simmer -> মৃদু আঁচে ফুটানো / দমে রাখা
   - Golden brown -> হালকা বাদামি বা লালচে করে ভাজা
3. Authentic Culinary Units:
   - tablespoon (tbsp) -> টেবিল চামচ
   - teaspoon (tsp) -> চা চামচ
   - cup -> কাপ
   - pinch -> এক চিমটি
   - to taste -> স্বাদমতো
4. Strict Structural Preservation:
   - When translating a structured recipe, translate text fields (title, description, cultural context note, step instructions, ingredient names).
   - Strictly keep all numerical amounts, units, and step numbering sequence (1, 2, 3...) intact.
   - Never omit, reorder, or alter recipe steps.`;

/**
 * Gemini 3 Structured Output Schema for Recipe Translation
 */
export const RECIPE_TRANSLATION_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    titleBn: {
      type: Type.STRING,
      description: "Authentic, appetizing recipe title in natural Bangla"
    },
    descriptionBn: {
      type: Type.STRING,
      description: "Engaging 1-2 sentence recipe description in natural Bangla"
    },
    culturalNoteBn: {
      type: Type.STRING,
      description: "Cultural context or culinary heritage note in natural Bangla (if applicable)"
    },
    ingredients: {
      type: Type.ARRAY,
      description: "Translated ingredients list matching input order",
      items: {
        type: Type.OBJECT,
        properties: {
          name: {
            type: Type.STRING,
            description: "Original ingredient name in English"
          },
          nameBn: {
            type: Type.STRING,
            description: "Authentic ingredient name in Bangla"
          }
        },
        required: ["name", "nameBn"]
      }
    },
    steps: {
      type: Type.ARRAY,
      description: "Translated cooking instructions matching step sequence",
      items: {
        type: Type.OBJECT,
        properties: {
          step: {
            type: Type.INTEGER,
            description: "Chronological step number matching original"
          },
          instructionBn: {
            type: Type.STRING,
            description: "Cooking step instruction in natural, authentic Bangla"
          }
        },
        required: ["step", "instructionBn"]
      }
    }
  },
  required: ["titleBn", "steps"]
};

/**
 * Translates arbitrary text into natural Bangla using Gemini 3.8 Flash, with persistent SQLite and memory caching.
 *
 * @param {Object} options
 * @param {string} options.text - Source text to translate
 * @param {string} [options.targetLanguage='bn'] - Target language code
 * @param {string} [options.apiKey] - Optional override API key
 * @param {number} [options.timeoutMs=15000] - Request timeout in milliseconds
 * @returns {Promise<{ success: boolean, originalText: string, translatedText: string, targetLanguage: string, cached: boolean, source: string }>}
 */
export async function translateText({
  text,
  targetLanguage = 'bn',
  apiKey = null,
  timeoutMs = 15000
} = {}) {
  if (typeof text !== 'string') {
    const err = new Error('Text parameter must be a string.');
    err.status = 400;
    throw err;
  }

  const cleanText = text.trim();
  if (!cleanText) {
    return {
      success: true,
      originalText: text,
      translatedText: '',
      targetLanguage,
      cached: true,
      source: 'empty'
    };
  }

  const normalizedLang = (targetLanguage || 'bn').toLowerCase().trim();
  const hash = crypto.createHash('sha256').update(`${normalizedLang}:${cleanText}`).digest('hex');

  // 1. Check in-memory cache
  const memKey = `ai:trans:text:${hash}`;
  const memCached = cacheService.get(memKey);
  if (memCached) {
    return {
      success: true,
      originalText: text,
      translatedText: memCached,
      targetLanguage: normalizedLang,
      cached: true,
      source: 'memory'
    };
  }

  // 2. Check SQLite persistent translation_cache
  try {
    const row = db.prepare('SELECT translated_text FROM translation_cache WHERE source_hash = ?').get(hash);
    if (row && row.translated_text) {
      cacheService.set(memKey, row.translated_text, 24 * 60 * 60 * 1000);
      return {
        success: true,
        originalText: text,
        translatedText: row.translated_text,
        targetLanguage: normalizedLang,
        cached: true,
        source: 'database'
      };
    }
  } catch (dbErr) {
    console.warn('⚠️ Error reading from translation_cache table:', dbErr.message);
  }

  // 3. Cache miss: Call Gemini 3.8 Flash
  const effectiveApiKey = apiKey || process.env.GEMINI_API_KEY;
  if (!effectiveApiKey) {
    const err = new Error('GEMINI_API_KEY is not configured on the server.');
    err.status = 500;
    throw err;
  }

  const ai = new GoogleGenAI({ apiKey: effectiveApiKey });
  const prompt = `Translate the following culinary text into natural, idiomatic ${normalizedLang === 'bn' ? 'Bengali (Bangla)' : normalizedLang} for home cooks:\n\n"${cleanText}"\n\nReturn ONLY the translated text without commentary or quotes.`;

  let translatedText = '';
  try {
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        const timeoutErr = new Error(`Translation timed out after ${timeoutMs / 1000} seconds.`);
        timeoutErr.status = 504;
        reject(timeoutErr);
      }, timeoutMs);
    });

    const generatePromise = ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        systemInstruction: AI_TRANSLATION_SYSTEM_INSTRUCTION,
        thinkingConfig: {
          thinkingLevel: 'low'
        }
      }
    });

    const response = await Promise.race([generatePromise, timeoutPromise]);
    translatedText = (response.text || '').trim();
  } catch (apiErr) {
    logAiFailure({
      service: 'TRANSLATE_TEXT',
      model: 'gemini-3.8-flash',
      error: apiErr,
      context: { textLength: cleanText.length, targetLanguage: normalizedLang },
      fallbackAction: apiErr.status === 429 ? 'Returned 429 quota error' : 'Re-thrown to route handler'
    });
    console.warn('⚠️ Gemini translation API error:', apiErr.message);
    if (apiErr.status === 429 || apiErr.message?.includes('Quota exceeded')) {
      const quotaErr = new Error('Translation service quota reached. Please try again shortly.');
      quotaErr.status = 429;
      throw quotaErr;
    }
    throw apiErr;
  }

  if (!translatedText) {
    translatedText = cleanText;
  }

  // 4. Persist into SQLite translation_cache and in-memory cache
  try {
    db.prepare(`
      INSERT OR REPLACE INTO translation_cache (source_hash, source_text, target_lang, translated_text)
      VALUES (?, ?, ?, ?)
    `).run(hash, cleanText, normalizedLang, translatedText);
  } catch (cacheErr) {
    console.warn('⚠️ Could not save to translation_cache table:', cacheErr.message);
  }

  cacheService.set(memKey, translatedText, 24 * 60 * 60 * 1000);

  return {
    success: true,
    originalText: text,
    translatedText,
    targetLanguage: normalizedLang,
    cached: false,
    source: 'gemini'
  };
}

/**
 * Translates a complete recipe object into natural Bangla using Gemini 3.8 Flash,
 * with aggressive SQLite database persistence for pre-loaded recipes and caching.
 *
 * @param {Object} options
 * @param {Object} options.recipe - Recipe object to translate
 * @param {string} [options.targetLanguage='bn'] - Target language code
 * @param {string} [options.apiKey] - Optional override API key
 * @param {number} [options.timeoutMs=30000] - Request timeout in milliseconds
 * @returns {Promise<{ success: boolean, recipe: Object, cached: boolean, source: string, targetLanguage: string }>}
 */
export async function translateRecipe({
  recipe,
  targetLanguage = 'bn',
  apiKey = null,
  timeoutMs = 30000
} = {}) {
  if (!recipe || typeof recipe !== 'object') {
    const err = new Error('Recipe parameter must be a valid recipe object.');
    err.status = 400;
    throw err;
  }

  const recipeId = recipe.id;
  const normalizedLang = (targetLanguage || 'bn').toLowerCase().trim();

  // ═════════════════════════════════════════════════════════════════════
  // 1. Pre-loaded Database Check: If already translated in SQLite, return with 0 API calls!
  // ═════════════════════════════════════════════════════════════════════
  if (recipeId) {
    try {
      const dbRecipe = db.prepare('SELECT id, title, titleBn, description, descriptionBn, culturalNote, culturalNoteBn FROM recipes WHERE id = ?').get(recipeId);
      if (dbRecipe) {
        const dbSteps = db.prepare('SELECT stepNumber as step, instruction, instructionBn, duration FROM recipe_steps WHERE recipeId = ? ORDER BY stepNumber').all(recipeId);

        const hasDbTitleBn = Boolean(dbRecipe.titleBn && dbRecipe.titleBn.trim());
        const hasDbStepsBn = dbSteps.length > 0 && dbSteps.every(s => Boolean(s.instructionBn && s.instructionBn.trim()));

        if (hasDbTitleBn && (dbSteps.length === 0 || hasDbStepsBn)) {
          const stepsMap = new Map(dbSteps.map(s => [s.step, s.instructionBn]));
          const mergedRecipe = {
            ...recipe,
            titleBn: dbRecipe.titleBn,
            descriptionBn: dbRecipe.descriptionBn || recipe.descriptionBn || '',
            culturalNoteBn: dbRecipe.culturalNoteBn || recipe.culturalNoteBn || '',
            steps: (recipe.steps || []).map((step, idx) => {
              const stepNum = typeof step === 'object' ? (step.step || idx + 1) : idx + 1;
              const originalInstruction = typeof step === 'object' ? (step.instruction || '') : String(step);
              const instructionBn = stepsMap.get(stepNum) || (typeof step === 'object' ? step.instructionBn : '') || originalInstruction;
              return typeof step === 'object'
                ? { ...step, instructionBn }
                : { step: stepNum, instruction: originalInstruction, instructionBn };
            }),
            ingredients: (recipe.ingredients || []).map(ing => {
              if (typeof ing === 'object') {
                const nameBn = ing.nameBn || ingredientTranslations[ing.ingredientId] || ingredientTranslations[ing.name?.toLowerCase()] || ing.name;
                return { ...ing, nameBn };
              }
              const nameBn = ingredientTranslations[String(ing).toLowerCase()] || String(ing);
              return { name: String(ing), nameBn };
            })
          };

          return {
            success: true,
            recipe: mergedRecipe,
            cached: true,
            source: 'database',
            targetLanguage: normalizedLang
          };
        }
      }
    } catch (dbCheckErr) {
      console.warn('⚠️ SQLite check failed for recipe translation:', dbCheckErr.message);
    }
  }

  // ═════════════════════════════════════════════════════════════════════
  // 2. In-Memory & Persistent translation_cache Check for Dynamic/Custom Recipes
  // ═════════════════════════════════════════════════════════════════════
  const recipeHash = crypto.createHash('sha256').update(
    `${normalizedLang}:${recipeId || ''}:${recipe.title || ''}:${JSON.stringify(recipe.steps || [])}`
  ).digest('hex');

  const memCacheKey = `ai:trans:recipe:${recipeHash}`;
  const memCachedRecipe = cacheService.get(memCacheKey);
  if (memCachedRecipe) {
    return {
      success: true,
      recipe: memCachedRecipe,
      cached: true,
      source: 'memory',
      targetLanguage: normalizedLang
    };
  }

  try {
    const cachedRow = db.prepare('SELECT translated_text FROM translation_cache WHERE source_hash = ?').get(recipeHash);
    if (cachedRow && cachedRow.translated_text) {
      const parsedRecipe = JSON.parse(cachedRow.translated_text);
      cacheService.set(memCacheKey, parsedRecipe, 24 * 60 * 60 * 1000);
      return {
        success: true,
        recipe: parsedRecipe,
        cached: true,
        source: 'database',
        targetLanguage: normalizedLang
      };
    }
  } catch {}

  // ═════════════════════════════════════════════════════════════════════
  // 3. Cache Miss: Call Gemini 3.8 Flash
  // ═════════════════════════════════════════════════════════════════════
  const effectiveApiKey = apiKey || process.env.GEMINI_API_KEY;
  if (!effectiveApiKey) {
    console.warn('⚠️ GEMINI_API_KEY missing, falling back to local translation engine');
    const localDecorated = decorateRecipeTranslations(recipe);
    return {
      success: true,
      recipe: localDecorated,
      cached: false,
      source: 'local_fallback',
      targetLanguage: normalizedLang
    };
  }

  const ai = new GoogleGenAI({ apiKey: effectiveApiKey });

  const stepsList = (recipe.steps || []).map((s, idx) => {
    const stepNum = typeof s === 'object' ? (s.step || idx + 1) : idx + 1;
    const text = typeof s === 'object' ? (s.instruction || '') : String(s);
    return { step: stepNum, instruction: text };
  });

  const ingredientsList = (recipe.ingredients || []).map(i => {
    const name = typeof i === 'object' ? (i.name || i.nameEn || '') : String(i);
    return { name };
  });

  const prompt = `Translate this recipe into natural, authentic Bengali (Bangla) for home cooks.
Title: ${recipe.title || ''}
Description: ${recipe.description || ''}
Cultural Note: ${recipe.culturalNote || ''}
Ingredients: ${ingredientsList.map(i => i.name).filter(Boolean).join(', ')}
Steps:
${stepsList.map(s => `${s.step}. ${s.instruction}`).join('\n')}

Translate the title, description, cultural note, ingredients, and step instructions naturally into Bangla. Keep all step numbers and numerical amounts intact.`;

  let translatedData = null;

  try {
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        const timeoutErr = new Error(`Recipe translation timed out after ${timeoutMs / 1000} seconds.`);
        timeoutErr.status = 504;
        reject(timeoutErr);
      }, timeoutMs);
    });

    const generatePromise = ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        systemInstruction: AI_TRANSLATION_SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
        responseSchema: RECIPE_TRANSLATION_SCHEMA,
        thinkingConfig: {
          thinkingLevel: 'low'
        }
      }
    });

    const response = await Promise.race([generatePromise, timeoutPromise]);
    const rawJson = (response.text || '').trim();
    if (rawJson) {
      translatedData = JSON.parse(rawJson);
    }
  } catch (apiErr) {
    logAiFailure({
      service: 'TRANSLATE_RECIPE',
      model: 'gemini-3.8-flash',
      error: apiErr,
      context: { recipeId: recipe.id, recipeTitle: recipe.title, stepsCount: stepsList.length },
      fallbackAction: 'Fell back to local dictionary translation engine'
    });
    console.warn('⚠️ Gemini recipe translation failed:', apiErr.message);
    if (apiErr.status === 429 || apiErr.message?.includes('Quota exceeded')) {
      const quotaErr = new Error('AI Translation service is currently experiencing high demand. Please try again shortly.');
      quotaErr.status = 429;
      throw quotaErr;
    }
    // Fallback to local translation decorator if Gemini encountered an error
    console.warn('⚠️ Falling back to local translation engine');
    const localDecorated = decorateRecipeTranslations(recipe);
    return {
      success: true,
      recipe: localDecorated,
      cached: false,
      source: 'local_fallback',
      targetLanguage: normalizedLang
    };
  }

  // ═════════════════════════════════════════════════════════════════════
  // 4. Assemble Translated Recipe Preserving Amounts, Units & Step Sequence
  // ═════════════════════════════════════════════════════════════════════
  const stepTransMap = new Map();
  if (translatedData && Array.isArray(translatedData.steps)) {
    for (const st of translatedData.steps) {
      if (st.step && st.instructionBn) {
        stepTransMap.set(st.step, st.instructionBn);
      }
    }
  }

  const ingTransMap = new Map();
  if (translatedData && Array.isArray(translatedData.ingredients)) {
    for (const ing of translatedData.ingredients) {
      if (ing.name && ing.nameBn) {
        ingTransMap.set(ing.name.toLowerCase().trim(), ing.nameBn);
      }
    }
  }

  const translatedRecipe = {
    ...recipe,
    titleBn: translatedData?.titleBn || recipe.titleBn || recipe.title,
    descriptionBn: translatedData?.descriptionBn || recipe.descriptionBn || recipe.description || '',
    culturalNoteBn: translatedData?.culturalNoteBn || recipe.culturalNoteBn || recipe.culturalNote || '',
    ingredients: (recipe.ingredients || []).map((ing, idx) => {
      if (typeof ing === 'object') {
        const nameKey = (ing.name || '').toLowerCase().trim();
        const nameBn = ingTransMap.get(nameKey) || ing.nameBn || ingredientTranslations[ing.ingredientId] || ingredientTranslations[nameKey] || ing.name;
        return {
          ...ing,
          nameBn
        };
      }
      const nameKey = String(ing).toLowerCase().trim();
      const nameBn = ingTransMap.get(nameKey) || ingredientTranslations[nameKey] || String(ing);
      return {
        name: String(ing),
        nameBn
      };
    }),
    steps: (recipe.steps || []).map((st, idx) => {
      const stepNum = typeof st === 'object' ? (st.step || idx + 1) : idx + 1;
      const origInstruction = typeof st === 'object' ? (st.instruction || '') : String(st);
      const instructionBn = stepTransMap.get(stepNum) || (typeof st === 'object' ? st.instructionBn : '') || origInstruction;
      return typeof st === 'object'
        ? { ...st, step: stepNum, instructionBn }
        : { step: stepNum, instruction: origInstruction, instructionBn };
    })
  };

  // ═════════════════════════════════════════════════════════════════════
  // 5. Store in Database for Pre-loaded Recipes & Persistent Cache
  // ═════════════════════════════════════════════════════════════════════
  if (recipeId) {
    try {
      const existsInDb = db.prepare('SELECT id FROM recipes WHERE id = ?').get(recipeId);
      if (existsInDb) {
        db.transaction(() => {
          db.prepare(`
            UPDATE recipes 
            SET titleBn = COALESCE(?, titleBn), 
                descriptionBn = COALESCE(?, descriptionBn), 
                culturalNoteBn = COALESCE(?, culturalNoteBn) 
            WHERE id = ?
          `).run(translatedRecipe.titleBn, translatedRecipe.descriptionBn, translatedRecipe.culturalNoteBn, recipeId);

          const updateStep = db.prepare(`
            UPDATE recipe_steps 
            SET instructionBn = ? 
            WHERE recipeId = ? AND stepNumber = ?
          `);
          for (const s of translatedRecipe.steps) {
            if (s.step && s.instructionBn) {
              updateStep.run(s.instructionBn, recipeId, s.step);
            }
          }
        })();
        console.log(`💾 Stored Gemini Bangla translation in SQLite database for recipe: ${recipeId}`);
        if (typeof recipeService.invalidateCache === 'function') {
          recipeService.invalidateCache();
        }
      }
    } catch (persistErr) {
      console.warn('⚠️ Failed saving recipe translation to SQLite recipes table:', persistErr.message);
    }
  }

  // Persist into translation_cache and memory
  try {
    db.prepare(`
      INSERT OR REPLACE INTO translation_cache (source_hash, source_text, target_lang, translated_text)
      VALUES (?, ?, ?, ?)
    `).run(recipeHash, JSON.stringify({ id: recipeId, title: recipe.title }), normalizedLang, JSON.stringify(translatedRecipe));
  } catch (tcErr) {
    console.warn('⚠️ Could not save recipe to translation_cache:', tcErr.message);
  }

  cacheService.set(memCacheKey, translatedRecipe, 24 * 60 * 60 * 1000);

  return {
    success: true,
    recipe: translatedRecipe,
    cached: false,
    source: 'gemini',
    targetLanguage: normalizedLang
  };
}
