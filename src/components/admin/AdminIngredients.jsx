import React, { useState, useEffect, useCallback } from 'react';
import { useDatabase } from '../../context/DatabaseContext.jsx';
import { translateCategory } from '../../utils/translations.js';
import { API_BASE, safeParseJson } from '../../utils/apiConfig.js';
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
  const { language, t } = useDatabase();
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(initialOpenCreate);
  const [editingIngredient, setEditingIngredient] = useState(null);
  const [feedbackMessage, setFeedbackMessage] = useState('');

  const fetchIngredients = useCallback(async () => {
    try {
      setLoading(true);
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
      if (!res.ok) throw new Error(data.message || 'Failed to load ingredients');
      setIngredients(data.ingredients || []);
      setTotalPages(data.totalPages || 1);
      setTotalCount(data.total || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [token, page, search, categoryFilter]);

  useEffect(() => {
    fetchIngredients();
  }, [fetchIngredients]);

  const handleDelete = async (id, name, recipeCount) => {
    if (recipeCount > 0) {
      alert(language === 'bn'
        ? `⚠️ "${name}" উপাদানটি মোছা যাবে না: এটি বর্তমানে ${recipeCount}টি রেসিপিতে ব্যবহৃত হচ্ছে।`
        : `⚠️ Cannot delete "${name}": It is currently used in ${recipeCount} recipe(s). Please remove it from those recipes first.`);
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

      setFeedbackMessage(language === 'bn' ? `✅ "${name}" উপাদান জিআইভি থেকে সফলভাবে মোছা হয়েছে।` : `✅ Ingredient "${name}" deleted from GIV.`);
      fetchIngredients();
    } catch (err) {
      setFeedbackMessage(`❌ ${err.message}`);
    } finally {
      setTimeout(() => setFeedbackMessage(''), 5000);
    }
  };

  return (
    <div className="admin-ingredients-tab">
      {feedbackMessage && (
        <div className={feedbackMessage.startsWith('✅') ? 'admin-success-banner' : 'admin-error-banner'}>
          {feedbackMessage}
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
                    <td style={{ fontSize: '1.4rem' }}>{ing.emoji || '🧂'}</td>
                    <td>
                      <div className="table-recipe-title">
                        {language === 'bn' && ing.nameBn ? ing.nameBn : ing.name}
                      </div>
                      {ing.nameBn && language !== 'bn' && (
                        <div className="table-sub" style={{ color: 'var(--brand-pink)' }}>{ing.nameBn}</div>
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
                        {ing.spicy > 0 && <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', fontSize: '0.7rem' }}>🌶️ {ing.spicy}</span>}
                        {ing.sweet > 0 && <span className="badge" style={{ background: 'rgba(236, 72, 153, 0.15)', color: '#f472b6', fontSize: '0.7rem' }}>🍬 {ing.sweet}</span>}
                        {ing.sour > 0 && <span className="badge" style={{ background: 'rgba(234, 179, 8, 0.15)', color: '#facc15', fontSize: '0.7rem' }}>🍋 {ing.sour}</span>}
                        {ing.umami > 0 && <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', fontSize: '0.7rem' }}>🍄 {ing.umami}</span>}
                        {ing.salty > 0 && <span className="badge" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', fontSize: '0.7rem' }}>🧂 {ing.salty}</span>}
                        {ing.bitter > 0 && <span className="badge" style={{ background: 'rgba(139, 92, 246, 0.15)', color: '#a78bfa', fontSize: '0.7rem' }}>☕ {ing.bitter}</span>}
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
                          title={language === 'bn' ? 'উপাদান সম্পাদনা' : 'Edit Ingredient'}
                          onClick={() => { setEditingIngredient(ing); setIsModalOpen(true); }}
                        >
                          ✏️
                        </button>
                        <button
                          type="button"
                          className="btn-icon btn-danger"
                          title={ing.recipeCount > 0 ? (language === 'bn' ? 'উপাদানটি রেসিপিতে ব্যবহৃত হচ্ছে' : 'Ingredient in use') : (language === 'bn' ? 'উপাদান মুছুন' : 'Delete Ingredient')}
                          onClick={() => handleDelete(ing.id, ing.name, ing.recipeCount)}
                        >
                          🗑️
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
          setFeedbackMessage('✅ Ingredient saved to GIV and cache re-hydrated.');
          fetchIngredients();
          setTimeout(() => setFeedbackMessage(''), 5000);
        }}
        ingredient={editingIngredient}
        token={token}
      />
    </div>
  );
}
