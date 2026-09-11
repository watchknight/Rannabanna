import React, { useState, useEffect } from 'react';
import { X, AlertCircle, Apple } from 'lucide-react';
import { useDatabase } from '../../context/DatabaseContext.jsx';
import { API_BASE, safeParseJson } from '../../utils/apiConfig.js';

const CATEGORY_OPTIONS = [
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

export default function AdminIngredientModal({ isOpen, onClose, onSaved, ingredient, token }) {
  const { language, t } = useDatabase();
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    nameBn: '',
    category: 'Pantry & Spices',
    subCategory: 'Spices',
    emoji: '🧂',
    sweet: 0,
    salty: 0,
    sour: 0,
    bitter: 0,
    umami: 0,
    spicy: 0,
    isCommon: false
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;

    if (ingredient) {
      setFormData({
        id: ingredient.id || '',
        name: ingredient.name || '',
        nameBn: ingredient.nameBn || '',
        category: ingredient.category || 'Pantry & Spices',
        subCategory: ingredient.subCategory || '',
        emoji: ingredient.emoji || '🧂',
        sweet: ingredient.sweet || 0,
        salty: ingredient.salty || 0,
        sour: ingredient.sour || 0,
        bitter: ingredient.bitter || 0,
        umami: ingredient.umami || 0,
        spicy: ingredient.spicy || 0,
        isCommon: !!ingredient.isCommon
      });
    } else {
      setFormData({
        id: '',
        name: '',
        nameBn: '',
        category: 'Pantry & Spices',
        subCategory: 'General',
        emoji: '🧂',
        sweet: 0,
        salty: 0,
        sour: 0,
        bitter: 0,
        umami: 0,
        spicy: 0,
        isCommon: false
      });
    }
    setError('');
  }, [isOpen, ingredient]);

  if (!isOpen) return null;

  const handleAutoSlug = (name) => {
    if (!ingredient) {
      const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      setFormData(prev => ({ ...prev, id: slug, name }));
    } else {
      setFormData(prev => ({ ...prev, name }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.id.trim() || !formData.name.trim()) {
      setError('Ingredient ID and Name are required.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const url = ingredient ? `${API_BASE}/api/admin/ingredients/${ingredient.id}` : `${API_BASE}/api/admin/ingredients`;
      const method = ingredient ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      const data = await safeParseJson(res);
      if (!res.ok) throw new Error(data.message || 'Failed to save ingredient');

      onSaved();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-modal-overlay" onClick={onClose}>
      <div className="admin-modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '650px' }}>
        <div className="admin-modal-header">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Apple size={18} style={{ color: 'var(--brand-orange)' }} />
            {ingredient ? (language === 'bn' ? `উপাদান সম্পাদনা: ${ingredient.name}` : `Edit Ingredient: ${ingredient.name}`) : (language === 'bn' ? 'নতুন জিআইভি উপাদান যোগ করুন' : 'Add Canonical GIV Ingredient')}
          </h3>
          <button type="button" className="btn-icon" onClick={onClose} aria-label="Close modal">
            <X size={16} />
          </button>
        </div>

        <div className="admin-modal-body">
          {error && (
            <div className="admin-error-banner" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          <form id="ingredient-modal-form" onSubmit={handleSubmit}>
            <div className="admin-form-grid">
              <div className="admin-form-group">
                <label>English Name *</label>
                <input
                  type="text"
                  className="admin-form-input"
                  placeholder="e.g. Cardamom Pods"
                  value={formData.name}
                  onChange={(e) => handleAutoSlug(e.target.value)}
                  required
                />
              </div>

              <div className="admin-form-group">
                <label>Bengali Name (বাংলা নাম)</label>
                <input
                  type="text"
                  className="admin-form-input"
                  placeholder="e.g. এলাচ"
                  value={formData.nameBn}
                  onChange={(e) => setFormData({ ...formData, nameBn: e.target.value })}
                />
              </div>
            </div>

            <div className="admin-form-grid">
              <div className="admin-form-group">
                <label>GIV ID / Slug *</label>
                <input
                  type="text"
                  className="admin-form-input"
                  placeholder="e.g. cardamom-pods"
                  value={formData.id}
                  onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                  disabled={!!ingredient}
                  required
                />
              </div>

              <div className="admin-form-group">
                <label>Emoji Symbol</label>
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
                <label>Category</label>
                <select
                  className="admin-form-select"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                >
                  {CATEGORY_OPTIONS.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="admin-form-group">
                <label>Subcategory</label>
                <input
                  type="text"
                  className="admin-form-input"
                  placeholder="e.g. Whole Spices"
                  value={formData.subCategory}
                  onChange={(e) => setFormData({ ...formData, subCategory: e.target.value })}
                />
              </div>
            </div>

            <div className="admin-form-group" style={{ marginTop: 'var(--spacing-sm)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={formData.isCommon}
                  onChange={(e) => setFormData({ ...formData, isCommon: e.target.checked })}
                />
                <span style={{ fontWeight: 600, color: '#ffffff' }}>Common Kitchen Staple</span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>(Given higher baseline weight in matchmaking)</span>
              </label>
            </div>

            {/* Flavor Radar Sliders */}
            <div style={{ marginTop: 'var(--spacing-lg)', borderTop: '1px solid var(--surface-border)', paddingTop: 'var(--spacing-md)' }}>
              <h4 style={{ fontSize: '0.95rem', marginBottom: 'var(--spacing-sm)', color: 'var(--text-secondary)' }}>
                Taste / Flavor Profile (0 - 5)
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                {[
                  { key: 'sweet', label: 'Sweet', color: '#ec4899' },
                  { key: 'salty', label: 'Salty', color: '#3b82f6' },
                  { key: 'sour', label: 'Sour', color: '#eab308' },
                  { key: 'bitter', label: 'Bitter', color: '#8b5cf6' },
                  { key: 'umami', label: 'Umami', color: '#10b981' },
                  { key: 'spicy', label: 'Spicy', color: '#ef4444' }
                ].map(({ key, label, color }) => (
                  <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                      <span>{label}</span>
                      <strong style={{ color }}>{formData[key]}</strong>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="5"
                      step="1"
                      value={formData[key]}
                      onChange={(e) => setFormData({ ...formData, [key]: parseInt(e.target.value) || 0 })}
                      style={{ accentColor: color }}
                    />
                  </div>
                ))}
              </div>
            </div>
          </form>
        </div>

        <div className="admin-modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
            {t('adminCancel')}
          </button>
          <button
            type="submit"
            form="ingredient-modal-form"
            className="btn btn-primary"
            disabled={saving}
          >
            {saving ? t('adminSaving') : ingredient ? (language === 'bn' ? 'উপাদান আপডেট করুন' : 'Update Ingredient') : (language === 'bn' ? 'ভল্টে যোগ করুন' : 'Add to Vault')}
          </button>
        </div>
      </div>
    </div>
  );
}
