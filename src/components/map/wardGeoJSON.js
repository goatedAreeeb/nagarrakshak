import { HYDERABAD_WARDS } from '../../data/hyderabadWards';

const HEX_RADIUS = 0.0115;

export function createHexPolygon(lat, lng, radiusDeg = HEX_RADIUS, sides = 6) {
  const coords = [];
  for (let i = 0; i < sides; i++) {
    const angle = (i / sides) * 2 * Math.PI - Math.PI / 2;
    coords.push([
      lng + radiusDeg * Math.cos(angle),
      lat + radiusDeg * Math.sin(angle),
    ]);
  }
  coords.push(coords[0]);
  return coords;
}

function wardRowToProps(w) {
  return {
    ward_id: w.ward_id ?? w.id,
    ward_name: w.ward_name ?? w.name,
    lat: w.lat,
    lng: w.lng,
    population: w.population ?? 0,
    zone: w.zone ?? 'Hyderabad',
    open_issues: w.open_issues ?? 0,
    resolved_issues: w.resolved_issues ?? 0,
    health_score: w.health_score ?? 75,
    dominant_category: w.dominant_category ?? 'Roads',
  };
}

export function buildWardFeatures(wardData = HYDERABAD_WARDS) {
  return {
    type: 'FeatureCollection',
    features: wardData.map((w) => {
      const properties = wardRowToProps(w);
      return {
        type: 'Feature',
        properties,
        geometry: {
          type: 'Polygon',
          coordinates: [createHexPolygon(properties.lat, properties.lng)],
        },
      };
    }),
  };
}

/** Merge DB wards with full Hyderabad coverage (extra areas stay client-side). */
export function buildWardFeaturesFromRows(wardRows) {
  if (!wardRows?.length) return buildWardFeatures(HYDERABAD_WARDS);

  const dbNames = new Set(wardRows.map((w) => w.name?.toLowerCase()));
  const fromDb = wardRows.map((w) =>
    wardRowToProps({
      ward_id: w.id,
      ward_name: w.name,
      lat: w.lat,
      lng: w.lng,
      population: w.population,
      zone: w.zone,
      open_issues: w.open_issues,
      resolved_issues: w.resolved_issues,
      health_score: w.health_score,
      dominant_category: w.dominant_category,
    })
  );
  const extra = HYDERABAD_WARDS.filter((w) => !dbNames.has(w.ward_name.toLowerCase())).map(
    wardRowToProps
  );
  return buildWardFeatures([...fromDb, ...extra]);
}

export const wardFeatures = buildWardFeatures();

export function mergeWardLiveData(features, wardsFromDb) {
  if (!wardsFromDb?.length) return features;
  const byId = Object.fromEntries(wardsFromDb.map((w) => [w.id, w]));
  const byName = Object.fromEntries(wardsFromDb.map((w) => [w.name?.toLowerCase(), w]));

  return {
    ...features,
    features: features.features.map((f) => {
      const live =
        byId[f.properties.ward_id] || byName[f.properties.ward_name?.toLowerCase()];
      if (!live) return f;
      return {
        ...f,
        properties: {
          ...f.properties,
          population: live.population ?? f.properties.population,
          zone: live.zone ?? f.properties.zone,
          open_issues: live.open_issues ?? f.properties.open_issues,
          resolved_issues: live.resolved_issues ?? f.properties.resolved_issues,
          health_score: live.health_score ?? f.properties.health_score,
          dominant_category: live.dominant_category ?? f.properties.dominant_category,
          total_issues:
            (live.open_issues ?? f.properties.open_issues ?? 0) +
            (live.resolved_issues ?? f.properties.resolved_issues ?? 0),
        },
      };
    }),
  };
}
