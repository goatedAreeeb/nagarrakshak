/** Cyberpunk hologram palette — risk-tinted, transparent fills */

export const NEON = {
  mintDim: [60, 160, 140],
  cyan: [80, 200, 185],
  orange: [255, 140, 60],
  red: [255, 70, 90],
  amber: [255, 210, 70],
  lime: [180, 255, 100],
};

/** Softer risk hues (not full neon) for ward glass */
export const RISK = {
  low: [65, 175, 130],
  moderate: [200, 155, 55],
  high: [195, 85, 95],
};

export const ALPHA = {
  /** City view — risk visible, map readable underneath */
  idle: 52,
  /** Clicked ward — clearer but still see-through */
  selected: 98,
  /** Other wards while one is selected — faded but color still readable */
  dimmed: 46,
  dimmedStroke: 72,
  /** Toggle: show every ward’s risk color at any zoom */
  showAll: 78,
};

export const HOLOGRAM = {
  highlight: [120, 200, 180, 90],
};

function riskRgb(score) {
  if (score > 80) return RISK.high;
  if (score > 50) return RISK.moderate;
  return RISK.low;
}

export function riskScoreToFill(
  score,
  { alpha, dimmed = false, selected = false } = {},
) {
  const base = riskRgb(score);
  if (dimmed) {
    return [
      Math.round(base[0] * 0.72),
      Math.round(base[1] * 0.72),
      Math.round(base[2] * 0.72),
      ALPHA.dimmed,
    ];
  }
  const a =
    alpha ?? (selected ? ALPHA.selected : ALPHA.idle);
  return [...base, a];
}

export function riskScoreToStroke(
  score,
  { selected = false, dimmed = false, idle = false } = {},
) {
  const base = riskRgb(score);
  if (dimmed) {
    return [
      Math.round(base[0] * 0.75),
      Math.round(base[1] * 0.75),
      Math.round(base[2] * 0.75),
      ALPHA.dimmedStroke,
    ];
  }
  if (selected) return [...base, 185];
  if (idle) return [...base, 100];
  if (score > 80) return [...NEON.red, 160];
  if (score > 50) return [...NEON.amber, 140];
  return [...NEON.mintDim, 120];
}

export function severityToColor(level) {
  switch (level) {
    case 'Critical':
      return [...NEON.red, 235];
    case 'High':
      return [...NEON.orange, 225];
    case 'Medium':
      return [...NEON.amber, 215];
    default:
      return [...NEON.lime, 205];
  }
}
