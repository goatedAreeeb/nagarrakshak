// resolve-geography — REPORT_2 Part V §14 / Part X §28.
//
// Resolves a submission's GPS point and/or text location-mentions to a
// geographic_units row (LGD-coded), using nearest-point-in-radius over GPS
// first, then a fuzzy name match against location_mentions as a fallback.
// This is the Phase 6 GIS backend piece; the full map data-source swap (moving
// the 25-file map/civic/ subsystem off wards.health_score onto population-
// normalized cluster density) is a separate, larger frontend pass — not done
// in this piece, so as not to touch a large unfamiliar subsystem in the same
// change as new backend logic (REPORT_2 non-negotiable principle: read before
// rewriting, one verified step at a time).
//
// Auth: service-role only (internal pipeline step, called after extract-features).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, handleCors } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const MAX_GPS_MATCH_KM = 50; // beyond this, GPS is treated as "outside any known unit" rather than guessed

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Centroid lookup requires geographic_units to carry a representative lat/lng.
 *  The current schema (migration 0003) stores full boundary_geojson but no
 *  single centroid column — extracted here from boundary_geojson if present. */
function centroidOf(boundaryGeojson: any): { lat: number; lng: number } | null {
  if (!boundaryGeojson) return null;
  try {
    const coords = boundaryGeojson.geometry?.coordinates ?? boundaryGeojson.coordinates;
    if (!coords) return null;
    const flat: number[][] = [];
    const flatten = (c: any) => {
      if (typeof c[0] === 'number') flat.push(c);
      else c.forEach(flatten);
    };
    flatten(coords);
    if (flat.length === 0) return null;
    const avgLng = flat.reduce((s, p) => s + p[0], 0) / flat.length;
    const avgLat = flat.reduce((s, p) => s + p[1], 0) / flat.length;
    return { lat: avgLat, lng: avgLng };
  } catch {
    return null;
  }
}

function normalizeForMatch(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
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

  let payload: { submission_id?: string; lat?: number; lng?: number; location_mentions?: string[] };
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }
  if (!payload.submission_id) {
    return jsonResponse({ error: 'submission_id is required' }, 400);
  }

  const { data: units, error: unitsError } = await supabase
    .from('geographic_units')
    .select('id, name, level, boundary_geojson');

  if (unitsError) {
    return jsonResponse({ error: `Failed to load geographic_units: ${unitsError.message}` }, 500);
  }

  let matchedUnitId: string | null = null;
  let confidence = 0;
  let method: string | null = null;

  // Strategy 1: nearest centroid by GPS distance.
  if (payload.lat != null && payload.lng != null && units?.length) {
    let nearest: { id: string; distanceKm: number } | null = null;
    for (const unit of units) {
      const centroid = centroidOf(unit.boundary_geojson);
      if (!centroid) continue;
      const distanceKm = haversineKm(payload.lat, payload.lng, centroid.lat, centroid.lng);
      if (!nearest || distanceKm < nearest.distanceKm) {
        nearest = { id: unit.id, distanceKm };
      }
    }
    if (nearest && nearest.distanceKm <= MAX_GPS_MATCH_KM) {
      matchedUnitId = nearest.id;
      // Confidence decays linearly with distance — a crude but honest signal, not a false-precise score.
      confidence = Math.max(0.3, 1 - nearest.distanceKm / MAX_GPS_MATCH_KM);
      method = 'gps_centroid';
    }
  }

  // Strategy 2 (fallback, or corroboration): fuzzy name match against location_mentions.
  if (!matchedUnitId && payload.location_mentions?.length && units?.length) {
    for (const mention of payload.location_mentions) {
      const normalizedMention = normalizeForMatch(mention);
      const match = units.find((u) => normalizeForMatch(u.name).includes(normalizedMention) || normalizedMention.includes(normalizeForMatch(u.name)));
      if (match) {
        matchedUnitId = match.id;
        confidence = 0.4; // name-string matches are a documented, real risk per research bible Part VIII §21 — never over-claim confidence here
        method = 'name_match';
        break;
      }
    }
  }

  const { error: updateError } = await supabase
    .from('citizen_submissions')
    .update({ geographic_unit_id: matchedUnitId })
    .eq('id', payload.submission_id);

  if (updateError) {
    return jsonResponse({ error: `Failed to write geographic_unit_id: ${updateError.message}` }, 500);
  }

  return jsonResponse({
    submission_id: payload.submission_id,
    geographic_unit_id: matchedUnitId,
    confidence,
    method,
  });
});
