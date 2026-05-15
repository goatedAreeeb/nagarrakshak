import { useState, useEffect, useCallback, useRef } from 'react';
import {
  UserCog,
  Clock,
  MapPin,
  Sparkles,
  Send,
  ArrowUpRight,
  PlayCircle,
  MessageSquare,
  User,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { createNotification } from '../../contexts/NotificationContext';
import { notifySupervisorsOfEscalation } from '../../lib/supervisorRouting';
import {
  getSLADeadline,
  escalationRole,
  OFFICER_SLA_OPTIONS,
  formatSlaHoursLabel,
} from '../../lib/slaEngine';
import GlassModal from '../shared/GlassModal';
import ComplaintLocationMap from '../shared/ComplaintLocationMap';
import StatusBadge from '../shared/StatusBadge';
import DeptTag from '../shared/DeptTag';
import SeverityBadge from '../shared/SeverityBadge';
import SafetySensitiveBadge from '../shared/SafetySensitiveBadge';
import ComplaintTiming from '../shared/ComplaintTiming';
import LoadingSpinner from '../shared/LoadingSpinner';
import {
  formatComplaintId,
  formatDate,
  formatRelativeTime,
  roleLabel,
  cn,
} from '../../lib/utils';

export default function OfficerComplaintDetail({ complaint: initial, workers = [], onClose, onUpdate }) {
  const { user, profile } = useAuth();
  const [complaint, setComplaint] = useState(initial);
  const [citizen, setCitizen] = useState(null);
  const [assignee, setAssignee] = useState(null);
  const [messages, setMessages] = useState([]);
  const [senders, setSenders] = useState({});
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [selectedWorker, setSelectedWorker] = useState(initial?.assigned_to || '');
  const [assignSlaHours, setAssignSlaHours] = useState(initial?.sla_hours || 48);
  const [officerRemarks, setOfficerRemarks] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const threadRef = useRef(null);

  const workersForDept = workers.filter((w) => w.dept === complaint?.dept);
  const workerOptions = workersForDept.length > 0 ? workersForDept : workers;

  useEffect(() => {
    setComplaint(initial);
    setSelectedWorker(initial?.assigned_to || '');
    setAssignSlaHours(initial?.sla_hours || 48);
    setOfficerRemarks('');
    setError('');
  }, [initial]);

  useEffect(() => {
    if (!complaint?.citizen_id) {
      setCitizen(null);
      return;
    }
    supabase
      .from('users')
      .select('id, name, email')
      .eq('id', complaint.citizen_id)
      .single()
      .then(({ data }) => setCitizen(data));
  }, [complaint?.citizen_id]);

  useEffect(() => {
    if (!complaint?.assigned_to) {
      setAssignee(null);
      return;
    }
    supabase
      .from('users')
      .select('id, name, role, dept')
      .eq('id', complaint.assigned_to)
      .single()
      .then(({ data }) => setAssignee(data));
  }, [complaint?.assigned_to]);

  const loadMessages = useCallback(async () => {
    if (!complaint?.id) return;
    setLoadingMessages(true);
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('complaint_id', complaint.id)
      .order('created_at', { ascending: true });

    const rows = data || [];
    setMessages(rows);

    const ids = [...new Set(rows.map((m) => m.sender_id).filter(Boolean))];
    if (ids.length) {
      const { data: users } = await supabase.from('users').select('id, name, role').in('id', ids);
      const map = {};
      (users || []).forEach((u) => {
        map[u.id] = u;
      });
      setSenders(map);
    } else {
      setSenders({});
    }
    setLoadingMessages(false);
    requestAnimationFrame(() => {
      if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight;
    });
  }, [complaint?.id]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  const patchLocal = (patch) => {
    const next = { ...complaint, ...patch };
    setComplaint(next);
    onUpdate?.(next);
  };

  const handleAssign = async () => {
    if (!selectedWorker) {
      setError('Select a field worker to assign.');
      return;
    }
    setSubmitting(true);
    setError('');

    const hours = Number(assignSlaHours) || 48;
    const deadline = getSLADeadline(hours);
    const isNew = complaint.status === 'open';

    const { error: updateErr } = await supabase
      .from('complaints')
      .update({
        assigned_to: selectedWorker,
        status: 'assigned',
        sla_hours: hours,
        sla_deadline: deadline.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', complaint.id);

    if (updateErr) {
      setError(updateErr.message);
      setSubmitting(false);
      return;
    }

    const remarks = officerRemarks.trim();
    if (remarks) {
      await supabase.from('messages').insert({
        complaint_id: complaint.id,
        sender_id: user.id,
        content: `[Officer note — ${profile?.name || 'Officer'}] ${remarks}`,
      });
    }

    const worker = workers.find((w) => w.id === selectedWorker);
    if (worker?.id) {
      await createNotification(
        worker.id,
        'complaint_assigned',
        'New task assigned',
        `${complaint.dept}: ${complaint.description?.slice(0, 80) || 'Complaint'} — deadline ${formatSlaHoursLabel(hours)}.`,
        complaint.id
      );
    }

    if (complaint.citizen_id) {
      await createNotification(
        complaint.citizen_id,
        'complaint_assigned',
        'Worker assigned',
        `Your ${complaint.dept} complaint was assigned to ${worker?.name || 'a field worker'}.`,
        complaint.id
      );
    }

    patchLocal({
      assigned_to: selectedWorker,
      status: 'assigned',
      sla_hours: hours,
      sla_deadline: deadline.toISOString(),
    });
    setOfficerRemarks('');
    setSubmitting(false);
    loadMessages();

    if (isNew) onClose?.();
  };

  const handleMarkInProgress = async () => {
    setSubmitting(true);
    const { error: err } = await supabase
      .from('complaints')
      .update({ status: 'in_progress', updated_at: new Date().toISOString() })
      .eq('id', complaint.id);
    setSubmitting(false);
    if (!err) patchLocal({ status: 'in_progress' });
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    const text = newMessage.trim();
    if (!text || !user) return;
    setSending(true);
    const { data, error: err } = await supabase
      .from('messages')
      .insert({
        complaint_id: complaint.id,
        sender_id: user.id,
        content: text,
      })
      .select()
      .single();

    if (!err && data) {
      setMessages((prev) => [...prev, data]);
      setSenders((prev) => ({ ...prev, [user.id]: { id: user.id, name: profile?.name, role: profile?.role } }));
      setNewMessage('');
      if (complaint.citizen_id) {
        await createNotification(
          complaint.citizen_id,
          'new_message',
          'Update from officer',
          `${profile?.name}: ${text.slice(0, 100)}`,
          complaint.id
        );
      }
    }
    setSending(false);
  };

  const handleEscalate = async () => {
    const reason = officerRemarks.trim() || 'Requires supervisor attention';
    setSubmitting(true);
    setError('');

    const { error: escErr } = await supabase.from('escalations').insert({
      complaint_id: complaint.id,
      from_role: 'officer',
      to_role: escalationRole('officer'),
      reason,
    });

    if (escErr) {
      setError(escErr.message);
      setSubmitting(false);
      return;
    }

    await notifySupervisorsOfEscalation({
      complaintId: complaint.id,
      dept: complaint.dept,
      description: complaint.description,
      reason,
    });

    if (complaint.citizen_id) {
      await createNotification(
        complaint.citizen_id,
        'escalation',
        'Case escalated',
        `Your complaint was escalated to a zone supervisor for review.`,
        complaint.id
      );
    }

    setSubmitting(false);
    setOfficerRemarks('');
    onClose?.();
  };

  if (!complaint) return null;

  const canAssign = ['open', 'assigned', 'reopened'].includes(complaint.status);
  const needsAssignment = complaint.status === 'open' || !complaint.assigned_to;

  return (
    <GlassModal
      open
      onClose={onClose}
      title={`Complaint ${formatComplaintId(complaint.id)}`}
      size="xl"
      align="top"
      bodyClassName="p-0"
    >
      <div className="max-h-[min(85vh,800px)] overflow-y-auto">
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
              <ComplaintLocationMap lat={complaint.lat} lng={complaint.lng} address={complaint.address} />
            </div>
          </div>

          <div className="space-y-4 p-5">
            <div className="flex flex-wrap items-center gap-2">
              <DeptTag dept={complaint.dept} />
              <StatusBadge status={complaint.status} />
              <SeverityBadge severity={complaint.severity} size="sm" />
              {complaint.safety_sensitive ? <SafetySensitiveBadge /> : null}
            </div>

            <p className="text-[15px] leading-relaxed text-text-primary">{complaint.description}</p>

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
              {assignee && (
                <div className="flex items-center gap-2 text-emerald-300/90">
                  <UserCog size={14} />
                  Worker: {assignee.name} ({assignee.dept})
                </div>
              )}
            </div>

            {complaint.ai_reasoning && (
              <div className="glass-inset p-3">
                <p className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase text-text-muted">
                  <Sparkles size={12} /> AI routing
                </p>
                <p className="text-sm text-text-secondary">{complaint.ai_reasoning}</p>
              </div>
            )}

            {canAssign && (
              <section className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-4">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-text-primary">
                  <UserCog size={16} className="text-emerald-300" />
                  {needsAssignment ? 'Assign field worker' : 'Reassign & update SLA'}
                </h3>

                <label className="mb-1 block text-xs font-medium text-text-secondary">
                  Worker ({complaint.dept})
                  {workersForDept.length === 0 && workerOptions.length > 0 && (
                    <span className="text-text-muted"> — showing all workers (demo)</span>
                  )}
                </label>
                <select
                  value={selectedWorker}
                  onChange={(e) => setSelectedWorker(e.target.value)}
                  className="input-field mb-3"
                >
                  <option value="">Select worker</option>
                  {workerOptions.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} · {w.dept}
                    </option>
                  ))}
                </select>

                <label className="mb-1 block text-xs font-medium text-text-secondary">
                  Resolution timeline
                </label>
                <select
                  value={assignSlaHours}
                  onChange={(e) => setAssignSlaHours(Number(e.target.value))}
                  className="input-field mb-1"
                >
                  <optgroup label="Immediate / urgent">
                    {OFFICER_SLA_OPTIONS.filter((o) => o.hours <= 8).map((o) => (
                      <option key={o.hours} value={o.hours}>
                        {o.label}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Standard (under 1 week)">
                    {OFFICER_SLA_OPTIONS.filter((o) => o.hours >= 12).map((o) => (
                      <option key={o.hours} value={o.hours}>
                        {o.label}
                      </option>
                    ))}
                  </optgroup>
                </select>
                <p className="mb-3 text-[11px] text-text-muted">
                  Use 2–8h for emergencies (blocked road, sewage overflow). Citizen SLA timer starts after you assign.
                </p>

                <label className="mb-1 block text-xs font-medium text-text-secondary">
                  Officer remarks (visible in thread)
                </label>
                <textarea
                  value={officerRemarks}
                  onChange={(e) => setOfficerRemarks(e.target.value)}
                  rows={3}
                  placeholder="Instructions for the worker, access notes, priority context…"
                  className="input-field mb-3 resize-none"
                />

                {error && (
                  <p className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                    {error}
                  </p>
                )}

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleAssign}
                    disabled={submitting || !selectedWorker}
                    className="btn-primary flex-1 min-w-[140px] disabled:opacity-50"
                  >
                    {submitting ? 'Saving…' : needsAssignment ? 'Assign worker' : 'Update assignment'}
                  </button>
                  {complaint.status === 'assigned' && (
                    <button
                      type="button"
                      onClick={handleMarkInProgress}
                      disabled={submitting}
                      className="btn-secondary flex items-center gap-1"
                    >
                      <PlayCircle size={16} />
                      In progress
                    </button>
                  )}
                </div>
              </section>
            )}

            <section className="border-t border-white/10 pt-4">
              <h3 className="mb-2 flex items-center gap-2 text-sm font-bold">
                <MessageSquare size={16} />
                Thread
              </h3>
              <div
                ref={threadRef}
                className="glass-inset mb-3 max-h-40 space-y-2 overflow-y-auto p-3"
              >
                {loadingMessages ? (
                  <LoadingSpinner size="sm" />
                ) : messages.length === 0 ? (
                  <p className="text-center text-xs text-text-muted">No messages yet.</p>
                ) : (
                  messages.map((msg) => {
                    const sender = senders[msg.sender_id];
                    const isOfficer = msg.sender_id === user?.id;
                    return (
                      <div
                        key={msg.id}
                        className={cn(
                          'rounded-lg border px-3 py-2 text-sm',
                          isOfficer
                            ? 'border-emerald-500/30 bg-emerald-500/10'
                            : 'border-white/10 bg-white/[0.04]'
                        )}
                      >
                        <p className="text-xs font-semibold text-text-primary">
                          {sender?.name || 'User'}{' '}
                          <span className="font-normal text-text-muted">
                            {sender?.role ? roleLabel(sender.role) : ''}
                          </span>
                        </p>
                        <p className="mt-1 break-words text-text-secondary">{msg.content}</p>
                        <p className="mt-1 text-[10px] text-text-muted">
                          {formatRelativeTime(msg.created_at)}
                        </p>
                      </div>
                    );
                  })
                )}
              </div>
              <form onSubmit={handleSendMessage} className="flex gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Message citizen or worker…"
                  className="input-field min-w-0 flex-1"
                />
                <button type="submit" disabled={sending} className="btn-primary shrink-0 px-3">
                  <Send size={16} />
                </button>
              </form>
            </section>

            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
              <button
                type="button"
                onClick={handleEscalate}
                disabled={submitting}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 py-2 text-sm text-amber-200 hover:bg-amber-500/15 disabled:opacity-50"
              >
                <ArrowUpRight size={16} />
                Escalate to supervisor
              </button>
              <p className="mt-2 text-[11px] leading-relaxed text-text-muted">
                Sends this case up the chain when you need higher authority — e.g. inter-department
                coordination, policy approval, or repeated SLA breach. Your remarks above become the
                escalation reason; it appears on the Supervisor dashboard.
              </p>
            </div>
          </div>
        </div>
      </div>
    </GlassModal>
  );
}
