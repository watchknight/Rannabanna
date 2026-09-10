import React, { useMemo, useState, useEffect } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { useDatabase } from '../context/DatabaseContext'
import RecipeCard from '../components/RecipeCard'
import { translateCategory, translateUnit, translateTechnique, translatePreparation } from '../utils/translations'
import { scaleIngredient, adjustTime, checkQuantitySatisfaction } from '../utils/servingsScaler'

function RecipeDetailPage() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const { fetchRecipeDetail, cuisines, recipes, ingredients, language, t, toBengaliNumber } = useDatabase()
  
  const [recipe, setRecipe] = useState(null)
  const [servings, setServings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    
    fetchRecipeDetail(id)
      .then(data => {
        if (active) {
          setRecipe(data)
          const urlServings = parseInt(searchParams.get('servings'), 10)
          setServings(urlServings || data?.baseServings || data?.servings || 4)
          setLoading(false)
        }
      })
      .catch(err => {
        if (active) {
          setError(err.message)
          setLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [id])

  // Extract selected ingredients and on-hand quantities from query parameters
  const { selectedIds, onHandMap } = useMemo(() => {
    const raw = searchParams.get('selected')
    if (!raw) return { selectedIds: [], onHandMap: {} }
    const parts = raw.split(',').filter(Boolean)
    const ids = []
    const onHand = {}
    for (const p of parts) {
      if (p.includes(':')) {
        const [id, qty] = p.split(':')
        ids.push(id)
        if (!isNaN(Number(qty))) onHand[id] = Number(qty)
      } else {
        ids.push(p)
      }
    }
    return { selectedIds: ids, onHandMap: onHand }
  }, [searchParams])

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])

  // Cuisine definition
  const cuisine = useMemo(() => {
    if (!recipe || !cuisines) return null
    return cuisines.find(c => c.id === recipe.cuisineId)
  }, [recipe, cuisines])

  // Related recipes from same cuisine (excluding current one)
  const relatedRecipes = useMemo(() => {
    if (!recipe || !recipes) return []
    return recipes.filter(r => r.cuisineId === recipe.cuisineId && r.id !== recipe.id).slice(0, 3)
  }, [recipe, recipes])

  if (loading) {
    return (
      <div className="empty-state glass-panel animate-pulse" style={{ padding: 'var(--spacing-xxl)' }} id="recipe-detail-loading">
        <div className="empty-state-emoji animate-spin" style={{ animationDuration: '3s' }}>🍲</div>
        <h3>{language === 'bn' ? 'রেসিপি প্রস্তুত করা হচ্ছে...' : 'Loading Recipe Details...'}</h3>
        <p>{language === 'bn' ? 'ডাটাবেজ থেকে ধাপে ধাপে প্রস্তুত প্রণালী এবং রান্নার গোপনীয় কৌশলগুলো লোড হচ্ছে...' : 'Fetching step-by-step instructions and regional culinary secrets from the database...'}</p>
      </div>
    )
  }

  if (!recipe) {
    return (
      <div className="empty-state glass-panel animate-scale-in" id="error-recipe-not-found">
        <div className="empty-state-emoji">🍽️</div>
        <h3>{language === 'bn' ? 'রেসিপি পাওয়া যায়নি' : 'Recipe Not Found'}</h3>
        <p>{language === 'bn' ? 'আমরা যে রেসিপিটি খুঁজছেন তা পাওয়া যায়নি। এটি হয়তো সরানো হয়েছে।' : "We couldn't find the recipe you are looking for. It may have been retired or moved."}</p>
        <Link to="/" className="btn btn-primary" id="not-found-home-btn">
          {t('home')}
        </Link>
      </div>
    )
  }

  const baseServings = recipe.baseServings || recipe.servings || 4
  const activeServings = servings || baseServings
  const ingredientsList = Array.isArray(recipe.ingredients) ? recipe.ingredients : []
  const stepsList = Array.isArray(recipe.steps) ? recipe.steps : []
  const dietaryTagsList = Array.isArray(recipe.dietaryTags) ? recipe.dietaryTags : []

  // Dynamically adjusted time based on servings count (pure arithmetic calculation)
  const timeStats = adjustTime(recipe.prepTime, recipe.cookTime, baseServings, activeServings, recipe.timeAdjustment)

  // Group recipe ingredients
  const ingredientGroups = ingredientsList.reduce((acc, ri) => {
    const groupName = ri.group || 'Main Ingredients'
    if (!acc[groupName]) acc[groupName] = []
    acc[groupName].push(ri)
    return acc
  }, {})

  // Compute missing essential ingredients (including on-hand quantity shortfall from scaling)
  const missingEssentials = useMemo(() => {
    return ingredientsList
      .filter(ri => {
        if (!ri || !ri.isEssential) return false
        if (!selectedSet.has(ri.ingredientId)) return true
        const onHand = onHandMap[ri.ingredientId]
        if (onHand !== undefined) {
          const check = checkQuantitySatisfaction(ri, onHand, baseServings, activeServings)
          return !check.satisfied
        }
        return false
      })
      .map(ri => {
        const ingObj = (ingredients || []).find(ing => ing && ing.id === ri.ingredientId)
        const onHand = onHandMap[ri.ingredientId]
        const check = onHand !== undefined ? checkQuantitySatisfaction(ri, onHand, baseServings, activeServings) : null
        return {
          id: ri.ingredientId,
          name: ingObj?.name || ri.name || ri.ingredientId,
          nameBn: ingObj?.nameBn || ri.nameBn || ingObj?.name || ri.ingredientId,
          emoji: ingObj?.emoji || '🧂',
          shortfall: check?.missingQuantity || 0,
          unit: ri.unit,
          isInsufficient: Boolean(check && !check.satisfied)
        }
      })
  }, [ingredientsList, selectedSet, onHandMap, baseServings, activeServings, ingredients])

  const title = language === 'bn' ? (recipe.titleBn || recipe.title) : recipe.title
  const desc = language === 'bn' ? (recipe.descriptionBn || recipe.description) : recipe.description
  const culturalNote = language === 'bn' ? (recipe.culturalNoteBn || recipe.culturalNote) : recipe.culturalNote
  const cuisineName = language === 'bn' ? (cuisine?.nameBn || cuisine?.name || recipe.cuisineId) : (cuisine?.name || recipe.cuisineId)

  return (
    <div className="recipe-detail-container animate-fade-in" id={`recipe-detail-${recipe.id}`}>
      
      {/* 1. Header segment */}
      <section className="recipe-detail-header">
        <div className="recipe-detail-visual" id="recipe-detail-hero-visual">
          <span className="recipe-emoji" role="img" aria-label={title}>{recipe.imageEmoji || '🍲'}</span>
        </div>

        <div className="recipe-detail-info">
          <span 
            className="recipe-card-cuisine" 
            style={{ 
              color: cuisine?.color || 'var(--brand-orange)',
              fontSize: '0.85rem',
              fontWeight: '800'
            }}
          >
            {cuisine?.emoji} {cuisineName} {language === 'bn' ? 'রন্ধনশৈলী' : 'Cuisine'}
          </span>
          <h1 className="recipe-detail-title">{title}</h1>
          <p className="hero-subtitle" style={{ margin: 0, fontSize: '1.05rem', textAlign: 'left' }}>
            {desc}
          </p>

          <div className="recipe-detail-stats">
            <div className="recipe-detail-stat-card" id="recipe-stat-time">
              <div className="recipe-detail-stat-val">⏱️ {language === 'bn' ? toBengaliNumber(timeStats.totalTime) : timeStats.totalTime}</div>
              <div className="recipe-detail-stat-lbl">
                {t('mins')} {activeServings !== baseServings ? `(${t('adjustedTime')})` : ''}
              </div>
            </div>
            <div className="recipe-detail-stat-card" id="recipe-stat-calories">
              <div className="recipe-detail-stat-val">🔥 {language === 'bn' ? toBengaliNumber(Math.round(((recipe.calories || 0) * activeServings) / (baseServings || 4)) || (recipe.calories || 0)) : (Math.round(((recipe.calories || 0) * activeServings) / (baseServings || 4)) || (recipe.calories || 0))}</div>
              <div className="recipe-detail-stat-lbl">{t('caloriesLabel')}</div>
            </div>
            <div className="recipe-detail-stat-card" id="recipe-stat-difficulty">
              <div className="recipe-detail-stat-val" style={{ textTransform: 'capitalize' }}>
                {t(recipe.difficulty || 'intermediate')}
              </div>
              <div className="recipe-detail-stat-lbl">{t('filterDifficultyLabel')}</div>
            </div>
            <div className="recipe-detail-stat-card" id="recipe-stat-servings">
              <div className="servings-stepper">
                <button 
                  type="button" 
                  className="servings-btn" 
                  onClick={() => setServings(prev => Math.max(1, (prev || baseServings) - 1))}
                  disabled={activeServings <= 1}
                  aria-label="Decrease Servings"
                  id="servings-decrement-btn"
                >
                  −
                </button>
                <span className="servings-count" id="servings-count-val">👥 {language === 'bn' ? toBengaliNumber(activeServings) : activeServings}</span>
                <button 
                  type="button" 
                  className="servings-btn" 
                  onClick={() => setServings(prev => Math.min(24, (prev || baseServings) + 1))}
                  disabled={activeServings >= 24}
                  aria-label="Increase Servings"
                  id="servings-increment-btn"
                >
                  +
                </button>
              </div>
              <div className="recipe-detail-stat-lbl">{t('servingsLabel')}</div>
              {activeServings !== baseServings && (
                <div className="servings-adjusted-pill">
                  {t('originalServings')}: {language === 'bn' ? toBengaliNumber(baseServings) : baseServings}
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-xs)', marginTop: 'var(--spacing-sm)' }}>
            {dietaryTagsList.map(tag => (
              <span key={tag} className="tag" style={{ textTransform: 'capitalize' }}>
                🌱 {t(tag)}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* 2. Cultural Note Callout */}
      {culturalNote && (
        <section style={{ marginBottom: 'var(--spacing-lg)' }} id="recipe-cultural-history">
          <div className="cultural-callout">
            <span style={{ fontSize: '1.25rem', marginRight: 'var(--spacing-sm)' }}>📜</span>
            <strong>{t('culturalContext')}:</strong> {culturalNote}
          </div>
        </section>
      )}

      {/* 3. Main layout containing Ingredients on left and Directions on right */}
      <section className="recipe-detail-body">
        
        {/* Ingredients Column */}
        <div className="ingredients-list-panel glass-panel" id="recipe-detail-ingredients">
          <h2 style={{ fontSize: '1.5rem', marginBottom: 'var(--spacing-lg)' }}>{t('ingredientsNeeded')}</h2>
          
          {Object.entries(ingredientGroups).map(([groupName, items]) => (
            <div key={groupName} style={{ marginBottom: 'var(--spacing-lg)' }}>
              <h3 className="ingredients-group-title">{translateCategory(groupName, language)}</h3>
              <div className="ingredients-check-list">
                {items.map((ri, index) => {
                  const ingObj = (ingredients || []).find(i => i && i.id === ri.ingredientId)
                  const inKitchen = selectedSet.has(ri.ingredientId)
                  const onHand = onHandMap[ri.ingredientId]
                  const satisfaction = onHand !== undefined ? checkQuantitySatisfaction(ri, onHand, baseServings, activeServings) : null
                  const isMatched = inKitchen && (!satisfaction || satisfaction.satisfied)
                  const isInsufficient = inKitchen && satisfaction && !satisfaction.satisfied
                  const ingName = language === 'bn' ? (ingObj?.nameBn || ingObj?.name || ri.nameBn || ri.name || ri.ingredientId) : (ingObj?.name || ri.name || ri.ingredientId)
                  
                  // Scale ingredient quantity and unit
                  const scaled = scaleIngredient(ri, baseServings, activeServings)
                  const unit = translateUnit(scaled.displayUnit, language)
                  
                  return (
                    <label 
                      key={index} 
                      className={`ingredient-check-item ${isMatched ? 'matched-ing' : (isInsufficient ? 'insufficient-ing' : 'missing-ing')}`}
                      id={`ing-item-${ri.ingredientId}`}
                    >
                      <input 
                        type="checkbox" 
                        checked={isMatched} 
                        readOnly
                        aria-label={`${ingName}: ${isMatched ? 'Available in your kitchen' : (isInsufficient ? 'Insufficient in kitchen' : 'Missing from kitchen')}`}
                        id={`ing-chk-${ri.ingredientId}`}
                      />
                      <span>
                        <strong>{language === 'bn' ? toBengaliNumber(scaled.displayQuantity) : scaled.displayQuantity} {unit}</strong> {ingName}
                        {ri.preparation ? `, ${translatePreparation(ri.preparation, language)}` : ''}
                        {ri.isEssential && <span style={{ color: 'var(--brand-orange)', fontSize: '0.75rem', marginLeft: '6px' }}>*</span>}
                        {scaled.isFixed && (
                          <span className="badge-fixed" title={t('fixedIngredient')}>
                            {t('fixedIngredient')}
                          </span>
                        )}
                        {isInsufficient && (
                          <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.3)', marginLeft: '6px', fontSize: '0.65rem' }}>
                            ⚠️ {language === 'bn' ? `ঘাটতি: আরো ${toBengaliNumber(satisfaction.missingQuantity)} ${unit} প্রয়োজন` : `Shortfall: need ${satisfaction.missingQuantity} ${unit}`}
                          </span>
                        )}
                      </span>
                      {isMatched && (
                        <span className="badge badge-match-high" style={{ fontSize: '0.6rem', padding: '2px 6px' }}>
                          {language === 'bn' ? 'মিলেছে' : 'Matched'}
                        </span>
                      )}
                    </label>
                  )
                })}
              </div>
            </div>
          ))}

          {/* Missing items warning */}
          {selectedIds.length > 0 && missingEssentials.length > 0 && (
            <div 
              style={{ 
                marginTop: 'var(--spacing-lg)', 
                padding: 'var(--spacing-md)', 
                background: 'rgba(239, 68, 68, 0.05)', 
                border: '1.5px solid rgba(239, 68, 68, 0.25)', 
                borderRadius: 'var(--radius-md)' 
              }}
              id="missing-essentials-warning"
            >
              <h4 style={{ color: '#f87171', fontSize: '0.95rem', marginBottom: 'var(--spacing-sm)' }}>
                ⚠️ {language === 'bn' ? 'অনুপস্থিত বা অপর্যাপ্ত প্রয়োজনীয় উপকরণসমূহ:' : 'Missing or Insufficient Essential Ingredients:'}
              </h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-xs)' }}>
                {missingEssentials.map(ing => {
                  const ingName = language === 'bn' ? (ing.nameBn || ing.name) : ing.name
                  const unitText = ing.unit ? translateUnit(ing.unit, language) : ''
                  return (
                    <span 
                      key={ing.id} 
                      className={ing.isInsufficient ? "badge badge-match-med" : "badge badge-match-low"} 
                      style={{ textTransform: 'none' }}
                    >
                      {ing.emoji} {ingName}
                      {ing.isInsufficient && (
                        <strong style={{ marginLeft: '4px' }}>
                          ({language === 'bn' ? `ঘাটতি: ${toBengaliNumber(ing.shortfall)} ${unitText}` : `Need ${ing.shortfall} ${unitText}`})
                        </strong>
                      )}
                    </span>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Steps Column */}
        <div className="steps-panel glass-panel" id="recipe-detail-directions">
          <h2 style={{ fontSize: '1.5rem' }}>{t('cookingSteps')}</h2>
          <div className="steps-list">
            {stepsList.map(step => {
              const instruction = language === 'bn' ? (step.instructionBn || step.instruction) : step.instruction
              return (
                <div key={step.step || step.stepNumber} className="step-item" id={`step-row-${step.step || step.stepNumber}`}>
                  <div className="step-badge">{language === 'bn' ? toBengaliNumber(step.step || step.stepNumber) : (step.step || step.stepNumber)}</div>
                  <div className="step-content">
                    <div className="step-meta">
                      <span className="step-tech">{translateTechnique(step.technique, language)}</span>
                      <span className="step-duration">⏱️ {language === 'bn' ? toBengaliNumber(step.duration) : step.duration} {t('mins')}</span>
                    </div>
                    <p className="step-instruction">{instruction}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* 4. Related Cuisines Grid */}
      {relatedRecipes.length > 0 && (
        <section style={{ marginTop: 'var(--spacing-xl)' }} id="related-recipes-section">
          <div className="section-header">
            <h2>{language === 'bn' ? `${cuisineName} রন্ধনশৈলী থেকে আরো রেসিপি` : `More from ${cuisineName} Cuisine`}</h2>
          </div>
          <div className="recipes-grid">
            {relatedRecipes.map(r => (
              <RecipeCard key={r.id} recipe={r} selectedIds={selectedIds} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

export default RecipeDetailPage
