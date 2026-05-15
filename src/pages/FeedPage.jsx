import AppShell from '../components/layout/AppShell';
import NagarFeed from '../components/feed/NagarFeed';

export default function FeedPage() {
  return (
    <AppShell title="Civic Pulse" breadcrumb={[{ label: 'Civic Feed' }]}>
      <NagarFeed />
    </AppShell>
  );
}
