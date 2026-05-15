import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  AlertTriangle,
  Filter,
  Inbox,
  UserCog,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { getSLAStatus, isSlaCountdownActive } from '../../lib/slaEngine';
import { DEMO_ROUTING_OFFICER_EMAIL } from '../../lib/officerRouting';
import ComplaintTiming from '../shared/ComplaintTiming';
import MetricCard from '../shared/MetricCard';
import { ALL_DEPTS, formatComplaintId, cn } from '../../lib/utils';
import StatusBadge from '../shared/StatusBadge';
import DeptTag from '../shared/DeptTag';
import SeverityBadge from '../shared/SeverityBadge';
import LoadingSpinner from '../shared/LoadingSpinner';
import EmptyState from '../shared/EmptyState';
import OfficerComplaintDetail from './OfficerComplaintDetail';
import { useComplaintExplorer } from '../../contexts/ComplaintExplorerContext';

export default function OfficerDashboard() {
  const { profile } = useAuth();
  const { openByDept, openByStatusGroup } = useComplaintExplorer();
  const [complaints, setComplaints] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deptFilter, setDeptFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selected, setSelected] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('complaints')
        .select('*, wards(name), citizen:users!complaints_citizen_id_fkey(id, name)')
        .order('created_at', { ascending: false });

      if (deptFilter !== 'all') query = query.eq('dept', deptFilter);
      if (statusFilter !== 'all') query = query.eq('status', statusFilter);

      const [{ data: rows, error: cErr }, { data: workerRows }] = await Promise.all([
        query,
        supabase.from('users').select('id, name, dept').eq('role', 'worker').order('name'),
      ]);

      if (cErr) {
        let fallback = supabase
          .from('complaints')
          .select('*, wards(name)')
          .order('created_at', { ascending: false });
        if (deptFilter !== 'all') fallback = fallback.eq('dept', deptFilter);
        if (statusFilter !== 'all') fallback = fallback.eq('status', statusFilter);
        const { data: fb } = await fallback;
        setComplaints(fb || []);
      } else {
        setComplaints(rows || []);
      }
      setWorkers(workerRows || []);
    } catch (err) {
      console.warn('Officer dashboard:', err?.message || err);
      setComplaints([]);
    } finally {
      setLoading(false);
    }
  }, [deptFilter, statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const stats = useMemo(() => {
    const pending = complaints.filter((c) => c.status === 'open').length;
    const active = complaints.filter((c) =>
      ['assigned', 'in_progress', 'reopened'].includes(c.status)
    ).length;
    const breached = complaints.filter((c) => {
      if (!isSlaCountdownActive(c)) return false;
      return getSLAStatus(c.sla_deadline, c.sla_hours).status === 'breached';
    }).length;
    return { pending, active, breached };
  }, [complaints]);

  const breachedList = useMemo(
    () =>
      complaints.filter((c) => {
        if (!isSlaCountdownActive(c)) return false;
        return getSLAStatus(c.sla_deadline, c.sla_hours).status === 'breached';
      }),
    [complaints]
  );

  const handleComplaintUpdate = (updated) => {
    setComplaints((prev) => prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)));
    setSelected((prev) => (prev?.id === updated.id ? { ...prev, ...updated } : prev));
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl">
      <header>
        <p className="text-sm text-text-secondary">Officer command · All departments (demo)</p>
        <h1 className="text-2xl font-bold text-text-primary">{profile?.name || 'Officer'}</h1>
        <p className="mt-2 text-sm text-emerald-300/80">
          Routing hub for every department until dedicated officers are added. Login:{' '}
          <span className="font-mono text-text-primary">{DEMO_ROUTING_OFFICER_EMAIL}</span>
        </p>
        {profile?.dept && (
          <p className="mt-1 text-xs text-text-muted">Profile dept: {profile.dept} · filters below by complaint dept</p>
        )}
      </header>

      <section className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <MetricCard
          icon={Inbox}
          label="Awaiting assign"
          value={loading ? '—' : stats.pending}
          sublabel="Open · needs worker"
          accent="warning"
          onClick={() => {
            setStatusFilter('open');
            openByStatusGroup('open');
          }}
          className={statusFilter === 'open' ? 'ring-1 ring-amber-400/40' : ''}
        />
        <MetricCard
          icon={UserCog}
          label="Active"
          value={loading ? '—' : stats.active}
          sublabel="Assigned / in progress"
          accent="danger"
          onClick={() => {
            setStatusFilter('all');
            openByStatusGroup('open');
          }}
        />
        <MetricCard
          icon={AlertTriangle}
          label="SLA breach"
          value={loading ? '—' : stats.breached}
          sublabel="Past deadline"
          accent="danger"
          className="col-span-2 lg:col-span-1"
          onClick={() => openByStatusGroup('breached')}
        />
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="glass-panel lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-glass-border px-5 py-4">
            <div className="flex items-center gap-2">
              <Filter className="h-5 w-5 text-cyan-300" />
              <h2 className="text-lg font-semibold text-text-primary">Complaint queue</h2>
              <button
                type="button"
                onClick={fetchData}
                className="btn-ghost p-2"
                aria-label="Refresh"
              >
                <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              <select
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                className="rounded-lg border border-border-default bg-bg-elevated px-3 py-1.5 text-sm text-text-primary"
              >
                <option value="all">All departments</option>
                {ALL_DEPTS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-lg border border-border-default bg-bg-elevated px-3 py-1.5 text-sm text-text-primary"
              >
                <option value="all">All statuses</option>
                <option value="open">Open</option>
                <option value="assigned">Assigned</option>
                <option value="in_progress">In progress</option>
                <option value="resolved">Resolved</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <LoadingSpinner size="md" />
            </div>
          ) : complaints.length === 0 ? (
            <EmptyState icon={Inbox} title="No complaints" description="Nothing matches your filters." />
          ) : (
            <ul className="divide-y divide-glass-border">
              {complaints.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(c)}
                    className="flex w-full gap-4 px-5 py-4 text-left transition-colors hover:bg-white/[0.04]"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-cyan-300/90">
                        {formatComplaintId(c.id)}
                      </p>
                      <p className="mt-1 line-clamp-2 font-medium text-text-primary">
                        {c.description || 'No description'}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <DeptTag dept={c.dept} size="sm" interactive onClick={() => openByDept(c.dept)} />
                        <StatusBadge status={c.status} size="sm" />
                        <SeverityBadge severity={c.severity} size="sm" showLabel={false} />
                      </div>
                      <p className="mt-1.5 text-xs text-text-muted">
                        {c.wards?.name || 'Hyderabad'}
                        {c.citizen?.name && ` · ${c.citizen.name}`}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end justify-between gap-2">
                      <ComplaintTiming
                        status={c.status}
                        sla_deadline={c.sla_deadline}
                        sla_hours={c.sla_hours}
                        assigned_to={c.assigned_to}
                        size="sm"
                      />
                      <ChevronRight className="h-5 w-5 text-text-hint" />
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="glass-panel">
          <div className="flex items-center gap-2 border-b border-accent-red/20 px-5 py-4">
            <AlertTriangle className="h-5 w-5 text-red-400" />
            <h2 className="text-lg font-semibold text-text-primary">SLA breaches</h2>
            <span className="ml-auto rounded-full bg-red-500/20 px-2 py-0.5 text-xs font-bold text-red-300">
              {breachedList.length}
            </span>
          </div>
          {breachedList.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-text-secondary">No active breaches</p>
          ) : (
            <ul className="max-h-[520px] divide-y divide-white/10 overflow-y-auto">
              {breachedList.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(c)}
                    className="w-full px-5 py-3 text-left hover:bg-red-500/5"
                  >
                    <p className="line-clamp-2 text-sm text-text-primary">{c.description}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <DeptTag dept={c.dept} size="sm" interactive onClick={() => openByDept(c.dept)} />
                      <ComplaintTiming
                        status={c.status}
                        sla_deadline={c.sla_deadline}
                        sla_hours={c.sla_hours}
                        assigned_to={c.assigned_to}
                        size="sm"
                      />
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>

      {selected && (
        <OfficerComplaintDetail
          complaint={selected}
          workers={workers}
          onClose={() => setSelected(null)}
          onUpdate={handleComplaintUpdate}
        />
      )}
    </div>
  );
}
