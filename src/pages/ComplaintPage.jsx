import AppShell from '../components/layout/AppShell';
import ComplaintForm from '../components/citizen/ComplaintForm';

export default function ComplaintPage() {
  return (
    <AppShell title="Report Issue" breadcrumb={[{ label: 'Report Issue' }]}>
      <ComplaintForm />
    </AppShell>
  );
}
