// log-override — REPORT_2 Part IX §26 / Part XVI Phase 9.
//
// The one client-callable governance-write function. Called with the STAFF
// member's own JWT (not service-role) so we can identify who they are, but the
// actual writes use a service-role client because audit_events has no client
// INSERT policy at all (migration 0009) — every audit row must be written here,
// atomically with the override it records, never by a client directly.
//
// Two independent enforcement layers, not just one (REPORT_2 Part XVI Phase 9:
// "Role check enforced server-side in the Edge Function, not just hidden in the
// UI"): (1) this function explicitly checks the caller's role_v2 before writing
// anything, and (2) migration 0009's RLS policy on human_overrides would also
// reject a citizen/analyst INSERT if this check were ever bypassed.
//
// Auth: any authenticated user may call this — the function itself rejects
// non-mp_staff/mp callers, matching the CP-9 acceptance criterion exactly
// ("a citizen or analyst role cannot invoke log-override").

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, handleCors } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const ALLOWED_ROLES = ['mp_staff', 'mp'];

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  const corsPreflight = handleCors(req);
  if (corsPreflight) return corsPreflight;

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return jsonResponse({ error: 'Missing Authorization header' }, 401);
  }

  const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await callerClient.auth.getUser();
  if (userError || !userData?.user) {
    return jsonResponse({ error: 'Invalid or expired session' }, 401);
  }
  const callerId = userData.user.id;

  const { data: profile, error: profileError } = await callerClient
    .from('users')
    .select('role_v2, name')
    .eq('id', callerId)
    .single();
  if (profileError || !profile) {
    return jsonResponse({ error: 'Could not verify caller role' }, 403);
  }
  if (!ALLOWED_ROLES.includes(profile.role_v2)) {
    return jsonResponse({ error: `Role '${profile.role_v2}' is not permitted to override a recommendation` }, 403);
  }

  let payload: { recommendation_id?: string; new_rank?: number; override_reason?: string; justification?: string };
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }
  if (!payload.recommendation_id) {
    return jsonResponse({ error: 'recommendation_id is required' }, 400);
  }
  if (!payload.override_reason?.trim()) {
    return jsonResponse({ error: 'override_reason is required' }, 400);
  }

  // Service-role client for the actual atomic write — human_overrides + audit_events.
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: recommendation, error: recError } = await admin
    .from('recommendations')
    .select('id, rank')
    .eq('id', payload.recommendation_id)
    .single();
  if (recError || !recommendation) {
    return jsonResponse({ error: `Recommendation not found: ${recError?.message ?? payload.recommendation_id}` }, 404);
  }

  const { data: override, error: overrideError } = await admin
    .from('human_overrides')
    .insert({
      recommendation_id: payload.recommendation_id,
      user_id: callerId,
      previous_rank: recommendation.rank,
      new_rank: payload.new_rank ?? null,
      override_reason: payload.override_reason,
      justification: payload.justification ?? null,
    })
    .select('id')
    .single();
  if (overrideError || !override) {
    return jsonResponse({ error: `Failed to write override: ${overrideError?.message}` }, 500);
  }

  const { error: auditError } = await admin.from('audit_events').insert({
    event_type: 'override',
    actor_id: callerId,
    recommendation_id: payload.recommendation_id,
    override_id: override.id,
    detail: {
      actor_name: profile.name,
      previous_rank: recommendation.rank,
      new_rank: payload.new_rank ?? null,
      override_reason: payload.override_reason,
      justification: payload.justification ?? null,
    },
    model_version: null,
  });
  if (auditError) {
    // The override row already exists without a matching audit event — this is exactly
    // the non-atomic failure mode REPORT_2 Phase 9's stop-condition warns about. Surface
    // it loudly rather than returning 200 as if everything succeeded.
    return jsonResponse(
      { error: `Override was written but audit logging failed — inconsistent state, needs manual review: ${auditError.message}`, override_id: override.id },
      500
    );
  }

  if (payload.new_rank != null) {
    await admin.from('recommendations').update({ rank: payload.new_rank }).eq('id', payload.recommendation_id);
  }

  return jsonResponse({ override_id: override.id, recommendation_id: payload.recommendation_id });
});
