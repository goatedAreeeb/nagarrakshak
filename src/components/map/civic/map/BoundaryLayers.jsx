import { useMemo } from 'react';
import { GeoJsonLayer } from '@deck.gl/layers';
import { NEON } from '../theme/mapPalette';

export function useAreaBoundaryLayer() {
  return useMemo(
    () =>
      new GeoJsonLayer({
        id: 'ghmc-area',
        data: '/ghmc-area.geojson',
        extruded: false,
        stroked: true,
        filled: true,
        pickable: false,
        getPolygonOffset: () => [-2, -4],
        getFillColor: [20, 28, 32, 12],
        getLineColor: [...NEON.orange, 120],
        lineWidthMinPixels: 1.5,
        lineWidthMaxPixels: 2.5,
      }),
    [],
  );
}

export function useZoneLayer() {
  return useMemo(
    () =>
      new GeoJsonLayer({
        id: 'ghmc-zones',
        data: '/ghmc-zones.geojson',
        extruded: false,
        stroked: true,
        filled: true,
        pickable: false,
        getPolygonOffset: () => [-1.5, -3],
        getFillColor: [30, 20, 25, 14],
        getLineColor: [...NEON.red, 100],
        lineWidthMinPixels: 1.2,
        lineWidthMaxPixels: 2,
      }),
    [],
  );
}
