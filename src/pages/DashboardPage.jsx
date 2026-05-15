import { useLocation } from 'react-router-dom';
import AppShell from '../components/layout/AppShell';
import { useAuth } from '../contexts/AuthContext';
import CitizenDashboard from '../components/citizen/CitizenDashboard';
import WorkerDashboard from '../components/worker/WorkerDashboard';
import OfficerDashboard from '../components/officer/OfficerDashboard';
import SupervisorDashboard from '../components/supervisor/SupervisorDashboard';
import ZonalDashboard from '../components/zonal/ZonalDashboard';
import CityDashboard from '../components/city/CityDashboard';
import { ComplaintExplorerProvider } from '../contexts/ComplaintExplorerContext';

const TITLES = {
  citizen: 'My Dashboard',
  worker: 'Field Tasks',
  officer: 'Department Control',
  supervisor: 'Zone Overview',
  zonal: 'Zonal Analytics',
  city: 'City Command Center',
};

export default function DashboardPage() {
  const { profile } = useAuth();
  const location = useLocation();
  const role = profile?.role || 'citizen';

  const dashboards = {
    citizen: <CitizenDashboard />,
    worker: <WorkerDashboard />,
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
