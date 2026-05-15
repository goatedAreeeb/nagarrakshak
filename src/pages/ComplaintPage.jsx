import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import AppShell from '../components/layout/AppShell';
import ComplaintForm from '../components/citizen/ComplaintForm';
import { useComplaintDraft } from '../contexts/ComplaintDraftContext.jsx';

export default function ComplaintPage() {
  const [searchParams] = useSearchParams();
  const safetyMode = searchParams.get('safety') === '1';
  const { setSafetySensitive, setReportWithoutPhoto } = useComplaintDraft();

  useEffect(() => {
    setSafetySensitive(safetyMode);
    if (safetyMode) setReportWithoutPhoto(true);
  }, [safetyMode, setSafetySensitive, setReportWithoutPhoto]);

  return (
    <AppShell
      title={safetyMode ? 'Report safety concern' : 'Report issue'}
      breadcrumb={[{ label: safetyMode ? 'Safety concern' : 'Report issue' }]}
    >
      <ComplaintForm />
    </AppShell>
  );
}
