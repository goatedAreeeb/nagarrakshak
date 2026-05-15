import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export function useComplaints(filters = {}) {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchComplaints = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from('complaints')
        .select('*, wards(name)')
        .order('created_at', { ascending: false });

      if (filters.citizenId) query = query.eq('citizen_id', filters.citizenId);
      if (filters.dept) query = query.eq('dept', filters.dept);
      if (filters.wardId) query = query.eq('ward_id', filters.wardId);
      if (filters.zone) {
        const { data: wardRows } = await supabase.from('wards').select('id').eq('zone', filters.zone);
        const ids = wardRows?.map((w) => w.id) || [];
        if (ids.length) query = query.in('ward_id', ids);
        else {
          setComplaints([]);
          setLoading(false);
          return [];
        }
      }
      if (filters.status) query = query.eq('status', filters.status);
      if (filters.assignedTo) query = query.eq('assigned_to', filters.assignedTo);
      if (filters.severityMin) query = query.gte('severity', filters.severityMin);

      const { data, error: err } = await query;
      if (err) throw err;
      setComplaints(data || []);
      return data;
    } catch (err) {
      console.warn('useComplaints:', err?.message || err);
      setError(err);
      setComplaints([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, [
    filters.citizenId,
    filters.dept,
    filters.wardId,
    filters.zone,
    filters.status,
    filters.assignedTo,
    filters.severityMin,
  ]);

  useEffect(() => {
    fetchComplaints();
  }, [fetchComplaints]);

  return { complaints, loading, error, refetch: fetchComplaints, setComplaints };
}
