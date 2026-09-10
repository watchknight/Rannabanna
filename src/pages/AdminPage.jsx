import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useDatabase } from '../context/DatabaseContext';
import { API_BASE, safeParseJson } from '../utils/apiConfig.js';
import AdminLogin from '../components/admin/AdminLogin';
import AdminOverview from '../components/admin/AdminOverview';
import AdminRecipes from '../components/admin/AdminRecipes';
import AdminIngredients from '../components/admin/AdminIngredients';
import AdminCuisines from '../components/admin/AdminCuisines';
import AdminSystem from '../components/admin/AdminSystem';
import '../styles/admin.css';

export default function AdminPage() {
  const { language, setLanguage, t } = useDatabase();
  const [token, setToken] = useState(() => {
    return sessionStorage.getItem('rannabanna_admin_token') || localStorage.getItem('rannabanna_admin_token') || null;
  });

  const [activeTab, setActiveTab] = useState('overview');
  const [cuisines, setCuisines] = useState([]);
  const [openCreateRecipe, setOpenCreateRecipe] = useState(false);
  const [openCreateIngredient, setOpenCreateIngredient] = useState(false);

  // Fetch cuisines list when logged in
  useEffect(() => {
    if (!token) return;

    const fetchCuisines = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/admin/cuisines`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await safeParseJson(res);
        if (res.ok) {
          setCuisines(data);
        } else if (res.status === 401) {
          // Token expired or invalid
          handleLogout();
        }
      } catch (err) {
        console.error('Failed to load cuisines:', err);
      }
    };

    fetchCuisines();
  }, [token]);

  const handleLoginSuccess = (newToken) => {
    setToken(newToken);
    sessionStorage.setItem('rannabanna_admin_token', newToken);
  };

  const handleLogout = async () => {
    if (token) {
      try {
        await fetch(`${API_BASE}/api/admin/logout`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        });
      } catch {
        // ignore
      }
    }
    sessionStorage.removeItem('rannabanna_admin_token');
    localStorage.removeItem('rannabanna_admin_token');
    setToken(null);
  };

  const handleNavigateTab = (tab, options = {}) => {
    setActiveTab(tab);
    if (options.openCreateModal) {
      if (tab === 'recipes') setOpenCreateRecipe(true);
      if (tab === 'ingredients') setOpenCreateIngredient(true);
    }
  };

  // Render Login screen if not authenticated
  if (!token) {
    return <AdminLogin onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="admin-wrapper animate-fade-in">
      {/* Top Bar */}
      <div className="admin-top-bar">
        <div className="admin-title-group">
          <h1>
            <span>🍳 {t('adminTitle')}</span>
            <span className="admin-badge">{t('adminBadge')}</span>
          </h1>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            {t('adminSubtitle')}
          </div>
        </div>

        <div className="admin-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setLanguage(language === 'en' ? 'bn' : 'en')}
            style={{ padding: '8px 14px', fontSize: '0.85rem', fontWeight: 600 }}
            title="Toggle between English and Bengali"
          >
            🌐 {language === 'en' ? 'বাংলা' : 'English'}
          </button>
          <Link to="/" className="btn btn-secondary" style={{ padding: '8px 14px', fontSize: '0.85rem' }}>
            🏠 {t('adminPublicSite')}
          </Link>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleLogout}
            style={{ padding: '8px 14px', fontSize: '0.85rem', color: '#f87171' }}
          >
            🔒 {t('adminSignOut')}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="admin-tabs">
        <button
          type="button"
          className={`admin-tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          📊 {t('adminTabOverview')}
        </button>
        <button
          type="button"
          className={`admin-tab-btn ${activeTab === 'recipes' ? 'active' : ''}`}
          onClick={() => { setActiveTab('recipes'); setOpenCreateRecipe(false); }}
        >
          🍲 {t('adminTabRecipes')}
        </button>
        <button
          type="button"
          className={`admin-tab-btn ${activeTab === 'ingredients' ? 'active' : ''}`}
          onClick={() => { setActiveTab('ingredients'); setOpenCreateIngredient(false); }}
        >
          🧂 {t('adminTabIngredients')}
        </button>
        <button
          type="button"
          className={`admin-tab-btn ${activeTab === 'cuisines' ? 'active' : ''}`}
          onClick={() => setActiveTab('cuisines')}
        >
          🌍 {t('adminTabCuisines')}
        </button>
        <button
          type="button"
          className={`admin-tab-btn ${activeTab === 'system' ? 'active' : ''}`}
          onClick={() => setActiveTab('system')}
        >
          ⚙️ {t('adminTabSystem')}
        </button>
      </div>

      {/* Active Tab Views */}
      {activeTab === 'overview' && (
        <AdminOverview token={token} onNavigateTab={handleNavigateTab} />
      )}

      {activeTab === 'recipes' && (
        <AdminRecipes
          token={token}
          cuisines={cuisines}
          initialOpenCreate={openCreateRecipe}
        />
      )}

      {activeTab === 'ingredients' && (
        <AdminIngredients
          token={token}
          initialOpenCreate={openCreateIngredient}
        />
      )}

      {activeTab === 'cuisines' && (
        <AdminCuisines token={token} />
      )}

      {activeTab === 'system' && (
        <AdminSystem token={token} />
      )}
    </div>
  );
}
