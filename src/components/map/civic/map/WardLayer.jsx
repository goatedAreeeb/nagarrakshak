import { useMemo } from 'react';
import { GeoJsonLayer } from '@deck.gl/layers';
import { ALPHA, HOLOGRAM, riskScoreToFill, riskScoreToStroke } from '../theme/mapPalette';

const EXTRUSION_ZOOM_MIN = 9.5;

function wardElevation(props, selected, allowHeight, showAllColors) {
  if (!allowHeight) return 0;
  const risk = props?.risk_score ?? 0;
  if (selected) return 95 + Math.min(35, risk * 0.3);
  if (showAllColors) return Math.min(50, Math.max(22, risk * 1.25));
  return Math.min(42, Math.max(12, risk * 1.1));
}

export default function useWardLayer({
  data,
  selectedWardId,
  zoom = 10,
  showAllColors = false,
  onHover,
  onClick,
}) {
  const cityExtrude = zoom >= EXTRUSION_ZOOM_MIN;
  const hasSelection = Boolean(selectedWardId);
  const extruded = showAllColors || cityExtrude || hasSelection;

  return useMemo(() => {
    if (!data) return null;

    return new GeoJsonLayer({
      id: 'ghmc-wards',
      data,
      pickable: true,
      autoHighlight: !showAllColors,
      highlightColor: HOLOGRAM.highlight,
      extruded,
      wireframe: false,
      filled: true,
      stroked: true,
      lineWidthMinPixels: 0.8,
      lineWidthMaxPixels: 2.5,
      elevationScale: 1,
      material: {
        ambient: 0.4,
        diffuse: 0.55,
        shininess: 24,
        specularColor: [90, 140, 130],
      },
      getPolygonOffset: () => [-1, -2],
      getElevation: (f) => {
        const id = f.properties?.ward_id;
        const selected = selectedWardId && id === selectedWardId;
        const allowHeight = showAllColors || cityExtrude || selected;
        return wardElevation(f.properties, selected, allowHeight, showAllColors);
      },
      getFillColor: (f) => {
        const score = f.properties?.risk_score ?? 0;
        const id = f.properties?.ward_id;
        const isSelected = selectedWardId && id === selectedWardId;

        if (showAllColors) {
          if (isSelected) return riskScoreToFill(score, { selected: true });
          return riskScoreToFill(score, { alpha: ALPHA.showAll });
        }

        const dimmed = hasSelection && !isSelected;
        if (isSelected) return riskScoreToFill(score, { selected: true });
        if (dimmed) return riskScoreToFill(score, { dimmed: true });
        return riskScoreToFill(score, { selected: false });
      },
      getLineColor: (f) => {
        const id = f.properties?.ward_id;
        const score = f.properties?.risk_score ?? 0;
        const isSelected = selectedWardId && id === selectedWardId;

        if (showAllColors) {
          return riskScoreToStroke(score, {
            selected: isSelected,
            idle: !isSelected,
          });
        }

        const dimmed = hasSelection && !isSelected;
        return riskScoreToStroke(score, {
          selected: isSelected,
          dimmed,
          idle: !hasSelection,
        });
      },
      getLineWidth: (f) => {
        const id = f.properties?.ward_id;
        if (selectedWardId && id === selectedWardId) return 2;
        if (showAllColors) return 1.1;
        return hasSelection ? 0.9 : 1;
      },
      updateTriggers: {
        getFillColor: [selectedWardId, hasSelection, showAllColors],
        getLineColor: [selectedWardId, hasSelection, showAllColors],
        getLineWidth: [selectedWardId, hasSelection, showAllColors],
        getElevation: [selectedWardId, cityExtrude, showAllColors],
      },
      onHover,
      onClick,
    });
  }, [
    data,
    selectedWardId,
    cityExtrude,
    hasSelection,
    showAllColors,
    extruded,
    onHover,
    onClick,
  ]);
}
