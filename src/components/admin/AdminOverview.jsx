import React, { useState, useEffect } from 'react';
import { useDatabase } from '../../context/DatabaseContext.jsx';
import { API_BASE, safeParseJson } from '../../utils/apiConfig.js';

export default function AdminOverview({ token, onNavigateTab }) {
  const { language, t } = useDatabase();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [flushing, setFlushing] = useState(false);
  const [flushMessage, setFlushMessage] = useState('');

  const fetchStats = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/admin/stats`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await safeParseJson(res);
      if (!res.ok) throw new Error(data.message || 'Failed to load system metrics');
      setStats(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [token]);

  const handleFlushCache = async () => {
    try {
      setFlushing(true);
      setFlushMessage('');
      const res = await fetch(`${API_BASE}/api/admin/system/cache/flush`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await safeParseJson(res);
      if (res.ok) {
        setFlushMessage(language === 'bn' ? '✅ ইন-মেমোরি ডাটাবেজ ক্যাশ ও এলআরইউ সফলভাবে রি-হাইড্রেট করা হয়েছে!' : '✅ In-memory database cache & LRU match cache flushed and re-hydrated successfully!');
        await fetchStats();
      } else {
        throw new Error(data.message || 'Failed to flush cache');
      }
    } catch (err) {
      setFlushMessage(`❌ ${err.message}`);
    } finally {
      setFlushing(false);
      setTimeout(() => setFlushMessage(''), 6000);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <div style={{ fontSize: '2rem' }}>⚡</div>
        <p style={{ color: 'var(--text-secondary)' }}>{t('adminTelemetryLoading')}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-error-banner">
        ⚠️ {error}
      </div>
    );
  }

  return (
    <div className="admin-overview-container">
      {flushMessage && (
        <div className={flushMessage.startsWith('✅') ? 'admin-success-banner' : 'admin-error-banner'}>
          {flushMessage}
        </div>
      )}

      {/* Top Metrics Grid */}
      <div className="admin-stats-grid">
        <div className="admin-stat-card">
          <div className="stat-header">
            <span>{t('adminTotalRecipes')}</span>
            <span className="stat-icon">🍲</span>
          </div>
          <div className="stat-value">{stats?.totalRecipes || 0}</div>
          <div className="stat-subtext">{language === 'bn' ? 'ডাটাবেজে সংরক্ষিত মোট রেসিপি' : 'Active in SQLite database'}</div>
        </div>

        <div className="admin-stat-card">
          <div className="stat-header">
            <span>{t('adminTotalIngredients')}</span>
            <span className="stat-icon">🧂</span>
          </div>
          <div className="stat-value">{stats?.totalIngredients || 0}</div>
          <div className="stat-subtext">{language === 'bn' ? 'ক্যানোনিক্যাল জিআইভি উপাদান' : 'Canonical GIV ingredients'}</div>
        </div>

        <div className="admin-stat-card">
          <div className="stat-header">
            <span>{t('adminTotalCuisines')}</span>
            <span className="stat-icon">🌍</span>
          </div>
          <div className="stat-value">{stats?.totalCuisines || 0}</div>
          <div className="stat-subtext">{language === 'bn' ? 'গ্লোবাল রন্ধন ঐতিহ্য' : 'Global culinary traditions'}</div>
        </div>

        <div className="admin-stat-card">
          <div className="stat-header">
            <span>{t('adminTotalGenerations')}</span>
            <span className="stat-icon">🤖</span>
          </div>
          <div className="stat-value">{stats?.totalGenerations || 0}</div>
          <div className="stat-subtext">{language === 'bn' ? 'ডাইনামিক কাস্টম শেফ তৈরি' : 'Dynamic bespoke creations'}</div>
        </div>

        <div className="admin-stat-card">
          <div className="stat-header">
            <span>{t('adminDbSize')}</span>
            <span className="stat-icon">💾</span>
          </div>
          <div className="stat-value">{stats?.dbSizeFormatted || 'N/A'}</div>
          <div className="stat-subtext">{language === 'bn' ? 'ডিস্ক স্টোরেজ সাইজ' : 'Local storage footprint'}</div>
        </div>

        <div className="admin-stat-card">
          <div className="stat-header">
            <span>{t('adminMemoryUptime')}</span>
            <span className="stat-icon">⚡</span>
          </div>
          <div className="stat-value">{stats?.memoryUsageMB || 0} MB</div>
          <div className="stat-subtext">{language === 'bn' ? `আপটাইম: ${Math.floor((stats?.uptimeSeconds || 0) / 60)} মিনিট` : `Uptime: ${Math.floor((stats?.uptimeSeconds || 0) / 60)} mins`}</div>
        </div>
      </div>

      {/* Quick Action Shortcuts */}
      <div className="admin-table-card" style={{ padding: 'var(--spacing-lg)', marginBottom: 'var(--spacing-xl)' }}>
        <h3 style={{ fontSize: '1.1rem', marginBottom: 'var(--spacing-md)' }}>⚡ {t('adminQuickActions')}</h3>
        <div style={{ display: 'flex', gap: 'var(--spacing-md)', flexWrap: 'wrap' }}>
          <button 
            type="button" 
            className="btn btn-primary"
            onClick={() => onNavigateTab('recipes', { openCreateModal: true })}
          >
            + {t('adminCreateRecipe')}
          </button>
          <button 
            type="button" 
            className="btn btn-secondary"
            onClick={() => onNavigateTab('ingredients', { openCreateModal: true })}
          >
            + {t('adminAddIngredient')}
          </button>
          <button 
            type="button" 
            className="btn btn-secondary"
            onClick={handleFlushCache}
            disabled={flushing}
          >
            {flushing ? `⏳ ${t('adminFlushingCache')}` : `🔄 ${t('adminFlushCache')}`}
          </button>
        </div>
      </div>

      {/* Two Column Layout: Cuisine Distribution & Top Ingredients */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 'var(--spacing-xl)' }}>
        {/* Cuisine Distribution */}
        <div className="admin-table-card" style={{ padding: 'var(--spacing-lg)' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: 'var(--spacing-md)', display: 'flex', justifyContent: 'space-between' }}>
            <span>🥘 {t('adminCuisineDist')}</span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{language === 'bn' ? 'রেসিপি সংখ্যা' : 'Recipe Counts'}</span>
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {stats?.cuisineDistribution?.map((c) => {
              const maxCount = stats.totalRecipes || 1;
              const pct = Math.round((c.count / maxCount) * 100);
              return (
                <div key={c.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 600, color: '#ffffff' }}>
                      {c.emoji} {language === 'bn' && c.nameBn ? c.nameBn : c.name} {c.nameBn && language !== 'bn' ? `(${c.nameBn})` : ''}
                    </span>
                    <span style={{ color: 'var(--text-secondary)' }}>{c.count} {language === 'bn' ? 'টি রেসিপি' : 'recipes'} ({pct}%)</span>
                  </div>
                  <div style={{ height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: c.color || 'var(--brand-pink)', borderRadius: '3px' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Used Ingredients */}
        <div className="admin-table-card" style={{ padding: 'var(--spacing-lg)' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: 'var(--spacing-md)', display: 'flex', justifyContent: 'space-between' }}>
            <span>🧂 {t('adminTopIngredients')}</span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{language === 'bn' ? 'ব্যবহারের হার' : 'Frequency'}</span>
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {stats?.topIngredients?.map((ing, idx) => (
              <div 
                key={ing.id}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  background: 'rgba(255,255,255,0.02)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid rgba(255,255,255,0.05)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', width: '20px' }}>#{idx + 1}</span>
                  <span style={{ fontSize: '1.2rem' }}>{ing.emoji || '🧂'}</span>
                  <div>
                    <div style={{ fontWeight: 600, color: '#ffffff', fontSize: '0.9rem' }}>
                      {language === 'bn' && ing.nameBn ? ing.nameBn : ing.name} {ing.nameBn && language !== 'bn' ? `(${ing.nameBn})` : ''}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{ing.category}</div>
                  </div>
                </div>
                <span className="badge" style={{ background: 'rgba(233, 30, 99, 0.2)', color: 'var(--brand-pink)', fontWeight: 700 }}>
                  {ing.count} {language === 'bn' ? 'টি রেসিপি' : 'recipes'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
