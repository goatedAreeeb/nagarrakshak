import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  MapPin,
  Users,
  ArrowUpRight,
  ChevronRight,
  RefreshCw,
  Inbox,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { format, subDays } from 'date-fns';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { formatRelativeTime, formatComplaintId } from '../../lib/utils';
import DeptTag from '../shared/DeptTag';
import LoadingSpinner from '../shared/LoadingSpinner';
import EmptyState from '../shared/EmptyState';
import MetricCard from '../shared/MetricCard';
import SupervisorEscalationDetail from './SupervisorEscalationDetail';
import { useComplaintExplorer } from '../../contexts/ComplaintExplorerContext';

const TOOLTIP_STYLE = {
  contentStyle: { background: '#0d1628', border: '1px solid #1e3a5f', borderRadius: 8 },
  labelStyle: { color: '#e2e8f0' },
};

export default function SupervisorDashboard() {
  const { profile } = useAuth();
  const { openByDept, openByStatusGroup } = useComplaintExplorer();
  const zone = profile?.zone || 'South';
  const [wards, setWards] = useState([]);
  const [officers, setOfficers] = useState([]);
  const [escalations, setEscalations] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEscalation, setSelectedEscalation] = useState(null);
  const [fetchError, setFetchError] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setFetchError('');
    try {
      const { data: wardRows } = await supabase
        .from('wards')
        .select('*')
        .eq('zone', zone)
        .order('health_score', { ascending: true });

      const wardIds = wardRows?.map((w) => w.id) || [];

      const [officerRes, escRes, compRes] = await Promise.all([
        supabase.from('users').select('id, name, dept, email').eq('role', 'officer'),
        supabase
          .from('escalations')
          .select('*, complaints(id, description, dept, status, ward_id, wards(name))')
          .eq('to_role', 'supervisor')
          .eq('resolved', false)
          .order('triggered_at', { ascending: false })
          .limit(30),
        wardIds.length
          ? supabase
              .from('complaints')
              .select('id, created_at, status, ward_id')
              .in('ward_id', wardIds)
              .gte('created_at', subDays(new Date(), 7).toISOString())
          : Promise.resolve({ data: [] }),
      ]);

      if (escRes.error) {
        const { data: escOnly } = await supabase
          .from('escalations')
          .select('*')
          .eq('to_role', 'supervisor')
          .eq('resolved', false)
          .order('triggered_at', { ascending: false })
          .limit(30);
        setEscalations(escOnly || []);
        if (escRes.error) setFetchError(escRes.error.message);
      } else {
        setEscalations(escRes.data || []);
      }

      setWards(wardRows || []);
      setOfficers(officerRes.data || []);
      setComplaints(compRes.data || []);
    } catch (err) {
      setFetchError(err?.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, [zone]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const trendData = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = subDays(new Date(), 6 - i);
      return { date: format(d, 'EEE'), filed: 0, resolved: 0 };
    });
    complaints.forEach((c) => {
      const day = format(new Date(c.created_at), 'EEE');
      const row = days.find((d) => d.date === day);
      if (row) {
        row.filed += 1;
        if (['resolved', 'closed'].includes(c.status)) row.resolved += 1;
      }
    });
    return days;
  }, [complaints]);

  const handleEscalationResolved = (escalationId) => {
    setEscalations((prev) => prev.filter((e) => e.id !== escalationId));
    setSelectedEscalation(null);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl">
      <header>
        <p className="text-sm text-text-secondary">Zone supervisor</p>
        <h1 className="text-2xl font-bold text-text-primary">{profile?.name}</h1>
        <p className="mt-1 text-sm text-cyan-300/90">
          {zone} Zone · {wards.length} wards · Review officer escalations below
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <MetricCard
          icon={Inbox}
          label="Pending escalations"
          value={escalations.length}
          sublabel="From officers — tap to open"
          accent="warning"
          onClick={() => openByStatusGroup('open')}
        />
        <MetricCard
          icon={Users}
          label="Officers"
          value={officers.length}
          sublabel="In system (demo)"
          accent="brand"
        />
        <MetricCard
          icon={MapPin}
          label="Wards"
          value={wards.length}
          sublabel={`${zone} zone`}
          accent="violet"
          className="col-span-2 lg:col-span-1"
        />
      </section>

      <section className="glass-panel border-amber-500/25">
        <div className="flex flex-wrap items-center gap-2 border-b border-amber-500/20 px-5 py-4">
          <ArrowUpRight className="h-5 w-5 text-amber-400" />
          <h2 className="text-lg font-semibold text-text-primary">Officer escalations</h2>
          <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-bold text-amber-200">
            {escalations.length}
          </span>
          <button
            type="button"
            onClick={fetchData}
            className="btn-ghost ml-auto p-2"
            aria-label="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        {fetchError && (
          <p className="mx-5 mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {fetchError}
          </p>
        )}

        {escalations.length === 0 ? (
          <EmptyState
            icon={ArrowUpRight}
            title="No active escalations"
            description="When an officer clicks “Escalate to supervisor”, the case appears here. Open it to send a directive or mark resolved."
            className="py-10"
          />
        ) : (
          <ul className="divide-y divide-white/10">
            {escalations.map((e) => {
              const c = e.complaints;
              return (
                <li key={e.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedEscalation(e)}
                    className="flex w-full gap-4 px-5 py-4 text-left transition-colors hover:bg-amber-500/5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-amber-200/90">
                        {formatComplaintId(e.complaint_id)}
                      </p>
                      <p className="mt-1 line-clamp-2 font-medium text-text-primary">
                        {c?.description || e.reason || 'Escalated complaint'}
                      </p>
                      {e.reason && (
                        <p className="mt-1 line-clamp-1 text-xs italic text-text-secondary">
                          Officer: {e.reason}
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {c?.dept && (
                          <DeptTag
                            dept={c.dept}
                            size="sm"
                            interactive
                            onClick={() => openByDept(c.dept)}
                          />
                        )}
                        <span className="text-xs text-text-muted">{c?.wards?.name}</span>
                        <span className="text-xs text-text-hint">
                          {formatRelativeTime(e.triggered_at)}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 shrink-0 self-center text-text-hint" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-border-default bg-bg-surface p-5 shadow-card">
          <div className="mb-4 flex items-center gap-2">
            <Users className="h-5 w-5 text-accent-cyan" />
            <h2 className="text-lg font-semibold text-text-primary">Department officers</h2>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {officers.map((o) => (
              <div
                key={o.id}
                className="rounded-lg border border-border-default bg-bg-elevated p-4 transition-colors hover:border-accent-cyan/40"
              >
                <p className="font-medium text-text-primary">{o.name}</p>
                {o.dept && <DeptTag dept={o.dept} size="sm" className="mt-2" />}
                <p className="mt-2 truncate text-xs text-text-hint">{o.email}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-border-default bg-bg-surface p-5 shadow-card">
          <h2 className="mb-4 text-lg font-semibold text-text-primary">7-day complaint trend</h2>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" />
              <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 11 }} stroke="#1e3a5f" />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} stroke="#1e3a5f" allowDecimals={false} />
              <Tooltip {...TOOLTIP_STYLE} />
              <Line
                type="monotone"
                dataKey="filed"
                stroke="#00d4ff"
                strokeWidth={2}
                dot={false}
                name="Filed"
              />
              <Line
                type="monotone"
                dataKey="resolved"
                stroke="#10b981"
                strokeWidth={2}
                dot={false}
                name="Resolved"
              />
            </LineChart>
          </ResponsiveContainer>
        </section>
      </div>

      <section className="rounded-xl border border-border-default bg-bg-surface shadow-card overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border-default px-5 py-4">
          <MapPin className="h-5 w-5 text-accent-cyan" />
          <h2 className="text-lg font-semibold text-text-primary">Zone wards</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-default text-left text-text-secondary">
                <th className="px-5 py-3 font-medium">Ward</th>
                <th className="px-3 py-3 font-medium">Open</th>
                <th className="px-3 py-3 font-medium">Resolved</th>
                <th className="px-3 py-3 font-medium">Health</th>
                <th className="px-5 py-3 font-medium">Dominant issue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-default">
              {wards.map((w) => (
                <tr key={w.id} className="hover:bg-bg-hover/40">
                  <td className="px-5 py-3 font-medium text-text-primary">{w.name}</td>
                  <td className="px-3 py-3 text-accent-amber">{w.open_issues}</td>
                  <td className="px-3 py-3 text-accent-emerald">{w.resolved_issues}</td>
                  <td className="px-3 py-3">
                    <HealthBar score={w.health_score} />
                  </td>
                  <td className="px-5 py-3">
                    <DeptTag
                      dept={w.dominant_category}
                      size="sm"
                      interactive
                      onClick={() => openByDept(w.dominant_category)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {selectedEscalation && (
        <SupervisorEscalationDetail
          escalation={selectedEscalation}
          onClose={() => setSelectedEscalation(null)}
          onResolved={handleEscalationResolved}
        />
      )}
    </div>
  );
}

function HealthBar({ score }) {
  const color =
    score >= 70 ? 'bg-accent-emerald' : score >= 45 ? 'bg-accent-amber' : 'bg-accent-red';
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-bg-elevated">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, score)}%` }} />
      </div>
      <span className="w-8 text-xs text-text-secondary">{Math.round(score)}</span>
    </div>
  );
}
