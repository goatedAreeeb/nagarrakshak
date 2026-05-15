import centroid from '@turf/centroid';

/** Attach [lng, lat] once per feature — reused by search index and labels. */
export function attachFeatureCentroids(geojson) {
  if (!geojson?.features?.length) return geojson;

  return {
    ...geojson,
    features: geojson.features.map((feature) => {
      const [lng, lat] = centroid(feature).geometry.coordinates;
      return {
        ...feature,
        properties: {
          ...feature.properties,
          _centroid: [lng, lat],
        },
      };
    }),
  };
}

export function getFeatureCentroid(feature) {
  const c = feature?.properties?._centroid;
  if (Array.isArray(c) && c.length >= 2) return c;
  return centroid(feature).geometry.coordinates;
}
