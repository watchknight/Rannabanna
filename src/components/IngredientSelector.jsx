import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDatabase } from '../context/DatabaseContext'
import { translateCategory } from '../utils/translations'
import { matchIngredient } from '../utils/ingredientResolver'

// Memoized chip to prevent heavy layout re-renders on selection toggles
const IngredientChip = React.memo(({ ing, isSelected, language, onClick }) => {
  const name = language === 'bn' ? (ing.nameBn || ing.name) : ing.name;

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick(ing.id);
    }
  };

  return (
    <div
      className={`ingredient-chip ${isSelected ? 'active' : ''}`}
      onClick={() => onClick(ing.id)}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-pressed={isSelected}
      aria-label={name}
      id={`ingredient-chip-${ing.id}`}
    >
      <span className="chip-emoji">{ing.emoji}</span>
      <span>{name}</span>
    </div>
  )
})

function IngredientSelector({ initialSelectedIds = [] }) {
  const { ingredients, language, t, toBengaliNumber } = useDatabase()
  const navigate = useNavigate()
  const dropdownRef = useRef(null)
  const tabsRef = useRef(null)

  const [selectedIds, setSelectedIds] = useState(initialSelectedIds)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState('All')
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [showLeftScroll, setShowLeftScroll] = useState(false)
  const [showRightScroll, setShowRightScroll] = useState(false)

  // 12 unique top-level categories derived dynamically
  const categories = useMemo(() => {
    const cats = new Set(ingredients.map(ing => ing.category))
    return ['All', ...Array.from(cats)]
  }, [ingredients])

  const updateScrollButtons = () => {
    if (tabsRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = tabsRef.current
      setShowLeftScroll(scrollLeft > 5)
      setShowRightScroll(scrollWidth - scrollLeft - clientWidth > 5)
    }
  }

  useEffect(() => {
    const tabsEl = tabsRef.current
    if (tabsEl) {
      const timer = setTimeout(() => {
        updateScrollButtons()
      }, 100)
      
      tabsEl.addEventListener('scroll', updateScrollButtons)
      window.addEventListener('resize', updateScrollButtons)
      
      return () => {
        clearTimeout(timer)
        tabsEl.removeEventListener('scroll', updateScrollButtons)
        window.removeEventListener('resize', updateScrollButtons)
      }
    }
  }, [categories])

  const handleScroll = useCallback((direction) => {
    if (tabsRef.current) {
      const scrollAmount = 240
      tabsRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      })
    }
  }, [])

  // Sync initial selections if they change (e.g. on navigation back)
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

  // Handle Select/Unselect toggle
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

  // Filtered ingredients for the grid display
  const gridIngredients = useMemo(() => {
    return ingredients.filter(ing => {
      if (activeCategory === 'All') return true
      return ing.category === activeCategory
    })
  }, [activeCategory, ingredients])

  // Autocomplete filtering with alias & plural resolution
  const autocompleteSuggestions = useMemo(() => {
    if (!searchQuery.trim()) return []
    return ingredients.filter(ing => matchIngredient(ing, searchQuery, language)).slice(0, 10)
  }, [searchQuery, ingredients, language])

  // Compile selected full objects for display
  const selectedObjects = useMemo(() => {
    return selectedIds.map(id => ingredients.find(ing => ing.id === id)).filter(Boolean)
  }, [selectedIds, ingredients])

  // Trigger search navigation
  const handleFindRecipes = () => {
    if (selectedIds.length === 0) return
    navigate(`/search?ingredients=${selectedIds.join(',')}`)
  }

  return (
    <div className="ingredient-selector glass-panel animate-fade-in" id="ingredient-selector-panel">
      {/* Selected Tags list */}
      <div className="selected-container" id="selected-tags-container">
        {selectedObjects.length === 0 ? (
          <div className="selected-placeholder">
            <span>{t('selectedPlaceholder')}</span>
          </div>
        ) : (
          selectedObjects.map(ing => {
            const displayName = language === 'bn' ? (ing.nameBn || ing.name) : ing.name;
            return (
              <div key={ing.id} className="selected-tag" id={`selected-tag-${ing.id}`}>
                <span>{ing.emoji} {displayName}</span>
                <button 
                  onClick={() => toggleIngredient(ing.id)} 
                  aria-label={`Remove ${displayName}`}
                  id={`remove-btn-${ing.id}`}
                >
                  ✕
                </button>
              </div>
            )
          })
        )}
      </div>

      {/* Autocomplete Search input */}
      <div className="selector-search-box" ref={dropdownRef}>
        <label htmlFor="ingredient-search-input" className="sr-only">
          {t('selectorPlaceholder')}
        </label>
        <div className="search-input-wrapper">
          <span className="search-input-icon" role="img" aria-hidden="true">🔍</span>
          <input
            type="text"
            placeholder={t('selectorPlaceholder')}
            aria-label={t('selectorPlaceholder')}
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
              aria-label="Clear search input"
              id="clear-search-btn"
            >
              ✕
            </button>
          )}
        </div>

        {/* Dropdown menu */}
        {isDropdownOpen && autocompleteSuggestions.length > 0 && (
          <div className="autocomplete-dropdown" id="search-autocomplete-dropdown" role="listbox">
            {autocompleteSuggestions.map(ing => {
              const displayName = language === 'bn' ? (ing.nameBn || ing.name) : ing.name;
              return (
                <div 
                  key={ing.id}
                  className={`autocomplete-item ${selectedIds.includes(ing.id) ? 'selected' : ''}`}
                  onClick={() => toggleIngredient(ing.id)}
                  role="option"
                  aria-selected={selectedIds.includes(ing.id)}
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleIngredient(ing.id); } }}
                  id={`autocomplete-item-${ing.id}`}
                >
                  <span role="img" aria-label={displayName}>{ing.emoji}</span>
                  <span>{displayName}</span>
                  <span className="autocomplete-category">{translateCategory(ing.category, language)}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Category Selection Tabs */}
      <div className="category-tabs-wrapper">
        {showLeftScroll && (
          <div className="category-fade-left" aria-hidden="true" />
        )}
        {showLeftScroll && (
          <button 
            type="button"
            className="category-scroll-btn left" 
            onClick={() => handleScroll('left')}
            aria-label="Scroll ingredient categories left"
          >
            ‹
          </button>
        )}
        
        <div 
          className="category-tabs" 
          id="category-tabs-list"
          role="tablist"
          aria-label="Ingredient Categories"
          ref={tabsRef}
        >
          {categories.map(cat => (
            <button
              key={cat}
              type="button"
              role="tab"
              aria-selected={activeCategory === cat}
              className={`category-tab ${activeCategory === cat ? 'active' : ''}`}
              onClick={() => setActiveCategory(cat)}
              id={`category-tab-${cat.toLowerCase().replace(/\s+/g, '-')}`}
            >
              {cat === 'All' ? (language === 'bn' ? 'সব' : 'All') : translateCategory(cat, language)}
            </button>
          ))}
        </div>

        {showRightScroll && (
          <div className="category-fade-right" />
        )}
        {showRightScroll && (
          <button 
            type="button"
            className="category-scroll-btn right" 
            onClick={() => handleScroll('right')}
            aria-label="Scroll right"
          >
            ›
          </button>
        )}
      </div>

      {/* Ingredients Grid */}
      <div className="ingredients-grid" id="ingredients-grid-list">
        {gridIngredients.map(ing => (
          <IngredientChip
            key={ing.id}
            ing={ing}
            isSelected={selectedIds.includes(ing.id)}
            language={language}
            onClick={toggleIngredient}
          />
        ))}
      </div>

      {/* Action Buttons */}
      <div className="selector-actions">
        {selectedIds.length > 0 && (
          <div className="selector-actions-inner">
            <button 
              className="btn btn-secondary" 
              onClick={clearAll}
              id="clear-all-ingredients-btn"
            >
              {t('clearAll')}
            </button>
            <button 
              className="btn btn-primary" 
              onClick={handleFindRecipes}
              id="find-recipes-submit-btn"
            >
              {t('findRecipes')} ({language === 'bn' ? toBengaliNumber(selectedIds.length) : selectedIds.length} {t('selectedCount')}) →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default IngredientSelector
