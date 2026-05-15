import { useMemo } from 'react';
import { TextLayer } from '@deck.gl/layers';

export default function useWardLabelLayer({ labels, zoom, showAllLabels = false }) {
  return useMemo(() => {
    if (!labels?.length) return null;
    if (!showAllLabels && zoom < 10.5) return null;

    const visible = showAllLabels
      ? labels
      : labels.filter((d) => zoom >= d.zoomMin);
    if (!visible.length) return null;

    return new TextLayer({
      id: 'ward-labels',
      data: visible,
      pickable: false,
      billboard: true,
      fontFamily: "'DM Sans', system-ui, sans-serif",
      fontWeight: 500,
      characterSet: 'auto',
      getPosition: (d) => d.position,
      getText: (d) => d.label,
      getSize: showAllLabels ? 11 : zoom >= 12.5 ? 13 : 11,
      getColor: [180, 255, 230, showAllLabels ? 200 : zoom >= 12 ? 235 : 190],
      outlineWidth: 2,
      outlineColor: [8, 12, 16, 220],
      getTextAnchor: 'middle',
      getAlignmentBaseline: 'center',
      sizeUnits: 'pixels',
      sizeMinPixels: 9,
      sizeMaxPixels: 14,
      parameters: { depthTest: false },
    });
  }, [labels, zoom, showAllLabels]);
}
