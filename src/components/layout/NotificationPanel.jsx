import { X, Bell, AlertTriangle, CheckCircle, MessageCircle, ArrowUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useNotificationContext } from '../../contexts/NotificationContext';
import { formatRelativeTime } from '../../lib/utils';

const ICONS = {
  complaint_assigned: Bell,
  sla_warning: AlertTriangle,
  sla_breach: AlertTriangle,
  escalation: ArrowUp,
  complaint_resolved: CheckCircle,
  closure_rejected: AlertTriangle,
  duplicate_merged: MessageCircle,
  new_message: MessageCircle,
};

export default function NotificationPanel({ open, onClose }) {
  const { notifications, markRead, markAllRead } = useNotificationContext();
  const navigate = useNavigate();

  if (!open) return null;

  const handleClick = async (n) => {
    if (!n.read) await markRead(n.id);
    onClose();
    if (n.complaint_id) navigate(`/dashboard?complaint=${n.complaint_id}`);
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" onClick={onClose} aria-hidden />
      <aside className="fixed right-0 top-0 bottom-0 w-full max-w-[380px] z-50 flex flex-col border-l border-glass-border bg-black/80 backdrop-blur-xl animate-slide-right">
        <div className="flex items-center justify-between px-4 h-[53px] border-b border-glass-border">
          <h2 className="text-xl font-bold">Notifications</h2>
          <div className="flex items-center gap-2">
            <button type="button" onClick={markAllRead} className="text-[13px] font-semibold text-text-primary hover:underline">
              Mark all read
            </button>
            <button type="button" onClick={onClose} className="p-2 rounded-full hover:bg-white/10" aria-label="Close">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {notifications.length === 0 ? (
            <p className="p-8 text-center text-text-muted text-[15px]">No notifications yet</p>
          ) : (
            notifications.map((n) => {
              const Icon = ICONS[n.type] || Bell;
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => handleClick(n)}
                  className={`w-full text-left px-4 py-4 border-b border-glass-border hover:bg-white/[0.04] transition-colors ${
                    !n.read ? 'bg-white/[0.06]' : ''
                  }`}
                >
                  <div className="flex gap-3">
                    <Icon className="h-5 w-5 text-text-muted shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-[15px]">{n.title}</p>
                      <p className="text-[15px] text-text-secondary mt-0.5 leading-snug">{n.message}</p>
                      <p className="text-[13px] text-text-muted mt-1">{formatRelativeTime(n.created_at)}</p>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>
    </>
  );
}
