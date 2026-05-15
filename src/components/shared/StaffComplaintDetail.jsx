import { useState, useEffect } from 'react';
import { MapPin, Clock, Sparkles, User } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import GlassModal from './GlassModal';
import ComplaintLocationMap from './ComplaintLocationMap';
import DeptTag from './DeptTag';
import StatusBadge from './StatusBadge';
import SeverityBadge from './SeverityBadge';
import SafetySensitiveBadge from './SafetySensitiveBadge';
import ComplaintTiming from './ComplaintTiming';
import LoadingSpinner from './LoadingSpinner';
import { formatComplaintId, formatDate } from '../../lib/utils';

export default function StaffComplaintDetail({ complaint: initial, onClose }) {
  const [complaint, setComplaint] = useState(initial);
  const [citizen, setCitizen] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setComplaint(initial);
  }, [initial]);

  useEffect(() => {
    if (!initial?.id) return;
    setLoading(true);
    supabase
      .from('complaints')
      .select('*, wards(name)')
      .eq('id', initial.id)
      .single()
      .then(({ data }) => {
        if (data) setComplaint(data);
        setLoading(false);
      });
  }, [initial?.id]);

  useEffect(() => {
    if (!complaint?.citizen_id) {
      setCitizen(null);
      return;
    }
    supabase
      .from('users')
      .select('id, name')
      .eq('id', complaint.citizen_id)
      .single()
      .then(({ data }) => setCitizen(data));
  }, [complaint?.citizen_id]);

  if (!complaint) return null;

  return (
    <GlassModal
      open
      onClose={onClose}
      title={`Complaint ${formatComplaintId(complaint.id)}`}
      size="xl"
      align="top"
      bodyClassName="p-0"
    >
      <div className="max-h-[min(85vh,720px)] overflow-y-auto">
        {loading ? (
          <div className="flex justify-center py-20">
            <LoadingSpinner size="md" />
          </div>
        ) : (
          <div className="grid gap-0 lg:grid-cols-2">
            <div className="border-b border-white/10 lg:border-b-0 lg:border-r">
              {complaint.image_url ? (
                <img src={complaint.image_url} alt="" className="aspect-video w-full object-cover" />
              ) : (
                <div className="flex aspect-video items-center justify-center bg-white/[0.04]">
                  <DeptTag dept={complaint.dept} size="lg" />
                </div>
              )}
              <div className="p-4">
                <ComplaintLocationMap
                  lat={complaint.lat}
                  lng={complaint.lng}
                  address={complaint.address}
                />
              </div>
            </div>

            <div className="space-y-4 p-5">
              <div className="flex flex-wrap items-center gap-2">
                <DeptTag dept={complaint.dept} />
                <StatusBadge status={complaint.status} />
                <SeverityBadge severity={complaint.severity} size="sm" />
                {complaint.safety_sensitive ? <SafetySensitiveBadge /> : null}
              </div>

              <p className="text-[15px] leading-relaxed text-text-primary">
                {complaint.description || 'No description'}
              </p>

              <div className="glass-inset space-y-2 p-3 text-sm">
                <div className="flex items-center gap-2 text-text-secondary">
                  <User size={14} />
                  <span>
                    Citizen: <span className="text-text-primary">{citizen?.name || '—'}</span>
                  </span>
                </div>
                <div className="flex items-center gap-2 text-text-secondary">
                  <MapPin size={14} />
                  <span>{complaint.wards?.name || 'Hyderabad'}</span>
                </div>
                <div className="flex items-center gap-2 text-text-secondary">
                  <Clock size={14} />
                  <ComplaintTiming
                    status={complaint.status}
                    sla_deadline={complaint.sla_deadline}
                    sla_hours={complaint.sla_hours}
                    assigned_to={complaint.assigned_to}
                    size="sm"
                  />
                  <span className="text-text-muted">· {formatDate(complaint.created_at)}</span>
                </div>
              </div>

              {complaint.ai_reasoning && (
                <div className="glass-inset p-3">
                  <p className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase text-text-muted">
                    <Sparkles size={12} /> AI routing
                  </p>
                  <p className="text-sm text-text-secondary">{complaint.ai_reasoning}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </GlassModal>
  );
}
