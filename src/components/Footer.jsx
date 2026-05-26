import React from 'react'
import { Link } from 'react-router-dom'
import { useDatabase } from '../context/DatabaseContext'

function Footer() {
  const { t } = useDatabase()

  return (
    <footer className="footer" id="main-footer">
      <div className="footer-container">
        <div className="footer-brand">
          <h4>{t('logo')}</h4>
          <p>{t('footerDesc')}</p>
          <div className="social-links">
            <a href="#instagram" className="social-icon" aria-label="Instagram">📸</a>
            <a href="#youtube" className="social-icon" aria-label="YouTube">🎥</a>
            <a href="#pinterest" className="social-icon" aria-label="Pinterest">📌</a>
            <a href="#twitter" className="social-icon" aria-label="Twitter">🐦</a>
          </div>
        </div>

        <div className="footer-col">
          <h5>Platform</h5>
          <ul className="footer-links">
            <li><Link to="/">{t('home')}</Link></li>
            <li><Link to="/search">{t('recipeFinder')}</Link></li>
            <li><Link to="/cuisines">{t('cuisines')}</Link></li>
            <li><a href="#pantry">My Pantry</a></li>
          </ul>
        </div>

        <div className="footer-col">
          <h5>Cuisines</h5>
          <ul className="footer-links">
            <li><Link to="/cuisine/bengali">Bangladeshi</Link></li>
            <li><Link to="/cuisine/thai">Thai</Link></li>
            <li><Link to="/cuisine/italian">Italian</Link></li>
            <li><Link to="/cuisine/mexican">Mexican</Link></li>
          </ul>
        </div>

        <div className="footer-col">
          <h5>Company</h5>
          <ul className="footer-links">
            <li><a href="#about">About Us</a></li>
            <li><a href="#careers">Careers</a></li>
            <li><a href="#privacy">Privacy Policy</a></li>
            <li><a href="#terms">Terms of Service</a></li>
          </ul>
        </div>
      </div>

      <div className="footer-bottom">
        <p>&copy; {new Date().getFullYear()} Rannabanna. {t('footerCopyright')}</p>
        <p style={{ display: 'flex', gap: 'var(--spacing-md)' }}>
          <a href="#terms">Terms</a>
          <a href="#privacy">Privacy</a>
          <a href="#security">Security</a>
        </p>
      </div>
    </footer>
  )
}

export default Footer
