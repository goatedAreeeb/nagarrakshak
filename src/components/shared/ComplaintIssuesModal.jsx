import { useState, useEffect, useCallback } from 'react';
import { ChevronRight, Filter, RefreshCw } from 'lucide-react';
import GlassModal from './GlassModal';
import DeptTag from './DeptTag';
import StatusBadge from './StatusBadge';
import SeverityBadge from './SeverityBadge';
import ComplaintTiming from './ComplaintTiming';
import LoadingSpinner from './LoadingSpinner';
import EmptyState from './EmptyState';
import { fetchScopedComplaints } from '../../lib/complaintExplorer';
import { formatComplaintId, formatRelativeTime, cn } from '../../lib/utils';

export default function ComplaintIssuesModal({
  open,
  onClose,
  title,
  subtitle,
  filter = {},
  scope = {},
  onSelect,
}) {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const { data, error: err } = await fetchScopedComplaints(scope, filter);
    if (err) {
      setError(err.message || 'Failed to load complaints');
      setComplaints([]);
    } else {
      setComplaints(data);
    }
    setLoading(false);
  }, [scope, filter]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  return (
    <GlassModal
      open={open}
      onClose={onClose}
      title={title}
      size="lg"
      align="top"
      bodyClassName="p-0"
    >
      <div className="border-b border-white/10 px-5 py-3">
        <p className="text-sm text-text-secondary">{subtitle}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {filter.dept && <DeptTag dept={filter.dept} size="sm" />}
          {filter.statusGroup && filter.statusGroup !== 'all' && (
            <span className="rounded-full border border-white/15 bg-white/[0.06] px-2.5 py-0.5 text-xs text-text-secondary capitalize">
              {filter.statusGroup.replace('_', ' ')}
            </span>
          )}
          {filter.severityMin != null && (
            <span className="text-xs text-text-muted">Severity ≥ {filter.severityMin}</span>
          )}
          <button type="button" onClick={load} className="btn-ghost ml-auto p-2" aria-label="Refresh">
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
        </div>
        {!loading && (
          <p className="mt-2 text-xs font-semibold text-cyan-300/90">
            {complaints.length} issue{complaints.length === 1 ? '' : 's'}
          </p>
        )}
      </div>

      {error && (
        <p className="mx-5 mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <LoadingSpinner size="md" />
        </div>
      ) : complaints.length === 0 ? (
        <EmptyState
          icon={Filter}
          title="No matching issues"
          description="Try another department or filter."
          className="py-12"
        />
      ) : (
        <ul className="max-h-[min(60vh,520px)] divide-y divide-white/10 overflow-y-auto">
          {complaints.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => onSelect?.(c)}
                className="flex w-full gap-3 px-5 py-4 text-left transition-colors hover:bg-white/[0.04]"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-cyan-300/90">
                    {formatComplaintId(c.id)}
                  </p>
                  <p className="mt-1 line-clamp-2 font-medium text-text-primary">
                    {c.description || 'No description'}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <DeptTag dept={c.dept} size="sm" />
                    <StatusBadge status={c.status} size="sm" />
                    <SeverityBadge severity={c.severity} size="sm" showLabel={false} />
                  </div>
                  <p className="mt-1 text-xs text-text-muted">
                    {c.wards?.name || 'Hyderabad'} · {formatRelativeTime(c.created_at)}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end justify-center gap-2">
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
    </GlassModal>
  );
}
