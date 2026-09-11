import React, { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Utensils, ArrowRight } from 'lucide-react'
import IngredientSelector from '../components/IngredientSelector'
import CuisineCard from '../components/CuisineCard'
import RecipeCard from '../components/RecipeCard'
import { useDatabase } from '../context/DatabaseContext'
import { HERO_CULINARY_IMAGE } from '../utils/imageAssets'

function HomePage() {
  const { cuisines, ingredients, recipes, loading, language, t, toBengaliNumber } = useDatabase()

  // Top signature cuisines for home carousel
  const homeCuisines = useMemo(() => {
    return cuisines.filter(c => ['bengali', 'north-indian', 'pakistani', 'chinese', 'thai', 'italian', 'mexican', 'japanese'].includes(c.id))
  }, [cuisines])

  // Popular signature dishes representing each active cuisine
  const homeRecipes = useMemo(() => {
    const signatureIds = ['shorshe-ilish', 'butter-chicken', 'chicken-karahi', 'mapo-tofu', 'pad-thai', 'margherita-pizza', 'tacos-al-pastor', 'tonkotsu-ramen']
    return recipes.filter(r => signatureIds.includes(r.id)).slice(0, 8)
  }, [recipes])

  return (
    <div className="homepage-container animate-fade-in" id="home-page-root">
      
      {/* Editorial Hero Section (Inspired by Demo Image & Awwwards Luxury Layout) */}
      <section className="hero-editorial" id="home-hero">
        <div className="hero-content-col">
          <div className="hero-pill-badge">
            <Utensils size={14} />
            <span>{language === 'bn' ? 'বিশ্বব্যাপী রেসিপি সন্ধান' : 'Global Recipe Discovery'}</span>
          </div>

          <h1 className="hero-editorial-title">
            {language === 'bn' ? (
              <>
                আপনার যা আছে তা দিয়ে <br />
                <span className="accent">বিশ্বের সেরা রান্না করুন</span>
              </>
            ) : (
              <>
                Cook the World with <br />
                <span className="accent">What You Have</span>
              </>
            )}
          </h1>

          <p className="hero-editorial-subtitle">
            {language === 'bn' 
              ? 'আপনার ফ্রিজ, প্যান্ট্রি বা রান্নাঘরের উপাদানগুলো নির্বাচন করুন এবং পৃথিবীর প্রতিটি প্রান্তের সেরা অথেনটিক রেসিপি খুঁজে নিন।'
              : 'Select the items in your fridge, pantry, or garden and discover authentic matching dishes from every culinary corner of the globe.'}
          </p>

          <div className="hero-cta-group" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <a 
              href="#ingredient-discovery-section" 
              className="btn btn-primary hero-cta-btn"
              style={{ textDecoration: 'none' }}
            >
              <span>{language === 'bn' ? 'উপাদান নির্বাচন শুরু করুন ↓' : 'Start Selecting Ingredients ↓'}</span>
            </a>
          </div>
        </div>

        {/* Ambient Hero Culinary Visual Melting into Dark Obsidian Background */}
        <div className="hero-visual-col">
          <div className="hero-culinary-wrapper">
            <img 
              src={HERO_CULINARY_IMAGE} 
              alt="Culinary Masterpiece" 
              className="hero-culinary-img"
              fetchPriority="high"
              decoding="async"
              width="480"
              height="480"
            />
          </div>
        </div>
      </section>

      {/* Dedicated Full-Width Ingredient Discovery Section */}
      <section className="ingredient-discovery-section" id="ingredient-discovery-section" style={{ marginTop: '24px', width: '100%' }}>
        <div className="discovery-section-header" style={{ marginBottom: '18px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.76rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--brand-orange)', marginBottom: '6px' }}>
            <span>{language === 'bn' ? 'প্যান্ট্রি ও ফ্রিজ নির্বাচক' : 'Pantry & Fridge Matchmaker'}</span>
          </div>
          <h2 style={{ fontSize: 'clamp(1.5rem, 2.5vw, 2.1rem)', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em', marginBottom: '6px' }}>
            {language === 'bn' ? 'আপনার রান্নাঘরের উপাদান নির্বাচন করুন' : 'Select Ingredients in Your Kitchen'}
          </h2>
          <p style={{ fontSize: '0.92rem', color: 'var(--text-secondary)', maxWidth: '640px' }}>
            {language === 'bn' 
              ? 'যে উপাদানগুলো আপনার কাছে আছে সেগুলোতে ক্লিক করুন। আমাদের স্মার্ট ইঞ্জিন নিমেষেই সেরা রেসিপি মিলিয়ে দেবে।'
              : 'Click or search any items on hand. Our intelligent engine matches authentic global recipes in real-time.'}
          </p>
        </div>

        {/* Integrated Ingredient Discovery Engine (Full-Width, Zero Leftover Edge) */}
        <IngredientSelector />
      </section>

      {/* Platform Statistics */}
      <section className="stats-bar glass-panel" id="platform-stats-banner" style={{ marginTop: '30px' }}>
        <div className="stat-item">
          <div className="stat-num">{loading ? '...' : (language === 'bn' ? `${toBengaliNumber(ingredients.length)}+` : `${ingredients.length}+`)}</div>
          <div className="stat-label">{t('statsIngredients')}</div>
        </div>
        <div className="stat-item">
          <div className="stat-num">{loading ? '...' : (language === 'bn' ? toBengaliNumber(cuisines.length) : cuisines.length)}</div>
          <div className="stat-label">{t('statsCuisines')}</div>
        </div>
        <div className="stat-item">
          <div className="stat-num">{loading ? '...' : (language === 'bn' ? toBengaliNumber(recipes.length) : recipes.length)}</div>
          <div className="stat-label">{t('statsVerifiedRecipes')}</div>
        </div>
      </section>

      {/* How it Works Guide */}
      <section className="home-section" id="how-it-works-section" style={{ marginTop: '40px' }}>
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

      {/* Featured World Cuisines */}
      <section className="home-section" id="featured-cuisines-section">
        <div className="section-header">
          <h2>{t('featuredCuisines')}</h2>
          <Link to="/cuisines" className="section-header-link" id="view-all-cuisines-link" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <span>{t('viewAllCuisines')}</span>
            <ArrowRight size={16} />
          </Link>
        </div>
        <div className="cuisines-carousel" id="featured-cuisines-carousel">
          {homeCuisines.map(c => (
            <CuisineCard key={c.id} cuisine={c} />
          ))}
        </div>
      </section>

      {/* Popular Recipes Grid */}
      <section className="home-section" id="popular-recipes-section">
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
