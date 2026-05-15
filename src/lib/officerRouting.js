import { supabase } from './supabase';

/** Demo: single officer handles routing for every department until per-dept officers exist. */
export const DEMO_ROUTING_OFFICER_EMAIL = 'officer1@demo.com';

export async function getRoutingOfficer() {
  const { data: primary } = await supabase
    .from('users')
    .select('id, name, email, dept, role')
    .eq('role', 'officer')
    .eq('email', DEMO_ROUTING_OFFICER_EMAIL)
    .maybeSingle();

  if (primary) return primary;

  const { data: fallback } = await supabase
    .from('users')
    .select('id, name, email, dept, role')
    .eq('role', 'officer')
    .limit(1)
    .maybeSingle();

  return fallback;
}

/** Legacy name — routes to central demo officer, not per-dept officer. */
export async function findOfficerForDept() {
  return getRoutingOfficer();
}
