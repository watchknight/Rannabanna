import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  ShieldCheck, 
  Globe, 
  Home, 
  LogOut, 
  LayoutDashboard, 
  BookOpen, 
  Apple, 
  Settings 
} from 'lucide-react';
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
    <div className="admin-wrapper animate-fade-in" style={{ maxWidth: '1360px', margin: '0 auto', padding: '0 20px 60px' }}>
      {/* Top Bar */}
      <div className="admin-top-bar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div className="admin-title-group">
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0, fontSize: '1.6rem' }}>
            <ShieldCheck size={26} style={{ color: 'var(--brand-orange)' }} />
            <span>{t('adminTitle')}</span>
            <span className="admin-badge">{t('adminBadge')}</span>
          </h1>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '4px' }}>
            {t('adminSubtitle')}
          </div>
        </div>

        <div className="admin-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setLanguage(language === 'en' ? 'bn' : 'en')}
            style={{ padding: '8px 14px', fontSize: '0.85rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            title="Toggle between English and Bengali"
          >
            <Globe size={14} />
            <span>{language === 'en' ? 'বাংলা' : 'English'}</span>
          </button>
          <Link to="/" className="btn btn-secondary" style={{ padding: '8px 14px', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <Home size={14} />
            <span>{t('adminPublicSite')}</span>
          </Link>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleLogout}
            style={{ padding: '8px 14px', fontSize: '0.85rem', color: '#f87171', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <LogOut size={14} />
            <span>{t('adminSignOut')}</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="admin-tabs" style={{ display: 'flex', gap: '8px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '12px', marginBottom: '24px', overflowX: 'auto' }}>
        <button
          type="button"
          className={`admin-tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          <LayoutDashboard size={16} />
          <span>{t('adminTabOverview')}</span>
        </button>
        <button
          type="button"
          className={`admin-tab-btn ${activeTab === 'recipes' ? 'active' : ''}`}
          onClick={() => { setActiveTab('recipes'); setOpenCreateRecipe(false); }}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          <BookOpen size={16} />
          <span>{t('adminTabRecipes')}</span>
        </button>
        <button
          type="button"
          className={`admin-tab-btn ${activeTab === 'ingredients' ? 'active' : ''}`}
          onClick={() => { setActiveTab('ingredients'); setOpenCreateIngredient(false); }}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          <Apple size={16} />
          <span>{t('adminTabIngredients')}</span>
        </button>
        <button
          type="button"
          className={`admin-tab-btn ${activeTab === 'cuisines' ? 'active' : ''}`}
          onClick={() => setActiveTab('cuisines')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          <Globe size={16} />
          <span>{t('adminTabCuisines')}</span>
        </button>
        <button
          type="button"
          className={`admin-tab-btn ${activeTab === 'system' ? 'active' : ''}`}
          onClick={() => setActiveTab('system')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          <Settings size={16} />
          <span>{t('adminTabSystem')}</span>
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
