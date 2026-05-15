import { MapPin, Clock } from 'lucide-react';
import DeptTag from '../shared/DeptTag';
import SeverityBadge from '../shared/SeverityBadge';
import StatusBadge from '../shared/StatusBadge';
import ComplaintTiming from '../shared/ComplaintTiming';
import { formatRelativeTime, formatComplaintId } from '../../lib/utils';
import { getSLAStatus, isSlaCountdownActive } from '../../lib/slaEngine';

export default function ComplaintCard({ complaint, onClick }) {
  const slaActive = isSlaCountdownActive({
    status: complaint.status,
    sla_deadline: complaint.sla_deadline,
    assigned_to: complaint.assigned_to,
  });
  const sla = getSLAStatus(complaint.sla_deadline, complaint.sla_hours);
  const isBreached = slaActive && sla.status === 'breached';
  const wardName = complaint.wards?.name || 'Hyderabad';

  return (
    <button
      type="button"
      onClick={() => onClick?.(complaint)}
      className="card w-full text-left hover:border-border-strong transition-all animate-slide-up"
    >
      <div className="flex gap-4">
        <div className="shrink-0 w-[60px] h-[60px] rounded-lg overflow-hidden border border-border-default bg-bg-elevated">
          {complaint.image_url ? (
            <img
              src={complaint.image_url}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-bg-elevated to-bg-hover p-1">
              <DeptTag dept={complaint.dept} size="sm" showIcon={false} />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p
            className="mb-1.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-accent-cyan"
            title={complaint.id}
          >
            {formatComplaintId(complaint.id)}
          </p>
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <DeptTag dept={complaint.dept} size="sm" />
            <StatusBadge status={complaint.status} size="sm" />
          </div>

          <SeverityBadge severity={complaint.severity} size="sm" showLabel={false} />

          <p className="text-sm text-text-primary mt-2 line-clamp-1">
            {complaint.description || 'No description provided'}
          </p>

          <div className="mt-2">
            {isBreached ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent-red uppercase">
                <span className="w-1.5 h-1.5 rounded-full bg-accent-red animate-pulse" aria-hidden />
                Overdue
              </span>
            ) : (
              <ComplaintTiming
                status={complaint.status}
                sla_deadline={complaint.sla_deadline}
                sla_hours={complaint.sla_hours}
                assigned_to={complaint.assigned_to}
                size="sm"
              />
            )}
          </div>

          <div className="flex items-center gap-3 mt-2 text-xs text-text-secondary">
            <span className="flex items-center gap-1 truncate">
              <MapPin size={12} className="shrink-0" />
              {wardName}
            </span>
            <span className="flex items-center gap-1 shrink-0">
              <Clock size={12} />
              {formatRelativeTime(complaint.created_at)}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}
