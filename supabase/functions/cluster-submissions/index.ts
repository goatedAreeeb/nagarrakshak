// cluster-submissions — REPORT_2 Part V §14 / Part XVI Phase 5.
//
// Replaces the old duplicateCheck.js (150m haversine + same-department = suppress)
// with embedding-based clustering that PRESERVES every submission and counts unique
// reporters per cluster — deleting duplicates would destroy the population-impact
// evidence the ranking engine needs (research bible Part XVI). This is a simple
// greedy nearest-centroid clusterer, not a full HDBSCAN implementation — an explicit,
// documented simplification appropriate for an MVP (Report 1 BUILD-NEW matrix:
// "can start with a simpler clustering method").
//
// Auth: service-role only (batch/on-demand, not a citizen-facing endpoint).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, handleCors } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
const EMBED_MODEL_VERSION = 'text-embedding-004';
const SIMILARITY_THRESHOLD = 0.83; // cosine similarity — tune against real data before relying on it

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/** PostgREST returns pgvector columns as a string like "[0.1,0.2,...]" — normalize either shape. */
function parseVector(value: unknown): number[] | null {
  if (!value) return null;
  if (Array.isArray(value)) return value as number[];
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
  return null;
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function incrementalMean(oldCentroid: number[], oldCount: number, newVec: number[]): number[] {
  const total = oldCount + 1;
  return oldCentroid.map((v, i) => (v * oldCount + newVec[i]) / total);
}

async function embedText(text: string): Promise<number[] | null> {
  if (!GEMINI_API_KEY || !text?.trim()) return null;
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL_VERSION}:embedContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: `models/${EMBED_MODEL_VERSION}`,
          content: { parts: [{ text }] },
        }),
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const values = data?.embedding?.values;
    return Array.isArray(values) ? values : null;
  } catch {
    return null;
  }
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

  let payload: { geographic_unit_id?: string };
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }
  if (!payload.geographic_unit_id) {
    return jsonResponse({ error: 'geographic_unit_id is required' }, 400);
  }

  // Submissions in this geo unit that have completed feature extraction but aren't clustered yet.
  const { data: submissions, error: subError } = await supabase
    .from('citizen_submissions')
    .select('id, raw_text, submitter_id, submission_cluster_membership(cluster_id)')
    .eq('geographic_unit_id', payload.geographic_unit_id)
    .in('status', ['processed', 'needs_review']);

  if (subError) {
    return jsonResponse({ error: `Failed to load submissions: ${subError.message}` }, 500);
  }

  const unclustered = (submissions ?? []).filter(
    (s: any) => !s.submission_cluster_membership || s.submission_cluster_membership.length === 0
  );

  if (unclustered.length === 0) {
    return jsonResponse({ clusters: [], message: 'No unclustered submissions for this geography.' });
  }

  // Load existing clusters + centroids for this geo unit so new submissions can join them.
  const { data: existingClusters, error: clusterError } = await supabase
    .from('theme_clusters')
    .select('id, centroid_embedding, member_count')
    .eq('geographic_unit_id', payload.geographic_unit_id);

  if (clusterError) {
    return jsonResponse({ error: `Failed to load clusters: ${clusterError.message}` }, 500);
  }

  const clusters = (existingClusters ?? []).map((c) => ({
    id: c.id,
    centroid: parseVector(c.centroid_embedding),
    count: c.member_count ?? 0,
  }));

  const touchedClusterIds = new Set<string>();

  for (const submission of unclustered) {
    const embedding = await embedText(submission.raw_text ?? '');
    if (!embedding) {
      // No text to embed (e.g. photo/voice-only submission with a failed transcript) —
      // leave unclustered rather than guessing; a future pass with a transcript can retry.
      continue;
    }

    await supabase.from('submission_embeddings').upsert({
      submission_id: submission.id,
      embedding,
      model_version: EMBED_MODEL_VERSION,
    });

    let bestCluster: { id: string; centroid: number[]; count: number } | null = null;
    let bestScore = -1;
    for (const c of clusters) {
      if (!c.centroid) continue;
      const score = cosineSimilarity(embedding, c.centroid);
      if (score > bestScore) {
        bestScore = score;
        bestCluster = c;
      }
    }

    let targetClusterId: string;
    if (bestCluster && bestScore >= SIMILARITY_THRESHOLD) {
      targetClusterId = bestCluster.id;
      const newCentroid = incrementalMean(bestCluster.centroid, bestCluster.count, embedding);
      bestCluster.centroid = newCentroid;
      bestCluster.count += 1;
      await supabase
        .from('theme_clusters')
        .update({ centroid_embedding: newCentroid, member_count: bestCluster.count })
        .eq('id', targetClusterId);
    } else {
      const { data: newCluster, error: createError } = await supabase
        .from('theme_clusters')
        .insert({
          geographic_unit_id: payload.geographic_unit_id,
          centroid_embedding: embedding,
          member_count: 1,
          unique_reporter_count: 1,
        })
        .select('id')
        .single();
      if (createError || !newCluster) continue;
      targetClusterId = newCluster.id;
      clusters.push({ id: targetClusterId, centroid: embedding, count: 1 });
    }

    await supabase.from('submission_cluster_membership').insert({
      cluster_id: targetClusterId,
      submission_id: submission.id,
      similarity_score: bestCluster && bestScore >= SIMILARITY_THRESHOLD ? bestScore : 1,
    });
    touchedClusterIds.add(targetClusterId);
  }

  // Recompute unique_reporter_count precisely (distinct submitter_id) for every touched cluster —
  // the incremental centroid update above tracks member_count but not distinct reporters.
  const results = [];
  for (const clusterId of touchedClusterIds) {
    const { data: members } = await supabase
      .from('submission_cluster_membership')
      .select('submission_id, citizen_submissions(submitter_id)')
      .eq('cluster_id', clusterId);

    const memberIds = (members ?? []).map((m: any) => m.submission_id);
    const uniqueReporters = new Set((members ?? []).map((m: any) => m.citizen_submissions?.submitter_id)).size;

    await supabase
      .from('theme_clusters')
      .update({ unique_reporter_count: uniqueReporters, member_count: memberIds.length })
      .eq('id', clusterId);

    results.push({ cluster_id: clusterId, member_ids: memberIds, unique_reporter_count: uniqueReporters });
  }

  return jsonResponse({ clusters: results });
});
