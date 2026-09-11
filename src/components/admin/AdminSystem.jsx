import React, { useState, useEffect } from 'react';
import { Settings, Sparkles, Users, RotateCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useDatabase } from '../../context/DatabaseContext.jsx';
import { API_BASE, safeParseJson } from '../../utils/apiConfig.js';

export default function AdminSystem({ token }) {
  const { language, t } = useDatabase();
  const [logs, setLogs] = useState({ generations: [], users: [] });
  const [loading, setLoading] = useState(true);
  const [flushing, setFlushing] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState('');

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/admin/system/logs`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await safeParseJson(res);
      if (!res.ok) throw new Error(data.message || 'Failed to load system logs');
      setLogs(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [token]);

  const handleFlushCache = async () => {
    try {
      setFlushing(true);
      setFeedbackMessage('');
      const res = await fetch(`${API_BASE}/api/admin/system/cache/flush`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await safeParseJson(res);
      if (res.ok) {
        setFeedbackMessage(language === 'bn' ? 'এসকিউএলআইট ইন-মেমোরি ক্যাশ এবং এলআরইউ ম্যাচ স্টোর সফলভাবে রি-হাইড্রেট করা হয়েছে।' : 'SQLite in-memory caches and LRU match store flushed & re-hydrated.');
      } else {
        throw new Error(data.message || 'Cache flush failed');
      }
    } catch (err) {
      setFeedbackMessage(err.message);
    } finally {
      setFlushing(false);
      setTimeout(() => setFeedbackMessage(''), 5000);
    }
  };

  return (
    <div className="admin-system-tab">
      {feedbackMessage && (
        <div className="admin-success-banner" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertCircle size={16} />
          {feedbackMessage}
        </div>
      )}

      {/* System Maintenance Card */}
      <div className="admin-table-card" style={{ padding: 'var(--spacing-lg)', marginBottom: 'var(--spacing-xl)' }}>
        <h3 style={{ fontSize: '1.15rem', marginBottom: 'var(--spacing-xs)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Settings size={18} style={{ color: 'var(--brand-orange)' }} />
          {t('adminCacheMaintenance')}
        </h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: 'var(--spacing-md)' }}>
          {t('adminCacheDesc')}
        </p>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={handleFlushCache}
          disabled={flushing}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          <RotateCw size={14} className={flushing ? 'animate-spin' : ''} />
          {flushing ? t('adminFlushingCache') : t('adminFlushCache')}
        </button>
      </div>

      {/* AI Custom Recipe Generations */}
      <div className="admin-table-card" style={{ marginBottom: 'var(--spacing-xl)' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--surface-border)' }}>
          <h3 style={{ fontSize: '1.15rem', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={18} style={{ color: 'var(--brand-pink)' }} />
            {t('adminBespokeHistory')}
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '4px 0 0 0' }}>
            {t('adminBespokeDesc')}
          </p>
        </div>

        <div className="admin-table-responsive">
          <table className="admin-table">
            <thead>
              <tr>
                <th>{language === 'bn' ? 'সময়' : 'Time'}</th>
                <th>{language === 'bn' ? 'ব্যবহারকারী' : 'User'}</th>
                <th>{language === 'bn' ? 'নির্বাচিত উপকরণসমূহ' : 'Selected Ingredients'}</th>
                <th>{t('cuisines')}</th>
                <th>{language === 'bn' ? 'রেসিপি আইডি' : 'Recipe ID'}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '30px' }}>Loading history...</td>
                </tr>
              ) : logs.generations.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '30px' }}>
                    {language === 'bn' ? 'এখনও কোনো এআই রেসিপি তৈরির রেকর্ড নেই।' : 'No AI recipe generation records logged yet.'}
                  </td>
                </tr>
              ) : (
                logs.generations.map((gen) => {
                  let ingredientsList = [];
                  try {
                    ingredientsList = JSON.parse(gen.ingredient_ids);
                  } catch {
                    ingredientsList = (gen.ingredient_ids || '').split(',');
                  }
                  return (
                    <tr key={gen.id}>
                      <td style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                        {new Date(gen.created_at).toLocaleString()}
                      </td>
                      <td>
                        {gen.userName ? (
                          <div>
                            <div style={{ fontWeight: 600 }}>{gen.userName}</div>
                            <div className="table-sub">{gen.userEmail}</div>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>{language === 'bn' ? 'অতিথি / অনিবন্ধিত' : 'Guest / Anonymous'}</span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', maxWidth: '350px' }}>
                          {ingredientsList.map((ing, idx) => (
                            <span key={idx} className="badge" style={{ fontSize: '0.75rem' }}>
                              {ing}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td>
                        <span className="badge" style={{ textTransform: 'capitalize' }}>
                          {gen.cuisine_id || 'any'}
                        </span>
                      </td>
                      <td>
                        <code style={{ fontSize: '0.8rem', color: 'var(--brand-pink)' }}>
                          {gen.generated_recipe_id || 'N/A'}
                        </code>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Registered Users */}
      <div className="admin-table-card">
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--surface-border)' }}>
          <h3 style={{ fontSize: '1.15rem', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users size={18} style={{ color: 'var(--brand-orange)' }} />
            {t('adminRegisteredUsers')}
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '4px 0 0 0' }}>
            {t('adminRegisteredUsersDesc')}
          </p>
        </div>

        <div className="admin-table-responsive">
          <table className="admin-table">
            <thead>
              <tr>
                <th>{language === 'bn' ? 'আইডি' : 'User ID'}</th>
                <th>{language === 'bn' ? 'নাম' : 'Name'}</th>
                <th>{language === 'bn' ? 'ইমেইল' : 'Email'}</th>
                <th>{language === 'bn' ? 'সংরক্ষিত রেসিপি' : 'Saved Recipes'}</th>
                <th>{language === 'bn' ? 'নিবন্ধনের তারিখ' : 'Registered At'}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '30px' }}>Loading users...</td>
                </tr>
              ) : logs.users.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '30px' }}>
                    {language === 'bn' ? 'কোনো নিবন্ধিত ব্যবহারকারী অ্যাকাউন্ট নেই।' : 'No registered user accounts yet.'}
                  </td>
                </tr>
              ) : (
                logs.users.map((u) => (
                  <tr key={u.id}>
                    <td><code>{u.id}</code></td>
                    <td style={{ fontWeight: 600, color: '#ffffff' }}>{u.name}</td>
                    <td>{u.email}</td>
                    <td>
                      <span className="badge" style={{ fontWeight: 700 }}>
                        {u.savedCount || 0} {language === 'bn' ? 'টি' : 'saved'}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.8rem' }}>
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
