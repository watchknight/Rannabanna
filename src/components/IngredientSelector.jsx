import React, { useState, useMemo, useEffect, useRef, useCallback, useDeferredValue } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, X, Check, Plus, LayoutGrid, List, ArrowRight } from 'lucide-react'
import { useDatabase } from '../context/DatabaseContext'
import { translateCategory } from '../utils/translations'
import { matchIngredient } from '../utils/ingredientResolver'
import { getIngredientImage, getCategoryFallback } from '../utils/imageAssets'
import { getCategoryIcon } from '../utils/categoryIcons'

// Common Kitchen Staples for 1-Tap Quick Assembly
const QUICK_STAPLES = [
  { id: 'onion-red', name: 'Red Onion', nameBn: 'লাল পেঁয়াজ', category: 'Vegetables' },
  { id: 'garlic', name: 'Garlic', nameBn: 'রসুন', category: 'Vegetables' },
  { id: 'ginger', name: 'Ginger', nameBn: 'আদা', category: 'Vegetables' },
  { id: 'salt', name: 'Salt', nameBn: 'লবণ', category: 'Spices & Seasonings' },
  { id: 'olive-oil', name: 'Olive Oil', nameBn: 'অলিভ অয়েল', category: 'Sauces, Condiments & Pastes' },
  { id: 'egg', name: 'Egg', nameBn: 'ডিম', category: 'Proteins' },
  { id: 'rice-basmati', name: 'Basmati Rice', nameBn: 'বাসমতী চাল', category: 'Grains & Starches' },
  { id: 'chicken-breast', name: 'Chicken Breast', nameBn: 'চিকেন ব্রেস্ট', category: 'Proteins' }
]

// Brian Lovin & Awwwards Studio Photographic Card (Grid View)
// Features unobstructed high-res photography and a clean lower metadata compartment (Zero Murky Gradients)
const IngredientPhotoCard = React.memo(({ ing, isSelected, language, onClick }) => {
  const primaryName = language === 'bn' ? (ing.nameBn || ing.name) : ing.name;
  const secondaryName = language === 'bn' ? ing.name : (ing.nameBn || '');
  const imageUrl = getIngredientImage(ing.id, ing.category);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick(ing.id);
    }
  };

  return (
    <div
      className={`ingredient-photo-card ${isSelected ? 'selected' : ''}`}
      onClick={() => onClick(ing.id)}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-pressed={isSelected}
      aria-label={primaryName}
      id={`ingredient-card-${ing.id}`}
    >
      {/* Top Unobstructed Photo Frame */}
      <div className="ingredient-card-media-wrap">
        <img
          src={imageUrl}
          alt={primaryName}
          loading="lazy"
          decoding="async"
          className="ingredient-card-image"
          onError={(e) => {
            e.currentTarget.onerror = null;
            e.currentTarget.src = getCategoryFallback(ing.category);
          }}
        />

        {/* Selected Check Indicator or Subtle Plus */}
        <div className={`ingredient-card-select-indicator ${isSelected ? 'active' : ''}`}>
          {isSelected ? <Check size={12} strokeWidth={3} /> : <Plus size={12} strokeWidth={2.5} />}
        </div>

        {/* Category Pill Tag */}
        <div className="ingredient-card-category-tag">
          {getCategoryIcon(ing.category, 'w-2.5 h-2.5')}
          <span>{translateCategory(ing.category, language)}</span>
        </div>
      </div>

      {/* Clean Lower Metadata Compartment */}
      <div className="ingredient-card-meta">
        <div className="ingredient-card-name-title">{primaryName}</div>
        {secondaryName && (
          <div className="ingredient-card-name-sub">{secondaryName}</div>
        )}
      </div>
    </div>
  )
})

// Brian Lovin Dense Scannable Row (List View)
const IngredientListRow = React.memo(({ ing, isSelected, language, onClick }) => {
  const primaryName = language === 'bn' ? (ing.nameBn || ing.name) : ing.name;
  const secondaryName = language === 'bn' ? ing.name : (ing.nameBn || '');
  const imageUrl = getIngredientImage(ing.id, ing.category);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick(ing.id);
    }
  };

  return (
    <div
      className={`ingredient-list-row ${isSelected ? 'selected' : ''}`}
      onClick={() => onClick(ing.id)}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-pressed={isSelected}
      aria-label={primaryName}
      id={`ingredient-row-${ing.id}`}
    >
      <div className="ingredient-row-left">
        <img
          src={imageUrl}
          alt={primaryName}
          loading="lazy"
          decoding="async"
          className="ingredient-row-avatar"
          onError={(e) => {
            e.currentTarget.onerror = null;
            e.currentTarget.src = getCategoryFallback(ing.category);
          }}
        />
        <div className="ingredient-row-names">
          <span className="ingredient-row-primary">{primaryName}</span>
          {secondaryName && <span className="ingredient-row-secondary">{secondaryName}</span>}
        </div>
      </div>

      <div className="ingredient-row-right">
        <span className="ingredient-row-cat-badge">
          {getCategoryIcon(ing.category, 'w-3 h-3')}
          <span>{translateCategory(ing.category, language)}</span>
        </span>
        <div className={`ingredient-row-toggle-box ${isSelected ? 'active' : ''}`}>
          {isSelected ? <Check size={14} strokeWidth={3} /> : <Plus size={14} strokeWidth={2} />}
        </div>
      </div>
    </div>
  )
})

function IngredientSelector({ initialSelectedIds = [] }) {
  const { ingredients, language, t, toBengaliNumber } = useDatabase()
  const navigate = useNavigate()
  const dropdownRef = useRef(null)

  const [selectedIds, setSelectedIds] = useState(initialSelectedIds)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState('All')
  const [viewMode, setViewMode] = useState('grid') // 'grid' | 'list'
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)

  // Top-level categories derived dynamically
  const categories = useMemo(() => {
    const cats = new Set(ingredients.map(ing => ing.category).filter(Boolean))
    return ['All', ...Array.from(cats)]
  }, [ingredients])

  // Sync initial selections if they change
  const initialSelectedIdsStr = initialSelectedIds.join(',')
  useEffect(() => {
    setSelectedIds(initialSelectedIds)
  }, [initialSelectedIdsStr])

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Toggle ingredient selection
  const toggleIngredient = useCallback((id) => {
    setSelectedIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(item => item !== id)
      } else {
        return [...prev, id]
      }
    })
    setSearchQuery('')
    setIsDropdownOpen(false)
  }, [])

  // Clear all selections
  const clearAll = useCallback(() => {
    setSelectedIds([])
  }, [])

  // Filtered ingredients for the grid / list display
  const displayIngredients = useMemo(() => {
    return ingredients.filter(ing => {
      if (activeCategory === 'All') return true
      return ing.category === activeCategory
    })
  }, [activeCategory, ingredients])

  // Deferred search query prevents main thread input lag (0ms INP)
  const deferredSearchQuery = useDeferredValue(searchQuery)

  // Autocomplete filtering with real photo thumbnail
  const autocompleteSuggestions = useMemo(() => {
    if (!deferredSearchQuery.trim()) return []
    return ingredients.filter(ing => matchIngredient(ing, deferredSearchQuery, language)).slice(0, 8)
  }, [deferredSearchQuery, ingredients, language])

  // Selected full objects
  const selectedObjects = useMemo(() => {
    return selectedIds.map(id => ingredients.find(ing => ing.id === id)).filter(Boolean)
  }, [selectedIds, ingredients])

  // Trigger search navigation
  const handleFindRecipes = () => {
    if (selectedIds.length === 0) return
    navigate(`/search?ingredients=${selectedIds.join(',')}`)
  }

  return (
    <div className="ingredient-selector-root" id="ingredient-selector-panel" style={{ width: '100%' }}>
      
      {/* 1-Tap Quick Essentials Bar (Kitchen Staples) */}
      <div className="quick-essentials-section">
        <div className="quick-essentials-header">
          <span className="quick-essentials-title">
            {language === 'bn' ? 'নিত্য প্রয়োজনীয় উপাদান' : 'Kitchen Staples'}
          </span>
          <span className="quick-essentials-subtitle">
            {language === 'bn' ? '১-ক্লিকে যোগ করুন' : '1-tap quick add'}
          </span>
        </div>
        <div className="quick-essentials-strip" id="quick-essentials-strip">
          {QUICK_STAPLES.map(staple => {
            const isSelected = selectedIds.includes(staple.id);
            const label = language === 'bn' ? staple.nameBn : staple.name;
            const img = getIngredientImage(staple.id, staple.category);
            return (
              <button
                key={staple.id}
                type="button"
                className={`essential-chip ${isSelected ? 'active' : ''}`}
                onClick={() => toggleIngredient(staple.id)}
                aria-pressed={isSelected}
                id={`essential-chip-${staple.id}`}
              >
                <img 
                  src={img} 
                  alt={label} 
                  loading="lazy"
                  decoding="async"
                  className="essential-chip-img" 
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = getCategoryFallback(staple.category);
                  }}
                />
                <span className="essential-chip-name">{label}</span>
                {isSelected ? (
                  <Check size={12} strokeWidth={3} className="essential-chip-icon" />
                ) : (
                  <Plus size={12} strokeWidth={2.5} className="essential-chip-icon plus" />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Integrated Search Input & View Mode Controls */}
      <div className="selector-toolbar-row">
        <div className="selector-search-box" ref={dropdownRef}>
          <div className="search-input-wrapper">
            <Search size={18} className="search-input-icon" />
            <label htmlFor="ingredient-search-input" className="sr-only">
              {language === 'bn' ? 'উপকরণ অনুসন্ধান করুন' : 'Search ingredients'}
            </label>
            <input
              type="text"
              placeholder={language === 'bn' ? 'উপাদান অনুসন্ধান করুন (যেমন: চিকেন, রসুন, টমেটো)...' : 'Search ingredients (e.g. Chicken, Garlic, Tomato)...'}
              aria-label={language === 'bn' ? 'উপকরণ অনুসন্ধান করুন' : 'Search ingredients'}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setIsDropdownOpen(true)
              }}
              onFocus={() => setIsDropdownOpen(true)}
              id="ingredient-search-input"
            />
            {searchQuery && (
              <button 
                type="button"
                className="clear-search-btn" 
                onClick={() => setSearchQuery('')}
                aria-label={language === 'bn' ? 'অনুসন্ধান মুছুন' : 'Clear search'}
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Autocomplete Dropdown with Real Image Thumbnails */}
          {isDropdownOpen && autocompleteSuggestions.length > 0 && (
            <div className="autocomplete-dropdown" id="search-autocomplete-dropdown" role="listbox">
              {autocompleteSuggestions.map(ing => {
                const displayName = language === 'bn' ? (ing.nameBn || ing.name) : ing.name;
                const imgUrl = getIngredientImage(ing.id, ing.category);
                const isSelected = selectedIds.includes(ing.id);

                return (
                  <div 
                    key={ing.id}
                    className={`autocomplete-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => toggleIngredient(ing.id)}
                    role="option"
                    aria-selected={isSelected}
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleIngredient(ing.id); } }}
                  >
                    <img
                      src={imgUrl}
                      alt={displayName}
                      loading="lazy"
                      decoding="async"
                      className="autocomplete-item-thumb"
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = getCategoryFallback(ing.category);
                      }}
                    />
                    <div className="autocomplete-item-details">
                      <div className="autocomplete-item-name">{displayName}</div>
                      <div className="autocomplete-item-category">
                        {translateCategory(ing.category, language)}
                      </div>
                    </div>
                    {isSelected && <Check size={16} className="autocomplete-item-checked" />}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Brian Lovin Dual View Switcher (Grid Gallery vs Compact List) */}
        <div className="view-mode-toggle" role="group" aria-label="Catalog View Mode">
          <button
            type="button"
            className={`view-mode-btn ${viewMode === 'grid' ? 'active' : ''}`}
            onClick={() => setViewMode('grid')}
            aria-pressed={viewMode === 'grid'}
            title={language === 'bn' ? 'গ্যালারি ভিউ' : 'Grid Gallery View'}
            id="view-mode-grid-btn"
          >
            <LayoutGrid size={15} />
            <span className="view-mode-btn-text">{language === 'bn' ? 'গ্যালারি' : 'Grid'}</span>
          </button>
          <button
            type="button"
            className={`view-mode-btn ${viewMode === 'list' ? 'active' : ''}`}
            onClick={() => setViewMode('list')}
            aria-pressed={viewMode === 'list'}
            title={language === 'bn' ? 'তালিকা ভিউ' : 'Scannable List View'}
            id="view-mode-list-btn"
          >
            <List size={15} />
            <span className="view-mode-btn-text">{language === 'bn' ? 'তালিকা' : 'List'}</span>
          </button>
        </div>
      </div>

      {/* Category Selection Pills Bar */}
      <div className="category-pills-bar" id="category-pills-bar" role="tablist">
        {categories.map(cat => (
          <button
            key={cat}
            type="button"
            role="tab"
            aria-selected={activeCategory === cat}
            className={`category-pill ${activeCategory === cat ? 'active' : ''}`}
            onClick={() => setActiveCategory(cat)}
            id={`category-pill-${cat.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
          >
            {getCategoryIcon(cat, 'w-4 h-4')}
            <span>{cat === 'All' ? (language === 'bn' ? 'সব' : 'All') : translateCategory(cat, language)}</span>
          </button>
        ))}
      </div>

      {/* Category Status & Item Counter Bar */}
      <div className="catalog-status-bar">
        <span className="catalog-status-count">
          {activeCategory === 'All' 
            ? (language === 'bn' ? `সকল উপাদান (${toBengaliNumber(displayIngredients.length)}টি)` : `All Ingredients (${displayIngredients.length})`)
            : `${translateCategory(activeCategory, language)} (${language === 'bn' ? toBengaliNumber(displayIngredients.length) : displayIngredients.length})`
          }
        </span>
        {selectedIds.length > 0 && (
          <span className="catalog-status-selected">
            {language === 'bn' ? `${toBengaliNumber(selectedIds.length)}টি উপাদান নির্বাচিত` : `${selectedIds.length} selected`}
          </span>
        )}
      </div>

      {/* Contained Scroll Viewport (Eliminating long scrolling) */}
      <div className="ingredient-catalog-viewport" id="ingredient-catalog-viewport">
        {/* Mode A: Real Photography Ingredient Cards Grid */}
        {viewMode === 'grid' ? (
          <div className="ingredient-cards-grid" id="ingredient-cards-grid">
            {displayIngredients.map(ing => (
              <IngredientPhotoCard
                key={ing.id}
                ing={ing}
                isSelected={selectedIds.includes(ing.id)}
                language={language}
                onClick={toggleIngredient}
              />
            ))}
          </div>
        ) : (
          /* Mode B: Brian Lovin Dense Scannable List */
          <div className="ingredient-list-table" id="ingredient-list-table">
            {displayIngredients.map(ing => (
              <IngredientListRow
                key={ing.id}
                ing={ing}
                isSelected={selectedIds.includes(ing.id)}
                language={language}
                onClick={toggleIngredient}
              />
            ))}
          </div>
        )}
      </div>

      {/* Docked Selection Floating Action Bar */}
      {selectedIds.length > 0 && (
        <div className="docked-selection-bar" id="docked-selection-bar">
          <div className="docked-avatars-group" aria-hidden="true">
            {selectedObjects.slice(0, 4).map(ing => (
              <img
                key={ing.id}
                src={getIngredientImage(ing.id, ing.category)}
                alt={ing.name}
                className="docked-avatar-img"
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = getCategoryFallback(ing.category);
                }}
              />
            ))}
          </div>

          <div className="docked-count-text">
            <span>{language === 'bn' ? toBengaliNumber(selectedIds.length) : selectedIds.length}</span>{' '}
            <span>{language === 'bn' ? 'উপাদান নির্বাচিত' : (selectedIds.length === 1 ? 'ingredient selected' : 'ingredients selected')}</span>
          </div>

          <button 
            type="button"
            className="docked-clear-btn" 
            onClick={clearAll}
            id="docked-clear-all-btn"
          >
            {t('clearAll')}
          </button>

          <button 
            type="button"
            className="docked-find-btn" 
            onClick={handleFindRecipes}
            id="docked-find-recipes-btn"
          >
            <span>{t('findRecipes')}</span>
            <ArrowRight size={18} />
          </button>
        </div>
      )}
    </div>
  )
}

export default IngredientSelector
