import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Clock, ChefHat, Flame, ShoppingCart, Sparkles } from 'lucide-react'
import { useDatabase } from '../context/DatabaseContext'
import { adjustTime } from '../utils/servingsScaler'
import { getCachedRecipeTranslation, translateWithGemini, subscribeToTranslations } from '../utils/aiTranslator'
import { getRecipeImage, getCuisineImage } from '../utils/imageAssets'

function RecipeCard({ recipe, selectedIds = [], targetServings = null, isCustomBespoke = false }) {
  const navigate = useNavigate()
  const { cuisines, language, t, toBengaliNumber } = useDatabase()
  const [isTranslatingCard, setIsTranslatingCard] = useState(false)
  const [liveTranslatedRecipe, setLiveTranslatedRecipe] = useState(() => {
    if (language !== 'bn' || !recipe) return null
    return getCachedRecipeTranslation(recipe.id, 'bn')
  })
  
  const isAi = isCustomBespoke || recipe.isAiGenerated || recipe.id?.startsWith('custom-')
  const cuisine = (cuisines || []).find(c => c.id === recipe.cuisineId)
  const baseServings = recipe.baseServings || recipe.servings || 4
  const activeServings = targetServings ? Number(targetServings) : baseServings
  const timeStats = adjustTime(recipe.prepTime, recipe.cookTime, baseServings, activeServings, recipe.timeAdjustment)
  const totalTime = timeStats.totalTime
  const isTimeAdjusted = activeServings !== baseServings

  // Listen for translation updates
  useEffect(() => {
    const unsubscribe = subscribeToTranslations(({ type, key, value }) => {
      if (type === 'recipe' && key === `bn:${recipe.id}`) {
        setLiveTranslatedRecipe(value)
        setIsTranslatingCard(false)
      }
    })
    return unsubscribe
  }, [recipe?.id])

  // On-demand translation for uncached recipe cards when switched to Bangla
  useEffect(() => {
    if (language !== 'bn' || !recipe) return
    if (recipe.titleBn && recipe.descriptionBn) return

    const cached = getCachedRecipeTranslation(recipe.id, 'bn')
    if (cached) {
      setLiveTranslatedRecipe(cached)
      return
    }

    let active = true
    setIsTranslatingCard(true)

    translateWithGemini({ recipe, targetLanguage: 'bn' })
      .then(res => {
        if (!active) return
        if (res?.success && res.recipe) {
          setLiveTranslatedRecipe(res.recipe)
        }
        setIsTranslatingCard(false)
      })
      .catch(() => {
        if (active) setIsTranslatingCard(false)
      })

    return () => { active = false }
  }, [language, recipe?.id])

  const getMatchBadgeClass = (pct) => {
    if (pct >= 90) return 'badge-match-high'
    if (pct >= 50) return 'badge-match-med'
    return 'badge-match-low'
  }

  const handleCardClick = () => {
    const params = new URLSearchParams()
    if (selectedIds.length > 0) params.set('selected', selectedIds.join(','))
    if (targetServings && Number(targetServings) !== baseServings) params.set('servings', targetServings)
    const query = params.toString() ? `?${params.toString()}` : ''
    navigate(`/recipe/${recipe.id}${query}`)
  }

  const title = language === 'bn' ? (liveTranslatedRecipe?.titleBn || recipe.titleBn || recipe.title) : recipe.title
  const desc = language === 'bn' ? (liveTranslatedRecipe?.descriptionBn || recipe.descriptionBn || recipe.description) : recipe.description
  const cuisineName = language === 'bn' ? (cuisine?.nameBn || cuisine?.name || recipe.cuisine || recipe.cuisineId) : (cuisine?.name || recipe.cuisine || recipe.cuisineId)
  const displayTime = language === 'bn' ? toBengaliNumber(totalTime) : totalTime
  const displayCalories = language === 'bn' 
    ? toBengaliNumber(Math.round(((recipe.calories || 0) * activeServings) / baseServings) || (recipe.calories || 0))
    : (Math.round(((recipe.calories || 0) * activeServings) / baseServings) || (recipe.calories || 0))
  const displayMatchPct = language === 'bn' ? toBengaliNumber(recipe.matchPercentage) : recipe.matchPercentage
  const recipePhotoUrl = getRecipeImage(recipe.id, recipe.cuisineId);

  return (
    <div 
      className={`recipe-card glass-panel glass-panel-hover animate-scale-in ${isAi ? 'recipe-card-ai' : ''}`}
      onClick={handleCardClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleCardClick(); } }}
      tabIndex={0}
      role="button"
      aria-label={`${title} (${cuisineName}), ${displayTime} ${t('mins')}, ${displayCalories} ${language === 'bn' ? 'ক্যালোরি' : 'kcal'}`}
      id={`recipe-card-${recipe.id}`}
      style={isAi ? { border: '1px solid rgba(240, 90, 40, 0.35)', boxShadow: '0 4px 20px rgba(240, 90, 40, 0.15)' } : {}}
    >
      {/* Full-Bleed Real Culinary Photography Header */}
      <div className="recipe-card-media">
        <img
          src={recipePhotoUrl}
          alt={title}
          loading="lazy"
          decoding="async"
          className="recipe-card-media-img"
          onError={(e) => {
            e.currentTarget.onerror = null;
            e.currentTarget.src = getCuisineImage(recipe.cuisineId);
          }}
        />
        {/* Visual badge distinguishing AI-generated custom recipes */}
        {isAi && (
          <span 
            className="badge badge-ai-generated"
            style={{
              position: 'absolute',
              top: '12px',
              left: '12px',
              background: 'var(--brand-orange)',
              border: '1px solid rgba(255, 255, 255, 0.25)',
              color: '#ffffff',
              fontSize: '0.74rem',
              fontWeight: '700',
              padding: '4px 10px',
              borderRadius: '9999px',
              boxShadow: '0 2px 10px rgba(240, 90, 40, 0.4)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              zIndex: 2
            }}
            id={`ai-badge-${recipe.id}`}
          >
            <Sparkles size={12} />
            <span>{t('aiGeneratedBadge')}</span>
          </span>
        )}

        {recipe.matchPercentage !== undefined && !isAi && (
          <span className={`badge recipe-match-badge ${getMatchBadgeClass(recipe.matchPercentage)}`} style={{ position: 'absolute', top: '12px', right: '12px', zIndex: 2 }}>
            {displayMatchPct}% {t('matchPercentageBadge')}
          </span>
        )}
      </div>

      <div className="recipe-card-content" style={{ padding: '16px 18px 20px' }}>
        <span 
          className="recipe-card-cuisine" 
          style={{ 
            color: cuisine?.color || 'var(--brand-orange)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.8rem',
            fontWeight: '700',
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}
        >
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: cuisine?.color || 'var(--brand-orange)', display: 'inline-block' }} />
          <span>{cuisineName}</span>
        </span>
        
        <h3 className="recipe-card-title" style={{ fontSize: '1.2rem', marginTop: '6px', marginBottom: '8px', lineHeight: '1.3' }}>
          {title}
          {isTranslatingCard && <span className="translating-dot" style={{ marginLeft: '6px' }} title="Translating via AI..."></span>}
        </h3>
        
        <p className="recipe-card-desc" style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: '1.5', marginBottom: '16px' }}>{desc}</p>
        
        <div className="recipe-card-meta" style={{ display: 'flex', alignItems: 'center', gap: '16px', borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: '12px' }}>
          <div className="recipe-card-meta-item" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            <Clock size={15} style={{ color: 'var(--brand-orange)' }} />
            <span>
              {displayTime} {t('mins')}
              {isTimeAdjusted && <small style={{ color: 'var(--brand-orange)', marginLeft: '4px', fontSize: '0.68rem' }}>({t('adjustedTime')})</small>}
            </span>
          </div>
          <div className="recipe-card-meta-item" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            <ChefHat size={15} style={{ color: 'var(--brand-orange)' }} />
            <span style={{ textTransform: 'capitalize' }}>{t(recipe.difficulty || 'intermediate')}</span>
          </div>
          <div className="recipe-card-meta-item" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            <Flame size={15} style={{ color: '#ef4444' }} />
            <span>{displayCalories} {language === 'bn' ? 'ক্যালোরি' : 'kcal'}</span>
          </div>
        </div>

        {/* Missing essentials hint */}
        {recipe.missingEssential && recipe.missingEssential.length > 0 && (
          <div className="recipe-card-missing" style={{
            marginTop: '12px',
            padding: '8px 12px',
            borderRadius: '10px',
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            fontSize: '0.78rem',
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <ShoppingCart size={14} style={{ color: 'var(--brand-orange)', flexShrink: 0 }} />
            <span>
              <strong style={{ color: 'var(--brand-orange)' }}>{t('needLabel')}: </strong>
              {recipe.missingEssential.slice(0, 3).map(m => language === 'bn' ? (m.nameBn || m.name) : m.name).join(', ')}
              {recipe.missingEssential.length > 3 && ` +${language === 'bn' ? toBengaliNumber(recipe.missingEssential.length - 3) : (recipe.missingEssential.length - 3)} ${language === 'bn' ? 'অন্যান্য' : 'more'}`}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

export default React.memo(RecipeCard)
