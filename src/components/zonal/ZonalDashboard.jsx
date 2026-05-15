import { useState, useEffect, useCallback, useMemo } from 'react';
import { BarChart3, Flame, MapPin } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { format, startOfMonth } from 'date-fns';
import { useAuth } from '../../contexts/AuthContext';
import { useComplaintExplorer } from '../../contexts/ComplaintExplorerContext';
import { supabase } from '../../lib/supabase';
import { formatRelativeTime, cn } from '../../lib/utils';
import DeptTag from '../shared/DeptTag';
import SeverityBadge from '../shared/SeverityBadge';
import MetricCard from '../shared/MetricCard';
import LoadingSpinner from '../shared/LoadingSpinner';
import EmptyState from '../shared/EmptyState';

const TOOLTIP_STYLE = {
  contentStyle: { background: '#0d1628', border: '1px solid #1e3a5f', borderRadius: 8 },
  labelStyle: { color: '#e2e8f0' },
};

function healthColor(score) {
  if (score >= 70) return 'border-accent-emerald/50 bg-accent-emerald/10';
  if (score >= 45) return 'border-accent-amber/50 bg-accent-amber/10';
  return 'border-accent-red/50 bg-accent-red/10';
}

export default function ZonalDashboard() {
  const { profile } = useAuth();
  const { openByDept, openByStatusGroup, openDetail } = useComplaintExplorer();
  const zone = profile?.zone || 'South';
  const [wards, setWards] = useState([]);
  const [deptPerf, setDeptPerf] = useState([]);
  const [chronic, setChronic] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const month = format(startOfMonth(new Date()), 'yyyy-MM-dd');

    const { data: wardRows } = await supabase
      .from('wards')
      .select('*')
      .eq('zone', zone)
      .order('name');

    const wardIds = wardRows?.map((w) => w.id) || [];

    const [perfRes, chronicRes] = await Promise.all([
      supabase.from('dept_performance').select('*').eq('month', month),
      wardIds.length
        ? supabase
            .from('complaints')
            .select('*, wards(name)')
            .in('ward_id', wardIds)
            .eq('is_chronic', true)
            .order('chronic_count', { ascending: false })
            .limit(10)
        : { data: [] },
    ]);

    setWards(wardRows || []);
    setDeptPerf(perfRes.data || []);
    setChronic(
      (chronicRes.data || []).filter((c) => !['resolved', 'closed'].includes(c.status))
    );
    setLoading(false);
  }, [zone]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totalOpen = wards.reduce((s, w) => s + (w.open_issues || 0), 0);
  const totalResolved = wards.reduce((s, w) => s + (w.resolved_issues || 0), 0);
  const avgHealth =
    wards.length > 0 ? wards.reduce((s, w) => s + w.health_score, 0) / wards.length : 0;

  const chartData = useMemo(
    () =>
      deptPerf.map((d) => ({
        dept: d.dept,
        score: Math.round(d.score || 0),
        resolved: d.resolved,
        total: d.total_complaints,
      })),
    [deptPerf]
  );

  const gridWards = useMemo(() => {
    const list = [...wards].slice(0, 8);
    while (list.length < 8) list.push(null);
    return list;
  }, [wards]);

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl space-y-6 animate-fade-in">
      <header>
        <p className="text-sm text-text-secondary">Zonal Analytics</p>
        <h1 className="text-2xl font-bold text-text-primary">{profile?.name}</h1>
        <p className="mt-1 text-sm text-cyan-300/90">
          {zone} Zone · Tap departments and cards to list issues
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MetricCard
          icon={MapPin}
          label="Wards"
          value={wards.length}
          sublabel={`${zone} zone`}
          accent="brand"
          onClick={() => openByStatusGroup('all')}
        />
        <MetricCard
          icon={Flame}
          label="Open issues"
          value={totalOpen}
          sublabel="Zone aggregate"
          accent="warning"
          onClick={() => openByStatusGroup('open')}
        />
        <MetricCard
          icon={BarChart3}
          label="Resolved"
          value={totalResolved}
          sublabel="Zone aggregate"
          accent="success"
          onClick={() => openByStatusGroup('resolved')}
        />
        <MetricCard
          icon={BarChart3}
          label="Avg health"
          value={`${Math.round(avgHealth)}%`}
          sublabel="Ward average"
          accent="violet"
          onClick={() => openByStatusGroup('all')}
        />
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="glass-panel p-5">
          <div className="mb-4 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-cyan-300" />
            <h2 className="text-lg font-semibold text-text-primary">Department efficiency</h2>
          </div>
          <p className="mb-3 text-xs text-text-muted">Click a bar to open that department&apos;s issues</p>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={chartData} layout="vertical" margin={{ left: 80 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" />
                <XAxis type="number" domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 11 }} stroke="#1e3a5f" />
                <YAxis type="category" dataKey="dept" tick={{ fill: '#94a3b8', fontSize: 10 }} stroke="#1e3a5f" width={75} />
                <Tooltip {...TOOLTIP_STYLE} />
                <Bar
                  dataKey="score"
                  name="Score %"
                  radius={[0, 4, 4, 0]}
                  cursor="pointer"
                  onClick={(data) => data?.dept && openByDept(data.dept)}
                >
                  {chartData.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={entry.score >= 70 ? '#10b981' : entry.score >= 45 ? '#f59e0b' : '#ef4444'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-12 text-center text-sm text-text-secondary">No performance data this month</p>
          )}
        </section>

        <section className="glass-panel p-5">
          <div className="mb-4 flex items-center gap-2">
            <MapPin className="h-5 w-5 text-cyan-300" />
            <h2 className="text-lg font-semibold text-text-primary">Ward health heatmap</h2>
          </div>
          <div className="grid grid-cols-4 grid-rows-2 gap-2">
            {gridWards.map((w, i) =>
              w ? (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => openByStatusGroup('open')}
                  className={cn(
                    'rounded-lg border p-3 text-center transition-colors hover:scale-[1.02]',
                    healthColor(w.health_score)
                  )}
                >
                  <p className="truncate text-xs font-semibold text-text-primary">{w.name}</p>
                  <p className="mt-1 text-lg font-bold text-text-primary">{Math.round(w.health_score)}</p>
                  <p className="text-[10px] text-text-secondary">{w.open_issues} open</p>
                </button>
              ) : (
                <div
                  key={`empty-${i}`}
                  className="rounded-lg border border-dashed border-white/10 p-3 opacity-30"
                />
              )
            )}
          </div>
        </section>
      </div>

      <section className="glass-panel border-red-500/25">
        <div className="flex items-center gap-2 border-b border-red-500/20 px-5 py-4">
          <Flame className="h-5 w-5 text-red-400" />
          <h2 className="text-lg font-semibold text-text-primary">Chronic hotspots</h2>
        </div>
        {chronic.length === 0 ? (
          <EmptyState
            icon={Flame}
            title="No chronic hotspots"
            description="Recurring issues in your zone will be flagged here."
            className="py-8"
          />
        ) : (
          <ul className="divide-y divide-red-500/10">
            {chronic.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => openDetail(c)}
                  className="flex w-full flex-col gap-3 px-5 py-4 text-left transition-colors hover:bg-red-500/5 sm:flex-row sm:items-center"
                >
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm text-text-primary">{c.description}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <DeptTag
                        dept={c.dept}
                        size="sm"
                        interactive
                        onClick={() => openByDept(c.dept)}
                      />
                      <span className="text-xs text-text-secondary">{c.wards?.name}</span>
                      <span className="text-xs font-medium text-red-300">
                        {c.chronic_count}× recurring
                      </span>
                    </div>
                  </div>
                  <SeverityBadge severity={c.severity} size="sm" showLabel={false} />
                  <span className="shrink-0 text-xs text-text-hint">
                    {formatRelativeTime(c.created_at)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
