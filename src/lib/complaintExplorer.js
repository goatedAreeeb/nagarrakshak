import { format, startOfMonth } from 'date-fns';
import { supabase } from './supabase';
import { getSLAStatus, isSlaCountdownActive } from './slaEngine';
import { normalizeDeptKey } from './utils';

const ACTIVE_STATUSES = ['open', 'assigned', 'in_progress', 'reopened'];
const RESOLVED_STATUSES = ['resolved', 'closed'];

export function isActiveStatus(status) {
  return ACTIVE_STATUSES.includes(status);
}

export function isResolvedStatus(status) {
  return RESOLVED_STATUSES.includes(status);
}

export function complaintMatchesFilter(complaint, filter = {}) {
  if (!complaint) return false;
  const {
    dept,
    statusGroup,
    severityMin,
    isChronic,
    breachedOnly,
  } = filter;

  if (dept && normalizeDeptKey(complaint.dept) !== normalizeDeptKey(dept)) {
    return false;
  }

  if (statusGroup === 'open' && !isActiveStatus(complaint.status)) return false;
  if (statusGroup === 'resolved' && !isResolvedStatus(complaint.status)) return false;
  if (statusGroup === 'breached') {
    if (isResolvedStatus(complaint.status)) return false;
    if (!isSlaCountdownActive(complaint)) return false;
    if (getSLAStatus(complaint.sla_deadline, complaint.sla_hours).status !== 'breached') {
      return false;
    }
  }

  if (severityMin != null && (complaint.severity ?? 0) < severityMin) return false;
  if (isChronic && !complaint.is_chronic) return false;
  if (breachedOnly && statusGroup !== 'breached') {
    if (!isSlaCountdownActive(complaint) || getSLAStatus(complaint.sla_deadline, complaint.sla_hours).status !== 'breached') {
      return false;
    }
  }

  return true;
}

export async function fetchWardIdsForZone(zone) {
  if (!zone) return [];
  const { data } = await supabase.from('wards').select('id').eq('zone', zone);
  return (data || []).map((w) => w.id);
}

/** Fetch complaints for explorer modal based on role scope + filters. */
export async function fetchScopedComplaints(scope, filter = {}) {
  const {
    dept,
    statusGroup,
    severityMin,
    isChronic,
    limit = 250,
  } = filter;

  let query = supabase
    .from('complaints')
    .select('*, wards(name)')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (scope.citizenId) query = query.eq('citizen_id', scope.citizenId);
  if (scope.assignedTo) query = query.eq('assigned_to', scope.assignedTo);

  let wardIds = scope.wardIds;
  if (scope.zone && !wardIds?.length) {
    wardIds = await fetchWardIdsForZone(scope.zone);
  }
  if (wardIds?.length) {
    query = query.in('ward_id', wardIds);
  }

  if (dept) {
    const key = normalizeDeptKey(dept);
    query = query.eq('dept', key);
  }

  if (statusGroup === 'open') query = query.in('status', ACTIVE_STATUSES);
  if (statusGroup === 'resolved') query = query.in('status', RESOLVED_STATUSES);
  if (severityMin != null) query = query.gte('severity', severityMin);
  if (isChronic) query = query.eq('is_chronic', true);

  const { data, error } = await query;

  if (error) {
    return { data: [], error };
  }

  let rows = data || [];

  if (dept) {
    rows = rows.filter((c) => complaintMatchesFilter(c, { dept }));
  }

  if (statusGroup === 'breached') {
    rows = rows.filter((c) => complaintMatchesFilter(c, { statusGroup: 'breached' }));
  }

  return { data: rows, error: null };
}

export async function fetchCityAnalytics() {
  const month = format(startOfMonth(new Date()), 'yyyy-MM-dd');

  const [compRes, perfRes, escRes, userRes] = await Promise.all([
    supabase
      .from('complaints')
      .select(
        'id, status, severity, dept, sla_deadline, sla_hours, created_at, description, ward_id, is_chronic, assigned_to'
      )
      .order('created_at', { ascending: false }),
    supabase
      .from('dept_performance')
      .select('*')
      .eq('month', month)
      .order('score', { ascending: false }),
    supabase.from('escalations').select('id').eq('resolved', false),
    supabase.from('users').select('id', { count: 'exact', head: true }).eq('role', 'citizen'),
  ]);

  const complaints = compRes.data || [];
  const errors = [compRes.error, perfRes.error, escRes.error, userRes.error].filter(Boolean);

  const open = complaints.filter((c) => isActiveStatus(c.status)).length;
  const resolved = complaints.filter((c) => isResolvedStatus(c.status)).length;
  const breached = complaints.filter((c) =>
    complaintMatchesFilter(c, { statusGroup: 'breached' })
  ).length;
  const avgSev = complaints.length
    ? complaints.reduce((s, c) => s + (c.severity || 0), 0) / complaints.length
    : 0;

  const deptCounts = {};
  complaints.forEach((c) => {
    const d = normalizeDeptKey(c.dept);
    deptCounts[d] = (deptCounts[d] || 0) + 1;
  });

  const pieData = Object.entries(deptCounts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  let deptMatrix = perfRes.data || [];
  if (deptMatrix.length === 0) {
    deptMatrix = Object.entries(deptCounts).map(([dept, total]) => {
      const deptRows = complaints.filter((c) => normalizeDeptKey(c.dept) === dept);
      const res = deptRows.filter((c) => isResolvedStatus(c.status)).length;
      const breaches = deptRows.filter((c) =>
        complaintMatchesFilter(c, { statusGroup: 'breached' })
      ).length;
      const score = total > 0 ? Math.round((res / total) * 100) : 0;
      return {
        id: dept,
        dept,
        total_complaints: total,
        resolved: res,
        breach_count: breaches,
        score,
      };
    });
  }

  return {
    complaints,
    deptMatrix,
    pieData,
    kpis: {
      open,
      breached,
      resolved,
      avgSev,
      escalations: escRes.data?.length || 0,
      citizens: userRes.count || 0,
      total: complaints.length,
    },
    error: errors[0]?.message || null,
  };
}
