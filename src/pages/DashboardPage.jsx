import { Navigate, useLocation } from 'react-router-dom';
import AppShell from '../components/layout/AppShell';
import { useAuth } from '../contexts/AuthContext';
import CitizenDashboard from '../components/citizen/CitizenDashboard';
import OfficerDashboard from '../components/officer/OfficerDashboard';
import SupervisorDashboard from '../components/supervisor/SupervisorDashboard';
import ZonalDashboard from '../components/zonal/ZonalDashboard';
import CityDashboard from '../components/city/CityDashboard';
import { ComplaintExplorerProvider } from '../contexts/ComplaintExplorerContext';

const TITLES = {
  citizen: 'My Dashboard',
  officer: 'Department Control',
  supervisor: 'Zone Overview',
  zonal: 'Zonal Analytics',
  city: 'City Command Center',
};

// New-domain roles (role_v2) have no old-role equivalent — mpstaff1@demo.com,
// for example, has role='citizen'/role_v2='mp_staff', so branching on the old
// `role` column alone lands every staff/MP/analyst/district-authority demo
// account on the old citizen complaint-filing dashboard. Proposals is the
// closest thing this app has to a staff "home" (Phase 9); redirect there
// instead of silently falling through to old-domain-only screens.
const STAFF_V2_ROLES = ['mp_staff', 'mp', 'analyst', 'district_authority_liaison', 'administrator'];

export default function DashboardPage() {
  const { profile, roleV2 } = useAuth();
  const location = useLocation();
  const role = profile?.role || 'citizen';

  if (STAFF_V2_ROLES.includes(roleV2)) {
    return <Navigate to="/staff/proposals" replace />;
  }

  const dashboards = {
    citizen: <CitizenDashboard />,
    officer: <OfficerDashboard />,
    supervisor: <SupervisorDashboard />,
    zonal: <ZonalDashboard />,
    city: <CityDashboard />,
  };

  return (
    <AppShell title={TITLES[role] || 'Dashboard'} breadcrumb={[{ label: TITLES[role] || 'Dashboard' }]}>
      <ComplaintExplorerProvider>
        {dashboards[role] || dashboards.citizen}
      </ComplaintExplorerProvider>
    </AppShell>
  );
}
