// compute-priority — REPORT_2 Part IX §24-25 / Part XVI Phase 8.
//
// Deterministic weighted-MCDA scoring. Contains NO LLM call — this is the one
// function in the whole pipeline explicitly forbidden from calling a model
// (research bible Part XVII: "LLM as ranking engine" is rejected as unauditable
// for public-money allocation). Every weight is a named constant below, visible
// to anyone who reads this file or the WeightSettingsPage that displays them.
//
// Gap-filling note: neither REPORT_1 nor REPORT_2's API catalogue actually
// specifies how a development_proposal gets created from a theme_cluster in the
// first place — Phase 9's ProposalsPage assumes proposals already exist, but no
// function creates them. This function fills that gap minimally: pass either
// {proposal_id} to score an existing proposal, or {cluster_id, title, category}
// to bootstrap a new development_proposal from a cluster and score it in one call.
//
// Design choices that matter (see research bible Part IV §12-13's own critique):
//   - Equity is applied as a MULTIPLIER on population_impact (a correction factor
//     on demand), not as a separate additively-weighted term — treating it as
//     independent risks double-counting, exactly what that critique warns against.
//   - Confidence is a display/gating field on every component, never silently
//     folded into the weighted sum. A missing input is flagged, never imputed to 0.
//   - Score is fully deterministic: same inputs -> same output, always (tested
//     via a determinism check in scripts/verify-priority-engine.mjs).
//
// Auth: service-role only.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, handleCors } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const MODEL_VERSION = 'compute-priority-v1-weighted-sum';

// Visible, named weights — the entire point of NPS-HACK-001 ("visible/adjustable
// ranking weights"). Sum to 1.0 across the four independently-weighted terms;
// equity is a multiplier on population_impact, not a fifth additive term.
const WEIGHTS = {
  population_impact: 0.35,
  severity_need: 0.30,
  feasibility: 0.15,
  cost: 0.10,
  urgency: 0.10,
};

// Rule-based cost-band lookup — legitimate internal reference data (REPORT_2 Part
// IX §25: "Cost | Estimated cost band ... Internal reference table"), not a
// fabricated external figure. Bands are illustrative INR ranges for a single
// intervention, deliberately coarse (never presented as an exact cost).
const COST_BAND_BY_CATEGORY: Record<string, { band: string; score: number }> = {
  school_infrastructure: { band: '10L_50L', score: 0.6 },
  vocational_training: { band: '50L_1Cr', score: 0.4 },
  road_repair: { band: 'under_10L', score: 0.85 },
  water_supply: { band: '10L_50L', score: 0.6 },
  drainage: { band: '50L_1Cr', score: 0.4 },
  health_facility: { band: 'over_1Cr', score: 0.2 },
  electricity: { band: 'under_10L', score: 0.85 },
};
const DEFAULT_COST_BAND = { band: 'unknown', score: null as number | null };

// Illustrative rule-based routing (research bible Part II §3 / NPS-GOV-001: an MP
// can recommend MPLADS-eligible works, refer other-scheme-appropriate needs
// elsewhere, or only advocate where no current scheme applies). This is NOT
// verified against the actual MPLADS admissibility annexures item-by-item — the
// research bible itself flags exact admissible-category rules as `[U]` unverified
// in its own research pass. Treat this as a starting heuristic that a real
// deployment must validate against the current MPLADS Guidelines, not as a
// legally authoritative admissibility determination.
const ROUTING_BY_CATEGORY: Record<string, { routing: string; rationale: string }> = {
  school_infrastructure: { routing: 'mplads_eligible', rationale: 'School building/infrastructure works are a plausible MPLADS-admissible category (illustrative rule, not verified against the current Guidelines annexures).' },
  road_repair: { routing: 'mplads_eligible', rationale: 'Road/infrastructure repair is a plausible MPLADS-admissible category (illustrative rule, not verified against the current Guidelines annexures).' },
  water_supply: { routing: 'mplads_eligible', rationale: 'Water supply infrastructure is a plausible MPLADS-admissible category (illustrative rule, not verified against the current Guidelines annexures).' },
  drainage: { routing: 'mplads_eligible', rationale: 'Drainage infrastructure is a plausible MPLADS-admissible category (illustrative rule, not verified against the current Guidelines annexures).' },
  electricity: { routing: 'mplads_eligible', rationale: 'Electrical infrastructure is a plausible MPLADS-admissible category (illustrative rule, not verified against the current Guidelines annexures).' },
  health_facility: { routing: 'refer_elsewhere', rationale: 'Health facility capital works often route through state health schemes rather than MPLADS — needs case-by-case admissibility check, not assumed eligible.' },
  vocational_training: { routing: 'refer_elsewhere', rationale: 'Skill/vocational training infrastructure typically sits under Skill India / state skill-development schemes rather than MPLADS — advocacy or referral is the safer default.' },
};
const DEFAULT_ROUTING = { routing: 'advocacy_only', rationale: 'No scheme-eligibility rule matched this category — routed as advocacy-only pending manual review, not assumed fundable.' };

// Urgency rule table — category-specific baseline, corroborated/boosted by the
// submission's own extracted sentiment (never overridden by an LLM-produced number).
const URGENCY_BASE_BY_CATEGORY: Record<string, number> = {
  health_facility: 0.8,
  drainage: 0.7,
  water_supply: 0.6,
  electricity: 0.6,
  school_infrastructure: 0.5,
  road_repair: 0.4,
  vocational_training: 0.3,
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function ensureProposal(payload: any) {
  if (payload.proposal_id) {
    const { data, error } = await supabase
      .from('development_proposals')
      .select('id, geographic_unit_id, category, source_cluster_id')
      .eq('id', payload.proposal_id)
      .single();
    if (error || !data) throw new Error(`Proposal not found: ${error?.message ?? payload.proposal_id}`);
    return data;
  }

  if (!payload.cluster_id) {
    throw new Error('Provide either proposal_id or cluster_id (+title, +category) to bootstrap a proposal');
  }

  const { data: cluster, error: clusterError } = await supabase
    .from('theme_clusters')
    .select('id, geographic_unit_id, taxonomy_key, label')
    .eq('id', payload.cluster_id)
    .single();
  if (clusterError || !cluster) throw new Error(`Cluster not found: ${clusterError?.message ?? payload.cluster_id}`);

  const { data: created, error: createError } = await supabase
    .from('development_proposals')
    .insert({
      geographic_unit_id: cluster.geographic_unit_id,
      source_cluster_id: cluster.id,
      title: payload.title ?? cluster.label ?? 'Untitled proposal',
      category: payload.category ?? cluster.taxonomy_key ?? null,
      status: 'candidate',
    })
    .select('id, geographic_unit_id, category, source_cluster_id')
    .single();
  if (createError || !created) throw new Error(`Failed to create proposal: ${createError?.message}`);
  return created;
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

  let payload: { proposal_id?: string; cluster_id?: string; title?: string; category?: string };
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  let proposal;
  try {
    proposal = await ensureProposal(payload);
  } catch (err) {
    return jsonResponse({ error: (err as Error).message }, 400);
  }

  const category = proposal.category as string | null;

  // --- Population Impact ---------------------------------------------------
  const { data: districtPopEvidence } = await supabase
    .from('evidence_records')
    .select('metric_value')
    .eq('geographic_unit_id', proposal.geographic_unit_id)
    .eq('metric_name', 'district_population')
    .maybeSingle();

  let affectedPopulation: number | null = null;
  let affectedPopulationSource = 'none';
  if (category) {
    const { data: categoryEvidence } = await supabase
      .from('evidence_records')
      .select('metric_value, metric_name')
      .eq('geographic_unit_id', proposal.geographic_unit_id)
      .eq('category', category)
      .maybeSingle();
    if (categoryEvidence) {
      affectedPopulation = categoryEvidence.metric_value;
      affectedPopulationSource = `evidence:${categoryEvidence.metric_name}`;
    }
  }
  if (affectedPopulation == null && proposal.source_cluster_id) {
    const { data: clusterRow } = await supabase
      .from('theme_clusters')
      .select('unique_reporter_count')
      .eq('id', proposal.source_cluster_id)
      .maybeSingle();
    if (clusterRow) {
      affectedPopulation = clusterRow.unique_reporter_count;
      affectedPopulationSource = 'cluster:unique_reporter_count (floor estimate, not a true affected-population figure)';
    }
  }

  const districtPopulation = districtPopEvidence?.metric_value ?? null;
  const populationImpactMissing = affectedPopulation == null || districtPopulation == null;
  const populationImpactRaw = populationImpactMissing ? null : Math.min(1, affectedPopulation! / districtPopulation!);

  // --- Equity Correction (multiplier on population_impact, not a separate term) ---
  // No cross-unit submission history exists yet (single demo geography) -> neutral
  // default per REPORT_2 Part IX §25's own specified missing-data behavior.
  const equityMultiplier = 1.0;
  const equityMissing = true;

  // --- Severity / Need -------------------------------------------------------
  const SENTIMENT_SCORE: Record<string, number> = { urgent: 1.0, concerned: 0.6, neutral: 0.3, positive: 0.1 };
  let severityValue: number | null = null;
  let severitySource = 'none';
  if (proposal.source_cluster_id) {
    const { data: members } = await supabase
      .from('submission_cluster_membership')
      .select('citizen_submissions(sentiment)')
      .eq('cluster_id', proposal.source_cluster_id);
    const sentiments = (members ?? []).map((m: any) => m.citizen_submissions?.sentiment).filter(Boolean);
    if (sentiments.length > 0) {
      severityValue = sentiments.reduce((sum: number, s: string) => sum + (SENTIMENT_SCORE[s] ?? 0.3), 0) / sentiments.length;
      severitySource = 'mean(citizen_submissions.sentiment) — a proxy, not a validated infrastructure-gap severity index';
    }
  }
  const severityMissing = severityValue == null;

  // --- Feasibility -------------------------------------------------------
  // No land-availability / scheme-eligibility dataset connected yet — flagged for
  // human verification per REPORT_2 Part IX §25 ("Flags 'needs verification' rather
  // than assuming infeasible"), never defaulted to a guessed pass/fail.
  const feasibilityValue: number | null = null;
  const feasibilityMissing = true;

  // --- Cost -------------------------------------------------------
  const costEntry = (category && COST_BAND_BY_CATEGORY[category]) || DEFAULT_COST_BAND;
  const costMissing = costEntry.score == null;

  // --- Urgency -------------------------------------------------------
  const urgencyBase = (category && URGENCY_BASE_BY_CATEGORY[category]) ?? null;
  const urgencyMissing = urgencyBase == null;

  const components = [
    {
      name: 'population_impact',
      value: populationImpactRaw,
      weight: WEIGHTS.population_impact,
      source: affectedPopulationSource,
      confidence: populationImpactMissing ? 'low' : 'medium',
      missing_data: populationImpactMissing,
    },
    {
      name: 'equity_correction',
      value: equityMultiplier,
      weight: 0, // applied as a multiplier below, not an additive weighted term — recorded for transparency only
      source: 'neutral default — no cross-geography submission history available yet',
      confidence: 'low',
      missing_data: equityMissing,
    },
    {
      name: 'severity_need',
      value: severityValue,
      weight: WEIGHTS.severity_need,
      source: severitySource,
      confidence: severityMissing ? 'low' : 'medium',
      missing_data: severityMissing,
    },
    {
      name: 'feasibility',
      value: feasibilityValue,
      weight: WEIGHTS.feasibility,
      source: 'no land-availability/scheme-eligibility dataset connected — needs manual verification',
      confidence: 'low',
      missing_data: feasibilityMissing,
    },
    {
      name: 'cost',
      value: costEntry.score,
      weight: WEIGHTS.cost,
      source: `internal rule-based cost-band lookup (band: ${costEntry.band})`,
      confidence: costMissing ? 'low' : 'medium',
      missing_data: costMissing,
    },
    {
      name: 'urgency',
      value: urgencyBase,
      weight: WEIGHTS.urgency,
      source: 'category-specific rule table',
      confidence: urgencyMissing ? 'low' : 'medium',
      missing_data: urgencyMissing,
    },
  ];

  // Deterministic weighted sum. A missing component contributes 0 to the sum but
  // its weight is also excluded from the normalizing denominator — this avoids
  // silently punishing a proposal for a component we simply don't have data for
  // yet (research bible §12-13: never let missing evidence read as "low priority").
  let weightedSum = 0;
  let weightTotal = 0;
  for (const c of components) {
    if (c.missing_data || c.value == null || c.weight === 0) continue;
    weightedSum += c.value * c.weight;
    weightTotal += c.weight;
  }
  const populationTerm = populationImpactMissing ? null : populationImpactRaw! * equityMultiplier;
  if (!populationImpactMissing) {
    // Replace the raw population_impact contribution with the equity-multiplied version.
    weightedSum = weightedSum - populationImpactRaw! * WEIGHTS.population_impact + populationTerm! * WEIGHTS.population_impact;
  }
  const totalScore = weightTotal > 0 ? weightedSum / weightTotal : 0;

  const overallConfidence = components.filter((c) => !c.missing_data).length >= 3 ? 'medium' : 'low';

  const { data: priorityScore, error: scoreError } = await supabase
    .from('priority_scores')
    .upsert(
      { proposal_id: proposal.id, total_score: totalScore, confidence: overallConfidence, model_version: MODEL_VERSION },
      { onConflict: 'proposal_id' }
    )
    .select('id')
    .single();
  if (scoreError || !priorityScore) {
    return jsonResponse({ error: `Failed to write priority_scores: ${scoreError?.message}` }, 500);
  }

  await supabase.from('score_components').delete().eq('priority_score_id', priorityScore.id);
  const { error: componentsError } = await supabase.from('score_components').insert(
    components.map((c) => ({ ...c, priority_score_id: priorityScore.id }))
  );
  if (componentsError) {
    return jsonResponse({ error: `Failed to write score_components: ${componentsError.message}` }, 500);
  }

  // Rank among all scored proposals in the same geography — recomputed fresh each
  // time rather than stored incrementally, so it never drifts out of sync. Counts
  // proposals scored strictly higher (rather than trying to findIndex this proposal
  // among its own siblings) so a floating-point round-trip mismatch between the
  // in-memory totalScore and the value just read back from Postgres can't produce
  // a wrong rank — tested live and caught exactly this bug during Phase 9 verification.
  const { data: siblingScores } = await supabase
    .from('priority_scores')
    .select('total_score, development_proposals!inner(geographic_unit_id)')
    .eq('development_proposals.geographic_unit_id', proposal.geographic_unit_id)
    .neq('proposal_id', proposal.id);
  const RANK_EPSILON = 1e-9;
  const rank = (siblingScores ?? []).filter((s) => s.total_score > totalScore + RANK_EPSILON).length + 1;

  const routing = (category && ROUTING_BY_CATEGORY[category]) || DEFAULT_ROUTING;
  const { error: recommendationError } = await supabase.from('recommendations').insert({
    proposal_id: proposal.id,
    routing: routing.routing,
    rank,
    rationale: routing.rationale,
  });
  if (recommendationError) {
    console.error('Failed to write recommendation:', recommendationError.message);
  }

  // Fire-and-forget hand-off to generate-explanation — same non-blocking pattern as
  // ingest-submission's chain to extract-features. Staff read the persisted result
  // via priority_scores.explanation_text (migration 0012), not by calling this
  // service-role-only chain themselves.
  const explanationTask = fetch(`${SUPABASE_URL}/functions/v1/generate-explanation`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ proposal_id: proposal.id }),
  }).catch((err) => console.error('generate-explanation hand-off failed for', proposal.id, err));
  // @ts-ignore — EdgeRuntime is a Supabase Edge Runtime global, not a standard Deno type.
  if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime?.waitUntil) {
    // @ts-ignore
    EdgeRuntime.waitUntil(explanationTask);
  }

  return jsonResponse({
    proposal_id: proposal.id,
    priority_score_id: priorityScore.id,
    total_score: totalScore,
    confidence: overallConfidence,
    model_version: MODEL_VERSION,
    components,
    weights: WEIGHTS,
    routing: routing.routing,
    rank,
  });
});
