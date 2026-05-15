import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { queryWithTimeout } from '../lib/queryWithTimeout';

const RESOLVED_STATUSES = ['resolved', 'closed'];
const OPEN_STATUSES = ['open', 'assigned', 'in_progress', 'reopened'];

export function useUserComplaintStats(userId) {
  const [stats, setStats] = useState({
    filed: 0,
    resolved: 0,
    open: 0,
    inProgress: 0,
    resolutionRate: 0,
    loading: false,
  });

  const fetchStats = useCallback(async () => {
    if (!userId) {
      setStats({
        filed: 0,
        resolved: 0,
        open: 0,
        inProgress: 0,
        resolutionRate: 0,
        loading: false,
      });
      return;
    }

    setStats((s) => ({ ...s, loading: true }));

    try {
      const { data, error } = await queryWithTimeout(
        supabase.from('complaints').select('status').eq('citizen_id', userId),
        10000,
        'Load stats'
      );

      if (error) throw error;

      const rows = data || [];
      const filed = rows.length;
      const resolved = rows.filter((c) => RESOLVED_STATUSES.includes(c.status)).length;
      const open = rows.filter((c) => OPEN_STATUSES.includes(c.status)).length;
      const inProgress = rows.filter((c) => c.status === 'in_progress').length;
      const resolutionRate = filed > 0 ? Math.round((resolved / filed) * 100) : 0;

      setStats({ filed, resolved, open, inProgress, resolutionRate, loading: false });
    } catch (err) {
      console.warn('Complaint stats:', err?.message || err);
      setStats({
        filed: 0,
        resolved: 0,
        open: 0,
        inProgress: 0,
        resolutionRate: 0,
        loading: false,
      });
    }
  }, [userId]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { ...stats, refetch: fetchStats };
}
