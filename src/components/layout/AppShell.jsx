import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Home, Map, Rss, FilePlus, Megaphone, Trophy } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import NotificationPanel from './NotificationPanel';
import CityBillboardStrip from '../billboard/CityBillboardStrip';

const ROLE_HIERARCHY = ['citizen', 'worker', 'officer', 'supervisor', 'zonal', 'city'];

function hasMinRole(role, minRole) {
  const roleIdx = ROLE_HIERARCHY.indexOf(role);
  const minIdx = ROLE_HIERARCHY.indexOf(minRole);
  if (roleIdx < 0 || minIdx < 0) return false;
  return roleIdx >= minIdx;
}

function mobileNavForRole(role) {
  const items = [
    { to: '/dashboard', icon: Home, label: 'Home' },
    { to: '/map', icon: Map, label: 'Map' },
    { to: '/feed', icon: Rss, label: 'Feed' },
    { to: '/billboard', icon: Megaphone, label: 'Bulletin' },
  ];
  if (role === 'citizen') {
    items.push({ to: '/leadership', icon: Trophy, label: 'Leadership' });
    items.push({ to: '/report', icon: FilePlus, label: 'Post' });
  }
  return items;
}

export default function AppShell({ children, title = 'Dashboard', breadcrumb = [] }) {
  const [panelOpen, setPanelOpen] = useState(false);
  const { role } = useAuth();
  const location = useLocation();

  const mobileItems = mobileNavForRole(role).filter(
    (item) => !item.minRole || hasMinRole(role, item.minRole)
  );

  return (
    <div className="min-h-screen bg-void bg-mesh-gradient">
      <Sidebar onOpenNotifications={() => setPanelOpen(true)} />

      <div className="md:ml-[275px] flex flex-col min-h-screen pb-[72px] md:pb-0">
        <Navbar
          title={title}
          breadcrumb={breadcrumb}
          onOpenNotifications={() => setPanelOpen(true)}
        />
        <main className="flex-1 px-4 md:px-6 py-5 animate-fade-in">
          <CityBillboardStrip />
          {children}
        </main>
      </div>

      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 flex h-[60px] items-stretch border-t border-glass-border bg-black/80 backdrop-blur-xl">
        {mobileItems.map((item) => {
          const isActive = location.pathname === item.to;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/dashboard'}
              className={`flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium ${
                isActive ? 'text-text-primary' : 'text-text-muted'
              }`}
            >
              <item.icon className={`h-6 w-6 ${isActive ? 'stroke-[2.5px]' : ''}`} />
              {item.label}
            </NavLink>
          );
        })}
      </nav>

      <NotificationPanel open={panelOpen} onClose={() => setPanelOpen(false)} />
    </div>
  );
}
