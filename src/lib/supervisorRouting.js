import { supabase } from './supabase';
import { createNotification } from '../contexts/NotificationContext';

export async function getSupervisors() {
  const { data } = await supabase
    .from('users')
    .select('id, name, email, zone, role')
    .eq('role', 'supervisor');
  return data || [];
}

/** Notify all supervisors when an officer escalates (demo: zone filter optional). */
export async function notifySupervisorsOfEscalation({
  complaintId,
  dept,
  description,
  reason,
  zone,
}) {
  let query = supabase.from('users').select('id, name').eq('role', 'supervisor');
  if (zone) query = query.eq('zone', zone);
  const { data: supervisors } = await query;

  const title = 'New escalation from officer';
  const snippet = (description || 'Complaint').slice(0, 80);
  const msg = `${dept || 'Issue'}: ${snippet}. Reason: ${(reason || '—').slice(0, 100)}`;

  const targets = supervisors?.length ? supervisors : await getSupervisors();
  await Promise.all(
    (targets || []).map((s) =>
      createNotification(s.id, 'escalation', title, msg, complaintId)
    )
  );
}
