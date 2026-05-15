import AppShell from '../components/layout/AppShell';
import { ComplaintExplorerProvider } from '../contexts/ComplaintExplorerContext';
import CityAnalyticsView from '../components/city/CityAnalyticsView';

export default function CityAnalyticsPage() {
  return (
    <AppShell
      title="City Analytics"
      breadcrumb={[
        { label: 'Command Center', to: '/dashboard' },
        { label: 'Analytics' },
      ]}
    >
      <ComplaintExplorerProvider>
        <CityAnalyticsView />
      </ComplaintExplorerProvider>
    </AppShell>
  );
}
