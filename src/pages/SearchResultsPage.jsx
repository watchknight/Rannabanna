import React, { useState, useMemo } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import FilterPanel from '../components/FilterPanel'
import RecipeCard from '../components/RecipeCard'
import { useRecipeMatcher } from '../hooks/useRecipeMatcher'
import { useDatabase } from '../context/DatabaseContext'
import { generateLocalCustomRecipe } from '../utils/customChefEngine'
import { API_BASE } from '../utils/apiConfig.js'

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

  // Compute total active filters count
  const activeFilterCount = useMemo(() => {
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

    // Render free-tier spin up takes 30-50s; allow 75s before client abort
    const controller = new AbortController()
    const timeoutId = setTimeout(() => {
      controller.abort()
    }, 75000)

    // Flag cold start if server takes longer than 6s to respond
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

      // Persist into localStorage so custom recipe survives page refresh and Render container spin-down
      try {
        const stored = JSON.parse(localStorage.getItem('rannabanna-custom-recipes') || '[]')
        const updated = [generated, ...stored.filter(r => r.id !== generated.id)].slice(0, 50)
        localStorage.setItem('rannabanna-custom-recipes', JSON.stringify(updated))
      } catch {}

      // Seed dynamically into the local React state database
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

  // Categories lists sliced for dynamic rendering
  const slicedPerfect = useMemo(() => perfect.slice(0, visiblePerfect), [perfect, visiblePerfect])
  const slicedGreat = useMemo(() => great.slice(0, visibleGreat), [great, visibleGreat])
  const slicedGood = useMemo(() => good.slice(0, visibleGood), [good, visibleGood])
  const slicedExploratory = useMemo(() => exploratory.slice(0, visibleExploratory), [exploratory, visibleExploratory])

  return (
    <div className="search-results-page animate-fade-in" id="search-results-root">
      {/* Upper header */}
      <div 
        className="search-summary-card"
        id="search-summary-card"
      >
        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: '700' }}>
          {t('searchingWith')} {language === 'bn' ? toBengaliNumber(selectedIds.length) : selectedIds.length} {language === 'bn' ? 'টি উপকরণ' : (selectedIds.length === 1 ? 'ingredient' : 'ingredients')}
        </span>
        
        {/* Visual Removable Chips */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-xs)', marginTop: 'var(--spacing-sm)', marginBottom: 'var(--spacing-md)' }}>
          {selectedObjects.map(ing => {
            const displayName = language === 'bn' ? (ing.nameBn || ing.name) : ing.name
            return (
              <div 
                key={ing.id} 
                className="selected-tag" 
                style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                id={`search-ing-tag-${ing.id}`}
              >
                <span>{ing.emoji} {displayName}</span>
                <button onClick={() => handleRemoveIngredient(ing.id)}>✕</button>
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
              padding: '6px' 
            }}
            id="add-more-ingredients-link"
          >
            {language === 'bn' ? '➕ তালিকা পরিবর্তন' : '➕ Modify List'}
          </Link>
        </div>

        <h2 className="search-summary-title">
          {t('foundRecipes', { count: totalCount })}
        </h2>

        {isOffline && (
          <div 
            style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: '6px', 
              padding: '4px 10px', 
              borderRadius: 'var(--radius-sm)', 
              background: 'rgba(245, 158, 11, 0.1)', 
              color: '#fbbf24', 
              fontSize: '0.8rem', 
              marginTop: 'var(--spacing-xs)' 
            }}
            id="offline-mode-indicator"
          >
            <span>📡</span>
            <span>{language === 'bn' ? 'অফলাইন মোড সক্রিয় (স্থানীয় ডাটাবেস ব্যবহৃত হচ্ছে)' : 'Offline mode active (using local database)'}</span>
          </div>
        )}

        {error && totalCount === 0 && !loading && (
          <div 
            style={{ 
              padding: 'var(--spacing-md)', 
              borderRadius: 'var(--radius-md)', 
              background: 'rgba(239, 68, 68, 0.1)', 
              border: '1px solid rgba(239, 68, 68, 0.3)', 
              color: '#f87171', 
              marginTop: 'var(--spacing-md)' 
            }}
            id="search-error-banner"
          >
            ⚠️ {language === 'bn' ? 'রেসিপি লোড করতে সমস্যা হয়েছে। অনুগ্রহ করে পুনরায় চেষ্টা করুন।' : 'Unable to load recipes. Please try again.'}
          </div>
        )}
      </div>

      {selectedIds.length === 0 ? (
        /* Empty State */
        <div className="empty-state glass-panel animate-scale-in" id="empty-search-state">
          <div className="empty-state-emoji">🍳</div>
          <h3>{t('emptyKitchenTitle')}</h3>
          <p>{t('emptyKitchenDesc')}</p>
          <Link to="/" className="btn btn-primary" id="empty-state-home-btn">
            {t('chooseIngredientsBtn')}
          </Link>
        </div>
      ) : (
        /* Main search grid with filter panel */
        <div className="search-page-container">
          <FilterPanel filters={filters} onChange={setFilters} />

          <div className="search-results-content">
            {/* Bespoke Chef Integration */}
            <div className="custom-chef-banner glass-panel animate-slide-up" style={{
              padding: 'var(--spacing-md) var(--spacing-lg)',
              marginBottom: 'var(--spacing-md)',
              borderRadius: 'var(--radius-md)',
              border: '1px dashed var(--brand-pink)',
              background: 'linear-gradient(135deg, rgba(233, 30, 99, 0.05) 0%, rgba(255, 107, 53, 0.05) 100%)',
              position: 'relative',
              overflow: 'hidden'
            }} id="custom-chef-trigger-box">
              <div style={{ display: 'flex', gap: 'var(--spacing-md)', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ fontSize: '2.5rem' }}>👩‍🍳</div>
                <div className="custom-chef-content" style={{ flex: '1', minWidth: '180px' }}>
                  <h4 style={{ margin: '0 0 4px 0', fontSize: '1.15rem', color: 'var(--brand-pink)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {t('bespokeChefTitle')}
                  </h4>
                  <p style={{ margin: '0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                    {t('bespokeChefDesc')}
                  </p>
                </div>
                <div className="custom-chef-actions">
                  <button 
                    className="btn btn-primary" 
                    onClick={handleGenerateCustom}
                    disabled={customGenerating}
                    style={{
                      background: 'var(--gradient-brand)',
                      border: 'none',
                      boxShadow: 'var(--shadow-neon)',
                      padding: '10px 18px',
                      fontSize: '0.9rem',
                      fontWeight: '600',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                    id="trigger-custom-chef-btn"
                  >
                    {customGenerating ? (
                      <>
                        <span className="animate-spin" style={{ display: 'inline-block' }}>✨</span>
                        <span>{t('generatingCustomBtn')}</span>
                      </>
                    ) : (
                      <>
                        <span>🪄</span>
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
                    marginTop: 'var(--spacing-md)', 
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-sm)',
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
                    <span>⚠️</span>
                    <span>{customError}</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleGenerateCustom}
                    className="btn btn-secondary"
                    style={{ fontSize: '0.8rem', padding: '4px 10px', height: 'auto', minHeight: 'unset' }}
                    id="custom-chef-retry-btn"
                  >
                    🔄 {t('tryAgainBtn')}
                  </button>
                </div>
              )}
            </div>

            {/* Active Loading State while waiting for Gemini 3.8 Flash */}
            {customGenerating && (
              <div 
                className="match-section glass-panel animate-pulse" 
                style={{
                  border: '2px dashed var(--brand-pink)',
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--spacing-xl)',
                  marginBottom: 'var(--spacing-xl)',
                  textAlign: 'center',
                  background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.08) 0%, rgba(219, 39, 119, 0.08) 100%)',
                  boxShadow: '0 4px 20px rgba(124, 58, 237, 0.15)'
                }}
                id="custom-recipe-generating-indicator"
              >
                <div style={{ fontSize: '2.6rem', marginBottom: 'var(--spacing-xs)' }} className="animate-bounce">
                  ✨👩‍🍳
                </div>
                <h3 style={{ margin: '0 0 6px 0', color: 'var(--brand-pink)', fontSize: '1.2rem' }}>
                  {language === 'bn' ? 'জেমিনি এআই শেফ আপনার কাস্টম রেসিপি প্রস্তুত করছে...' : 'Gemini AI Chef is crafting your custom recipe...'}
                </h3>
                <p style={{ margin: '0 auto', color: 'var(--text-secondary)', fontSize: '0.88rem', maxWidth: '520px' }}>
                  {language === 'bn' 
                    ? 'আপনার নির্বাচিত উপকরণ ও ফিল্টারের ওপর ভিত্তি করে বাস্তবসম্মত, সুস্বাদু রান্নাপ্রণালী তৈরি হচ্ছে।' 
                    : 'Analyzing your selected ingredients and cooking preferences to engineer a delicious, authentic step-by-step recipe.'}
                </p>
                {isColdStarting && (
                  <div style={{
                    marginTop: 'var(--spacing-md)',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'rgba(245, 158, 11, 0.12)',
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                    color: '#fbbf24',
                    fontSize: '0.82rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }} id="cold-start-notice">
                    <span>⏳</span>
                    <span>{language === 'bn' 
                      ? 'রেন্ডার সার্ভার স্লিপ মোড থেকে চালু হচ্ছে (~৩০-৪৫ সেকেন্ড লাগতে পারে)... অনুগ্রহ করে অপেক্ষা করুন।' 
                      : 'Render server is waking up from sleep (~30-45s cold start)... Hang tight, crafting your recipe!'}</span>
                  </div>
                )}
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: 'var(--spacing-md)', fontSize: '0.78rem', color: '#A78BFA' }}>
                  <span className="animate-spin" style={{ display: 'inline-block' }}>⚡</span>
                  <span>{language === 'bn' ? 'মডেল: জেমিনি ৩.৮ ফ্ল্যাশ' : 'Powered by Gemini 3.8 Flash'}</span>
                </div>
              </div>
            )}

            {/* Display generated Custom Recipe as featured section */}
            {customRecipe && (
              <div className="match-section" style={{
                border: '2px solid var(--brand-pink)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--spacing-md)',
                marginBottom: 'var(--spacing-xl)',
                background: 'rgba(255, 255, 255, 0.01)',
                boxShadow: 'var(--shadow-neon)'
              }} id="custom-recipe-featured-section">
                <h3 className="match-section-title" style={{ color: 'var(--brand-pink)' }}>
                  <span>✨</span> {t('customRecipeFeaturedTitle')}
                </h3>
                <div className="recipes-grid" style={{ gridTemplateColumns: '1fr' }}>
                  <RecipeCard recipe={customRecipe} selectedIds={selectedIds} isCustomBespoke={true} />
                </div>
              </div>
            )}

            {loading ? (
              <div className="match-section" id="search-loading-skeletons">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: 'var(--spacing-md)' }}>
                  <span className="animate-spin" style={{ display: 'inline-block', fontSize: '1.4rem' }}>🍲</span>
                  <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--text-secondary)' }}>
                    {t('calculatingMatchesTitle')}
                  </h3>
                </div>
                <div className="recipes-grid">
                  {[1, 2, 3, 4, 5, 6].map(n => (
                    <div 
                      key={n} 
                      className="recipe-card glass-panel animate-pulse" 
                      style={{ 
                        minHeight: '230px', 
                        display: 'flex', 
                        flexDirection: 'column', 
                        justifyContent: 'space-between', 
                        padding: 'var(--spacing-lg)' 
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
                        <div style={{ width: '68px', height: '22px', borderRadius: '12px', background: 'rgba(255,255,255,0.06)' }} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', margin: 'var(--spacing-md) 0' }}>
                        <div style={{ width: '85%', height: '20px', borderRadius: '4px', background: 'rgba(255,255,255,0.08)' }} />
                        <div style={{ width: '55%', height: '14px', borderRadius: '4px', background: 'rgba(255,255,255,0.04)' }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                        <div style={{ width: '60px', height: '12px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)' }} />
                        <div style={{ width: '60px', height: '12px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)' }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : totalCount === 0 ? (
              <div className="empty-state glass-panel animate-scale-in" id="no-recipes-match-card">
                <div className="empty-state-emoji">🍲</div>
                <h3>{t('noMatchesTitle')}</h3>
                <p>{t('noMatchesDesc')}</p>
                <button 
                  className="btn btn-primary"
                  onClick={handleGenerateCustom}
                  disabled={customGenerating}
                  id="empty-state-custom-chef-btn"
                  style={{ 
                    marginTop: 'var(--spacing-md)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  {customGenerating ? (
                    <>
                      <span className="animate-spin" style={{ display: 'inline-block' }}>✨</span>
                      <span>{t('generatingCustomBtn')}</span>
                    </>
                  ) : (
                    <>
                      <span>🪄</span>
                      <span>{t('generateCustomBtn')}</span>
                    </>
                  )}
                </button>
              </div>
            ) : (
              <>
                {/* A. Perfect Matches */}
                {perfect.length > 0 && (
                  <div className="match-section" id="perfect-matches-section">
                    <h3 className="match-section-title">
                      {t('perfectMatchTitle')}
                    </h3>
                    <div className="recipes-grid">
                      {slicedPerfect.map(r => (
                        <RecipeCard key={r.id} recipe={r} selectedIds={selectedIds} targetServings={filters.servings} />
                      ))}
                    </div>
                    {perfect.length > visiblePerfect && (
                      <div style={{ textAlign: 'center', marginTop: 'var(--spacing-md)' }}>
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

                {/* B. Great Matches */}
                {great.length > 0 && (
                  <div className="match-section" id="great-matches-section">
                    <h3 className="match-section-title">
                      {t('greatMatchTitle')}
                    </h3>
                    <div className="recipes-grid">
                      {slicedGreat.map(r => (
                        <RecipeCard key={r.id} recipe={r} selectedIds={selectedIds} targetServings={filters.servings} />
                      ))}
                    </div>
                    {great.length > visibleGreat && (
                      <div style={{ textAlign: 'center', marginTop: 'var(--spacing-md)' }}>
                        <button 
                          className="btn btn-secondary glass-panel" 
                          onClick={() => setVisibleGreat(prev => prev + 8)}
                          id="show-more-great-btn"
                        >
                          {t('showMore')} ({language === 'bn' ? toBengaliNumber(great.length - visibleGreat) : (great.length - visibleGreat)} {language === 'bn' ? 'অন্যান্য' : 'more'})
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* C. Good Matches */}
                {good.length > 0 && (
                  <div className="match-section" id="good-matches-section">
                    <h3 className="match-section-title">
                      {t('goodMatchTitle')}
                    </h3>
                    <div className="recipes-grid">
                      {slicedGood.map(r => (
                        <RecipeCard key={r.id} recipe={r} selectedIds={selectedIds} targetServings={filters.servings} />
                      ))}
                    </div>
                    {good.length > visibleGood && (
                      <div style={{ textAlign: 'center', marginTop: 'var(--spacing-md)' }}>
                        <button 
                          className="btn btn-secondary glass-panel" 
                          onClick={() => setVisibleGood(prev => prev + 8)}
                          id="show-more-good-btn"
                        >
                          {t('showMore')} ({language === 'bn' ? toBengaliNumber(good.length - visibleGood) : (good.length - visibleGood)} {language === 'bn' ? 'অন্যান্য' : 'more'})
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* D. Exploratory Matches */}
                {exploratory.length > 0 && (
                  <div className="match-section" id="exploratory-matches-section">
                    <h3 className="match-section-title">
                      {t('exploratoryMatchTitle')}
                    </h3>
                    <div className="recipes-grid">
                      {slicedExploratory.map(r => (
                        <RecipeCard key={r.id} recipe={r} selectedIds={selectedIds} targetServings={filters.servings} />
                      ))}
                    </div>
                    {exploratory.length > visibleExploratory && (
                      <div style={{ textAlign: 'center', marginTop: 'var(--spacing-md)' }}>
                        <button 
                          className="btn btn-secondary glass-panel" 
                          onClick={() => setVisibleExploratory(prev => prev + 8)}
                          id="show-more-exploratory-btn"
                        >
                          {t('showMore')} ({language === 'bn' ? toBengaliNumber(exploratory.length - visibleExploratory) : (exploratory.length - visibleExploratory)} {language === 'bn' ? 'অন্যান্য' : 'more'})
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

      {/* Mobile Floating Filter Button */}
      {selectedIds.length > 0 && (
        <button 
          type="button"
          className="mobile-filter-fab" 
          onClick={() => setIsMobileFilterOpen(true)}
          aria-label="Open Filter Panel"
          id="mobile-filter-fab-btn"
        >
          <span>⚙️ {t('filters')}</span>
          {activeFilterCount > 0 && (
            <span className="mobile-filter-fab-badge">{activeFilterCount}</span>
          )}
        </button>
      )}

      {/* Mobile Filter Slide-up Drawer */}
      {isMobileFilterOpen && (
        <div className="mobile-filter-overlay" onClick={() => setIsMobileFilterOpen(false)} id="mobile-filter-modal-overlay">
          <div className="mobile-filter-drawer animate-slide-up" onClick={(e) => e.stopPropagation()} id="mobile-filter-drawer-panel">
            <div className="mobile-drawer-header">
              <h3 style={{ margin: 0, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                ⚙️ {t('filters')} {activeFilterCount > 0 && `(${activeFilterCount})`}
              </h3>
              <button 
                type="button"
                className="mobile-drawer-close" 
                onClick={() => setIsMobileFilterOpen(false)}
                aria-label="Close Filters"
                id="close-mobile-filter-drawer-btn"
              >
                ✕
              </button>
            </div>
            <div className="mobile-drawer-body">
              <FilterPanel filters={filters} onChange={setFilters} />
            </div>
            <div className="mobile-drawer-footer">
              <button 
                type="button"
                className="btn btn-primary" 
                style={{ width: '100%', padding: '14px', fontSize: '1rem', fontWeight: '700' }}
                onClick={() => setIsMobileFilterOpen(false)}
                id="apply-mobile-filters-btn"
              >
                {language === 'bn' ? `ফলাফল দেখুন (${toBengaliNumber(totalCount)})` : `View Results (${totalCount})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default SearchResultsPage
