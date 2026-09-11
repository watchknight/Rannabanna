import React from 'react'
import { Users, Filter, RotateCcw, Leaf, Sprout, Wheat, Milk, CircleDot } from 'lucide-react'
import { useDatabase } from '../context/DatabaseContext'

function FilterPanel({ filters, onChange }) {
  const { cuisines, language, t, toBengaliNumber } = useDatabase()
  const activeCuisines = filters.cuisines || []
  const activeDietary = filters.dietary || []

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

  const handleSelectChange = (field, val) => {
    onChange({ ...filters, [field]: val })
  }

  const resetAll = () => {
    onChange({
      cuisines: [],
      mealType: 'all',
      difficulty: 'all',
      maxTime: 120,
      servings: 4,
      dietary: []
    })
  }

  const dietaryTags = [
    { id: 'vegetarian', name: 'Vegetarian', nameBn: 'নিরামিষ', icon: <Leaf size={15} /> },
    { id: 'vegan', name: 'Vegan', nameBn: 'ভেগান', icon: <Sprout size={15} /> },
    { id: 'gluten-free', name: 'Gluten-Free', nameBn: 'গ্লুটেন-মুক্ত', icon: <Wheat size={15} /> },
    { id: 'dairy-free', name: 'Dairy-Free', nameBn: 'দুগ্ধ-মুক্ত', icon: <Milk size={15} /> },
    { id: 'nut-free', name: 'Nut-Free', nameBn: 'বাদাম-মুক্ত', icon: <CircleDot size={15} /> }
  ]

  return (
    <div className="search-sidebar glass-panel" id="search-filter-sidebar" style={{ borderRadius: '24px', padding: '24px' }}>
      <div 
        style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginBottom: '20px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          paddingBottom: '14px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Filter size={18} style={{ color: 'var(--brand-orange)' }} />
          <h3 style={{ fontSize: '1.15rem', margin: 0 }}>{t('filters')}</h3>
        </div>
        <button 
          type="button"
          onClick={resetAll} 
          className="reset-filters-btn"
          id="reset-filters-btn"
          aria-label={t('resetAll')}
        >
          <RotateCcw size={13} />
          <span>{t('resetAll')}</span>
        </button>
      </div>

      {/* 1. Servings Filter */}
      <div className="filter-group" id="filter-servings-group">
        <label htmlFor="servings-filter-select" className="filter-title" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', fontSize: '0.88rem', fontWeight: 600 }}>
          <Users size={16} style={{ color: 'var(--brand-orange)' }} />
          <span>{t('servingsFilterLabel')}</span>
        </label>
        <select
          id="servings-filter-select"
          className="filter-select"
          value={filters.servings || 4}
          onChange={(e) => handleSelectChange('servings', parseInt(e.target.value, 10))}
        >
          {[1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20].map(n => (
            <option key={n} value={n}>
              {language === 'bn' ? toBengaliNumber(n) : n} {t('people')}
            </option>
          ))}
        </select>
      </div>

      {/* 2. Meal Type Filter */}
      <div className="filter-group">
        <label htmlFor="meal-type-filter-select" className="filter-title" style={{ display: 'block', marginBottom: '8px', fontSize: '0.88rem', fontWeight: 600 }}>
          {t('filterMealTypeLabel')}
        </label>
        <select
          id="meal-type-filter-select"
          className="filter-select"
          value={filters.mealType || 'all'}
          onChange={(e) => handleSelectChange('mealType', e.target.value)}
        >
          <option value="all">{t('allMealTypes')}</option>
          <option value="breakfast">{t('breakfast')}</option>
          <option value="lunch">{t('lunch')}</option>
          <option value="dinner">{t('dinner')}</option>
          <option value="snack">{t('snack')}</option>
          <option value="dessert">{t('dessert')}</option>
        </select>
      </div>

      {/* 3. Cuisines Multi-Select Filter */}
      <div className="filter-group">
        <h4 className="filter-title" style={{ marginBottom: '10px', fontSize: '0.88rem', fontWeight: 600 }}>{t('filterCuisineLabel')}</h4>
        <div className="filter-checkbox-list" id="cuisine-filter-checkboxes" role="group" aria-label={t('filterCuisineLabel')}>
          {cuisines.map(c => {
            const cuisineName = language === 'bn' ? (c.nameBn || c.name) : c.name
            const isChecked = activeCuisines.includes(c.id)
            return (
              <label key={c.id} className="filter-checkbox-label" id={`cuisine-filter-lbl-${c.id}`}>
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => handleCuisineToggle(c.id)}
                />
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: c.color || 'var(--brand-orange)', flexShrink: 0 }} />
                <span>{cuisineName}</span>
              </label>
            )
          })}
        </div>
      </div>

      {/* 4. Dietary Restrictions Multi-Select Filter */}
      <div className="filter-group">
        <h4 className="filter-title" style={{ marginBottom: '10px', fontSize: '0.88rem', fontWeight: 600 }}>{t('filterDietaryLabel')}</h4>
        <div className="filter-checkbox-list">
          {dietaryTags.map(tag => {
            const isChecked = activeDietary.includes(tag.id)
            const tagName = language === 'bn' ? tag.nameBn : tag.name
            return (
              <label key={tag.id} className="filter-checkbox-label">
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => handleDietaryToggle(tag.id)}
                />
                <span style={{ color: isChecked ? 'var(--brand-orange)' : 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}>
                  {tag.icon}
                </span>
                <span>{tagName}</span>
              </label>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default FilterPanel
