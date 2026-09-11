import React, { useMemo, useState, useEffect } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { 
  Clock, 
  Flame, 
  ChefHat, 
  Users, 
  Leaf, 
  BookOpen, 
  AlertCircle, 
  Sparkles, 
  Loader2, 
  UtensilsCrossed, 
  ShoppingCart,
  Minus,
  Plus
} from 'lucide-react'
import { useDatabase } from '../context/DatabaseContext'
import RecipeCard from '../components/RecipeCard'
import { translateCategory, translateUnit, translateTechnique, translatePreparation } from '../utils/translations'
import { scaleIngredient, adjustTime, checkQuantitySatisfaction } from '../utils/servingsScaler'
import { getCachedRecipeTranslation, translateWithGemini } from '../utils/aiTranslator'
import { getRecipeImage, getCuisineImage } from '../utils/imageAssets'

function RecipeDetailPage() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const { fetchRecipeDetail, cuisines, recipes, ingredients, language, t, toBengaliNumber } = useDatabase()
  
  const [recipe, setRecipe] = useState(null)
  const [servings, setServings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [recipeTranslating, setRecipeTranslating] = useState(false)

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

  // On-demand Gemini 3.8 Flash translation
  useEffect(() => {
    if (language !== 'bn' || !recipe) return

    const needsTranslation = !recipe.titleBn || 
      (Array.isArray(recipe.steps) && recipe.steps.length > 0 && recipe.steps.some(s => !s.instructionBn))

    if (!needsTranslation) return

    const cached = getCachedRecipeTranslation(recipe.id, 'bn')
    if (cached) {
      setRecipe(prev => ({ ...prev, ...cached }))
      return
    }

    let active = true
    setRecipeTranslating(true)

    translateWithGemini({ recipe, targetLanguage: 'bn' })
      .then(res => {
        if (!active) return
        if (res?.success && res.recipe) {
          setRecipe(prev => ({ ...prev, ...res.recipe }))
        }
        setRecipeTranslating(false)
      })
      .catch(() => {
        if (active) setRecipeTranslating(false)
      })

    return () => {
      active = false
    }
  }, [language, recipe?.id])

  // Extract selected ingredients
  const { selectedIds, onHandMap } = useMemo(() => {
    const raw = searchParams.get('selected')
    if (!raw) return { selectedIds: [], onHandMap: {} }
    const parts = raw.split(',').filter(Boolean)
    const ids = []
    const onHand = {}
    for (const p of parts) {
      if (p.includes(':')) {
        const [itemId, qty] = p.split(':')
        ids.push(itemId)
        if (!isNaN(Number(qty))) onHand[itemId] = Number(qty)
      } else {
        ids.push(p)
      }
    }
    return { selectedIds: ids, onHandMap: onHand }
  }, [searchParams])

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])

  const cuisine = useMemo(() => {
    if (!recipe || !cuisines) return null
    return cuisines.find(c => c.id === recipe.cuisineId)
  }, [recipe, cuisines])

  const relatedRecipes = useMemo(() => {
    if (!recipe || !recipes) return []
    return recipes.filter(r => r.cuisineId === recipe.cuisineId && r.id !== recipe.id).slice(0, 3)
  }, [recipe, recipes])

  const baseServings = recipe?.baseServings || recipe?.servings || 4
  const activeServings = servings || baseServings
  const ingredientsList = Array.isArray(recipe?.ingredients) ? recipe.ingredients : []

  const missingEssentials = useMemo(() => {
    if (!recipe || !Array.isArray(recipe.ingredients)) return []
    return recipe.ingredients
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
          shortfall: check?.missingQuantity || 0,
          unit: ri.unit,
          isInsufficient: Boolean(check && !check.satisfied)
        }
      })
  }, [recipe, selectedSet, onHandMap, baseServings, activeServings, ingredients])

  if (loading) {
    return (
      <div className="empty-state glass-panel animate-pulse" style={{ padding: '60px 20px', textAlign: 'center', borderRadius: '24px' }} id="recipe-detail-loading">
        <Loader2 size={40} className="animate-spin" style={{ color: 'var(--brand-orange)', marginBottom: '16px' }} />
        <h3>{language === 'bn' ? 'রেসিপি প্রস্তুত করা হচ্ছে...' : 'Loading Recipe Details...'}</h3>
        <p>{language === 'bn' ? 'ডাটাবেজ থেকে ধাপে ধাপে প্রস্তুত প্রণালী এবং রান্নার গোপনীয় কৌশলগুলো লোড হচ্ছে...' : 'Fetching step-by-step instructions and regional culinary secrets from the database...'}</p>
      </div>
    )
  }

  if (!recipe) {
    return (
      <div className="empty-state glass-panel animate-scale-in" id="error-recipe-not-found" style={{ textAlign: 'center', padding: '60px 20px', borderRadius: '24px' }}>
        <UtensilsCrossed size={48} style={{ color: 'var(--brand-orange)', marginBottom: '16px' }} />
        <h3>{language === 'bn' ? 'রেসিপি পাওয়া যায়নি' : 'Recipe Not Found'}</h3>
        <p>{language === 'bn' ? 'আমরা যে রেসিপিটি খুঁজছেন তা পাওয়া যায়নি। এটি হয়তো সরানো হয়েছে।' : "We couldn't find the recipe you are looking for. It may have been retired or moved."}</p>
        <Link to="/" className="btn btn-primary" id="not-found-home-btn" style={{ marginTop: '16px' }}>
          {t('home')}
        </Link>
      </div>
    )
  }

  const stepsList = Array.isArray(recipe.steps) ? recipe.steps : []
  const dietaryTagsList = Array.isArray(recipe.dietaryTags) ? recipe.dietaryTags : []
  const timeStats = adjustTime(recipe.prepTime, recipe.cookTime, baseServings, activeServings, recipe.timeAdjustment)

  const ingredientGroups = ingredientsList.reduce((acc, ri) => {
    const groupName = ri.group || 'Main Ingredients'
    if (!acc[groupName]) acc[groupName] = []
    acc[groupName].push(ri)
    return acc
  }, {})

  const title = language === 'bn' ? (recipe.titleBn || recipe.title) : recipe.title
  const desc = language === 'bn' ? (recipe.descriptionBn || recipe.description) : recipe.description
  const culturalNote = language === 'bn' ? (recipe.culturalNoteBn || recipe.culturalNote) : recipe.culturalNote
  const cuisineName = language === 'bn' ? (cuisine?.nameBn || cuisine?.name || recipe.cuisineId) : (cuisine?.name || recipe.cuisineId)
  const dishPhotoUrl = getRecipeImage(recipe.id, recipe.cuisineId)

  return (
    <div className="recipe-detail-container animate-fade-in" id={`recipe-detail-${recipe.id}`} style={{ maxWidth: '1360px', margin: '0 auto', padding: '0 20px 60px' }}>
      
      {/* AI Translation Loading Indicator */}
      {recipeTranslating && (
        <div className="recipe-translating-banner" id="recipe-translating-indicator">
          <Loader2 size={14} className="animate-spin" />
          <span>{t('translatingViaAi')}</span>
        </div>
      )}

      {/* 1. Header segment with Full-Bleed Real Food Photography */}
      <section className="recipe-detail-header">
        <div 
          className="recipe-detail-visual" 
          id="recipe-detail-hero-visual"
          style={{
            position: 'relative',
            borderRadius: '28px',
            overflow: 'hidden',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)'
          }}
        >
          <img
            src={dishPhotoUrl}
            alt={title}
            fetchPriority="high"
            decoding="async"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = getCuisineImage(recipe.cuisineId);
            }}
          />
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(8, 10, 14, 0.25)' }} />
        </div>

        <div className="recipe-detail-info">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
            <span 
              className="recipe-card-cuisine" 
              style={{ 
                color: cuisine?.color || 'var(--brand-orange)',
                fontSize: '0.85rem',
                fontWeight: '800',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: cuisine?.color || 'var(--brand-orange)' }} />
              <span>{cuisineName} {language === 'bn' ? 'রন্ধনশৈলী' : 'Cuisine'}</span>
            </span>
            {(recipe.isAiGenerated || recipe.id?.startsWith('custom-')) && (
              <span 
                className="badge"
                style={{
                  background: 'var(--brand-orange)',
                  color: '#ffffff',
                  fontSize: '0.82rem',
                  fontWeight: '700',
                  padding: '4px 12px',
                  borderRadius: '20px',
                  boxShadow: '0 2px 10px rgba(240, 90, 40, 0.4)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
                id="recipe-detail-ai-badge"
              >
                <Sparkles size={14} />
                <span>{t('aiGeneratedBadge')}<span className="ai-badge-subtext"> • <small style={{ opacity: 0.9 }}>{t('aiRecipePoweredBy')}</small></span></span>
              </span>
            )}
          </div>

          <h1 className="recipe-detail-title" style={{ fontSize: 'clamp(2rem, 3.5vw, 2.8rem)', fontWeight: 800, margin: '8px 0 12px', lineHeight: 1.2 }}>{title}</h1>
          <p className="hero-subtitle" style={{ margin: '0 0 24px', fontSize: '1.05rem', textAlign: 'left', lineHeight: 1.6 }}>
            {desc}
          </p>

          {/* Stats Bar with Lucide Icons */}
          <div className="recipe-detail-stats">
            <div className="recipe-detail-stat-card glass-panel" id="recipe-stat-time" style={{ padding: '12px 16px', borderRadius: '16px' }}>
              <div className="recipe-detail-stat-val" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '1.1rem', fontWeight: 700 }}>
                <Clock size={16} style={{ color: 'var(--brand-orange)' }} />
                <span>{language === 'bn' ? toBengaliNumber(timeStats.totalTime) : timeStats.totalTime}</span>
              </div>
              <div className="recipe-detail-stat-lbl" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                {t('mins')} {activeServings !== baseServings ? `(${t('adjustedTime')})` : ''}
              </div>
            </div>

            <div className="recipe-detail-stat-card glass-panel" id="recipe-stat-calories" style={{ padding: '12px 16px', borderRadius: '16px' }}>
              <div className="recipe-detail-stat-val" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '1.1rem', fontWeight: 700 }}>
                <Flame size={16} style={{ color: '#ef4444' }} />
                <span>{language === 'bn' ? toBengaliNumber(Math.round(((recipe.calories || 0) * activeServings) / (baseServings || 4)) || (recipe.calories || 0)) : (Math.round(((recipe.calories || 0) * activeServings) / (baseServings || 4)) || (recipe.calories || 0))}</span>
              </div>
              <div className="recipe-detail-stat-lbl" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{t('caloriesLabel')}</div>
            </div>

            <div className="recipe-detail-stat-card glass-panel" id="recipe-stat-difficulty" style={{ padding: '12px 16px', borderRadius: '16px' }}>
              <div className="recipe-detail-stat-val" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '1.1rem', fontWeight: 700, textTransform: 'capitalize' }}>
                <ChefHat size={16} style={{ color: 'var(--brand-orange)' }} />
                <span>{t(recipe.difficulty || 'intermediate')}</span>
              </div>
              <div className="recipe-detail-stat-lbl" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{t('filterDifficultyLabel')}</div>
            </div>

            <div className="recipe-detail-stat-card glass-panel" id="recipe-stat-servings" style={{ padding: '12px 16px', borderRadius: '16px' }}>
              <div className="servings-stepper" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button 
                  type="button" 
                  className="servings-btn" 
                  onClick={() => setServings(prev => Math.max(1, (prev || baseServings) - 1))}
                  disabled={activeServings <= 1}
                  aria-label="Decrease Servings"
                  id="servings-decrement-btn"
                >
                  <Minus size={14} />
                </button>
                <span className="servings-count" id="servings-count-val" style={{ fontWeight: 700, fontSize: '1.05rem', minWidth: '24px', textAlign: 'center' }}>
                  {language === 'bn' ? toBengaliNumber(activeServings) : activeServings}
                </span>
                <button 
                  type="button" 
                  className="servings-btn" 
                  onClick={() => setServings(prev => Math.min(24, (prev || baseServings) + 1))}
                  disabled={activeServings >= 24}
                  aria-label="Increase Servings"
                  id="servings-increment-btn"
                >
                  <Plus size={14} />
                </button>
              </div>
              <div className="recipe-detail-stat-lbl" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{t('servingsLabel')}</div>
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '16px' }}>
            {dietaryTagsList.map(tag => (
              <span key={tag} className="tag" style={{ textTransform: 'capitalize', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                <Leaf size={12} style={{ color: '#10b981' }} />
                <span>{t(tag)}</span>
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* 2. Cultural Note Callout */}
      {culturalNote && (
        <section style={{ marginBottom: '32px' }} id="recipe-cultural-history">
          <div className="cultural-callout glass-panel" style={{ padding: '16px 20px', borderRadius: '16px', borderLeft: '4px solid var(--brand-orange)', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <BookOpen size={20} style={{ color: 'var(--brand-orange)', flexShrink: 0, marginTop: '2px' }} />
            <div>
              <strong style={{ color: '#ffffff' }}>{t('culturalContext')}: </strong>
              <span style={{ color: 'var(--text-secondary)' }}>{culturalNote}</span>
            </div>
          </div>
        </section>
      )}

      {/* 3. Main layout containing Ingredients on left and Directions on right */}
      <section className="recipe-detail-body">
        
        {/* Ingredients Column */}
        <div className="ingredients-list-panel glass-panel" id="recipe-detail-ingredients" style={{ borderRadius: '24px', padding: '24px' }}>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '20px' }}>{t('ingredientsNeeded')}</h2>
          
          {Object.entries(ingredientGroups).map(([groupName, items]) => (
            <div key={groupName} style={{ marginBottom: '24px' }}>
              <h3 className="ingredients-group-title" style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--brand-orange)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>
                {translateCategory(groupName, language)}
              </h3>
              <div className="ingredients-check-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {items.map((ri, index) => {
                  const ingObj = (ingredients || []).find(i => i && i.id === ri.ingredientId)
                  const inKitchen = selectedSet.has(ri.ingredientId)
                  const onHand = onHandMap[ri.ingredientId]
                  const satisfaction = onHand !== undefined ? checkQuantitySatisfaction(ri, onHand, baseServings, activeServings) : null
                  const isMatched = inKitchen && (!satisfaction || satisfaction.satisfied)
                  const isInsufficient = inKitchen && satisfaction && !satisfaction.satisfied
                  const ingName = language === 'bn' ? (ingObj?.nameBn || ingObj?.name || ri.nameBn || ri.name || ri.ingredientId) : (ingObj?.name || ri.name || ri.ingredientId)
                  
                  const scaled = scaleIngredient(ri, baseServings, activeServings)
                  const unit = translateUnit(scaled.displayUnit, language)
                  
                  return (
                    <label 
                      key={index} 
                      className={`ingredient-check-item ${isMatched ? 'matched-ing' : (isInsufficient ? 'insufficient-ing' : 'missing-ing')}`}
                      id={`ing-item-${ri.ingredientId}`}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', fontSize: '0.88rem' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <input 
                          type="checkbox" 
                          checked={isMatched} 
                          readOnly
                          style={{ accentColor: 'var(--brand-orange)', width: '16px', height: '16px' }}
                          id={`ing-chk-${ri.ingredientId}`}
                        />
                        <span>
                          <strong>{language === 'bn' ? toBengaliNumber(scaled.displayQuantity) : scaled.displayQuantity} {unit}</strong> {ingName}
                          {ri.preparation ? `, ${translatePreparation(ri.preparation, language)}` : ''}
                        </span>
                      </div>
                      {isMatched && (
                        <span className="badge badge-match-high" style={{ fontSize: '0.65rem', padding: '2px 8px' }}>
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
                marginTop: '20px', 
                padding: '14px 16px', 
                background: 'rgba(239, 68, 68, 0.06)', 
                border: '1px solid rgba(239, 68, 68, 0.25)', 
                borderRadius: '16px' 
              }}
              id="missing-essentials-warning"
            >
              <h4 style={{ color: '#f87171', fontSize: '0.88rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                <ShoppingCart size={15} />
                <span>{language === 'bn' ? 'অনুপস্থিত প্রয়োজনীয় উপকরণসমূহ:' : 'Missing Essential Ingredients:'}</span>
              </h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {missingEssentials.map(ing => {
                  const ingName = language === 'bn' ? (ing.nameBn || ing.name) : ing.name
                  return (
                    <span 
                      key={ing.id} 
                      className="badge badge-match-low" 
                      style={{ textTransform: 'none', fontSize: '0.78rem' }}
                    >
                      {ingName}
                    </span>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Steps Column */}
        <div className="steps-panel glass-panel" id="recipe-detail-directions" style={{ borderRadius: '24px', padding: '28px' }}>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '24px' }}>{t('cookingSteps')}</h2>
          <div className="steps-list" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {stepsList.map(step => {
              const instruction = language === 'bn' ? (step.instructionBn || step.instruction) : step.instruction
              return (
                <div key={step.step || step.stepNumber} className="step-item" id={`step-row-${step.step || step.stepNumber}`} style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                  <div className="step-badge" style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--brand-orange)', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.9rem', flexShrink: 0 }}>
                    {language === 'bn' ? toBengaliNumber(step.step || step.stepNumber) : (step.step || step.stepNumber)}
                  </div>
                  <div className="step-content" style={{ flex: 1 }}>
                    <div className="step-meta" style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
                      {step.technique && (
                        <span className="step-tech badge" style={{ background: 'rgba(255,255,255,0.08)', color: '#ffffff', fontSize: '0.72rem' }}>
                          {translateTechnique(step.technique, language)}
                        </span>
                      )}
                      {step.duration && (
                        <span className="step-duration" style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <Clock size={12} style={{ color: 'var(--brand-orange)' }} />
                          <span>{language === 'bn' ? toBengaliNumber(step.duration) : step.duration} {t('mins')}</span>
                        </span>
                      )}
                    </div>
                    <p className="step-instruction" style={{ margin: 0, fontSize: '0.95rem', lineHeight: 1.6, color: 'var(--text-primary)' }}>{instruction}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* 4. Related Cuisines Grid */}
      {relatedRecipes.length > 0 && (
        <section style={{ marginTop: '48px' }} id="related-recipes-section">
          <div className="section-header" style={{ marginBottom: '20px' }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>{language === 'bn' ? `${cuisineName} রন্ধনশৈলী থেকে আরো রেসিপি` : `More from ${cuisineName} Cuisine`}</h2>
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
