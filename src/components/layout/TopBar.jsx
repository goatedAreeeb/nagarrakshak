import { ChevronRight, Bell } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useNotificationContext } from '../../contexts/NotificationContext';

export default function TopBar({ title, breadcrumb = [], onOpenNotifications }) {
  const { unreadCount } = useNotificationContext();

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-4 px-4 md:px-6 py-4 bg-bg-base/80 backdrop-blur-md border-b border-border-default">
      <div className="min-w-0">
        {breadcrumb.length > 0 && (
          <nav className="flex items-center gap-1 text-xs text-text-secondary mb-1 flex-wrap">
            {breadcrumb.map((crumb, i) => (
              <span key={crumb.label} className="flex items-center gap-1">
                {i > 0 && <ChevronRight className="w-3 h-3 shrink-0 text-text-hint" />}
                {crumb.to ? (
                  <Link to={crumb.to} className="hover:text-text-primary transition-colors">
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="text-text-hint">{crumb.label}</span>
                )}
              </span>
            ))}
          </nav>
        )}
        <h1 className="text-lg md:text-xl font-semibold text-text-primary truncate">{title}</h1>
      </div>

      <button
        type="button"
        onClick={onOpenNotifications}
        className="relative p-2 rounded-lg border border-border-default hover:border-border-strong hover:bg-bg-elevated transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5 text-text-secondary" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-accent-red text-white text-[10px] font-bold animate-badge-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>
    </header>
  );
}
