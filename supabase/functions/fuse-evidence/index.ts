// fuse-evidence — REPORT_2 Part V §14 / Part XI §32.
//
// Retrieves pre-ingested evidence_records for a geography (and optionally a
// category), and — if a proposal_id is given — links them via proposal_evidence.
// Deliberately NOT a live external-dataset fetcher: per the plan's own honesty
// rule (Part XI §32), UDISE+ bulk API access was never confirmed to exist
// publicly, so evidence is ingested ahead of time (scripts/seed-demo-users.mjs's
// seedDatasetSourcesAndEvidence) rather than pulled live per-request. Every
// evidence_records row carries its own dataset_source_id, retrieved_at, and
// freshness_label — this function never fabricates or estimates a missing figure.
//
// Auth: service-role only (internal pipeline step / staff-triggered lookup via
// a trusted server context — not called with a citizen's own JWT).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, handleCors } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

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
  const authHeader = req.headers.get('Authorization') ?? '';
  if (authHeader !== `Bearer ${SERVICE_ROLE_KEY}`) {
    return jsonResponse({ error: 'This function is service-role only' }, 403);
  }

  let payload: { geographic_unit_id?: string; category?: string; proposal_id?: string };
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }
  if (!payload.geographic_unit_id) {
    return jsonResponse({ error: 'geographic_unit_id is required' }, 400);
  }

  let query = supabase
    .from('evidence_records')
    .select('id, category, metric_name, metric_value, unit, retrieved_at, dataset_version, freshness_label, confidence, raw_payload, dataset_sources(name, source_url, is_live)')
    .eq('geographic_unit_id', payload.geographic_unit_id);

  if (payload.category) {
    query = query.eq('category', payload.category);
  }

  const { data: evidenceRecords, error } = await query;
  if (error) {
    return jsonResponse({ error: `Failed to load evidence: ${error.message}` }, 500);
  }

  if (payload.proposal_id && evidenceRecords?.length) {
    const links = evidenceRecords.map((ev) => ({ proposal_id: payload.proposal_id, evidence_id: ev.id }));
    const { error: linkError } = await supabase.from('proposal_evidence').upsert(links, { onConflict: 'proposal_id,evidence_id' });
    if (linkError) {
      return jsonResponse({ error: `Failed to link evidence to proposal: ${linkError.message}`, evidence_records: evidenceRecords }, 207);
    }
  }

  return jsonResponse({
    geographic_unit_id: payload.geographic_unit_id,
    category: payload.category ?? null,
    evidence_records: evidenceRecords ?? [],
  });
});
