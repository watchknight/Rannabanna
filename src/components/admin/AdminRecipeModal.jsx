import React, { useState, useEffect } from 'react';
import { useDatabase } from '../../context/DatabaseContext.jsx';
import { scaleIngredient, adjustTime, shouldScale } from '../../utils/servingsScaler.js';
import { translateUnit, translateTechnique, translatePreparation } from '../../utils/translations.js';
import { API_BASE, safeParseJson } from '../../utils/apiConfig.js';

const MEAL_TYPE_OPTIONS = ['breakfast', 'lunch', 'dinner', 'snack', 'dessert'];
const DIETARY_TAG_OPTIONS = ['vegetarian', 'vegan', 'dairy-free', 'gluten-free', 'nut-free', 'halal', 'kosher'];
const DIFFICULTY_OPTIONS = ['easy', 'intermediate', 'advanced'];

export default function AdminRecipeModal({ isOpen, onClose, onSaved, recipeId, token, cuisines = [] }) {
  const { language, t } = useDatabase();
  const [activeTab, setActiveTab] = useState('basic');
  const [previewServings, setPreviewServings] = useState(4);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    id: '',
    title: '',
    titleBn: '',
    cuisineId: cuisines[0]?.id || 'bengali',
    difficulty: 'intermediate',
    prepTime: 15,
    cookTime: 20,
    servings: 4,
    calories: 350,
    description: '',
    descriptionBn: '',
    culturalNote: '',
    culturalNoteBn: '',
    imageEmoji: '🍲',
    mealTypes: ['lunch', 'dinner'],
    dietaryTags: [],
    ingredients: [
      { ingredientId: '', quantity: 1, unit: 'tbsp', preparation: '', isEssential: true }
    ],
    steps: [
      { step: 1, instruction: '', instructionBn: '', duration: 5, technique: 'Prep' }
    ]
  });

  useEffect(() => {
    if (!isOpen) return;

    if (recipeId) {
      // Edit mode: fetch recipe details
      const fetchRecipe = async () => {
        try {
          setLoading(true);
          setError('');
          const res = await fetch(`${API_BASE}/api/admin/recipes/${recipeId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const data = await safeParseJson(res);
          if (!res.ok) throw new Error(data.message || 'Failed to load recipe details');
          setFormData({
            id: data.id || '',
            title: data.title || '',
            titleBn: data.titleBn || '',
            cuisineId: data.cuisineId || cuisines[0]?.id || 'bengali',
            difficulty: data.difficulty || 'intermediate',
            prepTime: data.prepTime || 15,
            cookTime: data.cookTime || 20,
            servings: data.servings || 4,
            calories: data.calories || 350,
            description: data.description || '',
            descriptionBn: data.descriptionBn || '',
            culturalNote: data.culturalNote || '',
            culturalNoteBn: data.culturalNoteBn || '',
            imageEmoji: data.imageEmoji || '🍲',
            mealTypes: data.mealTypes || [],
            dietaryTags: data.dietaryTags || [],
            ingredients: data.ingredients?.length ? data.ingredients.map(i => ({
              ingredientId: i.id || i.ingredientId,
              quantity: i.quantity || 1,
              unit: i.unit || '',
              preparation: i.preparation || '',
              isEssential: i.isEssential !== undefined ? !!i.isEssential : true
            })) : [{ ingredientId: '', quantity: 1, unit: 'tbsp', preparation: '', isEssential: true }],
            steps: data.steps?.length ? data.steps.map((s, idx) => ({
              step: s.step || idx + 1,
              instruction: s.instruction || '',
              instructionBn: s.instructionBn || '',
              duration: s.duration || 5,
              technique: s.technique || 'Cook'
            })) : [{ step: 1, instruction: '', instructionBn: '', duration: 5, technique: 'Cook' }]
          });
          setPreviewServings(data.servings || 4);
        } catch (err) {
          setError(err.message);
        } finally {
          setLoading(false);
        }
      };
      fetchRecipe();
    } else {
      // Create mode: blank state
      setFormData({
        id: '',
        title: '',
        titleBn: '',
        cuisineId: cuisines[0]?.id || 'bengali',
        difficulty: 'intermediate',
        prepTime: 15,
        cookTime: 20,
        servings: 4,
        calories: 350,
        description: '',
        descriptionBn: '',
        culturalNote: '',
        culturalNoteBn: '',
        imageEmoji: '🍲',
        mealTypes: ['lunch', 'dinner'],
        dietaryTags: [],
        ingredients: [
          { ingredientId: '', quantity: 1, unit: 'tbsp', preparation: '', isEssential: true }
        ],
        steps: [
          { step: 1, instruction: '', instructionBn: '', duration: 5, technique: 'Prep' }
        ]
      });
      setPreviewServings(4);
      setError('');
    }
  }, [isOpen, recipeId, token]);

  if (!isOpen) return null;

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleAutoSlug = (title) => {
    if (!recipeId) {
      const slug = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      setFormData(prev => ({ ...prev, id: slug, title }));
    } else {
      setFormData(prev => ({ ...prev, title }));
    }
  };

  const toggleTag = (category, tag) => {
    setFormData(prev => {
      const current = prev[category] || [];
      const updated = current.includes(tag)
        ? current.filter(t => t !== tag)
        : [...current, tag];
      return { ...prev, [category]: updated };
    });
  };

  // Ingredient Helpers
  const addIngredientRow = () => {
    setFormData(prev => ({
      ...prev,
      ingredients: [
        ...prev.ingredients,
        { ingredientId: '', quantity: 1, unit: 'g', preparation: '', isEssential: true }
      ]
    }));
  };

  const updateIngredientRow = (index, field, value) => {
    setFormData(prev => {
      const updated = [...prev.ingredients];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, ingredients: updated };
    });
  };

  const removeIngredientRow = (index) => {
    setFormData(prev => ({
      ...prev,
      ingredients: prev.ingredients.filter((_, i) => i !== index)
    }));
  };

  // Step Helpers
  const addStepRow = () => {
    setFormData(prev => ({
      ...prev,
      steps: [
        ...prev.steps,
        { step: prev.steps.length + 1, instruction: '', instructionBn: '', duration: 5, technique: 'Cook' }
      ]
    }));
  };

  const updateStepRow = (index, field, value) => {
    setFormData(prev => {
      const updated = [...prev.steps];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, steps: updated };
    });
  };

  const removeStepRow = (index) => {
    setFormData(prev => ({
      ...prev,
      steps: prev.steps
        .filter((_, i) => i !== index)
        .map((s, idx) => ({ ...s, step: idx + 1 }))
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.id.trim() || !formData.title.trim() || !formData.cuisineId) {
      setError('Recipe ID, Title, and Cuisine are required.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const url = recipeId ? `${API_BASE}/api/admin/recipes/${recipeId}` : `${API_BASE}/api/admin/recipes`;
      const method = recipeId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      const data = await safeParseJson(res);
      if (!res.ok) {
        throw new Error(data.message || 'Failed to save recipe');
      }

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
      <div className="admin-modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '900px' }}>
        <div className="admin-modal-header">
          <h3>{recipeId ? `✏️ Edit Recipe: ${formData.title || recipeId}` : '🍲 Create New Recipe'}</h3>
          <button type="button" className="btn-icon" onClick={onClose} aria-label="Close modal">✕</button>
        </div>

        {/* Modal Navigation Tabs */}
        <div style={{ display: 'flex', gap: '4px', padding: '12px 24px 0', borderBottom: '1px solid var(--surface-border)', background: 'rgba(0,0,0,0.15)' }}>
          {[
            { id: 'basic', label: t('adminBasicTab') },
            { id: 'descriptions', label: t('adminDescTab') },
            { id: 'ingredients', label: `${t('adminIngTab')} (${formData.ingredients.length})` },
            { id: 'steps', label: `${t('adminStepsTab')} (${formData.steps.length})` },
            { id: 'tags', label: t('adminTagsTab') },
            { id: 'preview', label: `✨ ${t('adminPreviewTab')}` }
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              className={`admin-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
              style={{ fontSize: '0.85rem', padding: '8px 14px' }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="admin-modal-body">
          {error && (
            <div className="admin-error-banner">
              ⚠️ {error}
            </div>
          )}

          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <p style={{ color: 'var(--text-secondary)' }}>Loading recipe...</p>
            </div>
          ) : (
            <form id="recipe-modal-form" onSubmit={handleSubmit}>
              {/* TAB 1: BASIC INFO */}
              {activeTab === 'basic' && (
                <div>
                  <div className="admin-form-grid">
                    <div className="admin-form-group">
                      <label>English Title *</label>
                      <input
                        type="text"
                        className="admin-form-input"
                        placeholder="e.g. Shorshe Ilish"
                        value={formData.title}
                        onChange={(e) => handleAutoSlug(e.target.value)}
                        required
                      />
                    </div>

                    <div className="admin-form-group">
                      <label>Bengali Title (বাংলা শিরোনাম)</label>
                      <input
                        type="text"
                        className="admin-form-input"
                        placeholder="e.g. সরিষা ইলিশ"
                        value={formData.titleBn}
                        onChange={(e) => handleInputChange('titleBn', e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="admin-form-grid">
                    <div className="admin-form-group">
                      <label>Recipe Slug / ID *</label>
                      <input
                        type="text"
                        className="admin-form-input"
                        placeholder="e.g. shorshe-ilish"
                        value={formData.id}
                        onChange={(e) => handleInputChange('id', e.target.value)}
                        disabled={!!recipeId}
                        required
                      />
                    </div>

                    <div className="admin-form-group">
                      <label>Cuisine *</label>
                      <select
                        className="admin-form-select"
                        value={formData.cuisineId}
                        onChange={(e) => handleInputChange('cuisineId', e.target.value)}
                      >
                        {cuisines.map(c => (
                          <option key={c.id} value={c.id}>{c.emoji} {c.name} ({c.nameBn})</option>
                        ))}
                      </select>
                    </div>

                    <div className="admin-form-group">
                      <label>Difficulty</label>
                      <select
                        className="admin-form-select"
                        value={formData.difficulty}
                        onChange={(e) => handleInputChange('difficulty', e.target.value)}
                      >
                        {DIFFICULTY_OPTIONS.map(d => (
                          <option key={d} value={d}>{d.toUpperCase()}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="admin-form-grid">
                    <div className="admin-form-group">
                      <label>Prep Time (Minutes)</label>
                      <input
                        type="number"
                        min="0"
                        className="admin-form-input"
                        value={formData.prepTime}
                        onChange={(e) => handleInputChange('prepTime', parseInt(e.target.value) || 0)}
                      />
                    </div>

                    <div className="admin-form-group">
                      <label>Cook Time (Minutes)</label>
                      <input
                        type="number"
                        min="0"
                        className="admin-form-input"
                        value={formData.cookTime}
                        onChange={(e) => handleInputChange('cookTime', parseInt(e.target.value) || 0)}
                      />
                    </div>

                    <div className="admin-form-group">
                      <label>Base Servings</label>
                      <input
                        type="number"
                        min="1"
                        max="24"
                        className="admin-form-input"
                        value={formData.servings}
                        onChange={(e) => handleInputChange('servings', parseInt(e.target.value) || 1)}
                      />
                    </div>

                    <div className="admin-form-group">
                      <label>Calories (kcal)</label>
                      <input
                        type="number"
                        min="0"
                        className="admin-form-input"
                        value={formData.calories}
                        onChange={(e) => handleInputChange('calories', parseInt(e.target.value) || 0)}
                      />
                    </div>

                    <div className="admin-form-group">
                      <label>Image Emoji</label>
                      <input
                        type="text"
                        className="admin-form-input"
                        value={formData.imageEmoji}
                        onChange={(e) => handleInputChange('imageEmoji', e.target.value)}
                        style={{ textAlign: 'center', fontSize: '1.25rem' }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: DESCRIPTIONS & CULTURAL NOTES */}
              {activeTab === 'descriptions' && (
                <div>
                  <div className="admin-form-group">
                    <label>English Description</label>
                    <textarea
                      className="admin-form-textarea"
                      placeholder="Brief culinary summary in English..."
                      value={formData.description}
                      onChange={(e) => handleInputChange('description', e.target.value)}
                      rows={3}
                    />
                  </div>

                  <div className="admin-form-group">
                    <label>Bengali Description (বাংলা বিবরণ)</label>
                    <textarea
                      className="admin-form-textarea"
                      placeholder="রেসিপির সংক্ষিপ্ত বাংলা বর্ণনা..."
                      value={formData.descriptionBn}
                      onChange={(e) => handleInputChange('descriptionBn', e.target.value)}
                      rows={3}
                    />
                  </div>

                  <div className="admin-form-group">
                    <label>English Cultural Note</label>
                    <textarea
                      className="admin-form-textarea"
                      placeholder="Historical or regional culinary background..."
                      value={formData.culturalNote}
                      onChange={(e) => handleInputChange('culturalNote', e.target.value)}
                      rows={2}
                    />
                  </div>

                  <div className="admin-form-group">
                    <label>Bengali Cultural Note (ঐতিহ্যবাহী নোট)</label>
                    <textarea
                      className="admin-form-textarea"
                      placeholder="ঐতিহ্যবাহী সাংস্কৃতিক তথ্য..."
                      value={formData.culturalNoteBn}
                      onChange={(e) => handleInputChange('culturalNoteBn', e.target.value)}
                      rows={2}
                    />
                  </div>
                </div>
              )}

              {/* TAB 3: INGREDIENTS BUILDER */}
              {activeTab === 'ingredients' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-md)' }}>
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                      Add ingredients matching canonical GIV IDs (e.g. <code>hilsa-fish</code>, <code>mustard-oil</code>).
                    </span>
                    <button type="button" className="btn btn-secondary" onClick={addIngredientRow} style={{ padding: '6px 12px', fontSize: '0.85rem' }}>
                      + Add Row
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {formData.ingredients.map((ing, idx) => (
                      <div 
                        key={idx} 
                        style={{ 
                          display: 'grid', 
                          gridTemplateColumns: '2fr 1fr 1fr 2fr 1fr 40px', 
                          gap: '8px', 
                          alignItems: 'center',
                          padding: '8px',
                          background: 'rgba(0,0,0,0.2)',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid rgba(255,255,255,0.05)'
                        }}
                      >
                        <input
                          type="text"
                          className="admin-form-input"
                          placeholder="GIV ID (e.g. onion-red)"
                          value={ing.ingredientId}
                          onChange={(e) => updateIngredientRow(idx, 'ingredientId', e.target.value)}
                          required
                        />
                        <input
                          type="number"
                          step="any"
                          min="0"
                          className="admin-form-input"
                          placeholder="Qty"
                          value={ing.quantity}
                          onChange={(e) => updateIngredientRow(idx, 'quantity', parseFloat(e.target.value) || 0)}
                        />
                        <input
                          type="text"
                          className="admin-form-input"
                          placeholder="Unit (g, tbsp)"
                          value={ing.unit}
                          onChange={(e) => updateIngredientRow(idx, 'unit', e.target.value)}
                        />
                        <input
                          type="text"
                          className="admin-form-input"
                          placeholder="Prep (e.g. chopped)"
                          value={ing.preparation}
                          onChange={(e) => updateIngredientRow(idx, 'preparation', e.target.value)}
                        />
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={ing.isEssential}
                              onChange={(e) => updateIngredientRow(idx, 'isEssential', e.target.checked)}
                            />
                            {t('essentialBadge')}
                          </label>
                          {!shouldScale(ing) && (
                            <span 
                              className="badge" 
                              title="Units like pinch, to taste, for frying do not multiply when servings scale"
                              style={{ fontSize: '0.65rem', background: 'rgba(234, 179, 8, 0.18)', color: '#fbbf24', border: '1px solid rgba(234, 179, 8, 0.3)', padding: '2px 4px', whiteSpace: 'nowrap' }}
                            >
                              🔒 {t('adminNonScalingFixed')}
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          className="btn-icon btn-danger"
                          onClick={() => removeIngredientRow(idx)}
                          disabled={formData.ingredients.length === 1}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 4: STEPS BUILDER */}
              {activeTab === 'steps' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-md)' }}>
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                      Step-by-step instructions in English and Bengali.
                    </span>
                    <button type="button" className="btn btn-secondary" onClick={addStepRow} style={{ padding: '6px 12px', fontSize: '0.85rem' }}>
                      + Add Step
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {formData.steps.map((st, idx) => (
                      <div 
                        key={idx}
                        style={{
                          padding: '12px',
                          background: 'rgba(0,0,0,0.25)',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid rgba(255,255,255,0.06)'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <span style={{ fontWeight: 700, color: 'var(--brand-pink)' }}>Step {st.step}</span>
                          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                            <input
                              type="text"
                              className="admin-form-input"
                              placeholder="Technique (e.g. Simmer)"
                              value={st.technique}
                              onChange={(e) => updateStepRow(idx, 'technique', e.target.value)}
                              style={{ width: '130px', padding: '4px 8px', fontSize: '0.8rem' }}
                            />
                            <input
                              type="number"
                              min="0"
                              className="admin-form-input"
                              placeholder="Mins"
                              value={st.duration}
                              onChange={(e) => updateStepRow(idx, 'duration', parseInt(e.target.value) || 0)}
                              style={{ width: '70px', padding: '4px 8px', fontSize: '0.8rem' }}
                            />
                            <button
                              type="button"
                              className="btn-icon btn-danger"
                              onClick={() => removeStepRow(idx)}
                              disabled={formData.steps.length === 1}
                            >
                              ✕
                            </button>
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                          <div>
                            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>English Instruction</label>
                            <textarea
                              className="admin-form-textarea"
                              placeholder="Instruction in English..."
                              value={st.instruction}
                              onChange={(e) => updateStepRow(idx, 'instruction', e.target.value)}
                              rows={2}
                              required
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Bengali Instruction (বাংলা নির্দেশনা)</label>
                            <textarea
                              className="admin-form-textarea"
                              placeholder="বাংলায় রান্নার ধাপ..."
                              value={st.instructionBn}
                              onChange={(e) => updateStepRow(idx, 'instructionBn', e.target.value)}
                              rows={2}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 5: TAGS & DIETARY */}
              {activeTab === 'tags' && (
                <div>
                  <div className="admin-form-group" style={{ marginBottom: 'var(--spacing-lg)' }}>
                    <label>Meal Types (Select all that apply)</label>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '6px' }}>
                      {MEAL_TYPE_OPTIONS.map(meal => {
                        const isSelected = formData.mealTypes.includes(meal);
                        return (
                          <button
                            key={meal}
                            type="button"
                            onClick={() => toggleTag('mealTypes', meal)}
                            className="badge"
                            style={{
                              padding: '8px 14px',
                              cursor: 'pointer',
                              border: isSelected ? '1px solid var(--brand-pink)' : '1px solid var(--surface-border)',
                              background: isSelected ? 'var(--brand-gradient)' : 'rgba(255,255,255,0.05)',
                              color: isSelected ? '#ffffff' : 'var(--text-secondary)',
                              fontWeight: 600,
                              textTransform: 'capitalize'
                            }}
                          >
                            {meal} {isSelected && '✓'}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="admin-form-group">
                    <label>Dietary Tags (Select all that apply)</label>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '6px' }}>
                      {DIETARY_TAG_OPTIONS.map(diet => {
                        const isSelected = formData.dietaryTags.includes(diet);
                        return (
                          <button
                            key={diet}
                            type="button"
                            onClick={() => toggleTag('dietaryTags', diet)}
                            className="badge"
                            style={{
                              padding: '8px 14px',
                              cursor: 'pointer',
                              border: isSelected ? '1px solid #10b981' : '1px solid var(--surface-border)',
                              background: isSelected ? 'rgba(16, 185, 129, 0.25)' : 'rgba(255,255,255,0.05)',
                              color: isSelected ? '#34d399' : 'var(--text-secondary)',
                              fontWeight: 600,
                              textTransform: 'capitalize'
                            }}
                          >
                            {diet} {isSelected && '✓'}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 6: SERVINGS SCALING PREVIEW */}
              {activeTab === 'preview' && (() => {
                const baseServings = formData.servings || 4;
                const timeData = adjustTime(formData.prepTime, formData.cookTime, baseServings, previewServings);

                return (
                  <div className="admin-servings-preview-container animate-fade-in">
                    {/* Interactive Servings Slider Control */}
                    <div className="admin-table-card" style={{ padding: '16px 20px', marginBottom: '16px', background: 'rgba(255,255,255,0.03)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <div>
                          <h4 style={{ margin: 0, fontSize: '1rem', color: '#ffffff' }}>
                            🍽️ {t('adminServingSlider')}
                          </h4>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                            {t('originalServings')}: <strong>{baseServings}</strong> {t('people')} → {t('scaledTo')}: <strong style={{ color: 'var(--brand-pink)' }}>{previewServings}</strong> {t('people')}
                          </div>
                        </div>

                        {/* Stepper Buttons */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => setPreviewServings(p => Math.max(1, p - 1))}
                            disabled={previewServings <= 1}
                            style={{ padding: '4px 12px', fontSize: '1rem', fontWeight: 'bold' }}
                          >
                            -
                          </button>
                          <span style={{ fontSize: '1.2rem', fontWeight: 700, minWidth: '32px', textAlign: 'center', color: 'var(--brand-pink)' }}>
                            {previewServings}
                          </span>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => setPreviewServings(p => Math.min(24, p + 1))}
                            disabled={previewServings >= 24}
                            style={{ padding: '4px 12px', fontSize: '1rem', fontWeight: 'bold' }}
                          >
                            +
                          </button>
                        </div>
                      </div>

                      {/* Slider */}
                      <input
                        type="range"
                        min="1"
                        max="24"
                        step="1"
                        value={previewServings}
                        onChange={(e) => setPreviewServings(parseInt(e.target.value) || 1)}
                        style={{ width: '100%', accentColor: 'var(--brand-pink)' }}
                      />
                    </div>

                    {/* Adjusted Times Display */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '16px' }}>
                      <div className="admin-stat-card" style={{ padding: '12px 16px' }}>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{t('prepTimeLabel')}</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#ffffff' }}>
                          {timeData.prepTime} {t('mins')}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          {language === 'bn' ? `মূল: ${formData.prepTime} মি.` : `Base: ${formData.prepTime}m`}
                        </div>
                      </div>

                      <div className="admin-stat-card" style={{ padding: '12px 16px' }}>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{t('cookTimeLabel')}</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#ffffff' }}>
                          {timeData.cookTime} {t('mins')}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          {language === 'bn' ? `মূল: ${formData.cookTime} মি.` : `Base: ${formData.cookTime}m`}
                        </div>
                      </div>

                      <div className="admin-stat-card" style={{ padding: '12px 16px', borderColor: 'var(--brand-pink)' }}>
                        <div style={{ fontSize: '0.8rem', color: 'var(--brand-pink)' }}>{t('adjustedTime')}</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--brand-pink)' }}>
                          {timeData.totalTime} {t('mins')}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          {language === 'bn' ? 'মোট রান্নার সময়' : 'Diminishing returns scaled'}
                        </div>
                      </div>
                    </div>

                    {/* Notice about non-scaling units */}
                    <div style={{ padding: '10px 14px', borderRadius: 'var(--radius-sm)', background: 'rgba(234, 179, 8, 0.1)', border: '1px solid rgba(234, 179, 8, 0.25)', fontSize: '0.8rem', color: '#fde047', marginBottom: '16px' }}>
                      💡 {t('adminNonScalingNotice')}
                    </div>

                    {/* Scaled Ingredients Table */}
                    <div className="admin-table-card" style={{ marginBottom: '16px' }}>
                      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--surface-border)' }}>
                        <h4 style={{ margin: 0, fontSize: '0.95rem' }}>
                          🧂 {language === 'bn' ? 'স্কেলকৃত উপাদানসমূহের তালিকা' : 'Scaled Ingredient Quantities'}
                        </h4>
                      </div>
                      <div className="admin-table-responsive">
                        <table className="admin-table">
                          <thead>
                            <tr>
                              <th>{language === 'bn' ? 'উপাদান' : 'Ingredient ID'}</th>
                              <th>{language === 'bn' ? 'মূল পরিমাণ' : 'Base Quantity'}</th>
                              <th>{language === 'bn' ? 'স্কেলকৃত পরিমাণ' : 'Scaled Quantity'}</th>
                              <th>{language === 'bn' ? 'আচরণ' : 'Behavior'}</th>
                              <th>{language === 'bn' ? 'প্রস্তুতি' : 'Preparation'}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {formData.ingredients.map((ing, idx) => {
                              const scaled = scaleIngredient(ing, baseServings, previewServings);
                              return (
                                <tr key={idx}>
                                  <td>
                                    <strong>{ing.ingredientId || '—'}</strong>
                                    {ing.isEssential && (
                                      <span className="badge" style={{ marginLeft: '6px', fontSize: '0.65rem' }}>
                                        {t('essentialBadge')}
                                      </span>
                                    )}
                                  </td>
                                  <td>
                                    {ing.quantity} {language === 'bn' ? translateUnit(ing.unit, 'bn') : ing.unit}
                                  </td>
                                  <td>
                                    <span style={{ fontWeight: 700, color: scaled.isFixed ? 'var(--text-primary)' : 'var(--brand-pink)' }}>
                                      {scaled.displayQuantity} {language === 'bn' ? translateUnit(scaled.displayUnit, 'bn') : scaled.displayUnit}
                                    </span>
                                  </td>
                                  <td>
                                    {scaled.isFixed ? (
                                      <span className="badge" style={{ background: 'rgba(234, 179, 8, 0.2)', color: '#fbbf24', fontSize: '0.75rem' }}>
                                        🔒 {t('adminNonScalingFixed')}
                                      </span>
                                    ) : (
                                      <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', fontSize: '0.75rem' }}>
                                        ✓ Scaled ({Math.round((previewServings / baseServings) * 100)}%)
                                      </span>
                                    )}
                                  </td>
                                  <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                    {ing.preparation || '—'}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </form>
          )}
        </div>

        <div className="admin-modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
            {t('adminCancel')}
          </button>
          <button
            type="submit"
            form="recipe-modal-form"
            className="btn btn-primary"
            disabled={saving || loading}
          >
            {saving ? t('adminSaving') : recipeId ? (language === 'bn' ? 'রেসিপি আপডেট করুন' : 'Update Recipe') : (language === 'bn' ? 'রেসিপি প্রকাশ করুন' : 'Publish Recipe')}
          </button>
        </div>
      </div>
    </div>
  );
}
