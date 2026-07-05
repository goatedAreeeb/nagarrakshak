// extract-features — PROMPT-001, REPORT_2 Part VIII §23 / Part V §14.
//
// Converts raw submission text into structured, MCDA-ready features. This
// function NEVER returns or writes a priority/severity/rank value — that is
// compute-priority's job alone (Phase 8), and it is deterministic, not an LLM
// call. If the model output smuggles a priority-shaped field anyway, this
// function rejects the whole response and falls back to the deterministic
// keyword extractor rather than silently keeping the untrusted field.
//
// Auth: service-role only. This function is invoked server-to-server by
// ingest-submission using SUPABASE_SERVICE_ROLE_KEY (never present in any
// client bundle) — a browser calling this directly with a user JWT is rejected.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, handleCors } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY'); // server-side only; distinct from the retired VITE_GEMINI_KEY

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const SYSTEM_PROMPT = `You are a data-structuring assistant for a public-sector constituency-planning tool. You extract facts; you do not judge importance or priority. Output strict JSON matching the given schema. If uncertain about a field, output null and a confidence value — never guess to fill a field.

Schema:
{
  "category": string | null,          // short development-category label, e.g. "school_infrastructure", "road_repair", "water_supply", "health_facility", "vocational_training", "drainage", "other"
  "entities": string[],                // named things mentioned: school names, landmarks, facility types
  "location_mentions": string[],       // place names mentioned in the text (village/ward/landmark), not GPS
  "sentiment": "urgent" | "concerned" | "neutral" | "positive" | null,
  "confidence": number                 // 0.0-1.0, your confidence in this extraction
}

Do NOT include any field named priority, severity, rank, score, or urgency_level. Only the fields listed above.`;

const FORBIDDEN_KEYS = ['priority', 'severity', 'rank', 'score', 'urgency_level', 'sla_hours'];

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/** Deterministic fallback — reused pattern from the old gemini.js keyword rules,
 *  rebuilt for a development-category taxonomy instead of municipal departments. */
function extractFeaturesLocally(text: string) {
  const t = (text || '').toLowerCase();
  const rules: Array<{ pattern: RegExp; category: string }> = [
    { pattern: /\b(school|classroom|teacher|enrollment|udise)\b/, category: 'school_infrastructure' },
    { pattern: /\b(vocational|iti|skill|training centre|training center)\b/, category: 'vocational_training' },
    { pattern: /\b(road|pothole|footpath|pavement)\b/, category: 'road_repair' },
    { pattern: /\b(water|tap|pipe|drinking water|borewell)\b/, category: 'water_supply' },
    { pattern: /\b(drain|sewer|flooding|waterlog)\b/, category: 'drainage' },
    { pattern: /\b(hospital|clinic|health|dispensary|phc)\b/, category: 'health_facility' },
    { pattern: /\b(electricity|power|transformer|street light)\b/, category: 'electricity' },
  ];
  const match = rules.find((r) => r.pattern.test(t));
  const urgent = /\b(urgent|emergency|immediately|danger|unsafe)\b/.test(t);

  return {
    category: match?.category ?? null,
    entities: [],
    location_mentions: [],
    sentiment: urgent ? 'urgent' : t.trim() ? 'neutral' : null,
    confidence: match ? 0.4 : 0.2, // deliberately low — this is a keyword guess, not a validated extraction
  };
}

function validateSchema(parsed: Record<string, unknown>): boolean {
  if (typeof parsed !== 'object' || parsed === null) return false;
  for (const key of FORBIDDEN_KEYS) {
    if (key in parsed) return false; // fail closed — never let a smuggled priority-shaped field through
  }
  if ('confidence' in parsed && typeof parsed.confidence !== 'number') return false;
  if ('entities' in parsed && parsed.entities !== null && !Array.isArray(parsed.entities)) return false;
  if ('location_mentions' in parsed && parsed.location_mentions !== null && !Array.isArray(parsed.location_mentions)) return false;
  return true;
}

async function callGemini(text: string, language: string | null) {
  if (!GEMINI_API_KEY) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: `${SYSTEM_PROMPT}\n\nLanguage: ${language ?? 'unknown'}\nSubmission text:\n${text}` }],
            },
          ],
          generationConfig: { temperature: 0.1, maxOutputTokens: 400 },
        }),
      }
    );
    if (!res.ok) return null;

    const data = await res.json();
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;

    const parsed = JSON.parse(match[0]);
    if (!validateSchema(parsed)) return null;

    return {
      category: parsed.category ?? null,
      entities: Array.isArray(parsed.entities) ? parsed.entities : [],
      location_mentions: Array.isArray(parsed.location_mentions) ? parsed.location_mentions : [],
      sentiment: parsed.sentiment ?? null,
      confidence: typeof parsed.confidence === 'number' ? Math.max(0, Math.min(1, parsed.confidence)) : 0.5,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
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

  let payload: { submission_id?: string; text?: string; language?: string };
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  if (!payload.submission_id) {
    return jsonResponse({ error: 'submission_id is required' }, 400);
  }

  // Always fetch the row: lat/lng is needed to chain into resolve-geography regardless
  // of whether the caller already passed text inline.
  const { data: existing, error: fetchError } = await supabase
    .from('citizen_submissions')
    .select('raw_text, language, lat, lng')
    .eq('id', payload.submission_id)
    .single();
  if (fetchError || !existing) {
    return jsonResponse({ error: `Submission not found: ${fetchError?.message ?? payload.submission_id}` }, 404);
  }

  const text = payload.text ?? existing.raw_text ?? '';
  payload.language = payload.language ?? existing.language;

  let features = await callGemini(text ?? '', payload.language ?? null);
  let usedFallback = false;
  if (!features) {
    features = extractFeaturesLocally(text ?? '');
    usedFallback = true;
  }

  const status = features.confidence >= 0.5 ? 'processed' : 'needs_review';

  const { error: updateError } = await supabase
    .from('citizen_submissions')
    .update({
      category: features.category,
      entities: features.entities,
      location_mentions: features.location_mentions,
      sentiment: features.sentiment,
      confidence: features.confidence,
      status,
    })
    .eq('id', payload.submission_id);

  if (updateError) {
    return jsonResponse({ error: `Failed to write features: ${updateError.message}` }, 500);
  }

  if (existing.lat != null || features.location_mentions.length > 0) {
    const geoTask = fetch(`${SUPABASE_URL}/functions/v1/resolve-geography`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        submission_id: payload.submission_id,
        lat: existing.lat,
        lng: existing.lng,
        location_mentions: features.location_mentions,
      }),
    }).catch((err) => console.error('resolve-geography hand-off failed for', payload.submission_id, err));

    // @ts-ignore — EdgeRuntime is a Supabase Edge Runtime global, not a standard Deno type.
    if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime?.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(geoTask);
    }
  }

  return jsonResponse({ submission_id: payload.submission_id, ...features, status, usedFallback });
});
