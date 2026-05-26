import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useDatabase } from '../context/DatabaseContext'

function RecipeCard({ recipe, selectedIds = [] }) {
  const navigate = useNavigate()
  const { cuisines, language, t } = useDatabase()
  
  const cuisine = cuisines.find(c => c.id === recipe.cuisineId)
  const totalTime = recipe.prepTime + recipe.cookTime

  const getMatchBadgeClass = (pct) => {
    if (pct >= 90) return 'badge-match-high'
    if (pct >= 50) return 'badge-match-med'
    return 'badge-match-low'
  }

  const handleCardClick = () => {
    // Pass along selected ingredients as a query parameter so the detail page can highlight matches!
    const query = selectedIds.length > 0 ? `?selected=${selectedIds.join(',')}` : ''
    navigate(`/recipe/${recipe.id}${query}`)
  }

  const title = language === 'bn' ? (recipe.titleBn || recipe.title) : recipe.title
  const desc = language === 'bn' ? (recipe.descriptionBn || recipe.description) : recipe.description
  const cuisineName = language === 'bn' ? (cuisine?.nameBn || cuisine?.name || recipe.cuisineId) : (cuisine?.name || recipe.cuisineId)

  return (
    <div 
      className="recipe-card glass-panel glass-panel-hover animate-scale-in"
      onClick={handleCardClick}
      id={`recipe-card-${recipe.id}`}
    >
      <div className="recipe-card-img-placeholder">
        <span className="recipe-card-emoji">{recipe.imageEmoji || '🍲'}</span>
        {recipe.matchPercentage !== undefined && (
          <span className={`badge recipe-match-badge ${getMatchBadgeClass(recipe.matchPercentage)}`}>
            {recipe.matchPercentage}% {t('matchPercentageBadge')}
          </span>
        )}
      </div>

      <div className="recipe-card-content">
        <span 
          className="recipe-card-cuisine" 
          style={{ color: cuisine?.color || 'var(--brand-orange)' }}
        >
          {cuisine?.emoji} {cuisineName}
        </span>
        
        <h3 className="recipe-card-title">{title}</h3>
        
        <p className="recipe-card-desc">{desc}</p>
        
        <div className="recipe-card-meta">
          <div className="recipe-card-meta-item">
            <span>⏱️</span>
            <span>{totalTime} {t('mins')}</span>
          </div>
          <div className="recipe-card-meta-item">
            <span>👨‍🍳</span>
            <span style={{ textTransform: 'capitalize' }}>{t(recipe.difficulty || 'intermediate')}</span>
          </div>
          <div className="recipe-card-meta-item">
            <span>🔥</span>
            <span>{recipe.calories} kcal</span>
          </div>
        </div>

        {/* Show missing essentials hint on search results */}
        {recipe.missingEssential && recipe.missingEssential.length > 0 && (
          <div className="recipe-card-missing" style={{
            marginTop: '8px',
            padding: '6px 10px',
            borderRadius: '8px',
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            fontSize: '0.75rem',
            color: 'var(--text-tertiary, #888)'
          }}>
            <span style={{ color: 'var(--brand-orange)' }}>🛒 {t('needLabel')}: </span>
            {recipe.missingEssential.slice(0, 3).map(m => {
              const name = language === 'bn' ? (m.nameBn || m.name) : m.name
              return `${m.emoji} ${name}`
            }).join(', ')}
            {recipe.missingEssential.length > 3 && ` +${recipe.missingEssential.length - 3} ${language === 'bn' ? 'অন্যান্য' : 'more'}`}
          </div>
        )}
      </div>
    </div>
  )
}

export default RecipeCard
