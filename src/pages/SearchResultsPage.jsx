import React, { useState, useMemo } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { 
  Sparkles, 
  ChefHat, 
  Wand2, 
  RotateCcw, 
  AlertCircle, 
  Clock, 
  Zap, 
  Wifi, 
  Plus, 
  X, 
  Loader2,
  UtensilsCrossed,
  Filter
} from 'lucide-react'
import FilterPanel from '../components/FilterPanel'
import RecipeCard from '../components/RecipeCard'
import { useRecipeMatcher } from '../hooks/useRecipeMatcher'
import { useDatabase } from '../context/DatabaseContext'
import { API_BASE } from '../utils/apiConfig.js'
import { getIngredientImage } from '../utils/imageAssets'

function SearchResultsPage() {
  const { ingredients, addCustomRecipeToLocalState, language, t, toBengaliNumber, isOffline } = useDatabase()
  const [searchParams, setSearchParams] = useSearchParams()
  
  // Incremental rendering limits for match categories
  const [visiblePerfect, setVisiblePerfect] = useState(8)
  const [visibleGreat, setVisibleGreat] = useState(8)
  const [visibleGood, setVisibleGood] = useState(8)
  const [visibleExploratory, setVisibleExploratory] = useState(8)

  // Extract ingredients from URL query parameter (deduplicated)
  const selectedIds = useMemo(() => {
    const raw = searchParams.get('ingredients')
    return raw ? Array.from(new Set(raw.split(',').filter(Boolean))) : []
  }, [searchParams])

  // Local state for active sidebar filters
  const urlServings = parseInt(searchParams.get('servings'), 10) || 4
  const [filters, setFilters] = useState({
    cuisines: [],
    mealType: 'all',
    difficulty: 'all',
    maxTime: 120,
    servings: urlServings,
    dietary: []
  })
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false)

  // Compute active filters count for mobile FAB badge
  const activeFiltersCount = useMemo(() => {
    let count = 0
    if (filters.cuisines?.length > 0) count += filters.cuisines.length
    if (filters.dietary?.length > 0) count += filters.dietary.length
    if (filters.mealType && filters.mealType !== 'all') count += 1
    if (filters.difficulty && filters.difficulty !== 'all') count += 1
    if (filters.maxTime && filters.maxTime < 120) count += 1
    if (filters.servings && filters.servings !== 4) count += 1
    return count
  }, [filters])

  // Run the intelligent matching engine hook
  const { perfect, great, good, exploratory, totalCount, loading, error } = useRecipeMatcher(selectedIds, filters)

  // Compile ingredient objects for display
  const selectedObjects = useMemo(() => {
    return selectedIds.map(id => ingredients.find(ing => ing.id === id)).filter(Boolean)
  }, [selectedIds, ingredients])

  // Remove a selected tag and trigger URL update
  const handleRemoveIngredient = (id) => {
    const updatedIds = selectedIds.filter(item => item !== id)
    if (updatedIds.length === 0) {
      searchParams.delete('ingredients')
      setSearchParams(searchParams)
    } else {
      setSearchParams({ ingredients: updatedIds.join(',') })
    }
  }

  // AI Custom Recipe Generation states & handler
  const [customRecipe, setCustomRecipe] = useState(null)
  const [customGenerating, setCustomGenerating] = useState(false)
  const [customError, setCustomError] = useState(null)
  const [isColdStarting, setIsColdStarting] = useState(false)

  const handleGenerateCustom = async () => {
    if (selectedIds.length === 0) return
    setCustomGenerating(true)
    setCustomError(null)
    setIsColdStarting(false)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => {
      controller.abort()
    }, 75000)

    const coldStartTimer = setTimeout(() => {
      setIsColdStarting(true)
    }, 6000)

    try {
      const response = await fetch(`${API_BASE}/api/custom-recipe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          ingredientIds: selectedIds,
          cuisineId: filters.cuisine || 'any',
          cuisine: filters.cuisine !== 'all' ? filters.cuisine : null,
          filters: {
            maxTime: filters.maxTime,
            dietaryRestrictions: filters.dietary
          }
        }),
        signal: controller.signal
      })

      clearTimeout(timeoutId)
      clearTimeout(coldStartTimer)

      const data = await response.json().catch(() => null)

      if (!response.ok || !data) {
        const errMsg = data?.error || data?.message || (language === 'bn' ? 'কাস্টম রেসিপি তৈরিতে সমস্যা হয়েছে।' : 'Failed to generate custom recipe.')
        throw new Error(errMsg)
      }

      const generated = data.recipe || data
      if (!generated || !generated.title) {
        throw new Error(language === 'bn' ? 'অসম্পূর্ণ রেসিপি তৈরি হয়েছে।' : 'Incomplete recipe generated.')
      }

      try {
        const stored = JSON.parse(localStorage.getItem('rannabanna-custom-recipes') || '[]')
        const updated = [generated, ...stored.filter(r => r.id !== generated.id)].slice(0, 50)
        localStorage.setItem('rannabanna-custom-recipes', JSON.stringify(updated))
      } catch {}

      addCustomRecipeToLocalState(generated)
      setCustomRecipe(generated)
    } catch (err) {
      clearTimeout(timeoutId)
      clearTimeout(coldStartTimer)
      const isTimeout = err.name === 'AbortError'
      const errorMsg = isTimeout 
        ? (language === 'bn' ? 'রেসিপি তৈরির সময়সীমা শেষ হয়ে গেছে। সার্ভার পুনরায় চালু হচ্ছে, দয়া করে আবার চেষ্টা করুন।' : 'Recipe generation timed out. The server was likely cold-starting; please try again now.')
        : (err.message || t('customChefError'))
      
      console.warn('Backend custom recipe call failed:', err)
      setCustomError(errorMsg)
    } finally {
      setCustomGenerating(false)
      setIsColdStarting(false)
    }
  }

  // Sliced arrays for pagination
  const slicedPerfect = useMemo(() => perfect.slice(0, visiblePerfect), [perfect, visiblePerfect])
  const slicedGreat = useMemo(() => great.slice(0, visibleGreat), [great, visibleGreat])
  const slicedGood = useMemo(() => good.slice(0, visibleGood), [good, visibleGood])
  const slicedExploratory = useMemo(() => exploratory.slice(0, visibleExploratory), [exploratory, visibleExploratory])

  return (
    <div className="search-results-page animate-fade-in" id="search-results-page-root" style={{ maxWidth: '1360px', margin: '0 auto', padding: '0 20px 60px' }}>
      {/* Header Bar with Selected Tags & Counts */}
      <div 
        className="search-summary-card glass-panel"
        id="search-summary-card"
        style={{ borderRadius: '24px', padding: '24px 28px', marginBottom: '28px' }}
      >
        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.05em' }}>
          {t('searchingWith')} {language === 'bn' ? toBengaliNumber(selectedIds.length) : selectedIds.length} {language === 'bn' ? 'টি উপকরণ' : (selectedIds.length === 1 ? 'ingredient' : 'ingredients')}
        </span>
        
        {/* Visual Removable Chips with Real Photo Avatars */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', marginTop: '12px', marginBottom: '16px' }}>
          {selectedObjects.map(ing => {
            const displayName = language === 'bn' ? (ing.nameBn || ing.name) : ing.name
            const photo = getIngredientImage(ing.id, ing.category)
            return (
              <div 
                key={ing.id} 
                className="selected-tag" 
                style={{ padding: '4px 10px', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: '8px', borderRadius: '9999px' }}
                id={`search-ing-tag-${ing.id}`}
              >
                <img 
                  src={photo} 
                  alt="" 
                  style={{ width: '20px', height: '20px', borderRadius: '50%', objectFit: 'cover' }} 
                />
                <span>{displayName}</span>
                <button 
                  type="button"
                  onClick={() => handleRemoveIngredient(ing.id)} 
                  className="selected-tag-remove-btn"
                  aria-label={language === 'bn' ? `${displayName} মুছে ফেলুন` : `Remove ${displayName}`}
                  title={language === 'bn' ? `${displayName} মুছে ফেলুন` : `Remove ${displayName}`}
                >
                  <X size={11} />
                </button>
              </div>
            )
          })}
          <Link 
            to="/" 
            style={{ 
              fontSize: '0.85rem', 
              color: 'var(--brand-orange)', 
              fontWeight: '600', 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: '5px',
              padding: '6px 12px',
              borderRadius: '9999px',
              background: 'rgba(255, 107, 53, 0.08)',
              border: '1px solid rgba(255, 107, 53, 0.2)'
            }}
            id="add-more-ingredients-link"
          >
            <Plus size={14} />
            <span>{language === 'bn' ? 'তালিকা পরিবর্তন' : 'Modify List'}</span>
          </Link>
        </div>

        <h2 className="search-summary-title" style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0 }}>
          {t('foundRecipes', { count: totalCount })}
        </h2>

        {isOffline && (
          <div 
            style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: '6px', 
              padding: '4px 10px', 
              borderRadius: '8px', 
              background: 'rgba(245, 158, 11, 0.1)', 
              color: '#fbbf24', 
              fontSize: '0.8rem', 
              marginTop: '10px' 
            }}
            id="offline-mode-indicator"
          >
            <Wifi size={14} />
            <span>{language === 'bn' ? 'অফলাইন মোড সক্রিয় (স্থানীয় ডাটাবেস ব্যবহৃত হচ্ছে)' : 'Offline mode active (using local database)'}</span>
          </div>
        )}

        {error && totalCount === 0 && !loading && (
          <div 
            style={{ 
              padding: '12px 16px', 
              borderRadius: '12px', 
              background: 'rgba(239, 68, 68, 0.1)', 
              border: '1px solid rgba(239, 68, 68, 0.3)', 
              color: '#f87171', 
              marginTop: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '0.88rem'
            }}
            id="search-error-banner"
          >
            <AlertCircle size={16} />
            <span>{language === 'bn' ? 'রেসিপি লোড করতে সমস্যা হয়েছে। অনুগ্রহ করে পুনরায় চেষ্টা করুন।' : 'Unable to load recipes. Please try again.'}</span>
          </div>
        )}
      </div>

      {selectedIds.length === 0 ? (
        /* Empty State */
        <div className="empty-state glass-panel animate-scale-in" id="empty-search-state" style={{ textAlign: 'center', padding: '60px 20px', borderRadius: '24px' }}>
          <ChefHat size={48} style={{ color: 'var(--brand-orange)', marginBottom: '16px' }} />
          <h3>{t('emptyKitchenTitle')}</h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>{t('emptyKitchenDesc')}</p>
          <Link to="/" className="btn btn-primary" id="empty-state-home-btn">
            {t('chooseIngredientsBtn')}
          </Link>
        </div>
      ) : (
        /* Main search layout with sidebar */
        <div className="search-page-container">
          <FilterPanel filters={filters} onChange={setFilters} />

          <div className="search-results-content">
            {/* Bespoke AI Chef Integration Card */}
            <div 
              className="custom-chef-banner glass-panel animate-slide-up" 
              style={{
                padding: '24px',
                marginBottom: '28px',
                borderRadius: '24px',
                border: '1px solid rgba(240, 90, 40, 0.25)',
                background: '#121622',
                position: 'relative',
                overflow: 'hidden'
              }} 
              id="custom-chef-trigger-box"
            >
              <div style={{ display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(240, 90, 40, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--brand-orange)', flexShrink: 0 }}>
                  <Sparkles size={24} />
                </div>
                <div className="custom-chef-content" style={{ flex: '1', minWidth: '200px' }}>
                  <h4 style={{ margin: '0 0 6px 0', fontSize: '1.2rem', color: '#ffffff', fontWeight: 700 }}>
                    {t('bespokeChefTitle')}
                  </h4>
                  <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    {t('bespokeChefDesc')}
                  </p>
                </div>
                <div className="custom-chef-actions">
                  <button 
                    className="btn btn-primary" 
                    onClick={handleGenerateCustom}
                    disabled={customGenerating}
                    style={{
                      background: 'var(--brand-orange)',
                      border: 'none',
                      boxShadow: '0 4px 16px rgba(240, 90, 40, 0.35)',
                      padding: '12px 22px',
                      minHeight: '48px',
                      fontSize: '0.92rem',
                      fontWeight: '700',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      width: '100%'
                    }}
                    id="trigger-custom-chef-btn"
                  >
                    {customGenerating ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        <span>{t('generatingCustomBtn')}</span>
                      </>
                    ) : (
                      <>
                        <Wand2 size={16} />
                        <span>{t('generateCustomBtn')}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Graceful Inline Error State */}
              {customError && (
                <div 
                  className="glass-panel"
                  style={{ 
                    marginTop: '16px', 
                    padding: '12px 16px', 
                    borderRadius: '12px',
                    border: '1px solid rgba(239, 68, 68, 0.4)',
                    background: 'rgba(239, 68, 68, 0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    flexWrap: 'wrap'
                  }} 
                  id="custom-chef-error"
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f87171', fontSize: '0.85rem' }}>
                    <AlertCircle size={16} />
                    <span>{customError}</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleGenerateCustom}
                    className="btn btn-secondary"
                    style={{ fontSize: '0.8rem', padding: '8px 14px', minHeight: '40px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    id="custom-chef-retry-btn"
                  >
                    <RotateCcw size={13} />
                    <span>{t('tryAgainBtn')}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Active Loading State while waiting for Gemini 3.8 Flash */}
            {customGenerating && (
              <div 
                className="match-section glass-panel animate-pulse" 
                style={{
                  border: '2px dashed rgba(240, 90, 40, 0.4)',
                  borderRadius: '24px',
                  padding: '48px 24px',
                  marginBottom: '28px',
                  textAlign: 'center',
                  background: '#121622',
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)'
                }}
                id="custom-recipe-generating-indicator"
              >
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '18px' }}>
                  <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(240, 90, 40, 0.12)', border: '1px solid rgba(240, 90, 40, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                    <Loader2 size={34} className="animate-spin" style={{ color: 'var(--brand-orange)' }} />
                    <Sparkles size={18} style={{ color: '#ffffff', position: 'absolute' }} />
                  </div>
                </div>
                <h3 style={{ margin: '0 0 10px 0', color: '#ffffff', fontSize: '1.3rem', fontWeight: 700 }}>
                  {language === 'bn' ? 'জেমিনি এআই শেফ আপনার কাস্টম রেসিপি প্রস্তুত করছে...' : 'Gemini AI Chef is crafting your custom recipe...'}
                </h3>
                <p style={{ margin: '0 auto', color: 'var(--text-secondary)', fontSize: '0.92rem', maxWidth: '560px', lineHeight: 1.6 }}>
                  {language === 'bn' 
                    ? 'আপনার নির্বাচিত উপকরণ ও ফিল্টারের ওপর ভিত্তি করে বাস্তবসম্মত, সুস্বাদু রান্নাপ্রণালী তৈরি হচ্ছে।' 
                    : 'Analyzing your selected ingredients and cooking preferences to engineer a delicious, authentic step-by-step recipe.'}
                </p>
                <div style={{ width: '100%', maxWidth: '420px', height: '5px', background: 'rgba(255,255,255,0.08)', borderRadius: '9999px', margin: '22px auto 0', overflow: 'hidden' }}>
                  <div className="rb-shimmer" style={{ width: '100%', height: '100%', background: 'var(--brand-orange)' }} />
                </div>
                {isColdStarting && (
                  <div style={{
                    marginTop: '16px',
                    padding: '8px 14px',
                    borderRadius: '8px',
                    background: 'rgba(245, 158, 11, 0.12)',
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                    color: '#fbbf24',
                    fontSize: '0.82rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }} id="cold-start-notice">
                    <Clock size={14} />
                    <span>{language === 'bn' 
                      ? 'রেন্ডার সার্ভার স্লিপ মোড থেকে চালু হচ্ছে (~৩০-৪৫ সেকেন্ড লাগতে পারে)... অনুগ্রহ করে অপেক্ষা করুন।' 
                      : 'Render server is waking up from sleep (~30-45s cold start)... Hang tight, crafting your recipe!'}</span>
                  </div>
                )}
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '16px', fontSize: '0.8rem', color: '#A78BFA' }}>
                  <Zap size={14} />
                  <span>{language === 'bn' ? 'মডেল: জেমিনি ৩.৮ ফ্ল্যাশ' : 'Powered by Gemini 3.8 Flash'}</span>
                </div>
              </div>
            )}

            {/* Display generated Custom Recipe as featured section */}
            {customRecipe && (
              <div className="match-section" style={{
                border: '1px solid rgba(139, 92, 246, 0.5)',
                borderRadius: '24px',
                padding: '24px',
                marginBottom: '32px',
                background: 'rgba(139, 92, 246, 0.03)',
                boxShadow: '0 8px 30px rgba(139, 92, 246, 0.15)'
              }} id="custom-recipe-featured-section">
                <h3 className="match-section-title" style={{ color: '#A78BFA', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                  <Sparkles size={18} />
                  <span>{t('customRecipeFeaturedTitle')}</span>
                </h3>
                <div className="recipes-grid" style={{ gridTemplateColumns: '1fr' }}>
                  <RecipeCard recipe={customRecipe} selectedIds={selectedIds} isCustomBespoke={true} />
                </div>
              </div>
            )}

            {loading ? (
              <div className="match-section" id="search-loading-skeletons">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                  <Loader2 size={20} className="animate-spin" style={{ color: 'var(--brand-orange)' }} />
                  <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-secondary)' }}>
                    {t('calculatingMatchesTitle')}
                  </h3>
                </div>
                <div className="recipes-grid">
                  {[1, 2, 3, 4, 5, 6].map(n => (
                    <div 
                      key={n} 
                      className="recipe-card glass-panel animate-pulse" 
                      style={{ minHeight: '260px', padding: '20px', borderRadius: '20px' }}
                    >
                      <div style={{ width: '100%', height: '140px', borderRadius: '12px', background: 'rgba(255,255,255,0.06)', marginBottom: '16px' }} />
                      <div style={{ width: '80%', height: '20px', borderRadius: '4px', background: 'rgba(255,255,255,0.08)', marginBottom: '10px' }} />
                      <div style={{ width: '50%', height: '14px', borderRadius: '4px', background: 'rgba(255,255,255,0.04)' }} />
                    </div>
                  ))}
                </div>
              </div>
            ) : totalCount === 0 ? (
              <div className="empty-state glass-panel animate-scale-in" id="no-recipes-match-card" style={{ textAlign: 'center', padding: '48px 20px', borderRadius: '24px' }}>
                <UtensilsCrossed size={48} style={{ color: 'var(--brand-orange)', marginBottom: '16px' }} />
                <h3>{t('noMatchesTitle')}</h3>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>{t('noMatchesDesc')}</p>
                <button 
                  className="btn btn-primary"
                  onClick={handleGenerateCustom}
                  disabled={customGenerating}
                  id="empty-state-custom-chef-btn"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                >
                  {customGenerating ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>{t('generatingCustomBtn')}</span>
                    </>
                  ) : (
                    <>
                      <Wand2 size={16} />
                      <span>{t('generateCustomBtn')}</span>
                    </>
                  )}
                </button>
              </div>
            ) : (
              <>
                {/* A. Perfect Matches (100%) */}
                {perfect.length > 0 && (
                  <div className="match-section" id="perfect-matches-section" style={{ marginBottom: '36px' }}>
                    <h3 className="match-section-title" style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: '16px' }}>
                      {t('perfectMatchTitle')}
                    </h3>
                    <div className="recipes-grid">
                      {slicedPerfect.map(r => (
                        <RecipeCard key={r.id} recipe={r} selectedIds={selectedIds} targetServings={filters.servings} />
                      ))}
                    </div>
                    {perfect.length > visiblePerfect && (
                      <div style={{ textAlign: 'center', marginTop: '20px' }}>
                        <button 
                          className="btn btn-secondary glass-panel" 
                          onClick={() => setVisiblePerfect(prev => prev + 8)}
                          id="show-more-perfect-btn"
                        >
                          {t('showMore')} ({perfect.length - visiblePerfect} {language === 'bn' ? 'অন্যান্য' : 'more'})
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* B. Great Matches (80-99%) */}
                {great.length > 0 && (
                  <div className="match-section" id="great-matches-section" style={{ marginBottom: '36px' }}>
                    <h3 className="match-section-title" style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: '16px' }}>
                      {t('greatMatchTitle')}
                    </h3>
                    <div className="recipes-grid">
                      {slicedGreat.map(r => (
                        <RecipeCard key={r.id} recipe={r} selectedIds={selectedIds} targetServings={filters.servings} />
                      ))}
                    </div>
                    {great.length > visibleGreat && (
                      <div style={{ textAlign: 'center', marginTop: '20px' }}>
                        <button 
                          className="btn btn-secondary glass-panel" 
                          onClick={() => setVisibleGreat(prev => prev + 8)}
                          id="show-more-great-btn"
                        >
                          {t('showMore')} ({great.length - visibleGreat} {language === 'bn' ? 'অন্যান্য' : 'more'})
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* C. Good Matches (50-79%) */}
                {good.length > 0 && (
                  <div className="match-section" id="good-matches-section" style={{ marginBottom: '36px' }}>
                    <h3 className="match-section-title" style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: '16px' }}>
                      {t('goodMatchTitle')}
                    </h3>
                    <div className="recipes-grid">
                      {slicedGood.map(r => (
                        <RecipeCard key={r.id} recipe={r} selectedIds={selectedIds} targetServings={filters.servings} />
                      ))}
                    </div>
                    {good.length > visibleGood && (
                      <div style={{ textAlign: 'center', marginTop: '20px' }}>
                        <button 
                          className="btn btn-secondary glass-panel" 
                          onClick={() => setVisibleGood(prev => prev + 8)}
                          id="show-more-good-btn"
                        >
                          {t('showMore')} ({good.length - visibleGood} {language === 'bn' ? 'অন্যান্য' : 'more'})
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* D. Exploratory Matches */}
                {exploratory.length > 0 && (
                  <div className="match-section" id="exploratory-matches-section" style={{ marginBottom: '36px' }}>
                    <h3 className="match-section-title" style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: '16px' }}>
                      {t('exploreMoreTitle')}
                    </h3>
                    <div className="recipes-grid">
                      {slicedExploratory.map(r => (
                        <RecipeCard key={r.id} recipe={r} selectedIds={selectedIds} targetServings={filters.servings} />
                      ))}
                    </div>
                    {exploratory.length > visibleExploratory && (
                      <div style={{ textAlign: 'center', marginTop: '20px' }}>
                        <button 
                          className="btn btn-secondary glass-panel" 
                          onClick={() => setVisibleExploratory(prev => prev + 8)}
                          id="show-more-exploratory-btn"
                        >
                          {t('showMore')} ({exploratory.length - visibleExploratory} {language === 'bn' ? 'অন্যান্য' : 'more'})
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Mobile Floating Action Button (FAB) for Filters */}
      {selectedIds.length > 0 && (
        <button
          type="button"
          className="mobile-filter-fab"
          onClick={() => setIsMobileFilterOpen(true)}
          aria-label="Open Filters"
          id="mobile-filter-fab-btn"
        >
          <Filter size={18} />
          <span>{t('filters')}</span>
          {activeFiltersCount > 0 && (
            <span className="mobile-filter-fab-badge">
              {language === 'bn' ? toBengaliNumber(activeFiltersCount) : activeFiltersCount}
            </span>
          )}
        </button>
      )}

      {/* Mobile Slide-Up Drawer for Filters */}
      {isMobileFilterOpen && (
        <div 
          className="mobile-filter-overlay"
          onClick={() => setIsMobileFilterOpen(false)}
          id="mobile-filter-overlay"
        >
          <div 
            className="mobile-filter-drawer"
            onClick={(e) => e.stopPropagation()}
            id="mobile-filter-drawer"
            role="dialog"
            aria-modal="true"
            aria-label={t('filters')}
          >
            <div className="mobile-drawer-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Filter size={18} style={{ color: 'var(--brand-orange)' }} />
                <h3 style={{ margin: 0, fontSize: '1.15rem' }}>{t('filters')}</h3>
                {activeFiltersCount > 0 && (
                  <span className="badge" style={{ background: 'var(--brand-orange)', color: '#fff', fontSize: '0.75rem', padding: '2px 8px', borderRadius: '12px' }}>
                    {language === 'bn' ? toBengaliNumber(activeFiltersCount) : activeFiltersCount}
                  </span>
                )}
              </div>
              <button 
                type="button"
                className="mobile-drawer-close"
                onClick={() => setIsMobileFilterOpen(false)}
                aria-label="Close Filters Drawer"
                id="close-mobile-filter-drawer-btn"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mobile-drawer-body">
              <FilterPanel filters={filters} onChange={setFilters} />
            </div>

            <div className="mobile-drawer-footer">
              <button 
                type="button"
                className="btn btn-primary"
                style={{ width: '100%', minHeight: '48px', fontSize: '1rem', fontWeight: 700 }}
                onClick={() => setIsMobileFilterOpen(false)}
                id="apply-mobile-filters-btn"
              >
                {language === 'bn' ? `ফলাফল দেখুন (${toBengaliNumber(totalCount)}টি)` : `View Results (${totalCount})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default SearchResultsPage
