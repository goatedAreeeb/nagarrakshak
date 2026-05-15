import { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import {
  AlertCircle,
  Download,
  ChevronUp,
  ChevronDown,
  BarChart3,
  Building2,
  Users,
  RefreshCw,
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import { useAuth } from '../../contexts/AuthContext';
import { useComplaintExplorer } from '../../contexts/ComplaintExplorerContext';
import { supabase } from '../../lib/supabase';
import { fetchCityAnalytics } from '../../lib/complaintExplorer';
import { formatRelativeTime, cn, ALL_DEPTS } from '../../lib/utils';
import StatusBadge from '../shared/StatusBadge';
import SeverityBadge from '../shared/SeverityBadge';
import DeptTag from '../shared/DeptTag';
import MetricCard from '../shared/MetricCard';
import LoadingSpinner from '../shared/LoadingSpinner';
import ExportReport from '../reports/ExportReport';
import BillboardManager from '../billboard/BillboardManager';

const PIE_COLORS = [
  '#00d4ff',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#7c3aed',
  '#3b82f6',
  '#ec4899',
  '#a78bfa',
  '#94a3b8',
];
const TOOLTIP_STYLE = {
  contentStyle: { background: '#0d1628', border: '1px solid #1e3a5f', borderRadius: 8 },
  labelStyle: { color: '#e2e8f0' },
};

export default function CityDashboard() {
  const { profile } = useAuth();
  const location = useLocation();
  const { openByDept, openByStatusGroup, openDetail } = useComplaintExplorer();
  const [complaints, setComplaints] = useState([]);
  const [deptMatrix, setDeptMatrix] = useState([]);
  const [pieData, setPieData] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [exportOpen, setExportOpen] = useState(false);
  const [sortKey, setSortKey] = useState('score');
  const [sortDir, setSortDir] = useState('desc');
  const [kpis, setKpis] = useState({
    open: 0,
    breached: 0,
    resolved: 0,
    avgSev: 0,
    escalations: 0,
    citizens: 0,
    total: 0,
  });

  const loadCore = useCallback(async () => {
    setLoading(true);
    setFetchError('');
    const result = await fetchCityAnalytics();
    if (result.error) setFetchError(result.error);
    setComplaints(result.complaints);
    setDeptMatrix(result.deptMatrix);
    setPieData(result.pieData);
    setKpis(result.kpis);
    setLoading(false);
    return result;
  }, []);

  const loadAlerts = useCallback(async () => {
    const { data } = await supabase
      .from('complaints')
      .select('*, wards(name)')
      .gte('severity', 4)
      .in('status', ['open', 'assigned', 'in_progress', 'reopened'])
      .order('severity', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(20);
    setAlerts(data || []);
  }, []);

  useEffect(() => {
    loadCore();
    loadAlerts();
  }, [loadCore, loadAlerts]);

  useEffect(() => {
    if (location.hash === '#analytics') {
      requestAnimationFrame(() => {
        document.getElementById('analytics')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  }, [location.hash, loading]);

  useEffect(() => {
    const channel = supabase
      .channel('city-dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'complaints' }, () => {
        loadCore();
        loadAlerts();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadCore, loadAlerts]);

  const sortedMatrix = useMemo(() => {
    const rows = [...deptMatrix];
    rows.sort((a, b) => {
      const av = a[sortKey] ?? 0;
      const bv = b[sortKey] ?? 0;
      return sortDir === 'asc' ? av - bv : bv - av;
    });
    return rows;
  }, [deptMatrix, sortKey, sortDir]);

  const barData = useMemo(
    () =>
      pieData.map((d) => ({
        dept: d.name,
        count: d.value,
      })),
    [pieData]
  );

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const SortIcon = ({ col }) =>
    sortKey === col ? (
      sortDir === 'asc' ? (
        <ChevronUp size={12} className="ml-1 inline" />
      ) : (
        <ChevronDown size={12} className="ml-1 inline" />
      )
    ) : null;

  const handlePieClick = (_, index) => {
    const dept = pieData[index]?.name;
    if (dept) openByDept(dept);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl space-y-6 animate-fade-in">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-text-secondary">City Command Center</p>
          <h1 className="text-2xl font-bold text-text-primary">{profile?.name || 'GHMC Admin'}</h1>
          <p className="mt-1 text-sm text-text-muted">
            Tap any department or metric card to see all matching issues
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => loadCore()} className="btn-secondary">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => setExportOpen(true)}
            className="btn-primary inline-flex items-center gap-2"
          >
            <Download size={16} />
            Export
          </button>
        </div>
      </header>

      <BillboardManager />

      {fetchError && (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          {fetchError} — showing available data.
        </p>
      )}

      <section id="analytics" className="scroll-mt-6 space-y-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-cyan-300" />
          <h2 className="text-lg font-semibold text-text-primary">City analytics</h2>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          <MetricCard
            icon={Building2}
            label="Open"
            value={kpis.open}
            sublabel="Active pipeline"
            accent="warning"
            onClick={() => openByStatusGroup('open')}
          />
          <MetricCard
            icon={AlertCircle}
            label="SLA breach"
            value={kpis.breached}
            sublabel="Needs escalation"
            accent="danger"
            onClick={() => openByStatusGroup('breached')}
          />
          <MetricCard
            icon={BarChart3}
            label="Resolved"
            value={kpis.resolved}
            sublabel="Closed cases"
            accent="success"
            onClick={() => openByStatusGroup('resolved')}
          />
          <MetricCard
            icon={BarChart3}
            label="Avg severity"
            value={kpis.avgSev.toFixed(1)}
            sublabel="City-wide"
            accent="brand"
            onClick={() => openByStatusGroup('all')}
          />
          <MetricCard
            icon={AlertCircle}
            label="Escalations"
            value={kpis.escalations}
            sublabel="Unresolved"
            accent="violet"
            onClick={() => openByStatusGroup('open')}
          />
          <MetricCard
            icon={Users}
            label="Citizens"
            value={kpis.citizens}
            sublabel="Registered"
            accent="brand"
            onClick={() => openByStatusGroup('all')}
          />
        </div>
      </section>

      <section className="glass-panel p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-muted">
          Departments — tap to list issues
        </p>
        <div className="flex flex-wrap gap-2">
          {ALL_DEPTS.map((d) => {
            const count = pieData.find((p) => p.name === d)?.value || 0;
            return (
              <DeptTag
                key={d}
                dept={d}
                size="sm"
                interactive
                onClick={() => openByDept(d)}
                className={count > 0 ? '' : 'opacity-50'}
              />
            );
          })}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="glass-panel overflow-hidden">
          <div className="border-b border-white/10 px-5 py-4">
            <h2 className="text-lg font-semibold text-text-primary">Department matrix</h2>
            <p className="text-xs text-text-muted">This month · click a row</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-text-secondary">
                  <th className="px-5 py-3 font-medium">Dept</th>
                  <th
                    className="cursor-pointer px-3 py-3 font-medium hover:text-text-primary"
                    onClick={() => toggleSort('total_complaints')}
                  >
                    Total <SortIcon col="total_complaints" />
                  </th>
                  <th
                    className="cursor-pointer px-3 py-3 font-medium hover:text-text-primary"
                    onClick={() => toggleSort('resolved')}
                  >
                    Resolved <SortIcon col="resolved" />
                  </th>
                  <th
                    className="cursor-pointer px-3 py-3 font-medium hover:text-text-primary"
                    onClick={() => toggleSort('score')}
                  >
                    Score <SortIcon col="score" />
                  </th>
                  <th
                    className="cursor-pointer px-5 py-3 font-medium hover:text-text-primary"
                    onClick={() => toggleSort('breach_count')}
                  >
                    Breaches <SortIcon col="breach_count" />
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {sortedMatrix.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-text-secondary">
                      No department data — file complaints to populate analytics
                    </td>
                  </tr>
                ) : (
                  sortedMatrix.map((row) => (
                    <tr
                      key={row.id || row.dept}
                      className="cursor-pointer transition-colors hover:bg-white/[0.04]"
                      onClick={() => openByDept(row.dept)}
                    >
                      <td className="px-5 py-3">
                        <DeptTag
                          dept={row.dept}
                          size="sm"
                          interactive
                          onClick={() => openByDept(row.dept)}
                        />
                      </td>
                      <td className="px-3 py-3 text-text-primary">{row.total_complaints}</td>
                      <td className="px-3 py-3 text-emerald-300">{row.resolved}</td>
                      <td className="px-3 py-3">
                        <span
                          className={cn(
                            'font-medium',
                            row.score >= 70
                              ? 'text-emerald-300'
                              : row.score >= 45
                                ? 'text-amber-300'
                                : 'text-red-300'
                          )}
                        >
                          {Math.round(row.score)}%
                        </span>
                      </td>
                      <td className="px-5 py-3 text-red-300">{row.breach_count}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="glass-panel p-5">
          <h2 className="mb-1 text-lg font-semibold text-text-primary">Complaints by department</h2>
          <p className="mb-4 text-xs text-text-muted">Click a slice to open issues</p>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={95}
                  cursor="pointer"
                  onClick={handlePieClick}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={{ stroke: '#475569' }}
                >
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip {...TOOLTIP_STYLE} />
                <Legend wrapperStyle={{ color: '#94a3b8', fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-16 text-center text-sm text-text-secondary">No complaint data yet</p>
          )}

          {barData.length > 0 && (
            <div className="mt-6 border-t border-white/10 pt-4">
              <p className="mb-2 text-xs font-semibold uppercase text-text-muted">Volume by dept</p>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={barData} layout="vertical" margin={{ left: 4, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" />
                  <XAxis type="number" allowDecimals={false} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                  <YAxis
                    type="category"
                    dataKey="dept"
                    width={72}
                    tick={{ fill: '#94a3b8', fontSize: 9 }}
                  />
                  <Tooltip {...TOOLTIP_STYLE} />
                  <Bar
                    dataKey="count"
                    fill="#00d4ff"
                    radius={[0, 4, 4, 0]}
                    cursor="pointer"
                    onClick={(data) => data?.dept && openByDept(data.dept)}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>
      </div>

      <section className="glass-panel border-red-500/25">
        <div className="flex items-center gap-2 border-b border-red-500/20 px-5 py-4">
          <AlertCircle className="h-5 w-5 animate-pulse text-red-400" />
          <h2 className="text-lg font-semibold text-text-primary">Severity alert feed</h2>
          <span className="text-xs font-medium text-red-300">Live · severity 4+</span>
        </div>
        {alerts.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-text-secondary">
            No high-severity active alerts
          </p>
        ) : (
          <ul className="max-h-96 divide-y divide-white/10 overflow-y-auto">
            {alerts.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => openDetail(a)}
                  className="flex w-full items-start gap-4 px-5 py-3 text-left transition-colors hover:bg-red-500/5"
                >
                  <SeverityBadge severity={a.severity} size="sm" showLabel={false} />
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1 text-sm text-text-primary">{a.description}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <DeptTag
                        dept={a.dept}
                        size="sm"
                        interactive
                        onClick={() => openByDept(a.dept)}
                      />
                      <StatusBadge status={a.status} size="sm" />
                      <span className="text-xs text-text-hint">{a.wards?.name}</span>
                      <span className="text-xs text-text-secondary">
                        {formatRelativeTime(a.created_at)}
                      </span>
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ExportReport open={exportOpen} onClose={() => setExportOpen(false)} />
    </div>
  );
}
