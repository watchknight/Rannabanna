import React, { useMemo } from 'react'
import { Link } from 'react-router-dom'
import IngredientSelector from '../components/IngredientSelector'
import CuisineCard from '../components/CuisineCard'
import RecipeCard from '../components/RecipeCard'
import { useDatabase } from '../context/DatabaseContext'

function HomePage() {
  const { cuisines, ingredients, recipes, loading, language, t } = useDatabase()

  // Grab top cuisines for home carousel (Bangladeshi, Indian, Pakistani, Chinese, Thai, Italian, Mexican)
  const homeCuisines = useMemo(() => {
    return cuisines.filter(c => ['bengali', 'north-indian', 'pakistani', 'chinese', 'thai', 'italian', 'mexican'].includes(c.id))
  }, [cuisines])

  // Grab popular recipes representing each active cuisine (Bangladeshi, Indian, Pakistani, Chinese, Thai, Italian, Mexican)
  const homeRecipes = useMemo(() => {
    // Select popular signature dishes across all loaded cuisines
    const signatureIds = ['shorshe-ilish', 'butter-chicken', 'chicken-karahi', 'mapo-tofu', 'pad-thai', 'margherita-pizza', 'tacos-al-pastor']
    return recipes.filter(r => signatureIds.includes(r.id)).slice(0, 6)
  }, [recipes])

  return (
    <div className="homepage-container animate-fade-in" id="home-page-root">
      {/* Hero Section */}
      <section className="hero-section" id="home-hero">
        <div className="hero-badge animate-slide-up">
          <span>🌶️</span> {language === 'bn' ? 'বিশ্বব্যাপী রেসিপি সন্ধান' : 'Global Recipe Discovery'}
        </div>
        <h1 className="animate-slide-up" style={{ animationDelay: '0.1s' }}>
          {t('heroTitle')} <br />
          <span className="gradient-text">{t('heroTitleSpan')}</span>
        </h1>
        <p className="hero-subtitle animate-slide-up" style={{ animationDelay: '0.2s' }}>
          {t('heroSubtitle')}
        </p>

        {/* Core Ingredient Selector */}
        <div className="animate-slide-up" style={{ animationDelay: '0.3s' }}>
          <IngredientSelector />
        </div>
      </section>

      {/* Platform Statistics */}
      <section className="stats-bar glass-panel" id="platform-stats-banner">
        <div className="stat-item">
          <div className="stat-num">{loading ? '...' : ingredients.length + '+'}</div>
          <div className="stat-label">{t('statsIngredients')}</div>
        </div>
        <div className="stat-item">
          <div className="stat-num">{loading ? '...' : cuisines.length}</div>
          <div className="stat-label">{t('statsCuisines')}</div>
        </div>
        <div className="stat-item">
          <div className="stat-num">{loading ? '...' : recipes.length}</div>
          <div className="stat-label">{t('statsVerifiedRecipes')}</div>
        </div>
      </section>

      {/* How it Works Guide */}
      <section style={{ margin: 'var(--spacing-xxl) 0' }} id="how-it-works-section">
        <div className="section-header">
          <h2>{t('howItWorks')}</h2>
        </div>
        <div className="step-grid">
          <div className="step-card glass-panel">
            <div className="step-number">1</div>
            <h3>{t('howItWorksStep1Title')}</h3>
            <p>{t('howItWorksStep1Desc')}</p>
          </div>
          <div className="step-card glass-panel">
            <div className="step-number">2</div>
            <h3>{t('howItWorksStep2Title')}</h3>
            <p>{t('howItWorksStep2Desc')}</p>
          </div>
          <div className="step-card glass-panel">
            <div className="step-number">3</div>
            <h3>{t('howItWorksStep3Title')}</h3>
            <p>{t('howItWorksStep3Desc')}</p>
          </div>
        </div>
      </section>

      {/* Featured Cuisines */}
      <section style={{ margin: 'var(--spacing-xxl) 0' }} id="featured-cuisines-section">
        <div className="section-header">
          <h2>{t('featuredCuisines')}</h2>
          <Link to="/cuisines" className="section-header-link" id="view-all-cuisines-link">
            {t('viewAllCuisines')}
          </Link>
        </div>
        <div className="cuisines-carousel" id="featured-cuisines-carousel">
          {homeCuisines.map(c => (
            <CuisineCard key={c.id} cuisine={c} />
          ))}
        </div>
      </section>

      {/* Popular Recipes Grid */}
      <section style={{ margin: 'var(--spacing-xxl) 0' }} id="popular-recipes-section">
        <div className="section-header">
          <h2>{t('popularRecipes')}</h2>
        </div>
        <div className="recipes-grid" id="popular-recipes-grid">
          {homeRecipes.map(r => (
            <RecipeCard key={r.id} recipe={r} />
          ))}
        </div>
      </section>
    </div>
  )
}

export default HomePage
