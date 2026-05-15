import { NavLink } from 'react-router-dom';
import {
  Shield,
  LayoutDashboard,
  Map,
  Rss,
  FilePlus,
  BarChart3,
  Bell,
  LogOut,
  Megaphone,
  PenSquare,
  Trophy,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useNotificationContext } from '../../contexts/NotificationContext';
import { useUserComplaintStats } from '../../hooks/useUserComplaintStats';
import { roleLabel } from '../../lib/utils';

const ROLE_HIERARCHY = ['citizen', 'worker', 'officer', 'supervisor', 'zonal', 'city'];

function hasMinRole(role, minRole) {
  const roleIdx = ROLE_HIERARCHY.indexOf(role);
  const minIdx = ROLE_HIERARCHY.indexOf(minRole);
  if (roleIdx < 0 || minIdx < 0) return false;
  return roleIdx >= minIdx;
}

function getInitials(name) {
  if (!name) return '?';
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function NavItem({ to, icon: Icon, label, end }) {
  return (
    <NavLink to={to} end={end} className={({ isActive }) => `nav-item ${isActive ? 'nav-item-active' : ''}`}>
      {({ isActive }) => (
        <>
          <Icon className="h-[22px] w-[22px] shrink-0" strokeWidth={isActive ? 2.5 : 2} />
          <span>{label}</span>
        </>
      )}
    </NavLink>
  );
}

export default function Sidebar({ onOpenNotifications }) {
  const { user, profile, role, signOut } = useAuth();
  const { unreadCount } = useNotificationContext();
  const { filed, resolved, resolutionRate, loading } = useUserComplaintStats(user?.id);
  const showOfficerBadge = hasMinRole(role, 'officer') && role !== 'city';
  const isCitizen = role === 'citizen';
  const isCityHead = role === 'city';

  return (
    <aside className="hidden md:flex fixed left-0 top-0 bottom-0 w-[275px] flex-col z-40 border-r border-glass-border bg-black/40 backdrop-blur-xl">
      <div className="px-4 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white">
            <Shield className="h-5 w-5 text-void" strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-text-primary tracking-tight">NagarRakshak</h1>
            <p className="text-[13px] text-text-muted">Hyderabad</p>
          </div>
        </div>
      </div>

      {isCitizen && !loading && (
        <div className="mx-3 mb-2 p-4 rounded-2xl glass">
          <p className="text-[11px] font-bold uppercase tracking-wider text-text-muted mb-3">Your stats</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-2xl font-bold tabular-nums">{filed}</p>
              <p className="text-[13px] text-text-muted">Filed</p>
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{resolved}</p>
              <p className="text-[13px] text-text-muted">Resolved</p>
            </div>
          </div>
          <div className="mt-3 h-1 rounded-full bg-white/[0.1] overflow-hidden">
            <div className="h-full rounded-full bg-white transition-all" style={{ width: `${resolutionRate}%` }} />
          </div>
        </div>
      )}

      <nav className="flex-1 px-2 py-2 space-y-0.5 overflow-y-auto">
        <NavItem to="/dashboard" icon={LayoutDashboard} label="Home" end />
        <NavItem to="/map" icon={Map} label="Map" />
        <NavItem to="/feed" icon={Rss} label="Feed" />
        <NavItem to="/billboard" icon={Megaphone} label="Bulletin" />
        {role === 'city' && (
          <NavItem to="/billboard/publish" icon={PenSquare} label="Post Bulletin" />
        )}
        {isCitizen && <NavItem to="/leadership" icon={Trophy} label="Leadership" />}
        {isCitizen && <NavItem to="/report" icon={FilePlus} label="Post" />}
        {isCityHead && <NavItem to="/city/analytics" icon={BarChart3} label="Analytics" />}
        {showOfficerBadge && (
          <button type="button" onClick={onOpenNotifications} className="nav-item w-full mt-4">
            <Bell className="h-[22px] w-[22px]" strokeWidth={2} />
            <span className="flex-1 text-left">Notifications</span>
            {unreadCount > 0 && (
              <span className="min-w-[20px] h-5 px-1.5 flex items-center justify-center rounded-full bg-white text-void text-xs font-bold">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
        )}
      </nav>

      <div className="p-3 border-t border-glass-border">
        <div className="flex items-center gap-3 p-3 rounded-full hover:bg-white/[0.06] transition-colors">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.12] text-sm font-bold text-text-primary border border-glass-border">
            {getInitials(profile?.name)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-bold truncate">{profile?.name}</p>
            <p className="text-[13px] text-text-muted">{roleLabel(role)}</p>
          </div>
        </div>
        <button type="button" onClick={signOut} className="nav-item w-full mt-1 text-text-muted hover:text-text-primary">
          <LogOut className="h-[20px] w-[20px]" strokeWidth={2} />
          <span>Log out</span>
        </button>
      </div>
    </aside>
  );
}
