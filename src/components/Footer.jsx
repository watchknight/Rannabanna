import React from 'react'
import { Link } from 'react-router-dom'
import { Globe, Zap, Heart, ShieldCheck, Share2 } from 'lucide-react'
import { useDatabase } from '../context/DatabaseContext'
import Logo from './Logo'

function Footer() {
  const { t, language, cuisines, toBengaliNumber } = useDatabase()

  const getCuisineName = (cuisineId) => {
    const c = cuisines.find(c => c.id === cuisineId)
    if (!c) return cuisineId
    return language === 'bn' ? (c.nameBn || c.name) : c.name
  }

  return (
    <footer className="footer" id="main-footer">
      {/* Editorial Feature Highlights Bar */}
      <div className="feature-highlights-bar">
        <div className="feature-highlight-item">
          <Globe size={18} className="feature-highlight-icon" />
          <span>{language === 'bn' ? 'বিশ্ব রন্ধনশৈলী রেসিপি' : 'International Recipes'}</span>
        </div>
        <div className="feature-highlight-item">
          <Zap size={18} className="feature-highlight-icon" />
          <span>{language === 'bn' ? 'সহজ ও কার্যকরী ইন্টারফেস' : 'Easy to Use'}</span>
        </div>
        <div className="feature-highlight-item">
          <Heart size={18} className="feature-highlight-icon" />
          <span>{language === 'bn' ? 'রান্না করুন আত্মবিশ্বাসের সাথে' : 'Cook with Confidence'}</span>
        </div>
      </div>

      <div className="footer-container">
        <div className="footer-brand">
          <Link to="/" style={{ display: 'inline-flex', textDecoration: 'none', marginBottom: '12px' }} aria-label="Rannabanna Home">
            <Logo size="footer" />
          </Link>
          <p>{t('footerDesc')}</p>
          <div className="social-links">
            <a href="#instagram" className="social-icon" aria-label="Instagram">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="20" height="20" x="2" y="2" rx="5" ry="5"/>
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
                <line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/>
              </svg>
            </a>
            <a href="#youtube" className="social-icon" aria-label="YouTube">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17"/>
                <polygon points="10 15 15 12 10 9 10 15" fill="currentColor"/>
              </svg>
            </a>
            <a href="#twitter" className="social-icon" aria-label="Twitter / X">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4l11.733 16h4.267l-11.733 -16z" />
                <path d="M4 20l6.768 -6.768m2.46 -2.46l6.772 -6.772" />
              </svg>
            </a>
            <a href="#share" className="social-icon" aria-label="Share">
              <Share2 size={16} />
            </a>
          </div>
        </div>

        <div className="footer-col">
          <h5>{t('footerPlatform')}</h5>
          <ul className="footer-links">
            <li><Link to="/">{t('home')}</Link></li>
            <li><Link to="/search">{t('recipeFinder')}</Link></li>
            <li><Link to="/cuisines">{t('cuisines')}</Link></li>
            <li>
              <Link to="/admin" style={{ color: 'var(--brand-orange)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <ShieldCheck size={14} />
                <span>{language === 'bn' ? 'অ্যাডমিন পোর্টাল' : 'Admin Portal'}</span>
              </Link>
            </li>
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
        <p>&copy; {language === 'bn' ? toBengaliNumber(new Date().getFullYear()) : new Date().getFullYear()} Rannabanna. {t('footerCopyright')}</p>
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
