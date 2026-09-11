import React, { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Home, Compass, Search, ShieldCheck, Globe, Menu, X } from 'lucide-react'
import { useDatabase } from '../context/DatabaseContext'
import Logo from './Logo'

// Sleek SVG Flag Badges
function FlagBD() {
  return (
    <svg width="18" height="13" viewBox="0 0 20 12" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: '2px', display: 'inline-block' }}>
      <rect width="20" height="12" fill="#006A4E" />
      <circle cx="9" cy="6" r="4" fill="#F42A41" />
    </svg>
  )
}

function FlagUS() {
  return (
    <svg width="18" height="13" viewBox="0 0 20 12" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: '2px', display: 'inline-block' }}>
      <rect width="20" height="12" fill="#B22234" />
      <path d="M0 1.846h20M0 3.692h20M0 5.538h20M0 7.385h20M0 9.231h20M0 11.077h20" stroke="#FFFFFF" strokeWidth="0.923" />
      <rect width="8" height="6.46" fill="#3C3B6E" />
    </svg>
  )
}

function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const location = useLocation()
  const { language, setLanguage, t, isTranslating } = useDatabase()

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Auto-close mobile menu when route changes
  useEffect(() => {
    setIsMobileMenuOpen(false)
  }, [location.pathname])

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isMobileMenuOpen) {
        setIsMobileMenuOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isMobileMenuOpen])

  // Prevent background scroll when mobile menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isMobileMenuOpen])

  const isActive = (path) => {
    if (path === '/' && location.pathname === '/') return true
    if (path !== '/' && location.pathname.startsWith(path)) return true
    return false
  }

  return (
    <nav className={`navbar ${isScrolled ? 'scrolled' : ''}`}>
      <div className="nav-container">
        <Link to="/" className="logo-container" id="nav-logo" aria-label="Rannabanna - Cook the World with What You Have" title="Rannabanna">
          <Logo size="nav" />
        </Link>

        {/* Desktop Nav */}
        <div className="nav-links">
          <Link to="/" className={`nav-link ${isActive('/') ? 'active' : ''}`} id="nav-link-home">
            {t('home')}
          </Link>
          <Link to="/cuisines" className={`nav-link ${isActive('/cuisines') || isActive('/cuisine') ? 'active' : ''}`} id="nav-link-cuisines">
            {t('cuisines')}
          </Link>
          <Link to="/search" className={`nav-link ${isActive('/search') ? 'active' : ''}`} id="nav-link-finder">
            {t('recipeFinder')}
          </Link>
          
          {/* Desktop Glass Language Selector Toggle */}
          <button 
            type="button"
            className="lang-toggle-btn glass-panel" 
            onClick={() => setLanguage(language === 'en' ? 'bn' : 'en')}
            aria-label={language === 'en' ? 'Switch interface language to Bengali' : 'Switch interface language to English'}
            id="desktop-lang-toggle"
            style={isTranslating ? { borderColor: 'rgba(167, 139, 250, 0.6)', boxShadow: '0 0 10px rgba(139, 92, 246, 0.35)' } : {}}
          >
            {language === 'en' ? (
              <>
                <FlagBD />
                <span>বাংলা</span>
              </>
            ) : (
              <>
                <FlagUS />
                <span>EN</span>
              </>
            )}
            {isTranslating && <span className="translating-dot" style={{ marginLeft: '4px' }} title="Translating via AI..."></span>}
          </button>
        </div>

        {/* Mobile Action Group */}
        <div className="nav-mobile-actions">
          <button 
            type="button"
            className="mobile-lang-pill" 
            onClick={() => setLanguage(language === 'en' ? 'bn' : 'en')}
            aria-label={language === 'en' ? 'Switch interface language to Bengali' : 'Switch interface language to English'}
            id="mobile-header-lang-toggle"
          >
            {language === 'en' ? (
              <>
                <FlagBD />
                <span>বাংলা</span>
              </>
            ) : (
              <>
                <FlagUS />
                <span>EN</span>
              </>
            )}
            {isTranslating && <span className="translating-dot" style={{ marginLeft: '4px' }} title="Translating via AI..."></span>}
          </button>

          <button 
            type="button"
            className="mobile-toggle" 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle navigation menu"
            aria-expanded={isMobileMenuOpen}
            aria-controls="mobile-nav-drawer"
            id="nav-mobile-toggle"
          >
            {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Mobile Nav Drawer Overlay & Panel */}
        {isMobileMenuOpen && (
          <>
            <div 
              className="mobile-nav-backdrop"
              onClick={() => setIsMobileMenuOpen(false)}
              aria-hidden="true"
            />
            <div 
              id="mobile-nav-drawer"
              className="mobile-nav-drawer"
              role="navigation"
              aria-label="Mobile navigation"
            >
              <div className="mobile-nav-links">
                <Link 
                  to="/" 
                  className={`mob-nav-link ${isActive('/') ? 'active' : ''}`}
                  onClick={() => setIsMobileMenuOpen(false)}
                  id="mob-nav-link-home"
                >
                  <Home size={18} className="mob-nav-icon" />
                  <span>{t('home')}</span>
                </Link>
                <Link 
                  to="/cuisines" 
                  className={`mob-nav-link ${isActive('/cuisines') || isActive('/cuisine') ? 'active' : ''}`}
                  onClick={() => setIsMobileMenuOpen(false)}
                  id="mob-nav-link-cuisines"
                >
                  <Compass size={18} className="mob-nav-icon" />
                  <span>{t('cuisines')}</span>
                </Link>
                <Link 
                  to="/search" 
                  className={`mob-nav-link ${isActive('/search') ? 'active' : ''}`}
                  onClick={() => setIsMobileMenuOpen(false)}
                  id="mob-nav-link-finder"
                >
                  <Search size={18} className="mob-nav-icon" />
                  <span>{t('recipeFinder')}</span>
                </Link>
                <Link 
                  to="/admin" 
                  className={`mob-nav-link ${isActive('/admin') ? 'active' : ''}`}
                  onClick={() => setIsMobileMenuOpen(false)}
                  id="mob-nav-link-admin"
                  style={{ color: 'var(--brand-orange)' }}
                >
                  <ShieldCheck size={18} className="mob-nav-icon" />
                  <span>{language === 'bn' ? 'অ্যাডমিন পোর্টাল' : 'Admin Portal'}</span>
                </Link>
              </div>

              {/* Mobile Language Toggle inside Drawer */}
              <div className="mobile-nav-footer">
                <button 
                  type="button"
                  className="mobile-drawer-lang-btn" 
                  onClick={() => {
                    setLanguage(language === 'en' ? 'bn' : 'en');
                    setIsMobileMenuOpen(false);
                  }}
                  id="mobile-lang-toggle"
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Globe size={16} />
                    <span>{language === 'en' ? 'ভাষা পরিবর্তন: বাংলা' : 'Switch Language: English'}</span>
                  </span>
                  <span className="lang-badge" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {language === 'en' ? <FlagBD /> : <FlagUS />}
                    <span>{language === 'en' ? 'বাংলা' : 'EN'}</span>
                  </span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </nav>
  )
}

export default Navbar
