import { useState, useEffect } from 'react'
import { recipes as staticRecipes } from '../data/recipes.js'
import { ingredients as staticIngredients } from '../data/ingredients.js'
import { API_BASE } from '../utils/apiConfig.js'

export const MATCH_THRESHOLDS = {
  PERFECT: 90,
  GREAT: 60,
  GOOD: 35,
  EXPLORATORY: 10
};

export function useRecipeMatcher(selectedIngredientIds = [], filters = {}) {
  const [data, setData] = useState({
    perfect: [],
    great: [],
    good: [],
    exploratory: [],
    totalCount: 0
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // ⚡ FIXED: Stabilize dependencies into immutable primitives to prevent infinite re-render loops
  const stableIdsStr = selectedIngredientIds.join(',');
  const stableFiltersStr = JSON.stringify(filters);

  useEffect(() => {
    if (!stableIdsStr) {
      setData({
        perfect: [],
        great: [],
        good: [],
        exploratory: [],
        totalCount: 0
      })
      setLoading(false)
      return
    }

    const ids = stableIdsStr.split(',').filter(Boolean);
    const filterObj = JSON.parse(stableFiltersStr);

    let active = true
    const controller = new AbortController()

    // ⚡ 150ms debounce to prevent request flooding during rapid filter toggles & slider drags
    const debounceTimer = setTimeout(() => {
      setLoading(true)

      fetch(`${API_BASE}/api/match`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ingredientIds: ids,
          filters: filterObj
        }),
        signal: controller.signal
      })
        .then(res => {
          if (!res.ok) throw new Error('Failed to match recipes')
          return res.json()
        })
        .then(result => {
          if (active) {
            setData(result)
            setError(null)
            setLoading(false)
          }
        })
        .catch(err => {
          if (err.name === 'AbortError') return
          console.warn('API matching failed, falling back to local client-side matching:', err)
          if (active) {
            const result = matchRecipesLocally(ids, filterObj)
            setData(result)
            setError(err.message || 'API matching failed, using local data')
            setLoading(false)
          }
        })
    }, 150)

    return () => {
      active = false
      clearTimeout(debounceTimer)
      controller.abort()
    }
  }, [stableIdsStr, stableFiltersStr, API_BASE])

  return { ...data, loading, error }
}

function matchRecipesLocally(selectedIngredientIds = [], filters = {}) {
  const selectedSet = new Set(selectedIngredientIds)
  const matchedRecipes = []

  for (const recipe of staticRecipes) {
    const rIngredients = recipe.ingredients || []
    const hasAnyMatch = rIngredients.some(ri => selectedSet.has(ri.ingredientId))
    if (!hasAnyMatch) continue

    const essential = rIngredients.filter(ri => ri.isEssential)
    const optional = rIngredients.filter(ri => !ri.isEssential)

    const essentialTotal = essential.length
    const optionalTotal = optional.length

    const essentialMatched = essential.filter(ri => selectedSet.has(ri.ingredientId)).length
    const optionalMatched = optional.filter(ri => selectedSet.has(ri.ingredientId)).length

    let matchPercentage = 0

    if (essentialTotal === 0) {
      matchPercentage = optionalTotal > 0 ? Math.round((optionalMatched / optionalTotal) * 100) : 0
    } else if (optionalTotal === 0) {
      matchPercentage = Math.round((essentialMatched / essentialTotal) * 100)
    } else {
      const essentialScore = (essentialMatched / essentialTotal) * 85
      const optionalScore = (optionalMatched / optionalTotal) * 15
      matchPercentage = Math.round(essentialScore + optionalScore)
    }

    if (essentialMatched === essentialTotal && essentialTotal > 0) {
      matchPercentage = Math.min(100, matchPercentage + 5)
    }
    const totalMatched = essentialMatched + optionalMatched
    if (totalMatched >= 5) {
      matchPercentage = Math.min(100, matchPercentage + 3)
    }

    if (matchPercentage < 10) continue

    const missingEssential = essential
      .filter(ri => !selectedSet.has(ri.ingredientId))
      .map(ri => {
        const ingObj = staticIngredients.find(i => i.id === ri.ingredientId)
        return ingObj ? { id: ingObj.id, name: ingObj.name, nameBn: ingObj.nameBn, emoji: ingObj.emoji } : null
      }).filter(Boolean)

    const missingOptional = optional
      .filter(ri => !selectedSet.has(ri.ingredientId))
      .map(ri => {
        const ingObj = staticIngredients.find(i => i.id === ri.ingredientId)
        return ingObj ? { id: ingObj.id, name: ingObj.name, nameBn: ingObj.nameBn, emoji: ingObj.emoji } : null
      }).filter(Boolean)

    matchedRecipes.push({
      ...recipe,
      matchPercentage,
      essentialMatched,
      essentialTotal,
      optionalMatched,
      optionalTotal,
      missingEssential,
      missingOptional
    })
  }

  const filtered = matchedRecipes.filter(recipe => {
    if (filters.cuisines && filters.cuisines.length > 0) {
      if (!filters.cuisines.includes(recipe.cuisineId)) return false
    }
    if (filters.mealType && filters.mealType !== 'all') {
      if (!recipe.mealType.includes(filters.mealType)) return false
    }
    if (filters.difficulty && filters.difficulty !== 'all') {
      if (recipe.difficulty !== filters.difficulty) return false
    }
    if (filters.maxTime) {
      const totalTime = (recipe.prepTime || 0) + (recipe.cookTime || 0)
      if (totalTime > filters.maxTime) return false
    }
    if (filters.dietary && filters.dietary.length > 0) {
      const recipeTags = Array.isArray(recipe.dietaryTags) ? recipe.dietaryTags : []
      const hasAllTags = filters.dietary.every(tag => recipeTags.includes(tag))
      if (!hasAllTags) return false
    }
    return true
  })

  filtered.sort((a, b) => b.matchPercentage - a.matchPercentage)

  const perfect = filtered.filter(r => r.matchPercentage >= MATCH_THRESHOLDS.PERFECT)
  const great = filtered.filter(r => r.matchPercentage >= MATCH_THRESHOLDS.GREAT && r.matchPercentage < MATCH_THRESHOLDS.PERFECT)
  const good = filtered.filter(r => r.matchPercentage >= MATCH_THRESHOLDS.GOOD && r.matchPercentage < MATCH_THRESHOLDS.GREAT)
  const exploratory = filtered.filter(r => r.matchPercentage >= MATCH_THRESHOLDS.EXPLORATORY && r.matchPercentage < MATCH_THRESHOLDS.GOOD)

  return {
    perfect,
    great,
    good,
    exploratory,
    totalCount: filtered.length
  }
}
