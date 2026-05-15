import { Link } from 'react-router-dom';
import { Bell, ChevronRight, FileStack, CheckCircle2, Clock, Plus } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useNotificationContext } from '../../contexts/NotificationContext';
import { useUserComplaintStats } from '../../hooks/useUserComplaintStats';
import { roleLabel } from '../../lib/utils';

function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
}

function GlassStat({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-2.5 px-3 py-2 rounded-full glass min-w-0">
      <Icon className="h-4 w-4 text-text-muted shrink-0" strokeWidth={2} />
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-text-muted leading-none">{label}</p>
        <p className="text-base font-bold tabular-nums leading-tight mt-0.5">{value}</p>
      </div>
    </div>
  );
}

export default function Navbar({ title, breadcrumb = [], onOpenNotifications }) {
  const { user, profile, role } = useAuth();
  const { unreadCount } = useNotificationContext();
  const { filed, resolved, open, loading } = useUserComplaintStats(user?.id);
  const showCitizenMetrics = role === 'citizen';
  const showNotifications = role !== 'city';

  return (
    <header className="sticky top-0 z-30 border-b border-glass-border bg-black/60 backdrop-blur-xl">
      <div className="flex h-[53px] items-center gap-3 px-4 lg:px-5">
        <div className="min-w-0 flex-1">
          {breadcrumb.length > 0 && (
            <nav className="flex items-center gap-1 text-[13px] text-text-muted mb-0.5">
              {breadcrumb.map((crumb, i) => (
                <span key={crumb.label} className="flex items-center gap-1">
                  {i > 0 && <ChevronRight className="h-3 w-3" />}
                  {crumb.to ? (
                    <Link to={crumb.to} className="hover:underline">{crumb.label}</Link>
                  ) : (
                    <span>{crumb.label}</span>
                  )}
                </span>
              ))}
            </nav>
          )}
          <h1 className="truncate text-[20px] font-bold text-text-primary leading-tight">{title}</h1>
        </div>

        {showCitizenMetrics && (
          <div className="hidden xl:flex items-center gap-2">
            {loading ? (
              <div className="h-9 w-32 rounded-full skeleton" />
            ) : (
              <>
                <GlassStat icon={FileStack} label="Filed" value={filed} />
                <GlassStat icon={CheckCircle2} label="Resolved" value={resolved} />
                <GlassStat icon={Clock} label="Active" value={open} />
              </>
            )}
          </div>
        )}

        <div className="flex items-center gap-2 shrink-0">
          {showCitizenMetrics && (
            <Link to="/report" className="btn-primary hidden sm:inline-flex text-[14px] py-2 px-4">
              <Plus className="h-4 w-4" />
              Post
            </Link>
          )}
          {showNotifications && (
            <button
              type="button"
              onClick={onOpenNotifications}
              className="relative flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/[0.1] transition-colors"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute top-0 right-0 h-4 min-w-4 px-1 flex items-center justify-center rounded-full bg-white text-void text-[10px] font-bold">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          )}
          <div className="hidden md:block h-8 w-px bg-glass-border" />
          <div className="hidden md:flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.12] text-xs font-bold border border-glass-border">
            {getInitials(profile?.name)}
          </div>
        </div>
      </div>

      {showCitizenMetrics && !loading && (
        <div className="xl:hidden flex gap-2 overflow-x-auto px-4 pb-3 pt-1 border-t border-glass-border/50">
          <GlassStat icon={FileStack} label="Filed" value={filed} />
          <GlassStat icon={CheckCircle2} label="Resolved" value={resolved} />
          <GlassStat icon={Clock} label="Active" value={open} />
        </div>
      )}
    </header>
  );
}
