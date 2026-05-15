import { useState, useEffect, useRef, useCallback } from 'react';
import { Sparkles, Send, Clock, UserCheck, Building2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { createNotification } from '../../contexts/NotificationContext';
import DeptTag from '../shared/DeptTag';
import SeverityBadge from '../shared/SeverityBadge';
import StatusBadge from '../shared/StatusBadge';
import SafetySensitiveBadge from '../shared/SafetySensitiveBadge';
import ComplaintTiming from '../shared/ComplaintTiming';
import ClosureVerify from './ClosureVerify';
import LoadingSpinner from '../shared/LoadingSpinner';
import GlassModal from '../shared/GlassModal';
import ComplaintLocationMap from '../shared/ComplaintLocationMap';
import { formatDate, formatRelativeTime, formatComplaintId, roleLabel, cn } from '../../lib/utils';
import { formatTimeLeft, getSLAStatus, isResolvedStatus } from '../../lib/slaEngine';

const TIMELINE_STEPS = [
  {
    key: 'open',
    label: 'Reported',
    dot: 'border-sky-400/80 bg-sky-400/90',
    ring: 'ring-sky-400/40',
    line: 'from-sky-400/80',
    text: 'text-sky-200',
  },
  {
    key: 'assigned',
    label: 'Assigned',
    dot: 'border-amber-400/80 bg-amber-400/90',
    ring: 'ring-amber-400/40',
    line: 'from-amber-400/80',
    text: 'text-amber-200',
  },
  {
    key: 'in_progress',
    label: 'In Progress',
    dot: 'border-violet-400/80 bg-violet-400/90',
    ring: 'ring-violet-400/40',
    line: 'from-violet-400/80',
    text: 'text-violet-200',
  },
  {
    key: 'resolved',
    label: 'Resolved',
    dot: 'border-emerald-400/80 bg-emerald-400/90',
    ring: 'ring-emerald-400/40',
    line: 'from-emerald-400/80',
    text: 'text-emerald-200',
  },
];

function timelineIndex(status) {
  switch (status) {
    case 'open':
      return 0;
    case 'assigned':
      return 1;
    case 'in_progress':
    case 'reopened':
      return 2;
    case 'resolved':
    case 'closed':
      return 3;
    default:
      return 0;
  }
}

function stepTimestamp(complaint, stepKey) {
  if (!complaint) return null;
  switch (stepKey) {
    case 'open':
      return complaint.created_at;
    case 'assigned':
      return timelineIndex(complaint.status) >= 1 ? complaint.updated_at : null;
    case 'in_progress':
      return timelineIndex(complaint.status) >= 2 ? complaint.updated_at : null;
    case 'resolved':
      return complaint.resolved_at || (isResolvedStatus(complaint.status) ? complaint.updated_at : null);
    default:
      return null;
  }
}

function StatusTimeline({ complaint }) {
  const status = complaint?.status;
  const activeIdx = timelineIndex(status);

  return (
    <div className="glass-inset px-3 py-5">
      <p className="mb-4 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
        Status progress
      </p>
      <div className="relative px-1">
        <div className="absolute left-[10%] right-[10%] top-[13px] flex h-[3px] overflow-hidden rounded-full bg-white/10">
          {TIMELINE_STEPS.slice(0, -1).map((step, i) => (
            <div
              key={step.key}
              className={cn(
                'h-full flex-1 transition-all duration-500',
                i < activeIdx ? `bg-gradient-to-r ${step.line} to-white/30` : 'bg-transparent'
              )}
              aria-hidden
            />
          ))}
        </div>

        <div className="relative flex items-start justify-between">
          {TIMELINE_STEPS.map((step, i) => {
            const completed = i < activeIdx;
            const active = i === activeIdx;
            const upcoming = i > activeIdx;
            const ts = stepTimestamp(complaint, step.key);
            const reached = completed || active;

            return (
              <div key={step.key} className="z-10 flex w-[23%] min-w-0 flex-col items-center">
                <div
                  className={cn(
                    'flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full border-2 shadow-sm transition-all',
                    completed && step.dot,
                    active && !completed && [step.dot, `ring-2 ${step.ring}`],
                    upcoming && 'border-white/20 bg-black/60'
                  )}
                >
                  {active && !completed && (
                    <span className="h-2.5 w-2.5 rounded-full bg-black/70" />
                  )}
                </div>
                <span
                  className={cn(
                    'mt-2 px-0.5 text-center text-[10px] font-semibold leading-tight',
                    reached ? step.text : 'text-text-muted'
                  )}
                >
                  {step.label}
                </span>
                {ts && reached && (
                  <span className="mt-1 px-0.5 text-center text-[9px] leading-tight text-text-muted">
                    {formatDate(ts).split(',')[0]}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ComplaintMeta({ complaint, assignee }) {
  const isResolved = isResolvedStatus(complaint.status);
  const isAssigned = Boolean(complaint.assigned_to || assignee);
  const sla = getSLAStatus(complaint.sla_deadline, complaint.sla_hours);

  return (
    <div className="glass-inset divide-y divide-white/10">
      <div className="p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
          Complaint ID
        </p>
        <p
          className="mt-1 font-mono text-sm font-semibold text-accent-cyan break-all"
          title={complaint.id}
        >
          {formatComplaintId(complaint.id)}
        </p>
        <p className="mt-1 truncate font-mono text-[10px] text-text-hint" title={complaint.id}>
          {complaint.id}
        </p>
      </div>

      <div className="p-4">
        <div className="flex items-start gap-3">
          <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-text-muted" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
              Registered under
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <DeptTag dept={complaint.dept} />
              <StatusBadge status={complaint.status} size="sm" />
              <SeverityBadge severity={complaint.severity} size="sm" showLabel={false} />
              {complaint.safety_sensitive ? <SafetySensitiveBadge /> : null}
            </div>
            {complaint.division && (
              <p className="mt-2 text-sm text-text-secondary">
                Division · <span className="text-text-primary">{complaint.division}</span>
              </p>
            )}
          </div>
        </div>
      </div>

      {isAssigned && assignee && (
        <div className="p-4">
          <div className="flex items-start gap-3">
            <UserCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                {isResolved ? 'Resolved by' : 'Assigned to'}
              </p>
              <p className="mt-1 text-sm font-bold text-text-primary">{assignee.name}</p>
              <p className="text-xs text-text-secondary">{roleLabel(assignee.role)}</p>
              {assignee.dept && (
                <p className="mt-1 text-xs text-text-muted">
                  Dept · <span className="text-text-secondary">{assignee.dept}</span>
                </p>
              )}
              {!isResolved &&
                complaint.sla_deadline &&
                complaint.assigned_to &&
                complaint.status !== 'open' && (
                <p className="mt-2 text-xs text-amber-200/90">
                  Resolve within · {formatTimeLeft(sla.hoursLeft)}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm">
        <div className="flex items-center gap-2 text-text-secondary">
          <Clock size={14} className="shrink-0" />
          <ComplaintTiming
            status={complaint.status}
            created_at={complaint.created_at}
            resolved_at={complaint.resolved_at}
            sla_deadline={complaint.sla_deadline}
            sla_hours={complaint.sla_hours}
            assigned_to={complaint.assigned_to}
            size="md"
          />
        </div>
        <span className="text-text-muted">·</span>
        <span className="text-text-muted">{complaint.wards?.name || 'Hyderabad'}</span>
        <span className="text-text-muted">·</span>
        <span className="text-text-muted">{formatDate(complaint.created_at)}</span>
      </div>
    </div>
  );
}

export default function ComplaintDetail({ complaint: initial, onClose, onUpdate }) {
  const { user, profile } = useAuth();
  const [complaint, setComplaint] = useState(initial);
  const [assignee, setAssignee] = useState(initial?.assignee || null);
  const [messages, setMessages] = useState([]);
  const [senders, setSenders] = useState({});
  const [newMessage, setNewMessage] = useState('');
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [sending, setSending] = useState(false);
  const scrollContainerRef = useRef(null);
  const threadScrollRef = useRef(null);

  const scrollToTop = useCallback(() => {
    const container = scrollContainerRef.current;
    if (container) container.scrollTop = 0;
  }, []);

  const scrollThreadToBottom = useCallback(() => {
    const el = threadScrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  useEffect(() => {
    setComplaint(initial);
    setAssignee(initial?.assignee || null);
    requestAnimationFrame(scrollToTop);
  }, [initial, scrollToTop]);

  useEffect(() => {
    if (!complaint?.assigned_to) {
      setAssignee(null);
      return;
    }
    if (complaint.assignee) {
      setAssignee(complaint.assignee);
      return;
    }
    supabase
      .from('users')
      .select('id, name, role, dept')
      .eq('id', complaint.assigned_to)
      .single()
      .then(({ data }) => {
        if (data) setAssignee(data);
      });
  }, [complaint?.assigned_to, complaint?.assignee]);

  const loadMessages = useCallback(async () => {
    if (!initial?.id) return;
    setLoadingMessages(true);
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('complaint_id', initial.id)
      .order('created_at', { ascending: true });

    const rows = data || [];
    setMessages(rows);

    const senderIds = [...new Set(rows.map((m) => m.sender_id).filter(Boolean))];
    if (senderIds.length) {
      const { data: users } = await supabase.from('users').select('id, name, role').in('id', senderIds);
      const map = {};
      (users || []).forEach((u) => {
        map[u.id] = u;
      });
      setSenders(map);
    } else {
      setSenders({});
    }
    setLoadingMessages(false);
    requestAnimationFrame(scrollThreadToBottom);
  }, [initial?.id, scrollThreadToBottom]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    if (!complaint?.id) return;

    const channel = supabase
      .channel(`messages-${complaint.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `complaint_id=eq.${complaint.id}`,
        },
        async (payload) => {
          const msg = payload.new;
          setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
          if (msg.sender_id) {
            const { data: u } = await supabase
              .from('users')
              .select('id, name, role')
              .eq('id', msg.sender_id)
              .single();
            if (u) setSenders((prev) => ({ ...prev, [u.id]: u }));
          }
          requestAnimationFrame(scrollThreadToBottom);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [complaint?.id, scrollThreadToBottom]);

  const handleSend = async (e) => {
    e.preventDefault();
    const text = newMessage.trim();
    if (!text || !user) return;

    setSending(true);
    const { data, error } = await supabase
      .from('messages')
      .insert({
        complaint_id: complaint.id,
        sender_id: user.id,
        content: text,
      })
      .select()
      .single();

    if (!error && data) {
      setNewMessage('');
      setMessages((prev) => (prev.some((m) => m.id === data.id) ? prev : [...prev, data]));
      setSenders((prev) => ({
        ...prev,
        [user.id]: { id: user.id, name: profile?.name || 'You', role: profile?.role || 'citizen' },
      }));

      if (complaint.assigned_to && complaint.assigned_to !== user.id) {
        await createNotification(
          complaint.assigned_to,
          'new_message',
          'New message on complaint',
          `${profile?.name || 'Citizen'}: ${text.slice(0, 80)}${text.length > 80 ? '…' : ''}`,
          complaint.id
        );
      }
      requestAnimationFrame(scrollThreadToBottom);
    }
    setSending(false);
  };

  const patchComplaint = (patch) => {
    const next = { ...complaint, ...patch };
    setComplaint(next);
    onUpdate?.(next);
  };

  if (!complaint) return null;

  const showClosure = complaint.status === 'resolved' && complaint.citizen_verified !== true;

  return (
    <GlassModal
      open
      onClose={onClose}
      title="Complaint details"
      titleId="complaint-detail-title"
      size="lg"
      align="top"
      bodyClassName="p-0"
    >
      <div ref={scrollContainerRef} className="max-h-[min(72vh,680px)] overflow-y-auto overscroll-contain">
        <div className="aspect-video w-full shrink-0 overflow-hidden bg-white/5">
          {complaint.image_url ? (
            <img src={complaint.image_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full min-h-[140px] w-full items-center justify-center">
              <DeptTag dept={complaint.dept} size="lg" />
            </div>
          )}
        </div>

        <div className="space-y-5 p-5 pb-6">
          <StatusTimeline complaint={complaint} />
          <ComplaintMeta complaint={complaint} assignee={assignee} />

          {complaint.description && (
            <p className="break-words text-[15px] leading-relaxed text-text-primary">
              {complaint.description}
            </p>
          )}

          {complaint.ai_reasoning && (
            <div className="glass-inset p-4">
              <div className="mb-2 flex items-center gap-2">
                <Sparkles size={16} className="text-text-primary" />
                <span className="text-sm font-semibold">AI analysis</span>
                <span className="badge-cyan ml-auto">Gemini</span>
              </div>
              <p className="text-sm italic leading-relaxed text-text-secondary">{complaint.ai_reasoning}</p>
            </div>
          )}

          {showClosure && (
            <ClosureVerify complaint={complaint} onVerified={patchComplaint} onReopened={patchComplaint} />
          )}

          <ComplaintLocationMap lat={complaint.lat} lng={complaint.lng} address={complaint.address} />

          <section className="border-t border-white/10 pt-5">
            <h3 className="mb-3 text-sm font-bold">Complaint thread</h3>
            <div ref={threadScrollRef} className="glass-inset max-h-48 space-y-3 overflow-y-auto p-3">
              {loadingMessages ? (
                <div className="flex justify-center py-6">
                  <LoadingSpinner size="md" />
                </div>
              ) : messages.length === 0 ? (
                <p className="py-4 text-center text-sm text-text-muted">No messages yet.</p>
              ) : (
                messages.map((msg) => {
                  const sender = senders[msg.sender_id];
                  const isOwn = msg.sender_id === user?.id;
                  return (
                    <div key={msg.id} className={cn('flex', isOwn ? 'justify-end' : 'justify-start')}>
                      <div
                        className={cn(
                          'max-w-[88%] rounded-2xl border px-3 py-2 text-sm',
                          isOwn
                            ? 'border-white bg-white text-black'
                            : 'border-white/10 bg-white/[0.06] text-text-primary'
                        )}
                      >
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <span className="text-xs font-bold">{sender?.name || 'Unknown'}</span>
                          {sender?.role && (
                            <span className="text-[10px] opacity-70">{roleLabel(sender.role)}</span>
                          )}
                        </div>
                        <p className="break-words leading-relaxed">{msg.content}</p>
                        <p className="mt-1 text-[10px] opacity-60">{formatRelativeTime(msg.created_at)}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <form onSubmit={handleSend} className="mt-3 flex gap-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message…"
                className="input-field min-w-0 flex-1"
                disabled={sending}
              />
              <button
                type="submit"
                disabled={sending || !newMessage.trim()}
                className="btn-primary shrink-0 px-4 disabled:opacity-50"
              >
                {sending ? <LoadingSpinner size="sm" /> : <Send size={16} />}
              </button>
            </form>
          </section>
        </div>
      </div>
    </GlassModal>
  );
}
