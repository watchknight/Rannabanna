import React, { useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Globe, Compass, Loader2, ArrowLeft } from 'lucide-react'
import { useDatabase } from '../context/DatabaseContext'
import RecipeCard from '../components/RecipeCard'
import { translateCategory } from '../utils/translations'
import { getCuisineImage, getIngredientImage } from '../utils/imageAssets'

function CuisineDetailPage() {
  const { id } = useParams()
  const { cuisines, recipes, ingredients, loading, language, toBengaliNumber } = useDatabase()
  
  const [visibleRecipesCount, setVisibleRecipesCount] = useState(8)

  const cuisine = useMemo(() => {
    return cuisines.find(c => c.id === id)
  }, [id, cuisines])

  const cuisineRecipes = useMemo(() => {
    return recipes.filter(r => r.cuisineId === id)
  }, [id, recipes])

  const visibleRecipes = useMemo(() => {
    return cuisineRecipes.slice(0, visibleRecipesCount)
  }, [cuisineRecipes, visibleRecipesCount])

  const signatureObjects = useMemo(() => {
    if (!cuisine || !cuisine.signatureIngredients) return []
    return cuisine.signatureIngredients
      .map(ingId => ingredients.find(ing => ing.id === ingId))
      .filter(Boolean)
  }, [cuisine, ingredients])

  if (loading) {
    return (
      <div className="empty-state glass-panel animate-pulse" style={{ padding: '60px 20px', textAlign: 'center', borderRadius: '24px' }} id="cuisine-detail-loading">
        <Loader2 size={40} className="animate-spin" style={{ color: 'var(--brand-orange)', marginBottom: '16px' }} />
        <h3>{language === 'bn' ? 'রন্ধনশৈলী লোড হচ্ছে...' : 'Loading Cuisine Details...'}</h3>
        <p style={{ color: 'var(--text-secondary)' }}>{language === 'bn' ? 'বিশ্ব রন্ধনশৈলী ভল্ট সংযুক্ত করা হচ্ছে...' : 'Connecting to global cuisines vault...'}</p>
      </div>
    )
  }

  if (!cuisine) {
    return (
      <div className="empty-state glass-panel animate-scale-in" id="error-cuisine-not-found" style={{ textAlign: 'center', padding: '60px 20px', borderRadius: '24px' }}>
        <Compass size={48} style={{ color: 'var(--brand-orange)', marginBottom: '16px' }} />
        <h3>{language === 'bn' ? 'রন্ধনশৈলী পাওয়া যায়নি' : 'Cuisine Not Found'}</h3>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>{language === 'bn' ? 'আপনি যে রন্ধনশৈলী খুঁজছেন তা আমাদের সিস্টেমে নেই।' : "We couldn't find the cuisine profile you are looking for."}</p>
        <Link to="/cuisines" className="btn btn-primary" id="cuisine-not-found-back-btn">
          {language === 'bn' ? 'রন্ধনশৈলী তালিকায় ফিরে যান' : 'Back to Cuisines'}
        </Link>
      </div>
    )
  }

  const name = language === 'bn' ? (cuisine.nameBn || cuisine.name) : cuisine.name
  const region = language === 'bn' ? (cuisine.regionBn || cuisine.region) : cuisine.region
  const description = language === 'bn' ? (cuisine.descriptionBn || cuisine.description) : cuisine.description
  const cuisinePhotoUrl = getCuisineImage(cuisine.id)

  return (
    <div className="cuisine-detail-page animate-fade-in" id={`cuisine-detail-${cuisine.id}`} style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 20px 60px' }}>
      
      {/* 1. Styled panoramic hero with authentic photography */}
      <section 
        className="glass-panel" 
        style={{
          position: 'relative',
          padding: '48px 36px',
          borderRadius: '28px',
          marginBottom: '36px',
          overflow: 'hidden',
          minHeight: '260px',
          display: 'flex',
          alignItems: 'center'
        }}
        id="cuisine-detail-hero"
      >
        <img
          src={cuisinePhotoUrl}
          alt={name}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover'
          }}
        />
        <div 
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(to right, rgba(8, 10, 14, 0.95) 0%, rgba(8, 10, 14, 0.75) 50%, rgba(8, 10, 14, 0.4) 100%)'
          }}
        />

        <div style={{ position: 'relative', zIndex: 2, maxWidth: '720px' }}>
          <Link to="/cuisines" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--brand-orange)', fontSize: '0.85rem', fontWeight: 600, marginBottom: '12px' }}>
            <ArrowLeft size={14} />
            <span>{language === 'bn' ? 'সকল রন্ধনশৈলী' : 'All Cuisines'}</span>
          </Link>
          <span 
            style={{ 
              display: 'block', 
              fontSize: '0.78rem', 
              textTransform: 'uppercase', 
              letterSpacing: '0.1em', 
              fontWeight: 800,
              color: cuisine.color || 'var(--brand-orange)',
              marginBottom: '4px'
            }}
          >
            {region} {language === 'bn' ? 'রন্ধনশৈলী পরিচিতি' : 'Cuisine Profile'}
          </span>
          <h1 className="cuisine-detail-title" style={{ fontSize: 'clamp(2.2rem, 4vw, 3.2rem)', fontWeight: 800, color: '#ffffff', margin: '0 0 12px' }}>
            {name}
          </h1>
          <p style={{ fontSize: '1.05rem', lineHeight: '1.6', color: 'rgba(255, 255, 255, 0.9)', margin: 0 }}>
            {description}
          </p>
        </div>
      </section>

      {/* 2. Main structure: Signatures on left & Recipes on right */}
      <div className="recipe-detail-body" style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '36px', alignItems: 'start' }}>
        
        {/* Signature ingredients sidebar with REAL PHOTOGRAPHY */}
        <div className="ingredients-list-panel glass-panel" id="cuisine-signature-ingredients" style={{ borderRadius: '24px', padding: '24px' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '8px' }}>
            {language === 'bn' ? 'প্রধান সিগনেচার উপাদান' : 'Signature Elements'}
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '18px', lineHeight: 1.5 }}>
            {language === 'bn' ? `${name} রান্নার মূল স্বাদ ফুটিয়ে তুলতে এই উপাদানগুলো অপরিহার্য:` : `These defining staples are critical to cooking authentic ${cuisine.name} food:`}
          </p>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {signatureObjects.map(ing => {
              const ingName = language === 'bn' ? (ing.nameBn || ing.name) : ing.name
              const photo = getIngredientImage(ing.id, ing.category)
              return (
                <div 
                  key={ing.id} 
                  className="tag" 
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '12px', 
                    padding: '8px 12px',
                    borderRadius: '12px',
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.08)'
                  }}
                  id={`sig-ing-${ing.id}`}
                >
                  <img
                    src={photo}
                    alt={ingName}
                    style={{ width: '32px', height: '32px', borderRadius: '8px', objectFit: 'cover' }}
                  />
                  <div>
                    <div style={{ color: '#ffffff', fontWeight: 600, fontSize: '0.9rem' }}>{ingName}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {translateCategory(ing.subCategory || ing.category, language)}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Recipes Grid */}
        <div className="cuisine-recipes-column">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0 }}>
              {language === 'bn' ? `${name} ঐতিহ্যবাহী রেসিপিসমূহ` : `Traditional ${cuisine.name} Recipes`}
            </h2>
            <span style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
              {language === 'bn' ? `${toBengaliNumber(cuisineRecipes.length)}টি রেসিপি` : `${cuisineRecipes.length} recipes`}
            </span>
          </div>

          <div className="recipes-grid">
            {visibleRecipes.map(r => (
              <RecipeCard key={r.id} recipe={r} />
            ))}
          </div>

          {cuisineRecipes.length > visibleRecipesCount && (
            <div style={{ textAlign: 'center', marginTop: '32px' }}>
              <button 
                className="btn btn-secondary glass-panel" 
                onClick={() => setVisibleRecipesCount(prev => prev + 8)}
                id="load-more-cuisine-recipes-btn"
              >
                {language === 'bn' ? 'আরো রেসিপি দেখুন' : 'View More Recipes'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default CuisineDetailPage
