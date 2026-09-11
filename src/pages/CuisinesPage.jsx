import React, { useState, useMemo } from 'react'
import { Globe, Loader2 } from 'lucide-react'
import CuisineCard from '../components/CuisineCard'
import { useDatabase } from '../context/DatabaseContext'

function CuisinesPage() {
  const { cuisines, loading, language } = useDatabase()
  const [activeContinent, setActiveContinent] = useState('All')

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

  const continents = useMemo(() => {
    if (!cuisines) return ['All']
    const conts = new Set(cuisines.map(c => c.continent))
    return ['All', ...Array.from(conts)]
  }, [cuisines])

  const displayCuisines = useMemo(() => {
    if (!cuisines) return []
    return cuisines.filter(c => {
      if (activeContinent === 'All') return true
      return c.continent === activeContinent
    })
  }, [activeContinent, cuisines])

  if (loading) {
    return (
      <div className="empty-state glass-panel animate-pulse" style={{ padding: '60px 20px', textAlign: 'center', borderRadius: '24px' }} id="cuisines-loading">
        <Loader2 size={40} className="animate-spin" style={{ color: 'var(--brand-orange)', marginBottom: '16px' }} />
        <h3>{language === 'bn' ? 'রন্ধনশৈলী লোড হচ্ছে...' : 'Loading Cuisines...'}</h3>
        <p style={{ color: 'var(--text-secondary)' }}>{language === 'bn' ? 'বিশ্ব রন্ধনশৈলী ভল্ট সংযুক্ত করা হচ্ছে...' : 'Connecting to global cuisines vault...'}</p>
      </div>
    )
  }

  return (
    <div className="cuisines-page-container animate-fade-in" id="cuisines-page-root" style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 20px 60px' }}>
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <div className="hero-pill-badge" style={{ marginBottom: '12px' }}>
          <Globe size={14} />
          <span>{language === 'bn' ? 'বিশ্ব রন্ধন ঐতিহ্যের সংগ্রহ' : 'World Culinary Traditions'}</span>
        </div>
        <h1 className="cuisines-page-title" style={{ fontSize: 'clamp(2.2rem, 4vw, 3rem)', fontWeight: 800, marginBottom: '12px' }}>
          {language === 'bn' ? 'বিশ্ব ' : 'Explore '}<span className="gradient-text">{language === 'bn' ? 'রন্ধনশৈলী এক্সপ্লোর করুন' : 'World Cuisines'}</span>
        </h1>
        <p className="hero-subtitle" style={{ maxWidth: '640px', margin: '0 auto', fontSize: '1.05rem', color: 'var(--text-secondary)' }}>
          {language === 'bn' 
            ? 'বিভিন্ন মহাদেশের রন্ধনশৈলীর স্বতন্ত্র উপাদান, রান্নার ধরণ, সিগনেচার ফ্লেভার এবং ঐতিহ্যবাহী রেসিপিগুলো আবিষ্কার করুন।' 
            : 'Discover the distinct ingredients, cooking styles, signature flavors, and traditional recipes that define culinary arts across continents.'}
        </p>
      </div>

      {/* Filter Tabs */}
      <div 
        className="category-pills-bar centered" 
        style={{ marginBottom: '32px' }}
        id="continent-filter-tabs"
      >
        {continents.map(cont => (
          <button
            key={cont}
            className={`category-pill ${activeContinent === cont ? 'active' : ''}`}
            onClick={() => setActiveContinent(cont)}
            id={`continent-tab-${cont.toLowerCase().replace(/\s+/g, '-')}`}
          >
            {translateContinent(cont, language)}
          </button>
        ))}
      </div>

      {/* Grid of CuisineCards with Real Photography */}
      <div className="recipes-grid" id="cuisines-grid-list">
        {displayCuisines.map(c => (
          <CuisineCard key={c.id} cuisine={c} />
        ))}
      </div>
    </div>
  )
}

export default CuisinesPage
