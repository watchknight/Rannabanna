import React, { useEffect, Suspense, lazy } from 'react'
import { Routes, Route, useLocation, Link } from 'react-router-dom'
import Navbar from './components/Navbar'
import Footer from './components/Footer'

// Lazy load route pages to optimize the initial bundle size
const HomePage = lazy(() => import('./pages/HomePage'))
const SearchResultsPage = lazy(() => import('./pages/SearchResultsPage'))
const RecipeDetailPage = lazy(() => import('./pages/RecipeDetailPage'))
const CuisinesPage = lazy(() => import('./pages/CuisinesPage'))
const CuisineDetailPage = lazy(() => import('./pages/CuisineDetailPage'))
const AdminPage = lazy(() => import('./pages/AdminPage'))

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

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('App runtime error caught by ErrorBoundary:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      const language = localStorage.getItem('rannabanna-language') || 'en'
      const errorTitle = language === 'bn' ? 'কিছু একটা সমস্যা হয়েছে' : 'Something went wrong'
      const errorDesc = this.state.error?.message || (language === 'bn' ? 'এই পৃষ্ঠাটি লোড করার সময় একটি অপ্রত্যাশিত ত্রুটি ঘটেছে।' : 'An unexpected error occurred while loading this page.')
      const backHome = language === 'bn' ? 'হোমে ফিরে যান' : 'Back to Home'
      return (
        <div className="empty-state glass-panel animate-scale-in" style={{ margin: 'var(--spacing-xxl) auto', maxWidth: '500px', padding: 'var(--spacing-xl)', textAlign: 'center' }}>
          <div className="empty-state-emoji">⚠️</div>
          <h3>{errorTitle}</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            {errorDesc}
          </p>
          <button 
            type="button" 
            className="btn btn-primary" 
            onClick={() => { this.setState({ hasError: false, error: null }); window.location.href = '/'; }}
            style={{ marginTop: 'var(--spacing-md)' }}
          >
            {backHome}
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

function NotFoundPage() {
  const language = localStorage.getItem('rannabanna-language') || 'en'
  const title = language === 'bn' ? 'পৃষ্ঠা পাওয়া যায়নি' : 'Page Not Found'
  const desc = language === 'bn' ? 'আপনি যে পৃষ্ঠাটি খুঁজছেন তা বিদ্যমান নেই।' : "The page you're looking for doesn't exist."
  const goHome = language === 'bn' ? 'হোমে যান' : 'Go Home'
  return (
    <div className="empty-state glass-panel animate-scale-in" style={{ margin: '2rem auto' }}>
      <div className="empty-state-emoji">🍽️</div>
      <h3>{title}</h3>
      <p>{desc}</p>
      <Link to="/" className="btn btn-primary">{goHome}</Link>
    </div>
  )
}

function App() {
  return (
    <div className="app-container">
      <ScrollToTop />
      <Navbar />
      <main className="main-content">
        <ErrorBoundary>
          <Suspense fallback={<PageLoadingFallback />}>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/search" element={<SearchResultsPage />} />
              <Route path="/recipe/:id" element={<RecipeDetailPage />} />
              <Route path="/cuisines" element={<CuisinesPage />} />
              <Route path="/cuisine/:id" element={<CuisineDetailPage />} />
              <Route path="/admin/*" element={<AdminPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </main>
      <Footer />
    </div>
  )
}

export default App
