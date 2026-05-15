import AppShell from '../components/layout/AppShell';
import { useAuth } from '../contexts/AuthContext';
import CitizenLeaderboard from '../components/citizen/CitizenLeaderboard';

export default function LeadershipPage() {
  const { user } = useAuth();

  return (
    <AppShell
      title="Leadership"
      breadcrumb={[{ label: 'City leadership' }]}
    >
      <div className="max-w-2xl mx-auto space-y-5">
        <p className="text-[15px] text-text-secondary">
          Top citizens across Hyderabad by civic credits — recognising consistent reporting and civic
          participation city-wide.
        </p>
        <CitizenLeaderboard currentUserId={user?.id} />
      </div>
    </AppShell>
  );
}
