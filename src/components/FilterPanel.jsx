import React from 'react'
import { useDatabase } from '../context/DatabaseContext'

function FilterPanel({ filters, onChange }) {
  const { cuisines, language, t } = useDatabase()
  const activeCuisines = filters.cuisines || []
  const activeDietary = filters.dietary || []

  // Handlers for updating individual filter fields
  const handleCuisineToggle = (cuisineId) => {
    const updated = activeCuisines.includes(cuisineId)
      ? activeCuisines.filter(id => id !== cuisineId)
      : [...activeCuisines, cuisineId]
    onChange({ ...filters, cuisines: updated })
  }

  const handleDietaryToggle = (tag) => {
    const updated = activeDietary.includes(tag)
      ? activeDietary.filter(t => t !== tag)
      : [...activeDietary, tag]
    onChange({ ...filters, dietary: updated })
  }

  const handleSliderChange = (e) => {
    onChange({ ...filters, maxTime: parseInt(e.target.value, 10) })
  }

  const handleSelectChange = (field, val) => {
    onChange({ ...filters, [field]: val })
  }

  const resetAll = () => {
    onChange({
      cuisines: [],
      mealType: 'all',
      difficulty: 'all',
      maxTime: 120,
      dietary: []
    })
  }

  const dietaryTags = [
    { id: 'vegetarian', name: 'Vegetarian', emoji: '🥗' },
    { id: 'vegan', name: 'Vegan', emoji: '🌱' },
    { id: 'gluten-free', name: 'Gluten-Free', emoji: '🌾' },
    { id: 'dairy-free', name: 'Dairy-Free', emoji: '🥛' },
    { id: 'nut-free', name: 'Nut-Free', emoji: '🥜' }
  ]

  return (
    <div className="search-sidebar glass-panel" id="search-filter-sidebar">
      <div 
        style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginBottom: 'var(--spacing-lg)' 
        }}
      >
        <h3 style={{ fontSize: '1.2rem' }}>{t('filters')}</h3>
        <button 
          onClick={resetAll} 
          style={{ 
            fontSize: '0.8rem', 
            color: 'var(--brand-orange)', 
            fontWeight: '600', 
            cursor: 'pointer',
            background: 'none',
            border: 'none'
          }}
          id="reset-filters-btn"
        >
          {t('resetAll')}
        </button>
      </div>

      {/* 1. Meal Type Filter */}
      <div className="filter-group">
        <label htmlFor="meal-type-filter-select" className="filter-title" style={{ display: 'block', marginBottom: 'var(--spacing-xs)' }}>
          {t('filterMealTypeLabel')}
        </label>
        <select
          value={filters.mealType || 'all'}
          onChange={(e) => handleSelectChange('mealType', e.target.value)}
          style={{
            width: '100%',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--surface-border)',
            borderRadius: 'var(--radius-sm)',
            padding: '8px 12px',
            cursor: 'pointer'
          }}
          id="meal-type-filter-select"
        >
          <option value="all">{t('allMealTypes')}</option>
          <option value="breakfast" style={{ textTransform: 'capitalize' }}>{t('breakfast')}</option>
          <option value="lunch" style={{ textTransform: 'capitalize' }}>{t('lunch')}</option>
          <option value="dinner" style={{ textTransform: 'capitalize' }}>{t('dinner')}</option>
          <option value="snack" style={{ textTransform: 'capitalize' }}>{t('snack')}</option>
          <option value="dessert" style={{ textTransform: 'capitalize' }}>{t('dessert')}</option>
        </select>
      </div>

      {/* 2. Cuisines Multi-Select Filter */}
      <div className="filter-group">
        <h4 className="filter-title">{t('filterCuisineLabel')}</h4>
        <div className="filter-checkbox-list" id="cuisine-filter-checkboxes" role="group" aria-label={t('filterCuisineLabel')}>
          {cuisines.map(c => {
            const cuisineName = language === 'bn' ? (c.nameBn || c.name) : c.name
            return (
              <label key={c.id} className="filter-checkbox-label" id={`cuisine-filter-lbl-${c.id}`}>
                <input
                  type="checkbox"
                  checked={activeCuisines.includes(c.id)}
                  onChange={() => handleCuisineToggle(c.id)}
                  id={`cuisine-filter-chk-${c.id}`}
                />
                <span role="img" aria-hidden="true">{c.emoji}</span>
                <span>{cuisineName}</span>
              </label>
            )
          })}
        </div>
      </div>

      {/* 3. Max Cooking Time Slider */}
      <div className="filter-group">
        <label htmlFor="cooking-time-range-slider" className="filter-title" style={{ display: 'block', marginBottom: 'var(--spacing-xs)' }}>
          {t('filterMaxTimeLabel')}
        </label>
        <div className="filter-slider-container">
          <input
            type="range"
            min="10"
            max="120"
            step="5"
            aria-label="Maximum cooking time in minutes"
            value={filters.maxTime || 120}
            onChange={handleSliderChange}
            className="filter-slider"
            id="cooking-time-range-slider"
          />
          <div className="filter-slider-labels">
            <span>10 {t('mins')}</span>
            <span style={{ fontWeight: '700', color: 'var(--brand-orange)' }}>
              {filters.maxTime && filters.maxTime < 120 ? `${filters.maxTime} ${t('mins')}` : t('anyTime')}
            </span>
            <span>2 {t('hours')}</span>
          </div>
        </div>
      </div>

      {/* 4. Cooking Difficulty */}
      <div className="filter-group">
        <label htmlFor="difficulty-filter-select" className="filter-title" style={{ display: 'block', marginBottom: 'var(--spacing-xs)' }}>
          {t('filterDifficultyLabel')}
        </label>
        <select
          value={filters.difficulty || 'all'}
          onChange={(e) => handleSelectChange('difficulty', e.target.value)}
          style={{
            width: '100%',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--surface-border)',
            borderRadius: 'var(--radius-sm)',
            padding: '8px 12px',
            cursor: 'pointer'
          }}
          id="difficulty-filter-select"
        >
          <option value="all">{t('anyLevel')}</option>
          <option value="beginner" style={{ textTransform: 'capitalize' }}>{t('beginner')}</option>
          <option value="intermediate" style={{ textTransform: 'capitalize' }}>{t('intermediate')}</option>
          <option value="hard">{t('advanced')}</option>
        </select>
      </div>

      {/* 5. Dietary Tags Multi-Select */}
      <div className="filter-group">
        <h4 className="filter-title">{t('filterDietaryLabel')}</h4>
        <div className="filter-checkbox-list" id="dietary-filter-checkboxes" role="group" aria-label={t('filterDietaryLabel')}>
          {dietaryTags.map(tag => {
            const tagName = language === 'bn' ? t(tag.id) : tag.name
            return (
              <label key={tag.id} className="filter-checkbox-label" id={`dietary-filter-lbl-${tag.id}`}>
                <input
                  type="checkbox"
                  checked={activeDietary.includes(tag.id)}
                  onChange={() => handleDietaryToggle(tag.id)}
                  id={`dietary-filter-chk-${tag.id}`}
                />
                <span>{tag.emoji} {tagName}</span>
              </label>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default FilterPanel
