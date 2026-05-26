import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { cuisines as staticCuisines } from '../data/cuisines.js';
import { ingredients as staticIngredients } from '../data/ingredients.js';
import { recipes as staticRecipes } from '../data/recipes.js';
import { translations } from '../utils/translations.js';

const DatabaseContext = createContext(null);

export function DatabaseProvider({ children }) {
  const [cuisines, setCuisines] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Persisted language preference (default is English)
  const [language, setLanguageState] = useState(() => {
    return localStorage.getItem('rannabanna-language') || 'en';
  });

  const setLanguage = (lang) => {
    localStorage.setItem('rannabanna-language', lang);
    setLanguageState(lang);
  };

  // Sleek, deterministic translation lookup helper
  const t = (key, replacements = {}) => {
    const dict = translations[language] || translations['en'];
    let val = dict[key] || translations['en'][key] || key;
    Object.keys(replacements).forEach(k => {
      val = val.replace(`{${k}}`, replacements[k]);
    });
    return val;
  };

  // Fetch cuisines, ingredients, and recipes list on mount
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    
    const fetchData = async () => {
      try {
        setLoading(true);
        
        const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

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
          setLoading(false);
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.warn('API hydration failed, falling back to local static files:', err);
          if (active) {
            // Robust client-side fallback
            setCuisines(staticCuisines);
            setIngredients(staticIngredients);
            setRecipes(staticRecipes);
            setError(null); // Clear error to allow the app to work seamlessly
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
      const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
      const res = await fetch(`${API_BASE}/api/recipes/${recipeId}`);
      if (!res.ok) throw new Error('Recipe not found in database');
      return await res.json();
    } catch (err) {
      console.warn(`API fetch for recipe ${recipeId} failed, falling back to local static files:`, err);
      const local = recipes.find(r => r.id === recipeId);
      if (!local) throw new Error('Recipe not found');
      return local;
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

  const value = {
    cuisines,
    ingredients,
    recipes,
    loading,
    error,
    language,
    setLanguage,
    t,
    fetchRecipeDetail,
    getCuisineById,
    addCustomRecipeToLocalState
  };

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
