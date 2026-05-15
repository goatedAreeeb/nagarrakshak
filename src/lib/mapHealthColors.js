/**
 * Ward hex colors: problem areas = red, healthy = soft teal, no data = neutral slate.
 * Alpha kept moderate so the basemap & labels stay visible.
 */

export function wardFillColor(properties, { hovered = false } = {}) {
  const open = properties.open_issues ?? 0;
  const resolved = properties.resolved_issues ?? 0;
  const score = properties.health_score ?? 50;

  let rgb;
  let alpha;

  if (open === 0 && resolved === 0) {
    rgb = [100, 116, 139];
    alpha = hovered ? 140 : 95;
  } else if (open >= 35) {
    rgb = [185, 28, 28];
    alpha = hovered ? 230 : 205;
  } else if (open >= 22) {
    rgb = [220, 38, 38];
    alpha = hovered ? 220 : 195;
  } else if (open >= 12) {
    rgb = [239, 68, 68];
    alpha = hovered ? 210 : 185;
  } else if (open >= 6) {
    rgb = [245, 158, 11];
    alpha = hovered ? 200 : 170;
  } else if (open >= 1) {
    rgb = [251, 191, 36];
    alpha = hovered ? 185 : 155;
  } else if (score >= 72) {
    rgb = [16, 185, 129];
    alpha = hovered ? 175 : 130;
  } else if (score >= 52) {
    rgb = [52, 211, 153];
    alpha = hovered ? 165 : 125;
  } else {
    rgb = [34, 197, 94];
    alpha = hovered ? 160 : 120;
  }

  return [...rgb, alpha];
}

export function wardLineColor(properties, { hovered = false } = {}) {
  const open = properties.open_issues ?? 0;
  if (hovered) return [255, 255, 255, 255];
  if (open >= 12) return [254, 202, 202, 220];
  if (open >= 1) return [253, 230, 138, 180];
  return [148, 163, 184, 160];
}

export function wardElevation(properties, { hovered = false } = {}) {
  const open = properties.open_issues ?? 0;
  const base = 120 + open * 85 + (properties.resolved_issues ?? 0) * 8;
  return hovered ? base * 1.35 : base;
}
