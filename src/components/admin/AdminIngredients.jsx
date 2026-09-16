import React, { useState, useEffect, useCallback } from 'react';
import { Pencil, Trash2, Plus, Search, AlertCircle, RefreshCw, AlertTriangle } from 'lucide-react';
import { useDatabase } from '../../context/DatabaseContext.jsx';
import { translateCategory } from '../../utils/translations.js';
import { API_BASE, safeParseJson } from '../../utils/apiConfig.js';
import { getIngredientImage } from '../../utils/imageAssets.js';
import AdminIngredientModal from './AdminIngredientModal';

const CATEGORIES = [
  'all',
  'Pantry & Spices',
  'Produce',
  'Meat & Seafood',
  'Dairy & Eggs',
  'Grains & Pasta',
  'Condiments & Sauces',
  'Oils & Fats',
  'Bakery & Dough',
  'Beverages & Liquids'
];

export default function AdminIngredients({ token, initialOpenCreate = false }) {
  const { language, t, ingredients: localIngredients, recipes: localRecipes } = useDatabase();
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(initialOpenCreate);
  const [editingIngredient, setEditingIngredient] = useState(null);
  const [feedbackMessage, setFeedbackMessage] = useState('');

  const fetchIngredients = useCallback(async (isExplicitRetry = false) => {
    if (isExplicitRetry) setIsRetrying(true);
    try {
      setLoading(true);
      setErrorMessage('');
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '30'
      });
      if (search.trim()) params.set('search', search.trim());
      if (categoryFilter !== 'all') params.set('category', categoryFilter);

      const res = await fetch(`${API_BASE}/api/admin/ingredients?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await safeParseJson(res);
      if (!res.ok) throw new Error(data.message || 'Failed to load ingredients from server');
      setIngredients(data.ingredients || []);
      setTotalPages(data.totalPages || 1);
      setTotalCount(data.total || 0);
      setIsOffline(false);
    } catch (err) {
      console.warn('Backend server unreachable, falling back to local cached ingredients:', err.message);
      setIsOffline(true);
      setErrorMessage(err.message || 'Backend connection failed');

      // Precalculate recipe usage counts for each ingredient across all local recipes
      const usageCounts = {};
      (localRecipes || []).forEach(r => {
        (r.ingredients || []).forEach(item => {
          const ingId = item.ingredientId || item.id;
          if (ingId) {
            usageCounts[ingId] = (usageCounts[ingId] || 0) + 1;
          }
        });
      });

      // Normalize flavor profile and data structure from local ingredients
      let filtered = (localIngredients || []).map(ing => ({
        ...ing,
        spicy: ing.spicy ?? ing.flavorProfile?.spicy ?? 0,
        sweet: ing.sweet ?? ing.flavorProfile?.sweet ?? 0,
        sour: ing.sour ?? ing.flavorProfile?.sour ?? 0,
        bitter: ing.bitter ?? ing.flavorProfile?.bitter ?? 0,
        umami: ing.umami ?? ing.flavorProfile?.umami ?? 0,
        salty: ing.salty ?? ing.flavorProfile?.salty ?? 0,
        recipeCount: ing.recipeCount ?? usageCounts[ing.id] ?? 0
      }));

      const q = search.trim().toLowerCase();
      if (q) {
        filtered = filtered.filter(ing => 
          (ing.name && ing.name.toLowerCase().includes(q)) ||
          (ing.nameBn && ing.nameBn.toLowerCase().includes(q)) ||
          (ing.id && ing.id.toLowerCase().includes(q)) ||
          (ing.category && ing.category.toLowerCase().includes(q)) ||
          (ing.subCategory && ing.subCategory.toLowerCase().includes(q))
        );
      }

      if (categoryFilter !== 'all') {
        filtered = filtered.filter(ing => ing.category === categoryFilter);
      }

      const total = filtered.length;
      const pages = Math.max(1, Math.ceil(total / 30));
      const currentPage = Math.min(page, pages);
      const start = (currentPage - 1) * 30;
      const paged = filtered.slice(start, start + 30);

      setIngredients(paged);
      setTotalPages(pages);
      setTotalCount(total);
    } finally {
      setLoading(false);
      setIsRetrying(false);
    }
  }, [token, page, search, categoryFilter, localIngredients, localRecipes]);

  useEffect(() => {
    fetchIngredients();
  }, [fetchIngredients]);

  const handleDelete = async (id, name, recipeCount) => {
    if (isOffline) {
      alert(language === 'bn'
        ? 'অফলাইন ক্যাটালগ মোডে উপাদান মোছা সম্ভব নয়। ডাটাবেজ আপডেট করতে সার্ভার চালু করুন (npm run dev)।'
        : 'Cannot delete ingredients in Offline Catalog Mode. Start the backend server with "npm run dev" to enable database modifications.');
      return;
    }

    if (recipeCount > 0) {
      alert(language === 'bn'
        ? `"${name}" উপাদানটি মোছা যাবে না: এটি বর্তমানে ${recipeCount}টি রেসিপিতে ব্যবহৃত হচ্ছে।`
        : `Cannot delete "${name}": It is currently used in ${recipeCount} recipe(s). Please remove it from those recipes first.`);
      return;
    }

    const confirmText = language === 'bn'
      ? `আপনি কি নিশ্চিতভাবে "${name}" (${id}) উপাদানটি জিআইভি থেকে মুছে ফেলতে চান?`
      : `Are you sure you want to delete "${name}" (${id}) from the Global Ingredient Vault?`;

    if (!window.confirm(confirmText)) {
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/admin/ingredients/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await safeParseJson(res);
      if (!res.ok) throw new Error(data.message || 'Failed to delete ingredient');

      setFeedbackMessage(language === 'bn' ? `"${name}" উপাদান জিআইভি থেকে সফলভাবে মোছা হয়েছে।` : `Ingredient "${name}" deleted from GIV.`);
      fetchIngredients();
    } catch (err) {
      setFeedbackMessage(err.message);
    } finally {
      setTimeout(() => setFeedbackMessage(''), 5000);
    }
  };

  return (
    <div className="admin-ingredients-tab">
      {feedbackMessage && (
        <div className="admin-success-banner" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertCircle size={16} />
          {feedbackMessage}
        </div>
      )}

      {isOffline && (
        <div className="admin-warning-banner" role="alert">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertTriangle size={18} style={{ color: '#fbbf24', flexShrink: 0 }} />
            <div>
              <strong>{language === 'bn' ? 'অফলাইন ক্যাটালগ মোড:' : 'Offline Catalog Mode:'}</strong>{' '}
              {language === 'bn'
                ? 'ব্যাকএন্ড সার্ভারের (localhost:3001) সাথে সংযোগ পাওয়া যায়নি। লোকাল উপাদান ক্যাটালগ প্রদর্শিত হচ্ছে। উপাদান সংযোজন বা পরিবর্তন করতে "npm run dev" চালান।'
                : 'Backend server (localhost:3001) is offline or unreachable. Displaying local ingredients catalog. Run "npm run dev" to enable database modifications.'}
            </div>
          </div>
          <button
            type="button"
            className="admin-retry-btn"
            onClick={() => fetchIngredients(true)}
            disabled={isRetrying || loading}
          >
            <RefreshCw size={13} className={isRetrying ? 'animate-spin' : ''} />
            {isRetrying ? (language === 'bn' ? 'সংযোগ পরীক্ষা হচ্ছে...' : 'Retrying...') : (language === 'bn' ? 'পুনরায় সংযোগ পরীক্ষা' : 'Retry Connection')}
          </button>
        </div>
      )}

      {/* Toolbar */}
      <div className="admin-toolbar">
        <div className="admin-filter-group">
          <input
            type="text"
            className="admin-search-input"
            placeholder={t('adminSearchIngredientsPlaceholder')}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />

          <select
            className="admin-select"
            value={categoryFilter}
            onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
          >
            {CATEGORIES.map(cat => (
              <option key={cat} value={cat}>
                {cat === 'all' ? (language === 'bn' ? 'সকল ক্যাটাগরি' : 'All Categories') : translateCategory(cat, language)}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          className="btn btn-primary"
          onClick={() => { setEditingIngredient(null); setIsModalOpen(true); }}
        >
          + {t('adminAddIngredient')}
        </button>
      </div>

      {/* Table Card */}
      <div className="admin-table-card">
        <div className="admin-table-responsive">
          <table className="admin-table">
            <thead>
              <tr>
                <th style={{ width: '50px' }}>Icon</th>
                <th>{language === 'bn' ? 'উপাদান ও বাংলা' : 'Name & Bengali'}</th>
                <th>{language === 'bn' ? 'ক্যাটাগরি' : 'Category / Sub'}</th>
                <th>{language === 'bn' ? 'প্রধান উপাদান' : 'Staple'}</th>
                <th>{language === 'bn' ? 'স্বাদের মাত্রা' : 'Flavor Profile'}</th>
                <th>{language === 'bn' ? 'রেসিপিতে ব্যবহার' : 'Used In'}</th>
                <th style={{ textAlign: 'right', width: '100px' }}>{t('adminActions')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '40px' }}>
                    Loading Global Ingredient Vault...
                  </td>
                </tr>
              ) : ingredients.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '40px' }}>
                    No ingredients found.
                  </td>
                </tr>
              ) : (
                ingredients.map((ing) => (
                  <tr key={ing.id}>
                    <td>
                      <img 
                        src={getIngredientImage(ing.id, ing.category)} 
                        alt="" 
                        style={{ width: '36px', height: '36px', borderRadius: '8px', objectFit: 'cover' }} 
                      />
                    </td>
                    <td>
                      <div className="table-recipe-title">
                        {language === 'bn' && ing.nameBn ? ing.nameBn : ing.name}
                      </div>
                      {ing.nameBn && language !== 'bn' && (
                        <div className="table-sub" style={{ color: 'var(--brand-orange)' }}>{ing.nameBn}</div>
                      )}
                      <div className="table-sub" style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{ing.id}</div>
                    </td>
                    <td>
                      <div>{translateCategory(ing.category, language)}</div>
                      <div className="table-sub">{ing.subCategory || (language === 'bn' ? 'সাধারণ' : 'General')}</div>
                    </td>
                    <td>
                      {ing.isCommon ? (
                        <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#34d399' }}>
                          {language === 'bn' ? 'স্ট্যাপল' : 'Staple'}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                          {language === 'bn' ? 'বিশেষ' : 'Specialty'}
                        </span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', maxWidth: '200px' }}>
                        {ing.spicy > 0 && <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', fontSize: '0.7rem' }}>Spicy: {ing.spicy}</span>}
                        {ing.sweet > 0 && <span className="badge" style={{ background: 'rgba(236, 72, 153, 0.15)', color: '#f472b6', fontSize: '0.7rem' }}>Sweet: {ing.sweet}</span>}
                        {ing.sour > 0 && <span className="badge" style={{ background: 'rgba(234, 179, 8, 0.15)', color: '#facc15', fontSize: '0.7rem' }}>Sour: {ing.sour}</span>}
                        {ing.umami > 0 && <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', fontSize: '0.7rem' }}>Umami: {ing.umami}</span>}
                        {ing.salty > 0 && <span className="badge" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', fontSize: '0.7rem' }}>Salty: {ing.salty}</span>}
                        {ing.bitter > 0 && <span className="badge" style={{ background: 'rgba(139, 92, 246, 0.15)', color: '#a78bfa', fontSize: '0.7rem' }}>Bitter: {ing.bitter}</span>}
                      </div>
                    </td>
                    <td>
                      <span className="badge" style={{ fontWeight: 700 }}>
                        {ing.recipeCount || 0} {language === 'bn' ? 'টি রেসিপি' : 'recipes'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '6px' }}>
                        <button
                          type="button"
                          className="btn-icon"
                          title="Edit Ingredient"
                          onClick={() => handleOpenEdit(ing)}
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          type="button"
                          className="btn-icon btn-danger"
                          title="Delete Ingredient"
                          onClick={() => handleDelete(ing.id, ing.name, ing.recipeCount)}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="admin-pagination">
          <div>
            {t('adminShowing')} <strong>{ingredients.length}</strong> {t('adminOf')} <strong>{totalCount}</strong> {t('adminIngredientsUnit')}
          </div>
          <div className="pagination-controls">
            <button
              type="button"
              className="btn btn-secondary"
              disabled={page <= 1 || loading}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              style={{ padding: '4px 10px', fontSize: '0.8rem' }}
            >
              {t('adminPrevious')}
            </button>
            <span>{t('adminPage')} {page} {t('adminOf')} {totalPages || 1}</span>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={page >= totalPages || loading}
              onClick={() => setPage(p => p + 1)}
              style={{ padding: '4px 10px', fontSize: '0.8rem' }}
            >
              {t('adminNext')}
            </button>
          </div>
        </div>
      </div>

      <AdminIngredientModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSaved={() => {
          setIsModalOpen(false);
          setFeedbackMessage('Ingredient saved to GIV and cache re-hydrated.');
          fetchIngredients();
          setTimeout(() => setFeedbackMessage(''), 5000);
        }}
        ingredient={editingIngredient}
        token={token}
        isOffline={isOffline}
      />
    </div>
  );
}
