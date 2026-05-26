import React, { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useDatabase } from '../context/DatabaseContext'

function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const location = useLocation()
  const { language, setLanguage, t } = useDatabase()

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const isActive = (path) => {
    if (path === '/' && location.pathname === '/') return true
    if (path !== '/' && location.pathname.startsWith(path)) return true
    return false
  }

  return (
    <nav className={`navbar ${isScrolled ? 'scrolled' : ''}`}>
      <div className="nav-container">
        <Link to="/" className="logo-container" id="nav-logo">
          <span className="emoji">🍳</span> {t('logo')}
        </Link>

        {/* Desktop Nav */}
        <div className="nav-links" style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
          <Link to="/" className={`nav-link ${isActive('/') ? 'active' : ''}`} id="nav-link-home">
            {t('home')}
          </Link>
          <Link to="/cuisines" className={`nav-link ${isActive('/cuisines') || isActive('/cuisine') ? 'active' : ''}`} id="nav-link-cuisines">
            {t('cuisines')}
          </Link>
          <Link to="/search" className={`nav-link ${isActive('/search') ? 'active' : ''}`} id="nav-link-finder">
            {t('recipeFinder')}
          </Link>
          
          {/* Glass Language Selector Toggle */}
          <button 
            className="lang-toggle-btn glass-panel" 
            onClick={() => setLanguage(language === 'en' ? 'bn' : 'en')}
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid var(--surface-border)',
              borderRadius: 'var(--radius-sm)',
              padding: '6px 12px',
              color: 'var(--text-primary)',
              fontWeight: '600',
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s ease',
              marginLeft: 'var(--spacing-sm)'
            }}
            id="desktop-lang-toggle"
          >
            {language === 'en' ? '🇧🇩 বাংলা' : '🇺🇸 EN'}
          </button>
        </div>

        {/* Mobile Toggle Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
          <button 
            className="mobile-toggle" 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle navigation menu"
            id="nav-mobile-toggle"
          >
            {isMobileMenuOpen ? '✕' : '☰'}
          </button>
        </div>

        {/* Mobile Nav Drawer Overlay */}
        {isMobileMenuOpen && (
          <div 
            style={{
              position: 'fixed',
              top: 'var(--nav-height)',
              left: 0,
              width: '100%',
              background: 'var(--bg-secondary)',
              borderBottom: '1px solid var(--surface-border)',
              display: 'flex',
              flexDirection: 'column',
              padding: 'var(--spacing-lg) var(--spacing-md)',
              gap: 'var(--spacing-md)',
              zIndex: 999,
              backdropFilter: 'var(--glass-blur)'
            }}
            className="animate-slide-up"
          >
            <Link 
              to="/" 
              className={`nav-link ${isActive('/') ? 'active' : ''}`}
              onClick={() => setIsMobileMenuOpen(false)}
              id="mob-nav-link-home"
            >
              {t('home')}
            </Link>
            <Link 
              to="/cuisines" 
              className={`nav-link ${isActive('/cuisines') || isActive('/cuisine') ? 'active' : ''}`}
              onClick={() => setIsMobileMenuOpen(false)}
              id="mob-nav-link-cuisines"
            >
              {t('cuisines')}
            </Link>
            <Link 
              to="/search" 
              className={`nav-link ${isActive('/search') ? 'active' : ''}`}
              onClick={() => setIsMobileMenuOpen(false)}
              id="mob-nav-link-finder"
            >
              {t('recipeFinder')}
            </Link>

            {/* Mobile Language Toggle */}
            <button 
              className="lang-toggle-btn glass-panel" 
              onClick={() => {
                setLanguage(language === 'en' ? 'bn' : 'en');
                setIsMobileMenuOpen(false);
              }}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--surface-border)',
                borderRadius: 'var(--radius-sm)',
                padding: '10px',
                color: 'var(--text-primary)',
                fontWeight: '600',
                fontSize: '0.9rem',
                cursor: 'pointer',
                textAlign: 'center',
                width: '100%'
              }}
              id="mobile-lang-toggle"
            >
              {language === 'en' ? '🇧🇩 বাংলা' : '🇺🇸 EN'}
            </button>
          </div>
        )}
      </div>
    </nav>
  )
}

export default Navbar
