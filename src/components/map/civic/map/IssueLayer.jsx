import { useMemo } from 'react';
import { ScatterplotLayer } from '@deck.gl/layers';
import { severityToColor } from '../theme/mapPalette';

export default function useIssueLayer({ issues, visible }) {
  return useMemo(() => {
    if (!visible || !issues?.length) return null;
    return new ScatterplotLayer({
      id: 'ward-issues',
      data: issues,
      pickable: true,
      radiusUnits: 'meters',
      getPosition: (d) => d.position,
      getRadius: 85,
      radiusMinPixels: 7,
      radiusMaxPixels: 16,
      getFillColor: (d) => severityToColor(d.severity),
      getLineColor: [255, 255, 255, 220],
      lineWidthMinPixels: 2,
      stroked: true,
      parameters: { depthTest: false },
    });
  }, [issues, visible]);
}

/** Soft neon halo under issue pins */
export function useIssueGlowLayer({ issues, visible }) {
  return useMemo(() => {
    if (!visible || !issues?.length) return null;
    return new ScatterplotLayer({
      id: 'ward-issues-glow',
      data: issues,
      pickable: false,
      radiusUnits: 'meters',
      getPosition: (d) => d.position,
      getRadius: 130,
      radiusMinPixels: 12,
      radiusMaxPixels: 24,
      getFillColor: (d) => {
        const c = severityToColor(d.severity);
        return [c[0], c[1], c[2], 55];
      },
      parameters: { depthTest: false },
    });
  }, [issues, visible]);
}
