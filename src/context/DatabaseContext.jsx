import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { cuisines as staticCuisines } from '../data/cuisines.js';
import { ingredients as staticIngredients } from '../data/ingredients.js';
import { recipes as staticRecipes } from '../data/recipes.js';
import { translations, toBengaliNumber } from '../utils/translations.js';
import { API_BASE } from '../utils/apiConfig.js';

const DatabaseContext = createContext(null);

export function DatabaseProvider({ children }) {
  const [cuisines, setCuisines] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isOffline, setIsOffline] = useState(false);
  
  // Persisted language preference (default is English)
  const [language, setLanguageState] = useState(() => {
    return localStorage.getItem('rannabanna-language') || 'en';
  });

  // Keep <html lang="..."> in sync with current language immediately
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = useCallback((lang) => {
    localStorage.setItem('rannabanna-language', lang);
    document.documentElement.lang = lang;
    setLanguageState(lang);
  }, []);

  // Sleek, deterministic translation lookup helper with automatic numeral localization
  const t = useCallback((key, replacements = {}) => {
    const dict = translations[language] || translations['en'];
    let val = dict[key] || translations['en'][key] || key;
    Object.keys(replacements).forEach(k => {
      let repVal = replacements[k];
      if (language === 'bn' && (typeof repVal === 'number' || /^\d+$/.test(String(repVal)))) {
        repVal = toBengaliNumber(repVal);
      }
      val = val.replaceAll(`{${k}}`, repVal);
    });
    return val;
  }, [language]);

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
      const local = staticRecipes.find(r => r.id === recipeId);
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
    addCustomRecipeToLocalState
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
    addCustomRecipeToLocalState
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
