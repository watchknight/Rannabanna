import React, { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useDatabase } from '../context/DatabaseContext'
import Logo from './Logo'

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
          >
            {language === 'en' ? '🇧🇩 বাংলা' : '🇺🇸 EN'}
          </button>
        </div>

        {/* Mobile Action Group (Visible on <= 768px only) */}
        <div className="nav-mobile-actions">
          {/* Quick Header Language Pill for Mobile */}
          <button 
            type="button"
            className="mobile-lang-pill" 
            onClick={() => setLanguage(language === 'en' ? 'bn' : 'en')}
            aria-label={language === 'en' ? 'Switch interface language to Bengali' : 'Switch interface language to English'}
            id="mobile-header-lang-toggle"
          >
            {language === 'en' ? '🇧🇩 বাংলা' : '🇺🇸 EN'}
          </button>

          {/* Hamburger Toggle Button */}
          <button 
            type="button"
            className="mobile-toggle" 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle navigation menu"
            aria-expanded={isMobileMenuOpen}
            aria-controls="mobile-nav-drawer"
            id="nav-mobile-toggle"
          >
            {isMobileMenuOpen ? '✕' : '☰'}
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
                  <span className="mob-nav-icon">🏠</span>
                  <span>{t('home')}</span>
                </Link>
                <Link 
                  to="/cuisines" 
                  className={`mob-nav-link ${isActive('/cuisines') || isActive('/cuisine') ? 'active' : ''}`}
                  onClick={() => setIsMobileMenuOpen(false)}
                  id="mob-nav-link-cuisines"
                >
                  <span className="mob-nav-icon">🌍</span>
                  <span>{t('cuisines')}</span>
                </Link>
                <Link 
                  to="/search" 
                  className={`mob-nav-link ${isActive('/search') ? 'active' : ''}`}
                  onClick={() => setIsMobileMenuOpen(false)}
                  id="mob-nav-link-finder"
                >
                  <span className="mob-nav-icon">🔍</span>
                  <span>{t('recipeFinder')}</span>
                </Link>
                <Link 
                  to="/admin" 
                  className={`mob-nav-link ${isActive('/admin') ? 'active' : ''}`}
                  onClick={() => setIsMobileMenuOpen(false)}
                  id="mob-nav-link-admin"
                  style={{ color: 'var(--brand-pink)' }}
                >
                  <span className="mob-nav-icon">🔒</span>
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
                  <span>🌐 {language === 'en' ? 'ভাষা পরিবর্তন: বাংলা' : 'Switch Language: English'}</span>
                  <span className="lang-badge">{language === 'en' ? '🇧🇩 বাংলা' : '🇺🇸 EN'}</span>
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
