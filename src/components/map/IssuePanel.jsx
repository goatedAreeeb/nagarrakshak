import { X } from 'lucide-react';
import { cn, formatDate, formatRelativeTime } from '../../lib/utils';
import SLATimer from '../shared/SLATimer';
import StatusBadge from '../shared/StatusBadge';
import SeverityBadge from '../shared/SeverityBadge';
import DeptTag from '../shared/DeptTag';
import MapPreviewPanel from '../shared/MapPreviewPanel';

export default function IssuePanel({ issue, open, onClose }) {
  if (!issue) return null;

  return (
    <div className="contents">
      {open && (
        <div
          className="fixed inset-0 z-[55] bg-black/40"
          onClick={onClose}
          role="presentation"
        />
      )}
    <div
      className={cn(
        'fixed top-0 right-0 bottom-0 z-[56] flex w-[380px] max-w-full flex-col border-l border-border-default bg-bg-surface shadow-card transition-transform duration-300',
        open ? 'translate-x-0' : 'translate-x-full'
      )}
      aria-hidden={!open}
    >
      <div className="flex items-start justify-between gap-3 border-b border-border-default px-5 py-4">
        <div>
          <div className="text-base font-semibold text-text-primary">Issue details</div>
          <div className="mt-1 text-xs text-text-secondary">{formatRelativeTime(issue.created_at)}</div>
        </div>
        <div
          role="button"
          tabIndex={0}
          onClick={onClose}
          onKeyDown={(e) => e.key === 'Enter' && onClose()}
          className="rounded-lg border border-border-default p-2 text-text-secondary hover:border-border-strong hover:bg-bg-elevated hover:text-text-primary cursor-pointer"
          aria-label="Close panel"
        >
          <X size={18} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={issue.status} />
          <DeptTag dept={issue.dept} size="sm" />
        </div>

        <div className="rounded-lg border border-border-default bg-bg-elevated px-4 py-3">
          <div className="text-xs font-medium uppercase tracking-wide text-text-hint">SLA</div>
          <div className="mt-2">
            <SLATimer sla_deadline={issue.sla_deadline} sla_hours={issue.sla_hours} size="lg" />
          </div>
          {issue.sla_deadline && (
            <div className="mt-2 text-xs text-text-secondary">
              Due {formatDate(issue.sla_deadline)}
            </div>
          )}
        </div>

        <div>
          <div className="text-xs text-text-hint mb-1">Severity</div>
          <SeverityBadge severity={issue.severity} size="md" />
        </div>

        {issue.description && (
          <div>
            <div className="text-xs text-text-hint mb-1">Description</div>
            <div className="text-sm text-text-primary leading-relaxed">{issue.description}</div>
          </div>
        )}

        {(issue.address || (issue.lat != null && issue.lng != null)) && (
          <div>
            <div className="text-xs text-text-hint mb-1">Location</div>
            {issue.address && (
              <div className="text-sm text-text-secondary">{issue.address}</div>
            )}
            {issue.lat != null && issue.lng != null && (
              <>
                <div className="mt-1 text-xs font-mono text-text-hint">
                  {issue.lat.toFixed(5)}, {issue.lng.toFixed(5)}
                </div>
                <div className="mt-3">
                  <MapPreviewPanel
                    lat={issue.lat}
                    lng={issue.lng}
                    address={issue.address}
                    aspectClass="aspect-[16/10]"
                    minHeight="140px"
                    showActions={false}
                    roundedClass="rounded-lg"
                  />
                </div>
              </>
            )}
          </div>
        )}

        {issue.division && (
          <div>
            <div className="text-xs text-text-hint mb-1">Division</div>
            <div className="text-sm text-text-secondary">{issue.division}</div>
          </div>
        )}

        <div className="rounded-lg border border-border-default bg-bg-base px-3 py-2 text-xs text-text-hint font-mono break-all">
          {issue.id}
        </div>
      </div>
    </div>
    </div>
  );
}
