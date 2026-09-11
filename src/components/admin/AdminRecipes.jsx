import React, { useState, useEffect, useCallback } from 'react';
import { Pencil, Trash2, Plus, AlertCircle, Sparkles } from 'lucide-react';
import { useDatabase } from '../../context/DatabaseContext.jsx';
import { API_BASE, safeParseJson } from '../../utils/apiConfig.js';
import { getRecipeImage, getCuisineImage } from '../../utils/imageAssets.js';
import AdminRecipeModal from './AdminRecipeModal';

export default function AdminRecipes({ token, cuisines = [], initialOpenCreate = false }) {
  const { language, t } = useDatabase();
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [cuisineFilter, setCuisineFilter] = useState('all');
  const [difficultyFilter, setDifficultyFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(initialOpenCreate);
  const [editingRecipeId, setEditingRecipeId] = useState(null);
  const [feedbackMessage, setFeedbackMessage] = useState('');

  const fetchRecipes = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20'
      });
      if (search.trim()) params.set('search', search.trim());
      if (cuisineFilter !== 'all') params.set('cuisineId', cuisineFilter);
      if (difficultyFilter !== 'all') params.set('difficulty', difficultyFilter);

      const res = await fetch(`${API_BASE}/api/admin/recipes?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await safeParseJson(res);
      if (!res.ok) throw new Error(data.message || 'Failed to load recipes');
      setRecipes(data.recipes || []);
      setTotalPages(data.totalPages || 1);
      setTotalCount(data.total || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [token, page, search, cuisineFilter, difficultyFilter]);

  useEffect(() => {
    fetchRecipes();
  }, [fetchRecipes]);

  const handleDelete = async (id, title) => {
    const confirmText = language === 'bn'
      ? `আপনি কি নিশ্চিতভাবে "${title}" (${id}) রেসিপিটি মুছে ফেলতে চান? এর সাথে যুক্ত সকল ধাপ ও উপাদান লিংক স্থায়ীভাবে মুছে যাবে।`
      : `Are you sure you want to delete "${title}" (${id})? This will permanently remove all associated steps and ingredient links.`;

    if (!window.confirm(confirmText)) {
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/admin/recipes/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await safeParseJson(res);
      if (!res.ok) throw new Error(data.message || 'Failed to delete recipe');

      setFeedbackMessage(language === 'bn' ? `"${title}" রেসিপি সফলভাবে মুছে ফেলা হয়েছে।` : `Recipe "${title}" deleted successfully.`);
      fetchRecipes();
    } catch (err) {
      setFeedbackMessage(err.message);
    } finally {
      setTimeout(() => setFeedbackMessage(''), 5000);
    }
  };

  const handleOpenEdit = (id) => {
    setEditingRecipeId(id);
    setIsModalOpen(true);
  };

  const handleOpenCreate = () => {
    setEditingRecipeId(null);
    setIsModalOpen(true);
  };

  return (
    <div className="admin-recipes-tab">
      {feedbackMessage && (
        <div className="admin-success-banner" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertCircle size={16} />
          {feedbackMessage}
        </div>
      )}

      {/* Toolbar */}
      <div className="admin-toolbar">
        <div className="admin-filter-group">
          <input
            type="text"
            className="admin-search-input"
            placeholder={t('adminSearchRecipesPlaceholder')}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />

          <select
            className="admin-select"
            value={cuisineFilter}
            onChange={(e) => { setCuisineFilter(e.target.value); setPage(1); }}
          >
            <option value="all">{t('adminAllCuisines')}</option>
            {cuisines.map(c => (
              <option key={c.id} value={c.id}>{language === 'bn' && c.nameBn ? c.nameBn : c.name}</option>
            ))}
          </select>

          <select
            className="admin-select"
            value={difficultyFilter}
            onChange={(e) => { setDifficultyFilter(e.target.value); setPage(1); }}
          >
            <option value="all">{t('adminAllDifficulties')}</option>
            <option value="easy">{language === 'bn' ? 'সহজ (Easy)' : 'Easy'}</option>
            <option value="intermediate">{language === 'bn' ? 'মাঝারি (Intermediate)' : 'Intermediate'}</option>
            <option value="advanced">{language === 'bn' ? 'কঠিন (Advanced)' : 'Advanced'}</option>
          </select>
        </div>

        <button type="button" className="btn btn-primary" onClick={handleOpenCreate}>
          <Plus size={16} style={{ display: 'inline', marginRight: '6px' }} />
          {t('adminCreateRecipe')}
        </button>
      </div>

      {/* Recipes Table Card */}
      <div className="admin-table-card">
        <div className="admin-table-responsive">
          <table className="admin-table">
            <thead>
              <tr>
                <th style={{ width: '64px' }}>Visual</th>
                <th>{language === 'bn' ? 'রেসিপির নাম' : 'Title & Bengali'}</th>
                <th>{t('cuisines')}</th>
                <th>{language === 'bn' ? 'কঠিনতা' : 'Difficulty'}</th>
                <th>{language === 'bn' ? 'সময়' : 'Time'}</th>
                <th>{t('servingsLabel')}</th>
                <th>{t('caloriesLabel')}</th>
                <th style={{ textAlign: 'right', width: '100px' }}>{t('adminActions')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '40px' }}>
                    Loading recipes catalog...
                  </td>
                </tr>
              ) : recipes.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '40px' }}>
                    No recipes found matching your filters.
                  </td>
                </tr>
              ) : (
                recipes.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <div style={{ width: '42px', height: '42px', borderRadius: '10px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
                        <img 
                          src={getRecipeImage(r.id, r.cuisineId)} 
                          alt={r.title} 
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = getCuisineImage(r.cuisineId);
                          }}
                        />
                      </div>
                    </td>
                    <td>
                      <div className="table-recipe-title">{r.title}</div>
                      {r.titleBn && (
                        <div className="table-sub" style={{ color: 'var(--brand-pink)' }}>{r.titleBn}</div>
                      )}
                      <div className="table-sub" style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{r.id}</div>
                    </td>
                    <td>
                      <span className="badge" style={{ textTransform: 'capitalize' }}>
                        {r.cuisineId}
                      </span>
                    </td>
                    <td>
                      <span 
                        className="badge" 
                        style={{
                          textTransform: 'capitalize',
                          background: r.difficulty === 'easy' ? 'rgba(16, 185, 129, 0.2)' : r.difficulty === 'advanced' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                          color: r.difficulty === 'easy' ? '#34d399' : r.difficulty === 'advanced' ? '#f87171' : '#fbbf24'
                        }}
                      >
                        {r.difficulty}
                      </span>
                    </td>
                    <td>{((r.prepTime || 0) + (r.cookTime || 0))} min</td>
                    <td>{r.servings || 4}</td>
                    <td>{r.calories ? `${r.calories} kcal` : '—'}</td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '6px' }}>
                        <button
                          type="button"
                          className="btn-icon"
                          title="Edit Recipe"
                          onClick={() => handleOpenEdit(r.id)}
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          type="button"
                          className="btn-icon btn-danger"
                          title="Delete Recipe"
                          onClick={() => handleDelete(r.id, r.title)}
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

        {/* Pagination Bar */}
        <div className="admin-pagination">
          <div>
            {t('adminShowing')} <strong>{recipes.length}</strong> {t('adminOf')} <strong>{totalCount}</strong> {t('adminRecipesUnit')}
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

      {/* Add / Edit Recipe Modal */}
      <AdminRecipeModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSaved={() => {
          setIsModalOpen(false);
          setFeedbackMessage('Recipe saved and in-memory caches synchronized.');
          fetchRecipes();
          setTimeout(() => setFeedbackMessage(''), 5000);
        }}
        recipeId={editingRecipeId}
        token={token}
        cuisines={cuisines}
      />
    </div>
  );
}
