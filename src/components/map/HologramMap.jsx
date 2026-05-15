import { useCallback, useEffect, useMemo, useState } from 'react';
import DeckGL from '@deck.gl/react';
import { GeoJsonLayer, ScatterplotLayer, TextLayer } from '@deck.gl/layers';
import { FlyToInterpolator } from '@deck.gl/core';
import MapboxMap from 'react-map-gl/mapbox';
import MaplibreMap from 'react-map-gl/maplibre';
import 'mapbox-gl/dist/mapbox-gl.css';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Layers, MapPin, Type } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { cn, severityColor } from '../../lib/utils';
import { buildWardFeaturesFromRows, mergeWardLiveData } from './wardGeoJSON';
import { applyComplaintStats } from '../../lib/mapWardStats';
import { HYDERABAD_MAP_VIEW } from '../../data/hyderabadWards';
import WardTooltip from './WardTooltip';
import IssuePanel from './IssuePanel';
import LoadingSpinner from '../shared/LoadingSpinner';
import {
  hasValidMapboxToken,
  MAPBOX_TOKEN,
  getHologramMapStyle,
} from '../../lib/mapConfig';
const ISSUE_ZOOM_MIN = 11;
const LABEL_ZOOM_MIN = 10.3;
const ACTIVE_STATUSES = ['open', 'assigned', 'in_progress', 'reopened'];

function healthRgb(score) {
  const t = Math.max(0, Math.min(100, score ?? 0)) / 100;
  return [
    Math.round(239 * (1 - t) + 16 * t),
    Math.round(68 * (1 - t) + 185 * t),
    Math.round(68 * (1 - t) + 129 * t),
    200,
  ];
}

function flyTo(view, { longitude, latitude, zoom = 14, pitch = 55, bearing = -8 }) {
  return {
    ...view,
    longitude,
    latitude,
    zoom,
    pitch,
    bearing,
    transitionDuration: 1800,
    transitionInterpolator: new FlyToInterpolator({ speed: 1.4 }),
  };
}

function LayerToggle({ label, icon: Icon, active, onToggle }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onToggle}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onToggle()}
      className={cn(
        'flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors',
        active
          ? 'border-accent-cyan/50 bg-accent-cyan/10 text-accent-cyan'
          : 'border-border-default bg-bg-surface/90 text-text-secondary hover:border-border-strong'
      )}
    >
      <Icon size={14} aria-hidden />
      {label}
    </div>
  );
}

export default function HologramMap() {
  const [viewState, setViewState] = useState(HYDERABAD_MAP_VIEW);
  const [layers, setLayers] = useState({ wards: true, issues: true, labels: true });
  const [wardGeo, setWardGeo] = useState(() => buildWardFeaturesFromRows());
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hover, setHover] = useState({ ward: null, x: 0, y: 0 });
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [panelOpen, setPanelOpen] = useState(false);

  const loadMapData = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    const [wardsRes, allComplaintsRes, activeComplaintsRes] = await Promise.all([
      supabase.from('wards').select('*').order('id'),
      supabase.from('complaints').select('id, lat, lng, status, severity, ward_id'),
      supabase
        .from('complaints')
        .select(
          'id, lat, lng, description, dept, division, severity, status, sla_hours, sla_deadline, ward_id, address, created_at'
        )
        .in('status', ACTIVE_STATUSES)
        .order('created_at', { ascending: false }),
    ]);

    const base = buildWardFeaturesFromRows(wardsRes.data || []);
    const merged = mergeWardLiveData(base, wardsRes.data || []);
    setWardGeo(applyComplaintStats(merged, allComplaintsRes.data || []));
    setComplaints(activeComplaintsRes.data || []);
    if (showSpinner) setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;

    (async () => {
      if (!active) return;
      await loadMapData(true);
    })();

    const channel = supabase
      .channel('map-complaints')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'complaints' }, () => {
        loadMapData(false);
      })
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [loadMapData]);

  const cityHealth = useMemo(() => {
    const feats = wardGeo?.features || [];
    if (!feats.length) return 0;
    const sum = feats.reduce((acc, f) => acc + (f.properties.health_score ?? 0), 0);
    return Math.round(sum / feats.length);
  }, [wardGeo]);

  const showIssues = layers.issues && viewState.zoom >= ISSUE_ZOOM_MIN;
  const showLabels = layers.labels && viewState.zoom >= LABEL_ZOOM_MIN;

  const deckLayers = useMemo(() => {
    const result = [];

    if (layers.wards) {
      result.push(
        new GeoJsonLayer({
          id: 'wards-extruded',
          data: wardGeo,
          pickable: true,
          extruded: true,
          wireframe: true,
          filled: true,
          getElevation: (f) => Math.max(80, (f.properties.open_issues ?? 0) * 70 + 40),
          elevationScale: 1,
          getFillColor: (f) => healthRgb(f.properties.health_score),
          getLineColor: [0, 212, 255, 120],
          lineWidthMinPixels: 1,
          onHover: (info) => {
            if (info.object) {
              setHover({
                ward: info.object.properties,
                x: info.x,
                y: info.y,
              });
            } else {
              setHover({ ward: null, x: 0, y: 0 });
            }
          },
          onClick: (info) => {
            if (!info.object) return;
            const p = info.object.properties;
            setViewState((v) => flyTo(v, { longitude: p.lng, latitude: p.lat, zoom: 13.2 }));
          },
          updateTriggers: {
            getFillColor: [wardGeo],
            getElevation: [wardGeo],
          },
        })
      );
    }

    if (showLabels) {
      result.push(
        new TextLayer({
          id: 'ward-labels',
          data: wardGeo.features,
          pickable: false,
          getPosition: (f) => [f.properties.lng, f.properties.lat],
          getText: (f) => f.properties.ward_name,
          getSize: 12,
          getColor: [226, 232, 240, 230],
          getAngle: 0,
          getTextAnchor: 'middle',
          getAlignmentBaseline: 'center',
          fontFamily: 'Inter, system-ui, sans-serif',
          fontWeight: 600,
          outlineWidth: 2,
          outlineColor: [7, 13, 28, 220],
        })
      );
    }

    if (showIssues && complaints.length) {
      result.push(
        new ScatterplotLayer({
          id: 'issues-scatter',
          data: complaints,
          pickable: true,
          radiusScale: 6,
          radiusMinPixels: 4,
          radiusMaxPixels: 22,
          getPosition: (d) => [d.lng, d.lat],
          getRadius: (d) => 3 + (d.severity ?? 3) * 2.2,
          getFillColor: (d) => {
            const hex = severityColor(d.severity ?? 3);
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);
            return [r, g, b, 220];
          },
          onClick: (info) => {
            if (!info.object) return;
            const issue = info.object;
            setSelectedIssue(issue);
            setPanelOpen(true);
            setViewState((v) =>
              flyTo(v, { longitude: issue.lng, latitude: issue.lat, zoom: 15.5, pitch: 60 })
            );
          },
        })
      );
    }

    return result;
  }, [wardGeo, complaints, layers, showIssues, showLabels]);

  const onViewStateChange = useCallback(({ viewState: next }) => {
    setViewState(next);
  }, []);

  const toggleLayer = (key) => {
    setLayers((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const useMapbox = hasValidMapboxToken();
  const mapStyle = getHologramMapStyle();

  return (
    <div className="relative h-full w-full overflow-hidden bg-bg-base">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex justify-center px-4 pt-4">
        <div className="pointer-events-auto w-full max-w-xl rounded-xl border border-border-glow bg-bg-surface/95 px-4 py-3 shadow-glow-cyan backdrop-blur-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-xs font-medium uppercase tracking-wider text-text-hint">
                Greater Hyderabad · city health
              </div>
              <div className="mt-0.5 text-2xl font-bold tabular-nums text-accent-cyan">{cityHealth}</div>
            </div>
            <div className="flex-1">
              <div className="h-2.5 overflow-hidden rounded-full bg-bg-elevated">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-accent-red via-accent-amber to-accent-emerald transition-all duration-500"
                  style={{ width: `${cityHealth}%` }}
                />
              </div>
            </div>
          </div>
          <div className="mt-2 flex justify-between text-[10px] text-text-hint">
            <span>{wardGeo?.features?.length ?? 0} GHMC circles</span>
            <span>Hover for population &amp; fixes</span>
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-6 left-4 z-20">
        <div className="pointer-events-auto rounded-xl border border-border-default bg-bg-surface/95 p-3 backdrop-blur-sm">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-hint">
            Area health score
          </div>
          <div className="flex h-2 w-36 overflow-hidden rounded-full">
            <div className="flex-1 bg-accent-red" title="0-33" />
            <div className="flex-1 bg-accent-amber" title="34-66" />
            <div className="flex-1 bg-accent-emerald" title="67-100" />
          </div>
          <div className="mt-3 text-xs font-semibold uppercase tracking-wide text-text-hint">
            Issue severity
          </div>
          <div className="mt-1.5 flex flex-col gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <div key={n} className="flex items-center gap-2 text-xs text-text-secondary">
                <div
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: severityColor(n) }}
                />
                Level {n}
              </div>
            ))}
          </div>
          {!showIssues && layers.issues && (
            <div className="mt-2 text-[10px] text-accent-amber">Zoom in slightly to see live issue pins</div>
          )}
        </div>
      </div>

      <div className="pointer-events-auto absolute bottom-6 right-4 z-20 flex flex-col gap-2">
        <LayerToggle
          label="Areas"
          icon={Layers}
          active={layers.wards}
          onToggle={() => toggleLayer('wards')}
        />
        <LayerToggle
          label="Issues"
          icon={MapPin}
          active={layers.issues}
          onToggle={() => toggleLayer('issues')}
        />
        <LayerToggle
          label="Labels"
          icon={Type}
          active={layers.labels}
          onToggle={() => toggleLayer('labels')}
        />
      </div>

      {loading && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-bg-base/60 backdrop-blur-[2px]">
          <LoadingSpinner size="lg" />
        </div>
      )}

      <DeckGL
        viewState={viewState}
        onViewStateChange={onViewStateChange}
        controller={{ touchRotate: true, inertia: true }}
        layers={deckLayers}
        getCursor={({ isHovering }) => (isHovering ? 'pointer' : 'grab')}
        style={{ width: '100%', height: '100%' }}
      >
        {useMapbox ? (
          <MapboxMap
            mapboxAccessToken={MAPBOX_TOKEN}
            mapStyle={mapStyle}
            attributionControl={false}
            reuseMaps
          />
        ) : (
          <MaplibreMap mapStyle={mapStyle} attributionControl={false} reuseMaps />
        )}
      </DeckGL>

      <WardTooltip ward={hover.ward} x={hover.x} y={hover.y} visible={Boolean(hover.ward)} />

      <IssuePanel
        issue={selectedIssue}
        open={panelOpen}
        onClose={() => {
          setPanelOpen(false);
          setSelectedIssue(null);
        }}
      />
    </div>
  );
}
