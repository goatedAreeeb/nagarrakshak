import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  BarChart3,
  Building2,
  ChevronRight,
  Download,
  RefreshCw,
  Users,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useComplaintExplorer } from '../../contexts/ComplaintExplorerContext';
import { supabase } from '../../lib/supabase';
import { fetchCityAnalytics } from '../../lib/complaintExplorer';
import { formatRelativeTime } from '../../lib/utils';
import StatusBadge from '../shared/StatusBadge';
import SeverityBadge from '../shared/SeverityBadge';
import DeptTag from '../shared/DeptTag';
import MetricCard from '../shared/MetricCard';
import LoadingSpinner from '../shared/LoadingSpinner';
import ExportReport from '../reports/ExportReport';

export default function CityDashboard() {
  const { profile } = useAuth();
  const { openByDept, openByStatusGroup, openDetail } = useComplaintExplorer();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [exportOpen, setExportOpen] = useState(false);
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
    setKpis(result.kpis);
    setLoading(false);
  }, []);

  const loadAlerts = useCallback(async () => {
    const { data } = await supabase
      .from('complaints')
      .select('*, wards(name)')
      .gte('severity', 4)
      .in('status', ['open', 'assigned', 'in_progress', 'reopened'])
      .order('severity', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(6);
    setAlerts(data || []);
  }, []);

  useEffect(() => {
    loadCore();
    loadAlerts();
  }, [loadCore, loadAlerts]);

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
            Quick overview — open Analytics for full city intelligence
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/city/analytics" className="btn-primary inline-flex items-center gap-2">
            <BarChart3 size={16} />
            Detailed analytics
          </Link>
          <button type="button" onClick={() => loadCore()} className="btn-secondary">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => setExportOpen(true)}
            className="btn-secondary inline-flex items-center gap-2"
          >
            <Download size={16} />
            Export
          </button>
        </div>
      </header>

      {fetchError && (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          {fetchError} — showing available data.
        </p>
      )}

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
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
      </section>

      <Link
        to="/city/analytics"
        className="glass-panel flex items-center justify-between gap-4 p-5 transition-colors hover:border-cyan-500/30"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-500/15">
            <BarChart3 className="h-5 w-5 text-cyan-300" />
          </div>
          <div>
            <h2 className="font-semibold text-text-primary">Detailed city analytics</h2>
            <p className="text-sm text-text-muted">
              Zone breakdown, status pipeline, department matrix, charts &amp; live alerts
            </p>
          </div>
        </div>
        <ChevronRight className="h-5 w-5 shrink-0 text-text-muted" />
      </Link>

      <section className="glass-panel border-red-500/25">
        <div className="flex items-center justify-between gap-2 border-b border-red-500/20 px-5 py-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 animate-pulse text-red-400" />
            <h2 className="text-lg font-semibold text-text-primary">Priority alerts</h2>
            <span className="text-xs font-medium text-red-300">Severity 4+</span>
          </div>
          <Link to="/city/analytics" className="text-xs font-medium text-cyan-300 hover:text-cyan-200">
            View all in analytics
          </Link>
        </div>
        {alerts.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-text-secondary">
            No high-severity active alerts
          </p>
        ) : (
          <ul className="divide-y divide-white/10">
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
                      <DeptTag dept={a.dept} size="sm" interactive onClick={() => openByDept(a.dept)} />
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
