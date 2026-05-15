import { useState } from 'react';
import { Megaphone, Plus, Pin, PinOff, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useCityNotices } from '../../contexts/CityNoticesContext';
import { NOTICE_TYPES, getNoticeStyle, getPriorityLabel } from '../../lib/noticeUtils';
import { formatRelativeTime, cn, roleLabel } from '../../lib/utils';
import LoadingSpinner from '../shared/LoadingSpinner';

const DEFAULT_FORM = {
  title: '',
  summary: '',
  guidance: '',
  notice_type: 'health_campaign',
  priority: 2,
  is_pinned: true,
  ends_at: '',
};

export default function BillboardManager() {
  const { user, profile, role } = useAuth();
  const { notices, loading, refresh } = useCityNotices();
  const [form, setForm] = useState(DEFAULT_FORM);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  if (role !== 'city') {
    return (
      <section className="glass-panel p-6 text-center">
        <p className="text-sm text-text-secondary">
          Bulletin publishing is restricted to the City Head account.
        </p>
      </section>
    );
  }

  const publish = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.summary.trim()) {
      setError('Title and summary are required.');
      return;
    }
    setSubmitting(true);
    setError('');
    setMessage('');

    const payload = {
      title: form.title.trim(),
      summary: form.summary.trim(),
      guidance: form.guidance.trim() || null,
      notice_type: form.notice_type,
      priority: Number(form.priority),
      is_pinned: form.is_pinned,
      is_active: true,
      published_by: user?.id,
      publisher_name: profile?.name || 'Municipal Commissioner',
      publisher_role: roleLabel(profile?.role),
      starts_at: new Date().toISOString(),
      ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
    };

    const { error: err } = await supabase.from('city_notices').insert(payload);
    setSubmitting(false);

    if (err) {
      setError(err.message.includes('city_notices') ? 'Run supabase/city_notices.sql first.' : err.message);
      return;
    }

    setMessage('Bulletin published — visible to all users immediately.');
    setForm(DEFAULT_FORM);
    setShowForm(false);
    refresh();
  };

  const toggleActive = async (notice) => {
    await supabase
      .from('city_notices')
      .update({ is_active: !notice.is_active })
      .eq('id', notice.id);
    refresh();
  };

  const togglePin = async (notice) => {
    await supabase
      .from('city_notices')
      .update({ is_pinned: !notice.is_pinned })
      .eq('id', notice.id);
    refresh();
  };

  return (
    <section className="glass-panel overflow-hidden border-cyan-500/20">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
        <div className="flex items-center gap-2">
          <Megaphone className="h-5 w-5 text-cyan-300" />
          <div>
            <h2 className="text-lg font-semibold text-text-primary">Bulletin publisher</h2>
            <p className="text-xs text-text-muted">City Head only — published notices are visible to all users</p>
          </div>
        </div>
        <button type="button" onClick={() => setShowForm((v) => !v)} className="btn-primary text-sm">
          <Plus size={16} />
          {showForm ? 'Cancel' : 'New bulletin'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={publish} className="space-y-4 border-b border-white/10 bg-white/[0.02] p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-xs font-medium text-text-secondary">Headline</span>
              <input
                className="input-field"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Dengue prevention alert — Hyderabad"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-xs font-medium text-text-secondary">Public message</span>
              <textarea
                className="input-field min-h-[80px] resize-none"
                value={form.summary}
                onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))}
                placeholder="Short notice shown on the billboard strip for all users"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-xs font-medium text-text-secondary">
                Safety guidance (one tip per line)
              </span>
              <textarea
                className="input-field min-h-[100px] resize-none font-mono text-sm"
                value={form.guidance}
                onChange={(e) => setForm((f) => ({ ...f, guidance: e.target.value }))}
                placeholder={'Remove stagnant water at home.\nUse repellent at dawn/dusk.\nReport breeding sites via NagarRakshak.'}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-text-secondary">Type</span>
              <select
                className="input-field"
                value={form.notice_type}
                onChange={(e) => setForm((f) => ({ ...f, notice_type: e.target.value }))}
              >
                {NOTICE_TYPES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-text-secondary">Priority</span>
              <select
                className="input-field"
                value={form.priority}
                onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
              >
                <option value={1}>Critical (outbreak)</option>
                <option value={2}>High</option>
                <option value={3}>Info</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-text-secondary">Ends on (optional)</span>
              <input
                type="date"
                className="input-field"
                value={form.ends_at}
                onChange={(e) => setForm((f) => ({ ...f, ends_at: e.target.value }))}
              />
            </label>
            <label className="flex items-center gap-2 self-end pb-2">
              <input
                type="checkbox"
                checked={form.is_pinned}
                onChange={(e) => setForm((f) => ({ ...f, is_pinned: e.target.checked }))}
                className="rounded border-white/20"
              />
              <span className="text-sm text-text-secondary">Pin to top of billboard</span>
            </label>
          </div>
          {error && <p className="text-sm text-red-300">{error}</p>}
          <button type="submit" disabled={submitting} className="btn-primary w-full sm:w-auto">
            {submitting ? 'Publishing…' : 'Publish to all users'}
          </button>
        </form>
      )}

      {message && (
        <p className="mx-5 mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
          {message}
        </p>
      )}

      <div className="max-h-64 overflow-y-auto divide-y divide-white/10">
        {loading ? (
          <div className="flex justify-center py-8">
            <LoadingSpinner size="sm" />
          </div>
        ) : (
          notices.slice(0, 8).map((n) => {
            const style = getNoticeStyle(n.notice_type);
            return (
              <div key={n.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <span className={cn('rounded-full border px-2 py-0.5 text-[10px] uppercase', style.badge)}>
                    {style.label}
                  </span>
                  <p className="mt-1 truncate text-sm font-medium text-text-primary">{n.title}</p>
                  <p className="text-xs text-text-muted">
                    {getPriorityLabel(n.priority)} · {formatRelativeTime(n.created_at)}
                    {!n.is_active && ' · Hidden'}
                  </p>
                </div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => togglePin(n)}
                    className="btn-ghost p-2"
                    aria-label={n.is_pinned ? 'Unpin' : 'Pin'}
                  >
                    {n.is_pinned ? <PinOff size={16} /> : <Pin size={16} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleActive(n)}
                    className="btn-ghost p-2"
                    aria-label={n.is_active ? 'Hide' : 'Show'}
                  >
                    {n.is_active ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
