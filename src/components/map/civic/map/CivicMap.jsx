import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlyToInterpolator } from '@deck.gl/core';
import DeckGL from '@deck.gl/react';
import Map from 'react-map-gl/maplibre';
import bbox from '@turf/bbox';
import centroid from '@turf/centroid';
import 'maplibre-gl/dist/maplibre-gl.css';
import { enrichWardCollection } from '../data/wardAnalytics';
import { getCachedIssuesForWard } from '../data/mockIssues';
import { useCivicStore } from '../civicStore';
import { buildWardLabelPoints } from '../utils/wardLabels';
import { attachFeatureCentroids } from '../utils/wardCentroids';
import { useAreaBoundaryLayer, useZoneLayer } from './BoundaryLayers';
import useWardLayer from './WardLayer';
import useWardLabelLayer from './LabelLayer';
import useIssueLayer, { useIssueGlowLayer } from './IssueLayer';
import MapLoader from './MapLoader';
import MapTooltip from './Tooltip';

const WARD_PANEL_WIDTH = 380;

const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY;
const MAP_STYLE = MAPTILER_KEY
  ? `https://api.maptiler.com/maps/dataviz-dark/style.json?key=${MAPTILER_KEY}`
  : null;

const INITIAL_VIEW_STATE = {
  longitude: 78.4744,
  latitude: 17.368,
  zoom: 10.15,
  pitch: 48,
  bearing: -18,
  maxPitch: 58,
};

const FLY_DURATION = 1400;
const FLY_INTERPOLATOR = new FlyToInterpolator();

const DECK_CONTROLLER = {
  scrollZoom: { smooth: false },
  dragPan: true,
  touchZoom: true,
  maxPitch: 58,
};

function buildHoverInfo(info) {
  if (!info?.object) return null;
  const p = info.object.properties ?? {};
  return {
    x: info.x,
    y: info.y,
    wardId: p.ward_id,
    wardName: p.ward_name,
    civicScore: p.civic_score,
    activeIssues: p.active_complaints,
    majorCategory: p.dominant_issue_category,
    unresolvedCount: p.unresolved_complaints,
    department: p.department,
    slaBreachPct: p.sla_breach_pct,
  };
}

function wardFromPick(info) {
  if (!info?.object) return null;
  const p = info.object.properties ?? {};
  return {
    feature: info.object,
    wardId: p.ward_id,
    wardName: p.ward_name,
    analytics: { ...p },
  };
}

export default function CivicMap() {
  const [viewState, setViewState] = useState(INITIAL_VIEW_STATE);
  const [wardsData, setWardsData] = useState(null);
  const [labelPoints, setLabelPoints] = useState([]);
  const [loadError, setLoadError] = useState(null);

  const selectedWard = useCivicStore((s) => s.selectedWard);
  const wardIssues = useCivicStore((s) => s.wardIssues);
  const setSelectedWard = useCivicStore((s) => s.setSelectedWard);
  const setHoverInfo = useCivicStore((s) => s.setHoverInfo);
  const setWardIssues = useCivicStore((s) => s.setWardIssues);
  const setSearchEntriesFromGeoJson = useCivicStore((s) => s.setSearchEntriesFromGeoJson);
  const showAllWardColors = useCivicStore((s) => s.showAllWardColors);

  const hoverFrame = useRef(null);
  const pendingHover = useRef(null);
  const mapRef = useRef(null);
  const [mapWidth, setMapWidth] = useState(0);

  useEffect(() => {
    const el = mapRef.current;
    if (!el) return undefined;
    const sync = () => setMapWidth(el.offsetWidth);
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;

    fetch('/ghmc-wards.geojson')
      .then((res) => {
        if (!res.ok) throw new Error(`Wards GeoJSON failed (${res.status})`);
        return res.json();
      })
      .then((raw) => {
        if (cancelled) return;
        const withCentroids = attachFeatureCentroids(enrichWardCollection(raw));
        setLoadError(null);
        setWardsData(withCentroids);
        setLabelPoints(buildWardLabelPoints(withCentroids));
        setSearchEntriesFromGeoJson(withCentroids);
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('Failed to load wards GeoJSON', err);
          setLoadError(err.message ?? 'Failed to load ward boundaries');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [setSearchEntriesFromGeoJson]);

  useEffect(() => {
    if (!selectedWard?.feature) {
      setWardIssues([]);
      return;
    }
    setWardIssues(getCachedIssuesForWard(selectedWard.feature, 16));
  }, [selectedWard, setWardIssues]);

  const hadSelection = useRef(false);
  useEffect(() => {
    if (selectedWard) {
      hadSelection.current = true;
      return;
    }
    if (hadSelection.current) {
      setViewState({ ...INITIAL_VIEW_STATE, transitionDuration: 1400 });
      hadSelection.current = false;
    }
  }, [selectedWard]);

  const flyToFeature = useCallback((feature) => {
    try {
      const [lng, lat] = centroid(feature).geometry.coordinates;
      const [minLng, minLat, maxLng, maxLat] = bbox(feature);
      const span = Math.max(maxLng - minLng, maxLat - minLat);
      const zoom = span < 0.02 ? 13.8 : span < 0.05 ? 12.9 : 12.2;
      setViewState((prev) => ({
        ...prev,
        longitude: lng,
        latitude: lat,
        zoom,
        pitch: 52,
        bearing: -16,
        transitionDuration: FLY_DURATION,
        transitionInterpolator: FLY_INTERPOLATOR,
      }));
    } catch {
      /* invalid geometry */
    }
  }, []);

  const lastFlyNonce = useRef(0);
  useEffect(
    () =>
      useCivicStore.subscribe((state) => {
        if (
          state.flyNonce &&
          state.flyNonce !== lastFlyNonce.current &&
          state.selectedWard?.feature
        ) {
          lastFlyNonce.current = state.flyNonce;
          flyToFeature(state.selectedWard.feature);
        }
      }),
    [flyToFeature],
  );

  const flushHover = useCallback(() => {
    hoverFrame.current = null;
    const info = pendingHover.current;
    if (info?.object) setHoverInfo(buildHoverInfo(info));
    else setHoverInfo(null);
  }, [setHoverInfo]);

  const handleWardHover = useCallback(
    (info) => {
      pendingHover.current = info;
      if (hoverFrame.current == null) {
        hoverFrame.current = requestAnimationFrame(flushHover);
      }
    },
    [flushHover],
  );

  const handleWardClick = useCallback(
    (info) => {
      const ward = wardFromPick(info);
      if (!ward) return;
      setSelectedWard(ward);
      flyToFeature(ward.feature);
    },
    [setSelectedWard, flyToFeature],
  );

  useEffect(
    () => () => {
      if (hoverFrame.current != null) cancelAnimationFrame(hoverFrame.current);
    },
    [],
  );

  const labelZoom = Math.floor(viewState.zoom);
  const areaLayer = useAreaBoundaryLayer();
  const zoneLayer = useZoneLayer();
  const wardLayer = useWardLayer({
    data: wardsData,
    selectedWardId: selectedWard?.wardId ?? null,
    zoom: labelZoom,
    showAllColors: showAllWardColors,
    onHover: handleWardHover,
    onClick: handleWardClick,
  });
  const labelLayer = useWardLabelLayer({
    labels: labelPoints,
    zoom: labelZoom,
    showAllLabels: showAllWardColors,
  });
  const showIssues = Boolean(selectedWard);
  const issueGlowLayer = useIssueGlowLayer({
    issues: wardIssues,
    visible: showIssues,
  });
  const issueLayer = useIssueLayer({
    issues: wardIssues,
    visible: showIssues,
  });

  const layers = useMemo(
    () =>
      [areaLayer, zoneLayer, wardLayer, labelLayer, issueGlowLayer, issueLayer].filter(
        Boolean,
      ),
    [areaLayer, zoneLayer, wardLayer, labelLayer, issueGlowLayer, issueLayer],
  );

  const onViewStateChange = useCallback(({ viewState: next, interactionState }) => {
    const userDriving =
      interactionState?.isZooming ||
      interactionState?.isDragging ||
      interactionState?.isRotating;
    setViewState({
      ...next,
      maxPitch: 58,
      transitionDuration: userDriving ? 0 : (next.transitionDuration ?? 0),
    });
  }, []);

  if (!MAP_STYLE) {
    return (
      <div className="civic-map civic-map--error">
        <p className="map-loader__label">
          Set <code>VITE_MAPTILER_KEY</code> in a <code>.env</code> file (see .env.example).
        </p>
      </div>
    );
  }

  return (
    <div
      ref={mapRef}
      className={`civic-map${selectedWard && !showAllWardColors ? ' civic-map--hologram-active' : ''}${showAllWardColors ? ' civic-map--risk-overview' : ''}`}
    >
      <DeckGL
        viewState={viewState}
        onViewStateChange={onViewStateChange}
        controller={DECK_CONTROLLER}
        layers={layers}
        getCursor={({ isHovering }) => (isHovering ? 'pointer' : 'grab')}
      >
        <Map mapStyle={MAP_STYLE} attributionControl={false} />
      </DeckGL>

      {!wardsData && !loadError && <MapLoader />}
      {loadError && (
        <div className="map-loader map-loader--error" role="alert">
          <p className="map-loader__label">{loadError}</p>
        </div>
      )}

      <header className="civic-header">
        <div className="civic-header__copy">
          <p className="civic-header__brand">NagarRakshak</p>
          <h1 className="civic-header__title">Hyderabad Civic Intelligence</h1>
        </div>
        <p className="civic-header__meta">
          {wardsData
            ? `${wardsData.features.length} wards · live governance view`
            : loadError
              ? 'Ward layer unavailable'
              : 'Syncing administrative layers…'}
        </p>
      </header>

      <MapTooltip
        mapWidth={mapWidth}
        panelReserve={selectedWard ? WARD_PANEL_WIDTH : 0}
      />
    </div>
  );
}
