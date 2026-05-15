import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  FileStack,
  CheckCircle2,
  Clock,
  Plus,
  ArrowRight,
  MapPin,
  TrendingUp,
  Award,
  RefreshCw,
  Shield,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { queryWithTimeout } from '../../lib/queryWithTimeout';
import { useUserComplaintStats } from '../../hooks/useUserComplaintStats';
import { getGreeting, citizenLevel, formatRelativeTime, formatComplaintId } from '../../lib/utils';
import MetricCard from '../shared/MetricCard';
import StatusBadge from '../shared/StatusBadge';
import DeptTag from '../shared/DeptTag';
import SeverityBadge from '../shared/SeverityBadge';
import ComplaintTiming from '../shared/ComplaintTiming';
import LoadingSpinner from '../shared/LoadingSpinner';
import EmptyState from '../shared/EmptyState';
import ComplaintDetail from './ComplaintDetail';
import { useComplaintExplorer } from '../../contexts/ComplaintExplorerContext';

const CHART_TOOLTIP = {
  background: 'rgba(0,0,0,0.85)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 12,
  fontSize: 12,
  color: '#f5f5f5',
};

export default function CitizenDashboard() {
  const { user, profile, loading: authLoading } = useAuth();
  const { openByDept } = useComplaintExplorer();
  const stats = useUserComplaintStats(user?.id);
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState(null);
  const complaintsSectionRef = useRef(null);

  const fetchComplaints = useCallback(async () => {
    if (!user?.id) {
      setComplaints([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await queryWithTimeout(
        supabase
          .from('complaints')
          .select('*, wards(name), assignee:users!complaints_assigned_to_fkey(id, name, role, dept)')
          .eq('citizen_id', user.id)
          .order('created_at', { ascending: false }),
        12000,
        'Load complaints'
      );

      if (result.error) {
        const fallback = await queryWithTimeout(
          supabase
            .from('complaints')
            .select('*, wards(name)')
            .eq('citizen_id', user.id)
            .order('created_at', { ascending: false }),
          12000,
          'Load complaints'
        );
        if (fallback.error) throw result.error;
        setComplaints(fallback.data || []);
      } else {
        setComplaints(result.data || []);
      }
    } catch (err) {
      console.warn('Complaints fetch:', err?.message || err);
      setError(err?.message || 'Failed to load complaints');
      setComplaints([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!authLoading && user?.id) {
      fetchComplaints();
    }
    if (!authLoading && !user?.id) {
      setComplaints([]);
      setLoading(false);
    }
  }, [authLoading, user?.id, fetchComplaints]);

  const filtered = complaints.filter((c) => {
    if (filter === 'open') return ['open', 'assigned', 'in_progress', 'reopened'].includes(c.status);
    if (filter === 'resolved') return ['resolved', 'closed'].includes(c.status);
    return true;
  });

  const focusComplaints = useCallback((nextFilter) => {
    setFilter(nextFilter);
    setSelected(null);
    requestAnimationFrame(() => {
      complaintsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, []);

  const chartData = buildMonthlyChart(complaints);
  const wardName = profile?.wards?.name || 'Hyderabad';

  if (authLoading) {
    return (
      <div className="flex justify-center py-24">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-slide-up max-w-5xl">
      <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <p className="text-[15px] text-text-secondary">{getGreeting()}</p>
          <h1 className="mt-0.5 text-2xl font-bold text-text-primary tracking-tight">
            {profile?.name || 'Citizen'}
          </h1>
          <p className="mt-1 flex items-center gap-1.5 text-[15px] text-text-muted">
            <MapPin className="h-4 w-4" />
            {wardName} · {citizenLevel(profile?.credits || 0)}
          </p>
        </div>
        <div className="flex flex-col items-stretch sm:items-end gap-2 shrink-0">
          <Link to="/report?safety=1" className="btn-secondary inline-flex items-center justify-center gap-2">
            <Shield className="h-4 w-4" />
            Safety concern
          </Link>
          <Link to="/report" className="btn-primary inline-flex items-center justify-center gap-2">
            <Plus className="h-4 w-4" />
            Post issue
          </Link>
        </div>
      </header>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard
          icon={FileStack}
          label="Filed"
          value={stats.loading ? '—' : stats.filed}
          sublabel="Total by you"
          accent="brand"
          onClick={() => focusComplaints('all')}
          className={filter === 'all' && !selected ? 'ring-1 ring-cyan-400/35' : ''}
        />
        <MetricCard
          icon={CheckCircle2}
          label="Resolved"
          value={stats.loading ? '—' : stats.resolved}
          sublabel="Closed"
          accent="success"
          onClick={() => focusComplaints('resolved')}
          className={filter === 'resolved' ? 'ring-1 ring-emerald-400/40' : ''}
        />
        <MetricCard
          icon={Clock}
          label="Active"
          value={stats.loading ? '—' : stats.open}
          sublabel="In progress"
          accent="danger"
          onClick={() => focusComplaints('open')}
          className={filter === 'open' ? 'ring-1 ring-red-400/40' : ''}
        />
        <MetricCard
          icon={Award}
          label="Credits"
          value={profile?.credits ?? 0}
          sublabel="Civic rewards"
          accent="violet"
          onClick={() => focusComplaints('all')}
          className="ring-0"
        />
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 glass-panel dashboard-panel-glow">
          <div className="px-5 py-4 border-b border-glass-border">
            <h2 className="font-bold text-text-primary">Activity</h2>
            <p className="text-[13px] text-text-muted">Reports per month</p>
          </div>
          <div className="h-[200px] px-2 py-3">
            {chartData.some((d) => d.filed > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="fillActivity" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#34d399" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: '#737373', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#737373', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={CHART_TOOLTIP} />
                  <Area type="monotone" dataKey="filed" stroke="#6ee7b7" strokeWidth={2} fill="url(#fillActivity)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-[15px] text-text-muted">
                No activity yet — post your first issue
              </div>
            )}
          </div>
        </div>

        <div className="glass-panel dashboard-panel-glow-teal p-5 flex flex-col">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-500/15 border border-teal-400/30 shadow-[0_0_20px_rgba(45,212,191,0.15)]">
              <TrendingUp className="h-5 w-5 text-teal-300" />
            </div>
            <div>
              <p className="text-[13px] text-text-muted">Resolution rate</p>
              <p className="text-2xl font-bold tabular-nums">
                {stats.loading ? '—' : `${stats.resolutionRate}%`}
              </p>
            </div>
          </div>
          <p className="text-[15px] text-text-secondary flex-1">
            Tap Filed, Active, or Resolved above to view matching complaints.
          </p>
          <div className="mt-4 h-1.5 rounded-full bg-white/[0.08] overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-teal-700 via-teal-500 to-teal-300 shadow-[0_0_12px_rgba(45,212,191,0.45)] transition-all"
              style={{ width: `${Math.min(100, stats.resolutionRate || 0)}%` }}
            />
          </div>
        </div>
      </div>

      <section ref={complaintsSectionRef} id="your-complaints" className="glass-panel scroll-mt-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 py-4 border-b border-glass-border">
          <div className="flex items-center gap-3">
            <div>
              <h2 className="font-bold text-text-primary text-[17px]">Your complaints</h2>
              <p className="text-[13px] text-text-muted">
                {loading ? 'Loading…' : `${filtered.length} shown · ${complaints.length} total`}
              </p>
            </div>
            <button type="button" onClick={fetchComplaints} className="btn-ghost p-2" aria-label="Refresh">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <div className="flex gap-1 p-1 rounded-full glass">
            {[
              { id: 'all', label: 'All' },
              { id: 'open', label: 'Active' },
              { id: 'resolved', label: 'Done' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                className={`pill-tab ${filter === tab.id ? 'pill-tab-active' : 'pill-tab-inactive'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <p className="mx-5 mt-4 text-sm text-text-secondary glass rounded-xl px-4 py-3">
            {error}.{' '}
            <button type="button" className="underline text-text-primary font-semibold" onClick={fetchComplaints}>
              Retry
            </button>
          </p>
        )}

        {loading && complaints.length === 0 && !error ? (
          <div className="flex justify-center py-16">
            <LoadingSpinner size="md" />
          </div>
        ) : filtered.length === 0 && !loading ? (
          <EmptyState icon={FileStack} title="No complaints yet" description="Tap Post issue to report a civic problem in your area." />
        ) : (
          <div className="divide-y divide-glass-border">
            {filtered.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelected(c)}
                className="w-full text-left px-5 py-4 hover:bg-white/[0.04] transition-colors flex gap-4 items-start group"
              >
                <div className="flex-1 min-w-0">
                  <p
                    className="mb-1 font-mono text-[11px] font-semibold uppercase tracking-wider text-accent-cyan"
                    title={c.id}
                  >
                    {formatComplaintId(c.id)}
                  </p>
                  <p className="font-medium text-[15px] text-text-primary line-clamp-2 group-hover:underline">
                    {c.description || 'Untitled issue'}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <StatusBadge status={c.status} size="sm" />
                    <DeptTag dept={c.dept} size="sm" interactive onClick={() => openByDept(c.dept)} />
                    <SeverityBadge severity={c.severity} size="sm" showLabel={false} />
                  </div>
                  <p className="text-[13px] text-text-muted mt-1.5">
                    {c.wards?.name || 'Hyderabad'} · {formatRelativeTime(c.created_at)}
                  </p>
                </div>
                <div className="hidden sm:flex flex-col items-end gap-2 shrink-0">
                  <ComplaintTiming
                    status={c.status}
                    created_at={c.created_at}
                    resolved_at={c.resolved_at}
                    sla_deadline={c.sla_deadline}
                    sla_hours={c.sla_hours}
                    assigned_to={c.assigned_to}
                    size="sm"
                  />
                  <ArrowRight className="h-4 w-4 text-text-hint" />
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {selected && (
        <ComplaintDetail complaint={selected} onClose={() => setSelected(null)} onUpdate={fetchComplaints} />
      )}
    </div>
  );
}

function buildMonthlyChart(complaints) {
  const months = {};
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = d.toLocaleString('en', { month: 'short' });
    months[key] = { month: key, filed: 0 };
  }
  complaints.forEach((c) => {
    const d = new Date(c.created_at);
    const key = d.toLocaleString('en', { month: 'short' });
    if (months[key]) months[key].filed += 1;
  });
  return Object.values(months);
}
