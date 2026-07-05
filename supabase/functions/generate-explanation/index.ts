// generate-explanation — PROMPT-003, REPORT_2 Part VIII §23 / Part IX §24.
//
// Narrates an ALREADY-COMPUTED score. Never calls the LLM to decide anything —
// compute-priority has already run by the time this is invoked. Every number
// the model is allowed to mention is derived from the real score_components row
// values; a post-generation check rejects the explanation if it contains a
// number that doesn't correspond to any real component/weight/score value
// (within a rounding tolerance), falling back to a raw-table message rather
// than ever showing an unvalidated LLM claim as if it were computed fact.
//
// Auth: service-role only.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, handleCors } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const SYSTEM_PROMPT = `You will be given a computed priority score and its component breakdown. Write a plain-language explanation (3-5 sentences) using ONLY the numbers provided. Do not introduce new facts, new comparisons to other proposals, or a different score. If a component value is null, say the evidence is not yet available for that component — do not estimate it. Refer to percentages as the value multiplied by 100, rounded to the nearest whole number.`;

const FALLBACK_TEXT = 'Explanation unavailable — see the raw component table below.';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/** Builds the set of numbers the model is allowed to cite: the total score, every
 *  component's value and weight, and their *100 rounded percentage forms. */
function buildAllowedNumbers(totalScore: number, components: any[]): number[] {
  const allowed = new Set<number>();
  const add = (n: number | null | undefined) => {
    if (n == null || Number.isNaN(n)) return;
    allowed.add(Math.round(n * 100) / 100);
    allowed.add(Math.round(n * 100)); // percentage form
    allowed.add(Math.round(n * 1000) / 1000);
  };
  add(totalScore);
  for (const c of components) {
    add(c.value);
    add(c.weight);
  }
  return [...allowed];
}

function validateCitations(text: string, allowedNumbers: number[]): boolean {
  const found = text.match(/-?\d+(\.\d+)?/g) ?? [];
  for (const raw of found) {
    const n = parseFloat(raw);
    // Tolerance-based match: natural-language rounding ("about 35%") is fine, a
    // fabricated figure with no nearby real value is not.
    const hasMatch = allowedNumbers.some((allowed) => Math.abs(allowed - n) <= 1.0);
    if (!hasMatch) return false;
  }
  return true;
}

async function callGemini(totalScore: number, components: any[]): Promise<string | null> {
  if (!GEMINI_API_KEY) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{
                text: `${SYSTEM_PROMPT}\n\nTotal score: ${totalScore}\nComponents:\n${JSON.stringify(components, null, 2)}`,
              }],
            },
          ],
          generationConfig: { temperature: 0.2, maxOutputTokens: 500, thinkingConfig: { thinkingBudget: 0 } },
        }),
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    return text || null;
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

  let payload: { proposal_id?: string };
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }
  if (!payload.proposal_id) {
    return jsonResponse({ error: 'proposal_id is required' }, 400);
  }

  const { data: priorityScore, error: scoreError } = await supabase
    .from('priority_scores')
    .select('id, total_score, confidence, model_version')
    .eq('proposal_id', payload.proposal_id)
    .single();
  if (scoreError || !priorityScore) {
    return jsonResponse({ error: `No priority_score found for this proposal — run compute-priority first: ${scoreError?.message}` }, 404);
  }

  const { data: components, error: componentsError } = await supabase
    .from('score_components')
    .select('name, value, weight, source, confidence, missing_data')
    .eq('priority_score_id', priorityScore.id);
  if (componentsError) {
    return jsonResponse({ error: `Failed to load score_components: ${componentsError.message}` }, 500);
  }

  const allowedNumbers = buildAllowedNumbers(priorityScore.total_score, components ?? []);

  let explanationText = await callGemini(priorityScore.total_score, components ?? []);
  let validated = false;
  if (explanationText && validateCitations(explanationText, allowedNumbers)) {
    validated = true;
  } else if (explanationText) {
    // One retry with a stricter reminder before falling back — cheap and often fixes stray rounding.
    explanationText = await callGemini(priorityScore.total_score, components ?? []);
    validated = Boolean(explanationText && validateCitations(explanationText, allowedNumbers));
  }

  const finalText = validated ? explanationText! : FALLBACK_TEXT;

  // Persisted so staff can read it via a normal RLS-scoped select — they can't call
  // this service-role-only function directly from the browser (see migration 0012).
  const { error: persistError } = await supabase
    .from('priority_scores')
    .update({ explanation_text: finalText, explanation_validated: validated })
    .eq('id', priorityScore.id);
  if (persistError) {
    console.error('Failed to persist explanation:', persistError.message);
  }

  return jsonResponse({
    proposal_id: payload.proposal_id,
    explanation_text: finalText,
    validated,
    total_score: priorityScore.total_score,
    confidence: priorityScore.confidence,
    components,
  });
});
