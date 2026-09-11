import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { cuisines as staticCuisines } from '../data/cuisines.js';
import { ingredients as staticIngredients } from '../data/ingredients.js';
import { recipes as staticRecipes } from '../data/recipes.js';
import { translations, toBengaliNumber } from '../utils/translations.js';
import { API_BASE } from '../utils/apiConfig.js';
import { 
  translateWithGemini, 
  getCachedTextTranslation, 
  getCachedRecipeTranslation, 
  subscribeToTranslations 
} from '../utils/aiTranslator.js';

const DatabaseContext = createContext(null);

export function DatabaseProvider({ children }) {
  const [cuisines, setCuisines] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isOffline, setIsOffline] = useState(false);
  
  // Translation in-flight count & dynamic translation cache
  const [translatingCount, setTranslatingCount] = useState(0);
  const [dynamicTranslations, setDynamicTranslations] = useState({});
  const inFlightKeys = useRef(new Set());

  // Persisted language preference (default is English)
  const [language, setLanguageState] = useState(() => {
    return localStorage.getItem('rannabanna-language') || 'en';
  });

  // Keep <html lang="..."> in sync with current language immediately
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  // Subscribe to external cache updates from aiTranslator
  useEffect(() => {
    const unsubscribe = subscribeToTranslations(({ type, key, value }) => {
      if (type === 'text') {
        const textKey = key.replace(/^bn:/, '');
        setDynamicTranslations(prev => ({ ...prev, [textKey]: value }));
      }
    });
    return unsubscribe;
  }, []);

  const setLanguage = useCallback((lang) => {
    localStorage.setItem('rannabanna-language', lang);
    document.documentElement.lang = lang;
    setLanguageState(lang);
  }, []);

  // Sleek, deterministic translation lookup helper with automatic numeral localization
  // and on-demand Gemini translation fallback for uncached strings
  const t = useCallback((key, replacements = {}) => {
    const dict = translations[language] || translations['en'];
    let val = dict[key];

    if (!val && language === 'bn') {
      val = dynamicTranslations[key] || getCachedTextTranslation(key, 'bn') || getCachedTextTranslation(translations.en?.[key] || key, 'bn');

      if (!val) {
        val = translations['en']?.[key] || key;
        const sourceToTranslate = translations['en']?.[key] || key;
        if (typeof window !== 'undefined' && sourceToTranslate && !inFlightKeys.current.has(key)) {
          inFlightKeys.current.add(key);
          setTranslatingCount(c => c + 1);
          translateWithGemini({ text: sourceToTranslate, targetLanguage: 'bn' })
            .then(res => {
              if (res?.success && res.translatedText) {
                setDynamicTranslations(prev => ({ ...prev, [key]: res.translatedText }));
              }
            })
            .catch(() => {})
            .finally(() => {
              inFlightKeys.current.delete(key);
              setTranslatingCount(c => Math.max(0, c - 1));
            });
        }
      }
    }

    if (!val) {
      val = translations['en']?.[key] || key;
    }

    Object.keys(replacements).forEach(k => {
      let repVal = replacements[k];
      if (language === 'bn' && (typeof repVal === 'number' || /^\d+$/.test(String(repVal)))) {
        repVal = toBengaliNumber(repVal);
      }
      val = val.replaceAll(`{${k}}`, repVal);
    });
    return val;
  }, [language, dynamicTranslations]);

  // Fetch cuisines, ingredients, and recipes list on mount
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    
    const fetchData = async () => {
      try {
        setLoading(true);

        const [cuisinesRes, ingredientsRes, recipesRes] = await Promise.all([
          fetch(`${API_BASE}/api/cuisines`, { signal: controller.signal }),
          fetch(`${API_BASE}/api/ingredients`, { signal: controller.signal }),
          fetch(`${API_BASE}/api/recipes`, { signal: controller.signal })
        ]);

        if (!cuisinesRes.ok || !ingredientsRes.ok || !recipesRes.ok) {
          throw new Error('Failed to load database from server');
        }

        const cuisinesData = await cuisinesRes.json();
        const ingredientsData = await ingredientsRes.json();
        const recipesData = await recipesRes.json();

        if (active) {
          setCuisines(cuisinesData);
          setIngredients(ingredientsData);
          setRecipes(recipesData);
          setError(null);
          setIsOffline(false);
          setLoading(false);
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.warn('API hydration failed, falling back to local static files:', err);
          if (active) {
            // Robust client-side fallback
            setCuisines(staticCuisines);
            setIngredients(staticIngredients);
            setRecipes(staticRecipes.map(r => ({ ...r, difficulty: r.difficulty || 'intermediate' })));
            setIsOffline(true);
            setError(null); // Clear blocking error; offline mode is active
            setLoading(false);
          }
        }
      }
    };

    fetchData();

    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  // API helper to fetch a specific recipe with full SQLite detail
  const fetchRecipeDetail = useCallback(async (recipeId) => {
    // 1. Check in-memory state for dynamically generated custom AI recipes
    const customInState = (recipes || []).find(r => r.id === recipeId);
    if (customInState && Array.isArray(customInState.ingredients) && Array.isArray(customInState.steps)) {
      return customInState;
    }

    try {
      const res = await fetch(`${API_BASE}/api/recipes/${recipeId}`);
      if (!res.ok) throw new Error('Recipe not found in database');
      const data = await res.json();
      if (!data || !data.ingredients || !data.steps) {
        throw new Error('Incomplete recipe data returned from server');
      }
      return data;
    } catch (err) {
      console.warn(`API fetch for recipe ${recipeId} failed, falling back to local static files:`, err);
      // staticRecipes contains full recipe data (ingredients + steps); server-hydrated recipes may be summaries only
      const local = staticRecipes.find(r => r.id === recipeId) || (recipes || []).find(r => r.id === recipeId);
      if (!local) throw new Error('Recipe not found');
      return { ...local, difficulty: local.difficulty || 'intermediate' };
    }
  }, [recipes]);

  const getCuisineById = useCallback((cuisineId) => {
    return cuisines.find(c => c.id === cuisineId);
  }, [cuisines]);

  const addCustomRecipeToLocalState = useCallback((customRecipe) => {
    setRecipes(prev => {
      if (prev.some(r => r.id === customRecipe.id)) return prev;
      return [customRecipe, ...prev];
    });
  }, []);

  // Translate a recipe object dynamically via Gemini 3.8 Flash with caching & English fallback
  const translateRecipeViaAi = useCallback(async (recipeObj) => {
    if (!recipeObj || language !== 'bn') return recipeObj;

    // 1. Check if already has complete Bangla translation
    const hasFullBn = recipeObj.titleBn && 
      (!Array.isArray(recipeObj.steps) || recipeObj.steps.length === 0 || recipeObj.steps.every(s => s.instructionBn));
    if (hasFullBn) {
      return recipeObj;
    }

    // 2. Check client-side recipe cache
    const cached = getCachedRecipeTranslation(recipeObj.id, 'bn');
    if (cached) {
      return { ...recipeObj, ...cached };
    }

    // 3. Cache miss: trigger Gemini translation
    setTranslatingCount(c => c + 1);
    try {
      const result = await translateWithGemini({ recipe: recipeObj, targetLanguage: 'bn' });
      if (result?.success && result.recipe) {
        setRecipes(prev => prev.map(r => r.id === result.recipe.id ? { ...r, ...result.recipe } : r));
        return result.recipe;
      }
    } catch (err) {
      console.warn('⚠️ AI Recipe translation failed, falling back to English:', err.message);
    } finally {
      setTranslatingCount(c => Math.max(0, c - 1));
    }

    return recipeObj;
  }, [language]);

  // Translate dynamic text on-demand
  const translateDynamicText = useCallback(async (text) => {
    if (!text || language !== 'bn') return text;
    const cached = dynamicTranslations[text] || getCachedTextTranslation(text, 'bn');
    if (cached) return cached;

    setTranslatingCount(c => c + 1);
    try {
      const res = await translateWithGemini({ text, targetLanguage: 'bn' });
      if (res?.success && res.translatedText) {
        setDynamicTranslations(prev => ({ ...prev, [text]: res.translatedText }));
        return res.translatedText;
      }
    } catch (err) {
      console.warn('Dynamic text translation failed, falling back to English:', err.message);
    } finally {
      setTranslatingCount(c => Math.max(0, c - 1));
    }
    return text;
  }, [language, dynamicTranslations]);

  const isTranslating = translatingCount > 0;

  const value = useMemo(() => ({
    cuisines,
    ingredients,
    recipes,
    loading,
    error,
    isOffline,
    language,
    setLanguage,
    t,
    toBengaliNumber,
    fetchRecipeDetail,
    getCuisineById,
    addCustomRecipeToLocalState,
    translateRecipeViaAi,
    translateDynamicText,
    isTranslating,
    translatingCount,
    dynamicTranslations
  }), [
    cuisines,
    ingredients,
    recipes,
    loading,
    error,
    isOffline,
    language,
    setLanguage,
    t,
    fetchRecipeDetail,
    getCuisineById,
    addCustomRecipeToLocalState,
    translateRecipeViaAi,
    translateDynamicText,
    isTranslating,
    translatingCount,
    dynamicTranslations
  ]);

  return (
    <DatabaseContext.Provider value={value}>
      {children}
    </DatabaseContext.Provider>
  );
}

export function useDatabase() {
  const context = useContext(DatabaseContext);
  if (!context) {
    throw new Error('useDatabase must be used within a DatabaseProvider');
  }
  return context;
}
