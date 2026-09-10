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

  const handleGenerateCustom = async () => {
    if (selectedIds.length === 0) return
    setCustomGenerating(true)
    setCustomError(null)

    // Set up AbortController with generous timeout for AI generation (25 seconds)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => {
      controller.abort()
    }, 25000)

    try {
      const response = await fetch(`${API_BASE}/api/custom-recipe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ ingredientIds: selectedIds }),
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error('Failed to generate bespoke recipe')
      }

      const data = await response.json()
      // Seed dynamically into the local React state database
      addCustomRecipeToLocalState(data)
      setCustomRecipe(data)
    } catch (err) {
      clearTimeout(timeoutId)
      const isTimeout = err.name === 'AbortError'
      console.warn(
        isTimeout 
          ? 'Backend custom recipe call timed out (1500ms limit reached). Falling back to high-precision local expert engine...'
          : 'Backend custom recipe call failed. Falling back to high-precision local expert engine:', 
        err
      )

      // Zero-lag instant local generation fallback
      try {
        const localRecipe = generateLocalCustomRecipe(selectedObjects, 'any')
        if (localRecipe) {
          // Assign a unique client-side custom ID to support deep-linking
          localRecipe.id = `custom-local-${Date.now()}-${Math.floor(Math.random() * 1000)}`
          
          // Seed the fully detailed custom recipe in context
          addCustomRecipeToLocalState(localRecipe)
          setCustomRecipe(localRecipe)
        } else {
          throw new Error('Local chef engine could not process selected ingredients')
        }
      } catch (localErr) {
        console.error('Local recipe generator failed:', localErr)
        setCustomError('Could not generate custom recipe')
      }
    } finally {
      setCustomGenerating(false)
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
                <div style={{ flex: '1', minWidth: '250px' }}>
                  <h4 style={{ margin: '0 0 4px 0', fontSize: '1.15rem', color: 'var(--brand-pink)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {t('bespokeChefTitle')}
                  </h4>
                  <p style={{ margin: '0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                    {t('bespokeChefDesc')}
                  </p>
                </div>
                <div>
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
                      fontWeight: '600'
                    }}
                    id="trigger-custom-chef-btn"
                  >
                    {customGenerating ? t('generatingCustomBtn') : t('generateCustomBtn')}
                  </button>
                </div>
              </div>

              {customError && (
                <div style={{ marginTop: 'var(--spacing-md)', color: '#FF3B30', fontSize: '0.85rem' }} id="custom-chef-error">
                  {t('customChefError')}
                </div>
              )}
            </div>

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
                  style={{ marginTop: 'var(--spacing-md)' }}
                >
                  {customGenerating ? t('generatingCustomBtn') : t('generateCustomBtn')}
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
