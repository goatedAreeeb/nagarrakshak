import AppShell from '../components/layout/AppShell';
import BillboardManager from '../components/billboard/BillboardManager';

export default function BillboardPublishPage() {
  return (
    <AppShell
      title="Post Bulletin"
      breadcrumb={[
        { label: 'Bulletin', to: '/billboard' },
        { label: 'Publish' },
      ]}
    >
      <div className="mx-auto max-w-3xl animate-fade-in">
        <BillboardManager />
      </div>
    </AppShell>
  );
}
