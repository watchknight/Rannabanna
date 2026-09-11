import React, { useState, useEffect } from 'react';
import { 
  BookOpen, 
  Apple, 
  Globe, 
  Sparkles, 
  Database, 
  Cpu, 
  Zap, 
  RotateCcw, 
  Loader2, 
  Plus 
} from 'lucide-react';
import { useDatabase } from '../../context/DatabaseContext';
import { API_BASE, safeParseJson } from '../../utils/apiConfig.js';
import { getIngredientImage } from '../../utils/imageAssets';

export default function AdminOverview({ token, onNavigateTab }) {
  const { language, t } = useDatabase();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [flushing, setFlushing] = useState(false);
  const [flushSuccess, setFlushSuccess] = useState(null);

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${API_BASE}/api/admin/stats`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await safeParseJson(res);
      if (res.ok) {
        setStats(data);
      } else {
        setError(data.message || 'Failed to fetch admin stats');
      }
    } catch (err) {
      setError(err.message || 'Network error fetching admin stats');
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
      setFlushSuccess(null);
      const res = await fetch(`${API_BASE}/api/admin/system/cache/flush`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await safeParseJson(res);
      if (res.ok) {
        setFlushSuccess(data.message || 'Cache successfully flushed and re-hydrated.');
        fetchStats();
      } else {
        setError(data.message || 'Cache flush failed');
      }
    } catch (err) {
      setError(err.message || 'Network error flushing cache');
    } finally {
      setFlushing(false);
    }
  };

  if (loading) {
    return (
      <div className="glass-panel" style={{ padding: '60px 20px', textAlign: 'center', borderRadius: '24px' }}>
        <Loader2 size={36} className="animate-spin" style={{ color: 'var(--brand-orange)', marginBottom: '16px' }} />
        <p style={{ color: 'var(--text-secondary)' }}>{language === 'bn' ? 'অ্যাডমিন স্ট্যাটিস্টিক্স লোড হচ্ছে...' : 'Loading system metrics...'}</p>
      </div>
    );
  }

  return (
    <div className="admin-overview animate-fade-in">
      {error && (
        <div className="admin-alert danger">
          {error}
        </div>
      )}

      {flushSuccess && (
        <div className="admin-alert success">
          {flushSuccess}
        </div>
      )}

      {/* Top Metrics Grid */}
      <div className="admin-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div className="admin-stat-card glass-panel" style={{ padding: '20px', borderRadius: '18px' }}>
          <div className="stat-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{t('adminTotalRecipes')}</span>
            <BookOpen size={18} style={{ color: 'var(--brand-orange)' }} />
          </div>
          <div className="stat-value" style={{ fontSize: '1.8rem', fontWeight: 800 }}>{stats?.totalRecipes || 0}</div>
          <div className="stat-subtext" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>{language === 'bn' ? 'ডাটাবেজে সংরক্ষিত মোট রেসিপি' : 'Active in database'}</div>
        </div>

        <div className="admin-stat-card glass-panel" style={{ padding: '20px', borderRadius: '18px' }}>
          <div className="stat-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{t('adminTotalIngredients')}</span>
            <Apple size={18} style={{ color: '#10b981' }} />
          </div>
          <div className="stat-value" style={{ fontSize: '1.8rem', fontWeight: 800 }}>{stats?.totalIngredients || 0}</div>
          <div className="stat-subtext" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>{language === 'bn' ? 'ক্যানোনিক্যাল জিআইভি উপাদান' : 'Canonical GIV ingredients'}</div>
        </div>

        <div className="admin-stat-card glass-panel" style={{ padding: '20px', borderRadius: '18px' }}>
          <div className="stat-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{t('adminTotalCuisines')}</span>
            <Globe size={18} style={{ color: '#3b82f6' }} />
          </div>
          <div className="stat-value" style={{ fontSize: '1.8rem', fontWeight: 800 }}>{stats?.totalCuisines || 0}</div>
          <div className="stat-subtext" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>{language === 'bn' ? 'গ্লোবাল রন্ধন ঐতিহ্য' : 'Global traditions'}</div>
        </div>

        <div className="admin-stat-card glass-panel" style={{ padding: '20px', borderRadius: '18px' }}>
          <div className="stat-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{t('adminTotalGenerations')}</span>
            <Sparkles size={18} style={{ color: '#8b5cf6' }} />
          </div>
          <div className="stat-value" style={{ fontSize: '1.8rem', fontWeight: 800 }}>{stats?.totalGenerations || 0}</div>
          <div className="stat-subtext" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>{language === 'bn' ? 'ডাইনামিক কাস্টম শেফ তৈরি' : 'Dynamic bespoke creations'}</div>
        </div>

        <div className="admin-stat-card glass-panel" style={{ padding: '20px', borderRadius: '18px' }}>
          <div className="stat-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{t('adminDbSize')}</span>
            <Database size={18} style={{ color: '#f59e0b' }} />
          </div>
          <div className="stat-value" style={{ fontSize: '1.8rem', fontWeight: 800 }}>{stats?.dbSizeFormatted || 'N/A'}</div>
          <div className="stat-subtext" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>{language === 'bn' ? 'ডাটাবেজ কানেকশন স্ট্যাটাস' : 'Supabase PostgreSQL'}</div>
        </div>

        <div className="admin-stat-card glass-panel" style={{ padding: '20px', borderRadius: '18px' }}>
          <div className="stat-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{t('adminMemoryUptime')}</span>
            <Cpu size={18} style={{ color: '#ec4899' }} />
          </div>
          <div className="stat-value" style={{ fontSize: '1.8rem', fontWeight: 800 }}>{stats?.memoryUsageMB || 0} MB</div>
          <div className="stat-subtext" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>{language === 'bn' ? `আপটাইম: ${Math.floor((stats?.uptimeSeconds || 0) / 60)} মিনিট` : `Uptime: ${Math.floor((stats?.uptimeSeconds || 0) / 60)} mins`}</div>
        </div>
      </div>

      {/* Quick Action Shortcuts */}
      <div className="admin-table-card glass-panel" style={{ padding: '24px', borderRadius: '20px', marginBottom: '28px' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Zap size={18} style={{ color: 'var(--brand-orange)' }} />
          <span>{t('adminQuickActions')}</span>
        </h3>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button 
            type="button" 
            className="btn btn-primary"
            onClick={() => onNavigateTab('recipes', { openCreateModal: true })}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Plus size={16} />
            <span>{t('adminCreateRecipe')}</span>
          </button>
          <button 
            type="button" 
            className="btn btn-secondary"
            onClick={() => onNavigateTab('ingredients', { openCreateModal: true })}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Plus size={16} />
            <span>{t('adminAddIngredient')}</span>
          </button>
          <button 
            type="button" 
            className="btn btn-secondary"
            onClick={handleFlushCache}
            disabled={flushing}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            {flushing ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>{t('adminFlushingCache')}</span>
              </>
            ) : (
              <>
                <RotateCcw size={16} />
                <span>{t('adminFlushCache')}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Two Column Layout: Cuisine Distribution & Top Ingredients */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '24px' }}>
        {/* Cuisine Distribution */}
        <div className="admin-table-card glass-panel" style={{ padding: '24px', borderRadius: '20px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Globe size={18} style={{ color: 'var(--brand-orange)' }} />
              <span>{t('adminCuisineDist')}</span>
            </span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{language === 'bn' ? 'রেসিপি সংখ্যা' : 'Recipe Counts'}</span>
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {stats?.cuisineDistribution?.map((c) => {
              const maxCount = stats.totalRecipes || 1;
              const pct = Math.round((c.count / maxCount) * 100);
              return (
                <div key={c.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '6px' }}>
                    <span style={{ fontWeight: 600, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: c.color || 'var(--brand-orange)' }} />
                      <span>{language === 'bn' && c.nameBn ? c.nameBn : c.name} {c.nameBn && language !== 'bn' ? `(${c.nameBn})` : ''}</span>
                    </span>
                    <span style={{ color: 'var(--text-secondary)' }}>{c.count} {language === 'bn' ? 'টি' : 'recipes'} ({pct}%)</span>
                  </div>
                  <div style={{ height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: c.color || 'var(--brand-orange)', borderRadius: '3px' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Used Ingredients */}
        <div className="admin-table-card glass-panel" style={{ padding: '24px', borderRadius: '20px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Apple size={18} style={{ color: '#10b981' }} />
              <span>{t('adminTopIngredients')}</span>
            </span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{language === 'bn' ? 'ব্যবহারের হার' : 'Frequency'}</span>
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {stats?.topIngredients?.map((ing, idx) => (
              <div 
                key={ing.id}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  background: 'rgba(255,255,255,0.02)',
                  borderRadius: '12px',
                  border: '1px solid rgba(255,255,255,0.05)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', width: '18px' }}>#{idx + 1}</span>
                  <img
                    src={getIngredientImage(ing.id, ing.category)}
                    alt=""
                    style={{ width: '28px', height: '28px', borderRadius: '6px', objectFit: 'cover' }}
                  />
                  <div>
                    <div style={{ fontWeight: 600, color: '#ffffff', fontSize: '0.88rem' }}>
                      {language === 'bn' && ing.nameBn ? ing.nameBn : ing.name} {ing.nameBn && language !== 'bn' ? `(${ing.nameBn})` : ''}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{ing.category}</div>
                  </div>
                </div>
                <span className="badge" style={{ background: 'rgba(255, 107, 53, 0.15)', color: 'var(--brand-orange)', fontWeight: 700 }}>
                  {ing.count} {language === 'bn' ? 'টি' : 'recipes'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
