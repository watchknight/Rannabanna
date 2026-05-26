import React, { useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useDatabase } from '../context/DatabaseContext'
import RecipeCard from '../components/RecipeCard'
import { translateCategory } from '../utils/translations'

function CuisineDetailPage() {
  const { id } = useParams()
  const { cuisines, recipes, ingredients, loading, language, t } = useDatabase()
  
  // Incremental recipes rendering to prevent rendering lag (cuisines have 50+ recipes!)
  const [visibleRecipesCount, setVisibleRecipesCount] = useState(8)

  // Find targeted cuisine
  const cuisine = useMemo(() => {
    return cuisines.find(c => c.id === id)
  }, [id, cuisines])

  // Get all recipes under this cuisine
  const cuisineRecipes = useMemo(() => {
    return recipes.filter(r => r.cuisineId === id)
  }, [id, recipes])

  // Slice recipes array for rendering
  const visibleRecipes = useMemo(() => {
    return cuisineRecipes.slice(0, visibleRecipesCount)
  }, [cuisineRecipes, visibleRecipesCount])

  // Get full ingredient details for signature items
  const signatureObjects = useMemo(() => {
    if (!cuisine || !cuisine.signatureIngredients) return []
    return cuisine.signatureIngredients
      .map(ingId => ingredients.find(ing => ing.id === ingId))
      .filter(Boolean)
  }, [cuisine, ingredients])

  if (loading) {
    return (
      <div className="empty-state glass-panel animate-pulse" style={{ padding: 'var(--spacing-xxl)' }} id="cuisine-detail-loading">
        <div className="empty-state-emoji animate-spin" style={{ animationDuration: '3s' }}>🌍</div>
        <h3>{language === 'bn' ? 'রন্ধনশৈলী লোড হচ্ছে...' : 'Loading Cuisine Details...'}</h3>
        <p>{language === 'bn' ? 'বিশ্ব রন্ধনশৈলী ভল্ট সংযুক্ত করা হচ্ছে...' : 'Connecting to global cuisines vault...'}</p>
      </div>
    )
  }

  if (!cuisine) {
    return (
      <div className="empty-state glass-panel animate-scale-in" id="error-cuisine-not-found">
        <div className="empty-state-emoji">🌍</div>
        <h3>{language === 'bn' ? 'রন্ধনশৈলী পাওয়া যায়নি' : 'Cuisine Not Found'}</h3>
        <p>{language === 'bn' ? 'আপনি যে রন্ধনশৈলী খুঁজছেন তা আমাদের সিস্টেমে নেই।' : "We couldn't find the cuisine profile you are looking for."}</p>
        <Link to="/cuisines" className="btn btn-primary" id="cuisine-not-found-back-btn">
          {language === 'bn' ? 'রন্ধনশৈলী তালিকায় ফিরে যান' : 'Back to Cuisines'}
        </Link>
      </div>
    )
  }

  const name = language === 'bn' ? (cuisine.nameBn || cuisine.name) : cuisine.name
  const region = language === 'bn' ? (cuisine.regionBn || cuisine.region) : cuisine.region
  const description = language === 'bn' ? (cuisine.descriptionBn || cuisine.description) : cuisine.description

  return (
    <div className="cuisine-detail-page animate-fade-in" id={`cuisine-detail-${cuisine.id}`}>
      
      {/* 1. Styled header card with cuisine gradient identity */}
      <section 
        className="glass-panel" 
        style={{
          padding: 'var(--spacing-xxl) var(--spacing-lg)',
          background: `linear-gradient(135deg, ${cuisine.color}ee 0%, #0a0a0f 100%)`,
          border: 'none',
          borderRadius: 'var(--radius-lg)',
          marginBottom: 'var(--spacing-xxl)',
          position: 'relative',
          overflow: 'hidden'
        }}
        id="cuisine-detail-hero"
      >
        <div style={{ position: 'relative', zIndex: 2, maxWidth: '800px' }}>
          <span style={{ fontSize: '4.5rem', marginBottom: 'var(--spacing-sm)', display: 'inline-block' }}>
            {cuisine.emoji}
          </span>
          <span 
            style={{ 
              display: 'block', 
              fontSize: '0.9rem', 
              textTransform: 'uppercase', 
              letterSpacing: '0.1em', 
              fontWeight: '800',
              opacity: 0.8
            }}
          >
            {region} {language === 'bn' ? 'রন্ধনশৈলী পরিচিতি' : 'Cuisine Profile'}
          </span>
          <h1 style={{ fontSize: '3.5rem', marginTop: 'var(--spacing-xs)', marginBottom: 'var(--spacing-md)' }}>
            {name}
          </h1>
          <p style={{ fontSize: '1.1rem', lineHeight: '1.7', opacity: 0.9 }}>
            {description}
          </p>
        </div>
      </section>

      {/* 2. Main structure: Signatures on left & Recipes on right */}
      <div className="recipe-detail-body">
        
        {/* Signature ingredients sidebar */}
        <div className="ingredients-list-panel glass-panel" id="cuisine-signature-ingredients">
          <h3 style={{ fontSize: '1.25rem', marginBottom: 'var(--spacing-lg)' }}>
            {language === 'bn' ? 'প্রধান সিগনেচার উপাদান' : 'Signature Elements'}
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 'var(--spacing-md)' }}>
            {language === 'bn' ? `${name} রান্নার মূল স্বাদ ফুটিয়ে তুলতে এই উপাদানগুলো অপরিহার্য:` : `These defining staples are critical to cooking authentic ${cuisine.name} food:`}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
            {signatureObjects.map(ing => {
              const ingName = language === 'bn' ? (ing.nameBn || ing.name) : ing.name
              return (
                <div 
                  key={ing.id} 
                  className="tag" 
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 'var(--spacing-sm)', 
                    padding: '8px 12px',
                    justifyContent: 'flex-start',
                    fontWeight: '600'
                  }}
                  id={`sig-ing-${ing.id}`}
                >
                  <span style={{ fontSize: '1.25rem' }}>{ing.emoji}</span>
                  <div>
                    <div style={{ color: '#ffffff' }}>{ingName}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>
                      {translateCategory(ing.subCategory, language)}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Recipes Grid */}
        <div className="steps-panel glass-panel" id="cuisine-recipes-panel">
          <h2 style={{ fontSize: '1.5rem', marginBottom: 'var(--spacing-lg)' }}>
            {language === 'bn' ? `${name} রেসিপিসমূহ (${cuisineRecipes.length})` : `${name} Recipes (${cuisineRecipes.length})`}
          </h2>
          
          {cuisineRecipes.length === 0 ? (
            <div className="empty-state" style={{ padding: 'var(--spacing-xl) 0' }}>
              <div className="empty-state-emoji">🍳</div>
              <h3>{language === 'bn' ? 'রেসিপি শীঘ্রই আসছে' : 'Recipes Coming Soon'}</h3>
              <p>{language === 'bn' ? 'আমরা বর্তমানে এই রন্ধনশৈলীর নতুন খাঁটি রেসিপি যাচাই করছি। অনুগ্রহ করে শীঘ্রই আবার দেখুন!' : 'We are currently curating and verifying authentic recipes for this cuisine. Check back soon!'}</p>
            </div>
          ) : (
            <>
              <div className="recipes-grid">
                {visibleRecipes.map(r => (
                  <RecipeCard key={r.id} recipe={r} />
                ))}
              </div>
              
              {cuisineRecipes.length > visibleRecipesCount && (
                <div style={{ textAlign: 'center', marginTop: 'var(--spacing-xl)' }}>
                  <button 
                    className="btn btn-secondary glass-panel" 
                    onClick={() => setVisibleRecipesCount(prev => prev + 8)}
                    id="show-more-cuisine-recipes-btn"
                  >
                    {t('showMore')} ({cuisineRecipes.length - visibleRecipesCount} {language === 'bn' ? 'অন্যান্য' : 'more'})
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default CuisineDetailPage
