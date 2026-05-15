import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ArrowUpRight,
  CheckCircle2,
  Clock,
  MapPin,
  MessageSquare,
  Send,
  User,
  UserCog,
  Sparkles,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { createNotification } from '../../contexts/NotificationContext';
import { escalationRole } from '../../lib/slaEngine';
import GlassModal from '../shared/GlassModal';
import ComplaintLocationMap from '../shared/ComplaintLocationMap';
import StatusBadge from '../shared/StatusBadge';
import DeptTag from '../shared/DeptTag';
import SeverityBadge from '../shared/SeverityBadge';
import ComplaintTiming from '../shared/ComplaintTiming';
import LoadingSpinner from '../shared/LoadingSpinner';
import {
  formatComplaintId,
  formatDate,
  formatRelativeTime,
  roleLabel,
  cn,
} from '../../lib/utils';

export default function SupervisorEscalationDetail({
  escalation: initialEscalation,
  onClose,
  onResolved,
}) {
  const { user, profile } = useAuth();
  const [escalation, setEscalation] = useState(initialEscalation);
  const [complaint, setComplaint] = useState(null);
  const [citizen, setCitizen] = useState(null);
  const [assignee, setAssignee] = useState(null);
  const [messages, setMessages] = useState([]);
  const [senders, setSenders] = useState({});
  const [loadingComplaint, setLoadingComplaint] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [supervisorNote, setSupervisorNote] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const threadRef = useRef(null);

  const loadComplaint = useCallback(async () => {
    if (!escalation?.complaint_id) return;
    setLoadingComplaint(true);
    const { data, error: err } = await supabase
      .from('complaints')
      .select('*, wards(name)')
      .eq('id', escalation.complaint_id)
      .single();

    if (err) {
      setError(err.message);
      setComplaint(null);
    } else {
      setComplaint(data);
    }
    setLoadingComplaint(false);
  }, [escalation?.complaint_id]);

  const loadMessages = useCallback(async () => {
    if (!escalation?.complaint_id) return;
    setLoadingMessages(true);
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('complaint_id', escalation.complaint_id)
      .order('created_at', { ascending: true });

    const rows = data || [];
    setMessages(rows);

    const ids = [...new Set(rows.map((m) => m.sender_id).filter(Boolean))];
    if (ids.length) {
      const { data: users } = await supabase.from('users').select('id, name, role').in('id', ids);
      setSenders(Object.fromEntries((users || []).map((u) => [u.id, u])));
    }
    setLoadingMessages(false);
  }, [escalation?.complaint_id]);

  useEffect(() => {
    setEscalation(initialEscalation);
    setSupervisorNote('');
    setError('');
  }, [initialEscalation]);

  useEffect(() => {
    loadComplaint();
    loadMessages();
  }, [loadComplaint, loadMessages]);

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

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const postSupervisorMessage = async (text) => {
    if (!text.trim() || !user || !complaint) return false;
    const content = `[Supervisor — ${profile?.name || 'Supervisor'}] ${text.trim()}`;
    const { data, error: err } = await supabase
      .from('messages')
      .insert({
        complaint_id: complaint.id,
        sender_id: user.id,
        content,
      })
      .select()
      .single();

    if (err) return false;

    setMessages((prev) => [...prev, data]);
    setSenders((prev) => ({
      ...prev,
      [user.id]: { id: user.id, name: profile?.name, role: profile?.role },
    }));
    return true;
  };

  const notifyParties = async (title, message) => {
    if (complaint?.citizen_id) {
      await createNotification(
        complaint.citizen_id,
        'escalation',
        title,
        message,
        complaint.id
      );
    }
    const { data: officers } = await supabase
      .from('users')
      .select('id')
      .eq('role', 'officer')
      .limit(5);
    for (const o of officers || []) {
      await createNotification(o.id, 'escalation', title, message, complaint.id);
    }
  };

  const handleIssueDirective = async () => {
    const text = supervisorNote.trim();
    if (!text) {
      setError('Write a directive for the officer or field team.');
      return;
    }
    setSubmitting(true);
    setError('');
    const ok = await postSupervisorMessage(text);
    if (ok) {
      await notifyParties(
        'Supervisor directive',
        `${profile?.name}: ${text.slice(0, 120)}`
      );
      setSupervisorNote('');
      loadMessages();
    } else {
      setError('Could not save directive.');
    }
    setSubmitting(false);
  };

  const handleResolve = async () => {
    setSubmitting(true);
    setError('');

    const note = supervisorNote.trim();
    if (note) await postSupervisorMessage(note);

    const { error: updateErr } = await supabase
      .from('escalations')
      .update({ resolved: true })
      .eq('id', escalation.id);

    if (updateErr) {
      setError(
        updateErr.message.includes('policy')
          ? 'Cannot mark resolved — run escalations UPDATE policy in Supabase (see schema.sql).'
          : updateErr.message
      );
      setSubmitting(false);
      return;
    }

    await notifyParties(
      'Escalation closed',
      `Supervisor ${profile?.name} closed the escalation for ${complaint?.dept || 'this'} complaint.`
    );

    setSubmitting(false);
    onResolved?.(escalation.id);
    onClose?.();
  };

  const handleEscalateHigher = async () => {
    const reason = supervisorNote.trim() || escalation.reason || 'Supervisor escalation to zonal';
    setSubmitting(true);
    setError('');

    const { error: insertErr } = await supabase.from('escalations').insert({
      complaint_id: escalation.complaint_id,
      from_role: 'supervisor',
      to_role: escalationRole('supervisor'),
      reason,
    });

    if (insertErr) {
      setError(insertErr.message);
      setSubmitting(false);
      return;
    }

    await supabase.from('escalations').update({ resolved: true }).eq('id', escalation.id);
    await postSupervisorMessage(`Escalated to ${roleLabel(escalationRole('supervisor'))}: ${reason}`);
    await notifyParties('Escalated to zonal', reason.slice(0, 120));

    setSubmitting(false);
    onResolved?.(escalation.id);
    onClose?.();
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    const text = newMessage.trim();
    if (!text) return;
    setSending(true);
    const ok = await postSupervisorMessage(text);
    if (ok) setNewMessage('');
    setSending(false);
  };

  const higherRole = escalationRole('supervisor');

  return (
    <GlassModal
      open
      onClose={onClose}
      title={`Escalation · ${formatComplaintId(escalation.complaint_id)}`}
      size="xl"
      align="top"
      bodyClassName="p-0"
    >
      <div className="max-h-[min(85vh,800px)] overflow-y-auto">
        {loadingComplaint ? (
          <div className="flex justify-center py-20">
            <LoadingSpinner size="md" />
          </div>
        ) : !complaint ? (
          <p className="p-8 text-center text-text-secondary">Complaint not found.</p>
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
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-200/90">
                  Officer escalation · {formatRelativeTime(escalation.triggered_at)}
                </p>
                <p className="mt-2 text-sm text-text-primary">
                  {escalation.reason || 'No reason provided'}
                </p>
                <p className="mt-1 text-xs text-text-muted">
                  From {roleLabel(escalation.from_role)} → {roleLabel(escalation.to_role)}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <DeptTag dept={complaint.dept} />
                <StatusBadge status={complaint.status} />
                <SeverityBadge severity={complaint.severity} size="sm" />
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

              <section className="rounded-xl border border-violet-500/25 bg-violet-500/5 p-4">
                <h3 className="mb-2 text-sm font-bold text-text-primary">Supervisor action</h3>
                <textarea
                  value={supervisorNote}
                  onChange={(e) => setSupervisorNote(e.target.value)}
                  rows={3}
                  placeholder="Directive to officer / worker, or resolution note…"
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
                    onClick={handleIssueDirective}
                    disabled={submitting}
                    className="btn-secondary flex-1 min-w-[120px] disabled:opacity-50"
                  >
                    Send directive
                  </button>
                  <button
                    type="button"
                    onClick={handleResolve}
                    disabled={submitting}
                    className="btn-primary flex flex-1 min-w-[140px] items-center justify-center gap-1 disabled:opacity-50"
                  >
                    <CheckCircle2 size={16} />
                    Mark resolved
                  </button>
                  <button
                    type="button"
                    onClick={handleEscalateHigher}
                    disabled={submitting}
                    className="flex w-full items-center justify-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 py-2 text-sm text-amber-200 hover:bg-amber-500/15 disabled:opacity-50 sm:w-auto sm:flex-1"
                  >
                    <ArrowUpRight size={16} />
                    Escalate to {roleLabel(higherRole)}
                  </button>
                </div>
              </section>

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
                      const isMe = msg.sender_id === user?.id;
                      return (
                        <div
                          key={msg.id}
                          className={cn(
                            'rounded-lg px-3 py-2 text-sm',
                            isMe ? 'bg-violet-500/15 ml-4' : 'bg-white/[0.04] mr-4'
                          )}
                        >
                          <p className="text-[10px] font-semibold uppercase text-text-muted">
                            {sender?.name || 'User'} · {roleLabel(sender?.role)}
                          </p>
                          <p className="mt-0.5 text-text-primary">{msg.content}</p>
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
                    placeholder="Quick reply in thread…"
                    className="input-field min-w-0 flex-1"
                  />
                  <button type="submit" disabled={sending} className="btn-primary shrink-0 px-3">
                    <Send size={16} />
                  </button>
                </form>
              </section>
            </div>
          </div>
        )}
      </div>
    </GlassModal>
  );
}
