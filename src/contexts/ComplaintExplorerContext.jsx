import { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabase';
import { fetchWardIdsForZone } from '../lib/complaintExplorer';
import ComplaintIssuesModal from '../components/shared/ComplaintIssuesModal';
import StaffComplaintDetail from '../components/shared/StaffComplaintDetail';
import ComplaintDetail from '../components/citizen/ComplaintDetail';
import OfficerComplaintDetail from '../components/officer/OfficerComplaintDetail';

const ComplaintExplorerContext = createContext(null);

export function ComplaintExplorerProvider({ children }) {
  const { user, profile } = useAuth();
  const [listPanel, setListPanel] = useState(null);
  const [detailComplaint, setDetailComplaint] = useState(null);
  const [wardIdsByZone, setWardIdsByZone] = useState(null);
  const [workers, setWorkers] = useState([]);

  const role = profile?.role || 'citizen';

  useEffect(() => {
    if (role !== 'officer') return;
    supabase
      .from('users')
      .select('id, name, dept')
      .eq('role', 'worker')
      .order('name')
      .then(({ data }) => setWorkers(data || []));
  }, [role]);

  const scope = useMemo(() => {
    const base = {};
    if (role === 'citizen' && user?.id) base.citizenId = user.id;
    if (role === 'worker' && user?.id) base.assignedTo = user.id;
    if ((role === 'supervisor' || role === 'zonal') && profile?.zone) {
      base.zone = profile.zone;
      if (wardIdsByZone) base.wardIds = wardIdsByZone;
    }
    if (role === 'officer' || role === 'city') base.cityWide = true;
    return base;
  }, [role, user?.id, profile?.zone, wardIdsByZone]);

  const ensureZoneWards = useCallback(async () => {
    if (!profile?.zone || wardIdsByZone) return wardIdsByZone;
    const ids = await fetchWardIdsForZone(profile.zone);
    setWardIdsByZone(ids);
    return ids;
  }, [profile?.zone, wardIdsByZone]);

  const openIssues = useCallback(
    async ({ title, subtitle, filter = {} }) => {
      if (scope.zone && !scope.wardIds) {
        await ensureZoneWards();
      }
      setDetailComplaint(null);
      setListPanel({ title, subtitle, filter });
    },
    [scope.zone, scope.wardIds, ensureZoneWards]
  );

  const openByDept = useCallback(
    (dept, extra = {}) => {
      openIssues({
        title: `${dept} issues`,
        subtitle: 'All complaints in this department',
        filter: { dept, ...extra },
      });
    },
    [openIssues]
  );

  const openByStatusGroup = useCallback(
    (statusGroup, extra = {}) => {
      const labels = {
        open: 'Active complaints',
        resolved: 'Resolved complaints',
        breached: 'SLA breached',
        all: 'All complaints',
      };
      openIssues({
        title: labels[statusGroup] || 'Complaints',
        subtitle: 'Tap a row for full details',
        filter: { statusGroup, ...extra },
      });
    },
    [openIssues]
  );

  const openDetail = useCallback((complaint) => {
    setListPanel(null);
    setDetailComplaint(complaint);
  }, []);

  const closeAll = useCallback(() => {
    setListPanel(null);
    setDetailComplaint(null);
  }, []);

  const value = useMemo(
    () => ({
      openIssues,
      openByDept,
      openByStatusGroup,
      openDetail,
      closeAll,
      scope,
      role,
    }),
    [openIssues, openByDept, openByStatusGroup, openDetail, closeAll, scope, role]
  );

  return (
    <ComplaintExplorerContext.Provider value={value}>
      {children}

      {listPanel && (
        <ComplaintIssuesModal
          open
          onClose={() => setListPanel(null)}
          title={listPanel.title}
          subtitle={listPanel.subtitle}
          filter={listPanel.filter}
          scope={scope}
          onSelect={openDetail}
        />
      )}

      {detailComplaint && role === 'citizen' && (
        <ComplaintDetail
          complaint={detailComplaint}
          onClose={closeAll}
          onUpdated={(updated) => setDetailComplaint(updated)}
        />
      )}

      {detailComplaint && role === 'officer' && (
        <OfficerComplaintDetail
          complaint={detailComplaint}
          workers={workers}
          onClose={closeAll}
          onUpdate={(updated) => setDetailComplaint((p) => ({ ...p, ...updated }))}
        />
      )}

      {detailComplaint && !['citizen', 'officer'].includes(role) && (
        <StaffComplaintDetail complaint={detailComplaint} onClose={closeAll} />
      )}
    </ComplaintExplorerContext.Provider>
  );
}

export function useComplaintExplorer() {
  const ctx = useContext(ComplaintExplorerContext);
  if (!ctx) {
    throw new Error('useComplaintExplorer must be used within ComplaintExplorerProvider');
  }
  return ctx;
}

/** Safe when provider may be absent (feed/map). */
export function useComplaintExplorerOptional() {
  return useContext(ComplaintExplorerContext);
}
