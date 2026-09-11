import React, { useState, useEffect } from 'react';
import { Pencil, Trash2, Plus, X, AlertCircle, Globe } from 'lucide-react';
import { useDatabase } from '../../context/DatabaseContext.jsx';
import { API_BASE, safeParseJson } from '../../utils/apiConfig.js';
import { getCuisineImage } from '../../utils/imageAssets.js';

export default function AdminCuisines({ token }) {
  const { language, t } = useDatabase();
  const [cuisines, setCuisines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCuisine, setEditingCuisine] = useState(null);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState('');

  const [formData, setFormData] = useState({
    id: '',
    name: '',
    nameBn: '',
    region: 'Global',
    regionBn: '',
    continent: 'Asia',
    description: '',
    descriptionBn: '',
    color: '#FF6B35',
    emoji: '🌍'
  });

  const fetchCuisines = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/admin/cuisines`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await safeParseJson(res);
      if (!res.ok) throw new Error(data.message || 'Failed to load cuisines');
      setCuisines(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCuisines();
  }, [token]);

  const handleOpenEdit = (c) => {
    setEditingCuisine(c);
    setFormData({
      id: c.id || '',
      name: c.name || '',
      nameBn: c.nameBn || '',
      region: c.region || '',
      regionBn: c.regionBn || '',
      continent: c.continent || '',
      description: c.description || '',
      descriptionBn: c.descriptionBn || '',
      color: c.color || '#FF6B35',
      emoji: c.emoji || '🌍'
    });
    setModalError('');
    setIsModalOpen(true);
  };

  const handleOpenCreate = () => {
    setEditingCuisine(null);
    setFormData({
      id: '',
      name: '',
      nameBn: '',
      region: 'South Asia',
      regionBn: '',
      continent: 'Asia',
      description: '',
      descriptionBn: '',
      color: '#FF6B35',
      emoji: '🌍'
    });
    setModalError('');
    setIsModalOpen(true);
  };

  const handleDelete = async (id, name, count) => {
    if (count > 0) {
      alert(language === 'bn'
        ? `"${name}" রন্ধনশৈলীটি মোছা যাবে না: ${count}টি রেসিপি এই রন্ধনশৈলীতে যুক্ত আছে।`
        : `Cannot delete "${name}": ${count} recipe(s) are assigned to this cuisine. Please reassign or remove those recipes first.`);
      return;
    }

    const confirmText = language === 'bn'
      ? `আপনি কি নিশ্চিতভাবে "${name}" (${id}) রন্ধনশৈলীটি মুছে ফেলতে চান?`
      : `Are you sure you want to delete "${name}" (${id})?`;

    if (!window.confirm(confirmText)) {
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/admin/cuisines/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await safeParseJson(res);
      if (!res.ok) throw new Error(data.message || 'Failed to delete cuisine');

      setFeedbackMessage(language === 'bn' ? `"${name}" রন্ধনশৈলী সফলভাবে মোছা হয়েছে।` : `Cuisine "${name}" deleted.`);
      fetchCuisines();
    } catch (err) {
      setFeedbackMessage(err.message);
    } finally {
      setTimeout(() => setFeedbackMessage(''), 5000);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.id.trim() || !formData.name.trim()) {
      setModalError('ID and Name are required.');
      return;
    }

    setSaving(true);
    setModalError('');

    try {
      const url = editingCuisine ? `${API_BASE}/api/admin/cuisines/${editingCuisine.id}` : `${API_BASE}/api/admin/cuisines`;
      const method = editingCuisine ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      const data = await safeParseJson(res);
      if (!res.ok) throw new Error(data.message || 'Failed to save cuisine');

      setIsModalOpen(false);
      setFeedbackMessage(`Cuisine "${formData.name}" saved.`);
      fetchCuisines();
      setTimeout(() => setFeedbackMessage(''), 5000);
    } catch (err) {
      setModalError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-cuisines-tab">
      {feedbackMessage && (
        <div className="admin-success-banner" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertCircle size={16} />
          {feedbackMessage}
        </div>
      )}

      <div className="admin-toolbar">
        <div>
          <h3 style={{ fontSize: '1.2rem', margin: 0 }}>{t('adminCuisinesCatalog')} ({cuisines.length})</h3>
        </div>
        <button type="button" className="btn btn-primary" onClick={handleOpenCreate}>
          <Plus size={16} style={{ display: 'inline', marginRight: '6px' }} />
          {t('adminAddCuisineBtn')}
        </button>
      </div>

      <div className="admin-table-card">
        <div className="admin-table-responsive">
          <table className="admin-table">
            <thead>
              <tr>
                <th style={{ width: '64px' }}>Visual</th>
                <th>{language === 'bn' ? 'রন্ধনশৈলী ও বাংলা' : 'Cuisine & Bengali'}</th>
                <th>{language === 'bn' ? 'অঞ্চল ও মহাদেশ' : 'Region & Continent'}</th>
                <th>{language === 'bn' ? 'থিম কালার' : 'Theme Color'}</th>
                <th>{language === 'bn' ? 'রেসিপি সংখ্যা' : 'Recipes'}</th>
                <th style={{ textAlign: 'right', width: '100px' }}>{t('adminActions')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '40px' }}>
                    Loading cuisines...
                  </td>
                </tr>
              ) : (
                cuisines.map(c => (
                  <tr key={c.id}>
                    <td>
                      <div style={{ width: '42px', height: '42px', borderRadius: '10px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
                        <img 
                          src={getCuisineImage(c.id)} 
                          alt={c.name} 
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                        />
                      </div>
                    </td>
                    <td>
                      <div className="table-recipe-title">
                        {language === 'bn' && c.nameBn ? c.nameBn : c.name}
                      </div>
                      {c.nameBn && language !== 'bn' && (
                        <div className="table-sub" style={{ color: 'var(--brand-pink)' }}>{c.nameBn}</div>
                      )}
                      <div className="table-sub" style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{c.id}</div>
                    </td>
                    <td>
                      <div>
                        {language === 'bn' && c.regionBn ? c.regionBn : c.region} {c.regionBn && language !== 'bn' ? `(${c.regionBn})` : ''}
                      </div>
                      <div className="table-sub">{c.continent}</div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '16px', height: '16px', borderRadius: '4px', background: c.color || '#FF6B35' }} />
                        <code style={{ fontSize: '0.8rem' }}>{c.color || '#FF6B35'}</code>
                      </div>
                    </td>
                    <td>
                      <span className="badge" style={{ fontWeight: 700 }}>
                        {c.recipeCount || 0} {language === 'bn' ? 'টি রেসিপি' : 'recipes'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '6px' }}>
                        <button
                          type="button"
                          className="btn-icon"
                          title={t('adminEdit')}
                          onClick={() => handleOpenEdit(c)}
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          type="button"
                          className="btn-icon btn-danger"
                          title={c.recipeCount > 0 ? (language === 'bn' ? 'রেসিপি যুক্ত থাকায় মোছা যাবে না' : 'Cannot delete with active recipes') : t('adminDelete')}
                          onClick={() => handleDelete(c.id, c.name, c.recipeCount)}
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
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="admin-modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="admin-modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="admin-modal-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Globe size={18} style={{ color: 'var(--brand-orange)' }} />
                {editingCuisine ? (language === 'bn' ? `রন্ধনশৈলী সম্পাদনা: ${editingCuisine.name}` : `Edit Cuisine: ${editingCuisine.name}`) : (language === 'bn' ? 'নতুন রন্ধনশৈলী যোগ করুন' : 'Add New Cuisine')}
              </h3>
              <button type="button" className="btn-icon" onClick={() => setIsModalOpen(false)}>
                <X size={16} />
              </button>
            </div>

            <div className="admin-modal-body">
              {modalError && (
                <div className="admin-error-banner" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertCircle size={16} />
                  {modalError}
                </div>
              )}

              <form id="cuisine-modal-form" onSubmit={handleSubmit}>
                <div className="admin-form-grid">
                  <div className="admin-form-group">
                    <label>English Name *</label>
                    <input
                      type="text"
                      className="admin-form-input"
                      value={formData.name}
                      onChange={(e) => {
                        const name = e.target.value;
                        if (!editingCuisine) {
                          const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
                          setFormData({ ...formData, name, id: slug });
                        } else {
                          setFormData({ ...formData, name });
                        }
                      }}
                      required
                    />
                  </div>

                  <div className="admin-form-group">
                    <label>Bengali Name (বাংলা নাম)</label>
                    <input
                      type="text"
                      className="admin-form-input"
                      value={formData.nameBn}
                      onChange={(e) => setFormData({ ...formData, nameBn: e.target.value })}
                    />
                  </div>
                </div>

                <div className="admin-form-grid">
                  <div className="admin-form-group">
                    <label>Cuisine Slug / ID *</label>
                    <input
                      type="text"
                      className="admin-form-input"
                      value={formData.id}
                      onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                      disabled={!!editingCuisine}
                      required
                    />
                  </div>

                  <div className="admin-form-group">
                    <label>Emoji Icon</label>
                    <input
                      type="text"
                      className="admin-form-input"
                      value={formData.emoji}
                      onChange={(e) => setFormData({ ...formData, emoji: e.target.value })}
                      style={{ textAlign: 'center', fontSize: '1.2rem' }}
                    />
                  </div>
                </div>

                <div className="admin-form-grid">
                  <div className="admin-form-group">
                    <label>Region</label>
                    <input
                      type="text"
                      className="admin-form-input"
                      value={formData.region}
                      onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                    />
                  </div>

                  <div className="admin-form-group">
                    <label>Continent</label>
                    <input
                      type="text"
                      className="admin-form-input"
                      value={formData.continent}
                      onChange={(e) => setFormData({ ...formData, continent: e.target.value })}
                    />
                  </div>

                  <div className="admin-form-group">
                    <label>Brand Theme Color</label>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <input
                        type="color"
                        value={formData.color}
                        onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                        style={{ width: '40px', height: '40px', padding: 0, border: 'none', background: 'transparent', cursor: 'pointer' }}
                      />
                      <input
                        type="text"
                        className="admin-form-input"
                        value={formData.color}
                        onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                <div className="admin-form-group">
                  <label>English Description</label>
                  <textarea
                    className="admin-form-textarea"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={2}
                  />
                </div>

                <div className="admin-form-group">
                  <label>Bengali Description (বাংলা বিবরণ)</label>
                  <textarea
                    className="admin-form-textarea"
                    value={formData.descriptionBn}
                    onChange={(e) => setFormData({ ...formData, descriptionBn: e.target.value })}
                    rows={2}
                  />
                </div>
              </form>
            </div>

            <div className="admin-modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>
                {t('adminCancel')}
              </button>
              <button type="submit" form="cuisine-modal-form" className="btn btn-primary" disabled={saving}>
                {saving ? t('adminSaving') : editingCuisine ? (language === 'bn' ? 'রন্ধনশৈলী আপডেট করুন' : 'Update Cuisine') : (language === 'bn' ? 'রন্ধনশৈলী যোগ করুন' : 'Add Cuisine')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
