const SYSTEM_PROMPT = `You are an AI civic complaint classifier for Hyderabad, India. 
Analyze the image and description provided. Return ONLY valid JSON 
with no markdown, no explanation, just the JSON object.
Required fields:
{
  dept: one of [Roads & Infrastructure, Solid Waste Management, 
    Drainage & Sewerage, HMWSSB Water Supply, TSSPDCL Electricity, 
    Street Lighting, Stray Animals, Parks & Horticulture, 
    Town Planning, Fire & Safety, Traffic Police, Women Safety, 
    Public Health, Other],
  division: specific wing within dept,
  severity: integer 1-5 (5=immediate life risk, 1=minor aesthetic),
  sla_hours: based on severity [5->2, 4->12, 3->48, 2->168, 1->336],
  urgency_label: one of [Immediate, Urgent, High, Moderate, Low],
  ai_reasoning: one sentence explaining classification,
  location_risk: boolean — true if near hospital/school/women safety zone
}`;

const DEPT_MAP = {
  'Roads & Infrastructure': 'Roads',
  'Solid Waste Management': 'Sanitation',
  'Drainage & Sewerage': 'Drainage',
  'HMWSSB Water Supply': 'HMWSSB',
  'TSSPDCL Electricity': 'TSSPDCL',
  'Street Lighting': 'Street Lighting',
  'Stray Animals': 'Stray Animals',
  'Parks & Horticulture': 'Parks',
  'Town Planning': 'Town Planning',
  'Fire & Safety': 'Fire & Safety',
  'Traffic Police': 'Traffic',
  'Women Safety': 'Women Safety',
  'Public Health': 'Public Health',
  Other: 'Other',
};

export const SLA_BY_SEVERITY = [336, 168, 48, 12, 2];
const URGENCY_BY_SEVERITY = ['Low', 'Moderate', 'High', 'Urgent', 'Immediate'];

const KEYWORD_RULES = [
  {
    pattern:
      /\b(stalking|followed\s+me|being\s+followed|eve\s*teas|molest|groped|indecent\s+exposure)\b/i,
    dept: 'Women Safety',
    division: 'Safety Cell',
    severity: 5,
  },
  {
    pattern:
      /\b(dead\s+(dog|animal|cat|body|pet)|dog\s+(dead|body|carcass)|animal\s+(dead|body|carcass)|dead\s+body|carcass|corpse|deceased|rotting\s+(dog|animal|body)|killed\s+(dog|animal))\b/i,
    dept: 'Stray Animals',
    division: 'Animal Control & Carcass Removal',
    severity: 4,
  },
  {
    pattern: /\b(bench|park|playground|garden|tree|horticulture|grass|lawn|swing)\b/i,
    dept: 'Parks',
    division: 'Parks & Horticulture',
    severity: 2,
  },
  {
    pattern: /\b(pothole|road|footpath|pavement|crack|asphalt|tar|divider)\b/i,
    dept: 'Roads',
    division: 'Road Maintenance',
    severity: 3,
  },
  {
    pattern: /\b(garbage|trash|waste|dump|litter|sanitation|bin)\b/i,
    dept: 'Sanitation',
    division: 'Solid Waste',
    severity: 3,
  },
  {
    pattern: /\b(drain|sewer|flooding|waterlog|manhole|stagnant)\b/i,
    dept: 'Drainage',
    division: 'Storm Water',
    severity: 4,
  },
  {
    pattern: /\b(water supply|tap|pipe leak|hmwssb|drinking water)\b/i,
    dept: 'HMWSSB',
    division: 'Water Supply',
    severity: 4,
  },
  {
    pattern: /\b(street light|lamp|pole light|dark street|lighting)\b/i,
    dept: 'Street Lighting',
    division: 'Electrical Maintenance',
    severity: 3,
  },
  {
    pattern: /\b(stray\s+dog|stray\s+animal|dog\s+bite|monkey|stray\s+cat|nuisance\s+dog|pack\s+of\s+dogs)\b/i,
    dept: 'Stray Animals',
    division: 'Animal Control',
    severity: 3,
  },
  {
    pattern: /\b(traffic|signal|jam|parking|vehicle)\b/i,
    dept: 'Traffic',
    division: 'Traffic Management',
    severity: 3,
  },
  {
    pattern: /\b(fire|smoke|gas leak|explosion)\b/i,
    dept: 'Fire & Safety',
    division: 'Emergency',
    severity: 5,
  },
  {
    pattern: /\b(harassment|unsafe|women|eve teasing)\b/i,
    dept: 'Women Safety',
    division: 'Safety Cell',
    severity: 5,
  },
  {
    pattern: /\b(dengue|mosquito|health|clinic|hospital waste)\b/i,
    dept: 'Public Health',
    division: 'Vector Control',
    severity: 4,
  },
];

function buildResult({ dept, division, severity, ai_reasoning, location_risk = false }) {
  const sev = Math.min(5, Math.max(1, severity));
  return {
    dept,
    division,
    severity: sev,
    sla_hours: SLA_BY_SEVERITY[sev - 1],
    urgency_label: URGENCY_BY_SEVERITY[sev - 1],
    ai_reasoning,
    location_risk,
    source: 'local',
  };
}

/** Text used for keyword + local classification (description + optional context). */
export function buildClassificationContext({
  description,
  hasVoice = false,
  hasImage = false,
  safetySensitive = false,
} = {}) {
  const parts = [];
  if (safetySensitive) {
    parts.push(
      'Citizen flagged a personal-safety concern: harassment, stalking, feeling unsafe in public transit or streets, poorly lit areas at night, or fear of escalation. Not a substitute for emergency services.'
    );
  }
  parts.push((description || '').trim());
  if (hasVoice) {
    parts.push('Citizen attached a voice note describing the issue.');
  }
  if (hasImage && (description || '').trim().length < 40) {
    parts.push('Photo evidence was uploaded with the report.');
  }
  return parts.filter(Boolean).join(' \n');
}

function normalizeDeptLabel(raw) {
  if (!raw) return 'Other';
  if (DEPT_MAP[raw]) return DEPT_MAP[raw];
  const lower = String(raw).toLowerCase();
  if (lower.includes('stray') || lower.includes('animal') || lower.includes('dog') || lower.includes('carcass')) {
    return 'Stray Animals';
  }
  if (lower.includes('waste') || lower.includes('garbage') || lower.includes('sanitation')) {
    return 'Sanitation';
  }
  if (lower.includes('road') || lower.includes('pothole')) return 'Roads';
  if (lower.includes('drain') || lower.includes('sewer')) return 'Drainage';
  if (lower.includes('water') && lower.includes('supply')) return 'HMWSSB';
  if (lower.includes('electric') || lower.includes('tsspdcl')) return 'TSSPDCL';
  if (lower.includes('light')) return 'Street Lighting';
  if (lower.includes('park') || lower.includes('horticulture')) return 'Parks';
  if (lower.includes('traffic')) return 'Traffic';
  if (lower.includes('fire')) return 'Fire & Safety';
  if (lower.includes('health')) return 'Public Health';
  return DEPT_MAP[raw] || raw || 'Other';
}

export function classifyComplaintLocally(
  description,
  { hasVoice = false, hasImage = false, safetySensitive = false } = {}
) {
  const text = buildClassificationContext({ description, hasVoice, hasImage, safetySensitive });

  if (!text.trim()) {
    return buildResult({
      dept: hasImage || hasVoice ? 'Stray Animals' : 'Other',
      division: hasImage || hasVoice ? 'General Inspection' : 'General',
      severity: hasImage || hasVoice ? 3 : 3,
      ai_reasoning: hasImage
        ? 'Photo uploaded — routed for officer review (add a short description next time for faster routing).'
        : 'Add a description so we can route to the right department.',
    });
  }

  for (const rule of KEYWORD_RULES) {
    if (rule.pattern.test(text)) {
      let severity = rule.severity;
      if (safetySensitive) severity = Math.max(4, severity);
      return buildResult({
        dept: rule.dept,
        division: rule.division,
        severity,
        ai_reasoning: safetySensitive
          ? `Safety-sensitive report — routed to ${rule.dept} with priority.`
          : `Matched keywords for ${rule.dept} based on your report.`,
      });
    }
  }

  if (safetySensitive) {
    return buildResult({
      dept: 'Women Safety',
      division: 'Safety Cell',
      severity: 4,
      ai_reasoning: 'Safety-sensitive report — routed for priority officer review.',
    });
  }

  if (hasImage && /\b(dog|animal|pet|stray)\b/i.test(text)) {
    return buildResult({
      dept: 'Stray Animals',
      division: 'Animal Control',
      severity: 3,
      ai_reasoning: 'Animal-related report with photo — routed to Stray Animals.',
    });
  }

  return buildResult({
    dept: 'Other',
    division: 'General',
    severity: 3,
    ai_reasoning: 'Classified locally from your report; officer may refine routing.',
  });
}

function parseGeminiResponse(data) {
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  const parsed = JSON.parse(jsonMatch[0]);
  const severity = Math.min(5, Math.max(1, parseInt(parsed.severity, 10) || 3));
  const dept = normalizeDeptLabel(parsed.dept);
  return {
    dept,
    division: parsed.division || 'General',
    severity,
    sla_hours: parsed.sla_hours || SLA_BY_SEVERITY[severity - 1],
    urgency_label: parsed.urgency_label || URGENCY_BY_SEVERITY[severity - 1],
    ai_reasoning: parsed.ai_reasoning || 'Classified by AI',
    location_risk: Boolean(parsed.location_risk),
    source: 'gemini',
  };
}

async function fetchGemini(apiKey, parts, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ role: 'user', parts }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 512 },
        }),
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      const isQuota = res.status === 429 || errText.includes('RESOURCE_EXHAUSTED');
      return { ok: false, quota: isQuota, errText };
    }

    const data = await res.json();
    const parsed = parseGeminiResponse(data);
    return { ok: Boolean(parsed), result: parsed };
  } catch (err) {
    return { ok: false, quota: err?.name === 'AbortError', errText: String(err) };
  } finally {
    clearTimeout(timer);
  }
}

export async function analyzeComplaint({
  imageBase64,
  description,
  lat,
  lng,
  hasVoice = false,
  safetySensitive = false,
}) {
  const contextText = buildClassificationContext({
    description,
    hasVoice,
    hasImage: Boolean(imageBase64),
    safetySensitive,
  });
  const local = classifyComplaintLocally(description, {
    hasVoice,
    hasImage: Boolean(imageBase64),
    safetySensitive,
  });
  const apiKey = import.meta.env.VITE_GEMINI_KEY;

  if (!apiKey) {
    return { ...local, ai_reasoning: `${local.ai_reasoning} (Gemini key not configured.)` };
  }

  const parts = [
    {
      text: `${SYSTEM_PROMPT}\n\nCitizen report: ${contextText || 'No description'}\nHas photo: ${Boolean(imageBase64)}\nHas voice note: ${hasVoice}\nSafety-sensitive flow: ${safetySensitive}\nLocation: ${lat}, ${lng} (Hyderabad)\n\nIf safety-sensitive is true, prioritise Women Safety, Traffic Police, Street Lighting, or Fire & Safety as appropriate. If the report involves a dead animal, dog carcass, or stray animal hazard, classify as Stray Animals.`,
    },
  ];

  if (imageBase64) {
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const mimeType = imageBase64.match(/data:(image\/\w+);/)?.[1] || 'image/jpeg';
    parts.push({ inline_data: { mime_type: mimeType, data: base64Data } });
  }

  const gemini = await fetchGemini(apiKey, parts);

  if (gemini.ok && gemini.result) {
    return gemini.result;
  }

  if (gemini.quota) {
    return {
      ...local,
      ai_reasoning: `${local.ai_reasoning} AI quota reached — using instant local classification.`,
    };
  }

  return {
    ...local,
    ai_reasoning: `${local.ai_reasoning} AI unavailable — using local classification.`,
  };
}
