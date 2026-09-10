import React from 'react'
import { Link } from 'react-router-dom'
import { useDatabase } from '../context/DatabaseContext'
import Logo from './Logo'

function Footer() {
  const { t, language, cuisines } = useDatabase()

  // Look up cuisine names from canonical data for consistency
  const getCuisineName = (cuisineId) => {
    const c = cuisines.find(c => c.id === cuisineId)
    if (!c) return cuisineId
    return language === 'bn' ? (c.nameBn || c.name) : c.name
  }

  return (
    <footer className="footer" id="main-footer">
      <div className="footer-container">
        <div className="footer-brand">
          <Link to="/" style={{ display: 'inline-flex', textDecoration: 'none', marginBottom: '10px' }} aria-label="Rannabanna Home">
            <Logo size="footer" />
          </Link>
          <p>{t('footerDesc')}</p>
          <div className="social-links">
            <a href="#instagram" className="social-icon" aria-label="Instagram">📸</a>
            <a href="#youtube" className="social-icon" aria-label="YouTube">🎥</a>
            <a href="#pinterest" className="social-icon" aria-label="Pinterest">📌</a>
            <a href="#twitter" className="social-icon" aria-label="Twitter">🐦</a>
          </div>
        </div>

        <div className="footer-col">
          <h5>{t('footerPlatform')}</h5>
          <ul className="footer-links">
            <li><Link to="/">{t('home')}</Link></li>
            <li><Link to="/search">{t('recipeFinder')}</Link></li>
            <li><Link to="/cuisines">{t('cuisines')}</Link></li>
            <li><Link to="/admin" style={{ color: 'var(--brand-pink)', fontWeight: 600 }}>🔒 {language === 'bn' ? 'অ্যাডমিন প্যানেল' : 'Admin Portal'}</Link></li>
          </ul>
        </div>

        <div className="footer-col">
          <h5>{t('cuisines')}</h5>
          <ul className="footer-links">
            <li><Link to="/cuisine/bengali">{getCuisineName('bengali')}</Link></li>
            <li><Link to="/cuisine/thai">{getCuisineName('thai')}</Link></li>
            <li><Link to="/cuisine/italian">{getCuisineName('italian')}</Link></li>
            <li><Link to="/cuisine/mexican">{getCuisineName('mexican')}</Link></li>
          </ul>
        </div>

        <div className="footer-col">
          <h5>{t('footerCompany')}</h5>
          <ul className="footer-links">
            <li><a href="#about">{t('aboutUs')}</a></li>
            <li><a href="#careers">{t('careers')}</a></li>
            <li><a href="#privacy">{t('privacyPolicy')}</a></li>
            <li><a href="#terms">{t('termsOfService')}</a></li>
          </ul>
        </div>
      </div>

      <div className="footer-bottom">
        <p>&copy; {new Date().getFullYear()} Rannabanna. {t('footerCopyright')}</p>
        <p className="footer-legal-links">
          <a href="#terms">{t('terms')}</a>
          <a href="#privacy">{t('privacy')}</a>
          <a href="#security">{t('security')}</a>
        </p>
      </div>
    </footer>
  )
}

export default Footer
