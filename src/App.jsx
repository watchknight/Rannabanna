import React, { useEffect, Suspense, lazy } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import Navbar from './components/Navbar'
import Footer from './components/Footer'

// Lazy load route pages to optimize the initial bundle size
const HomePage = lazy(() => import('./pages/HomePage'))
const SearchResultsPage = lazy(() => import('./pages/SearchResultsPage'))
const RecipeDetailPage = lazy(() => import('./pages/RecipeDetailPage'))
const CuisinesPage = lazy(() => import('./pages/CuisinesPage'))
const CuisineDetailPage = lazy(() => import('./pages/CuisineDetailPage'))

function ScrollToTop() {
  const { pathname } = useLocation()
  
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  
  return null
}

const PageLoadingFallback = () => {
  const language = localStorage.getItem('rannabanna-language') || 'en'
  return (
    <div 
      className="glass-panel animate-pulse" 
      style={{ 
        display: 'flex', 
        flexDirection: 'column',
        alignItems: 'center', 
        justifyContent: 'center', 
        minHeight: '50vh',
        margin: 'var(--spacing-xxl) auto',
        maxWidth: '500px',
        padding: 'var(--spacing-xl)',
        textAlign: 'center',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--surface-border)',
        background: 'rgba(20, 20, 31, 0.4)'
      }}
    >
      <div className="empty-state-emoji animate-spin" style={{ animationDuration: '3s', fontSize: '3rem', marginBottom: '12px' }}>🍲</div>
      <h3 style={{ margin: '0 0 8px 0', fontSize: '1.25rem' }}>
        {language === 'bn' ? 'রান্নাবান্না লোড হচ্ছে...' : 'Loading Rannabanna...'}
      </h3>
      <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
        {language === 'bn' ? 'আপনার রান্নাঘরের জন্য তাজা সুস্বাদু রেসিপি প্রস্তুত করা হচ্ছে...' : 'Preparing fresh culinary content for your kitchen...'}
      </p>
    </div>
  )
}

function App() {
  return (
    <div className="app-container">
      <ScrollToTop />
      <Navbar />
      <main className="main-content">
        <Suspense fallback={<PageLoadingFallback />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/search" element={<SearchResultsPage />} />
            <Route path="/recipe/:id" element={<RecipeDetailPage />} />
            <Route path="/cuisines" element={<CuisinesPage />} />
            <Route path="/cuisine/:id" element={<CuisineDetailPage />} />
          </Routes>
        </Suspense>
      </main>
      <Footer />
    </div>
  )
}

export default App
