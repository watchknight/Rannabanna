import React, { useState, useMemo } from 'react'
import CuisineCard from '../components/CuisineCard'
import { useDatabase } from '../context/DatabaseContext'

function CuisinesPage() {
  const { cuisines, loading, language } = useDatabase()
  const [activeContinent, setActiveContinent] = useState('All')

  // Group continent filter names
  const translateContinent = (cont, lang) => {
    if (lang !== 'bn') return cont;
    const mapped = {
      'All': 'সব',
      'Asia': 'এশিয়া',
      'Europe': 'ইউরোপ',
      'Americas': 'আমেরিকা'
    };
    return mapped[cont] || cont;
  };

  // Continent grouping list
  const continents = useMemo(() => {
    if (!cuisines) return ['All']
    const conts = new Set(cuisines.map(c => c.continent))
    return ['All', ...Array.from(conts)]
  }, [cuisines])

  // Filtered cuisines to display
  const displayCuisines = useMemo(() => {
    if (!cuisines) return []
    return cuisines.filter(c => {
      if (activeContinent === 'All') return true
      return c.continent === activeContinent
    })
  }, [activeContinent, cuisines])

  if (loading) {
    return (
      <div className="empty-state glass-panel animate-pulse" style={{ padding: 'var(--spacing-xxl)' }} id="cuisines-loading">
        <div className="empty-state-emoji animate-spin" style={{ animationDuration: '3s' }}>🌍</div>
        <h3>{language === 'bn' ? 'রন্ধনশৈলী লোড হচ্ছে...' : 'Loading Cuisines...'}</h3>
        <p>{language === 'bn' ? 'বিশ্ব রন্ধনশৈলী ভল্ট সংযুক্ত করা হচ্ছে...' : 'Connecting to global cuisines vault...'}</p>
      </div>
    )
  }

  return (
    <div className="cuisines-page-container animate-fade-in" id="cuisines-page-root">
      <div style={{ textAlign: 'center', marginBottom: 'var(--spacing-xxl)' }}>
        <h1 style={{ fontSize: '3rem', marginBottom: 'var(--spacing-md)' }}>
          {language === 'bn' ? 'বিশ্ব ' : 'Explore '}<span className="gradient-text">{language === 'bn' ? 'রন্ধনশৈলী এক্সপ্লোর করুন' : 'World Cuisines'}</span>
        </h1>
        <p className="hero-subtitle" style={{ maxWidth: '600px' }}>
          {language === 'bn' 
            ? 'বিভিন্ন মহাদেশের রন্ধনশৈলীর স্বতন্ত্র উপাদান, রান্নার ধরণ, সিগনেচার ফ্লেভার এবং ঐতিহ্যবাহী রেসিপিগুলো আবিষ্কার করুন।' 
            : 'Discover the distinct ingredients, cooking styles, signature flavors, and traditional recipes that define culinary arts across continents.'}
        </p>
      </div>

      {/* Filter Tabs */}
      <div 
        className="category-tabs" 
        style={{ justifyContent: 'center', marginBottom: 'var(--spacing-xl)' }}
        id="continent-filter-tabs"
      >
        {continents.map(cont => (
          <button
            key={cont}
            className={`category-tab ${activeContinent === cont ? 'active' : ''}`}
            onClick={() => setActiveContinent(cont)}
            id={`continent-tab-${cont.toLowerCase().replace(/\s+/g, '-')}`}
          >
            {translateContinent(cont, language)}
          </button>
        ))}
      </div>

      {/* Grid of CuisineCards */}
      <div className="recipes-grid" style={{ marginTop: 'var(--spacing-lg)' }} id="cuisines-grid-list">
        {displayCuisines.map(c => (
          <CuisineCard key={c.id} cuisine={c} />
        ))}
      </div>
    </div>
  )
}

export default CuisinesPage
