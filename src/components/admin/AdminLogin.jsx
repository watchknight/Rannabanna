import React, { useState } from 'react';
import { useDatabase } from '../../context/DatabaseContext.jsx';
import { API_BASE, safeParseJson } from '../../utils/apiConfig.js';

export default function AdminLogin({ onLoginSuccess }) {
  const { language, setLanguage, t } = useDatabase();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password.trim()) {
      setError(language === 'bn' ? 'অনুগ্রহ করে অ্যাডমিন পাসওয়ার্ড প্রদান করুন।' : 'Please enter the administrator password.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${API_BASE}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });

      const data = await safeParseJson(res);

      if (!res.ok) {
        throw new Error(data.message || (language === 'bn' ? 'ভুল অ্যাডমিন পাসওয়ার্ড' : 'Invalid administrator password'));
      }

      sessionStorage.setItem('rannabanna_admin_token', data.token);
      onLoginSuccess(data.token);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-login-wrapper">
      <div style={{ position: 'absolute', top: 20, right: 20 }}>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => setLanguage(language === 'en' ? 'bn' : 'en')}
          style={{ padding: '6px 12px', fontSize: '0.85rem' }}
        >
          🌐 {language === 'en' ? 'বাংলা' : 'English'}
        </button>
      </div>

      <div className="admin-login-card">
        <div className="admin-login-icon">🔒</div>
        <h2>{t('adminLoginTitle')}</h2>
        <p>{t('adminLoginSubtitle')}</p>

        {error && (
          <div className="admin-error-banner">
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="admin-form-group">
            <input
              type="password"
              className="admin-form-input"
              placeholder={t('adminPasswordPlaceholder')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              autoFocus
              style={{ textAlign: 'center', letterSpacing: '0.1em' }}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: 'var(--spacing-md)' }}
            disabled={loading}
          >
            {loading ? t('adminAuthenticating') : t('adminAccessBtn')}
          </button>
        </form>

        <div style={{ marginTop: 'var(--spacing-lg)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          {t('adminDevKeyHint')} <code style={{ color: 'var(--brand-pink)' }}>rannabanna2026</code>
        </div>
      </div>
    </div>
  );
}

