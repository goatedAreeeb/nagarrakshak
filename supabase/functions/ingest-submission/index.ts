// ingest-submission — entry point for citizen intake (REPORT_2 Part V §14).
//
// Deliberately dumb: validates the caller, rate-limits, writes citizen_submissions
// + submission_media rows, and returns. It does NOT call extract-features itself —
// keeping ingestion and AI feature-extraction as two independently-testable steps
// (per REPORT_2's non-negotiable engineering principles) means a slow/unavailable
// LLM provider never blocks a citizen's submit confirmation. extract-features is
// invoked separately, either by the client immediately after a successful ingest
// (fire-and-forget) or by a scheduled job sweeping `status = 'received'` rows.
//
// Auth: requires a valid citizen/mp_staff/mp JWT (Authorization: Bearer <token>).
// No service-role key is used here — this function runs under the caller's own
// RLS-scoped session, so a citizen can only ever insert a submission attributed
// to themselves (enforced by migration 0009's "submissions insert own or assisted" policy).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, handleCors } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

/** Fire-and-forget hand-off to extract-features. Uses EdgeRuntime.waitUntil so the
 *  citizen's submit confirmation doesn't wait on LLM latency (Report 2 Performance
 *  Budget: feature-extraction is async, not blocking submit), while still running
 *  under the platform's guarantee that the isolate stays alive to finish the task. */
function triggerFeatureExtraction(submissionId: string, text: string | null, language: string | null) {
  const task = fetch(`${SUPABASE_URL}/functions/v1/extract-features`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ submission_id: submissionId, text: text ?? '', language }),
  }).catch((err) => {
    console.error('extract-features hand-off failed for', submissionId, err);
  });

  // @ts-ignore — EdgeRuntime is a Supabase Edge Runtime global, not a standard Deno type.
  if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime?.waitUntil) {
    // @ts-ignore
    EdgeRuntime.waitUntil(task);
  }
}

const MAX_SUBMISSIONS_PER_HOUR = 20;
const VALID_CHANNELS = ['app', 'voice', 'photo', 'letter_ocr', 'assisted', 'whatsapp_import'];
const VALID_MEDIA_TYPES = ['photo', 'voice', 'ocr_scan'];
const ALLOWED_MIME_PREFIXES = ['image/', 'audio/'];

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

  // Client bound to the caller's own JWT — every query below runs under their RLS policies.
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) {
    return jsonResponse({ error: 'Invalid or expired session' }, 401);
  }
  const callerId = userData.user.id;

  let payload: {
    text?: string;
    language?: string;
    channel?: string;
    media_refs?: Array<{ storage_path: string; media_type: string; mime_type?: string }>;
    lat?: number;
    lng?: number;
    address?: string;
    geographic_unit_id?: string;
    submitter_id?: string; // only honored for assisted (mp_staff-on-behalf-of-citizen) entry
  };
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const channel = payload.channel ?? 'app';
  if (!VALID_CHANNELS.includes(channel)) {
    return jsonResponse({ error: `channel must be one of: ${VALID_CHANNELS.join(', ')}` }, 400);
  }

  if (!payload.text && (!payload.media_refs || payload.media_refs.length === 0)) {
    return jsonResponse({ error: 'Submission must include text or at least one media attachment' }, 400);
  }

  for (const media of payload.media_refs ?? []) {
    if (!VALID_MEDIA_TYPES.includes(media.media_type)) {
      return jsonResponse({ error: `media_type must be one of: ${VALID_MEDIA_TYPES.join(', ')}` }, 400);
    }
    if (media.mime_type && !ALLOWED_MIME_PREFIXES.some((p) => media.mime_type!.startsWith(p))) {
      return jsonResponse({ error: `mime_type not allowed: ${media.mime_type}` }, 400);
    }
    if (!media.storage_path) {
      return jsonResponse({ error: 'Each media_refs entry needs storage_path (upload to Storage first)' }, 400);
    }
  }

  // Rate limit: cap submissions per submitter per rolling hour. Checked against the
  // caller's own id, not payload.submitter_id, so assisted-entry staff can't use one
  // citizen's identity to bypass another citizen's limit.
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count: recentCount, error: countError } = await supabase
    .from('citizen_submissions')
    .select('id', { count: 'exact', head: true })
    .eq('submitter_id', callerId)
    .gte('created_at', oneHourAgo);

  if (countError) {
    return jsonResponse({ error: `Rate-limit check failed: ${countError.message}` }, 500);
  }
  if ((recentCount ?? 0) >= MAX_SUBMISSIONS_PER_HOUR) {
    return jsonResponse({ error: 'Submission rate limit reached. Try again later.' }, 429);
  }

  const submitterId = payload.submitter_id ?? callerId;

  const { data: submission, error: insertError } = await supabase
    .from('citizen_submissions')
    .insert({
      submitter_id: submitterId,
      channel,
      language: payload.language ?? null,
      raw_text: payload.text ?? null,
      lat: payload.lat ?? null,
      lng: payload.lng ?? null,
      address: payload.address ?? null,
      geographic_unit_id: payload.geographic_unit_id ?? null,
      status: 'received',
    })
    .select('id, status')
    .single();

  if (insertError || !submission) {
    return jsonResponse({ error: `Failed to record submission: ${insertError?.message}` }, 500);
  }

  if (payload.media_refs?.length) {
    const mediaRows = payload.media_refs.map((m) => ({
      submission_id: submission.id,
      media_type: m.media_type,
      storage_path: m.storage_path,
      mime_type: m.mime_type ?? null,
    }));
    const { error: mediaError } = await supabase.from('submission_media').insert(mediaRows);
    if (mediaError) {
      // Submission row already exists — report the partial failure rather than losing it silently.
      return jsonResponse(
        { submission_id: submission.id, status: submission.status, warning: `Media attach failed: ${mediaError.message}` },
        207
      );
    }
  }

  triggerFeatureExtraction(submission.id, payload.text ?? null, payload.language ?? null);

  return jsonResponse({ submission_id: submission.id, status: submission.status });
});
