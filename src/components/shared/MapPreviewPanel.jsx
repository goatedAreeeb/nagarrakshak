import { memo, useState, useCallback, useMemo, useEffect } from 'react';
import { MapPin, Navigation, ExternalLink, Maximize2, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { openStreetMapEmbedUrl } from '../../lib/geolocation';
import {
  googleMapsViewUrl,
  googleMapsDirectionsUrl,
  googleMapsEmbedUrl,
  googleMapsStaticUrl,
  hasGoogleMapsKey,
} from '../../lib/googleMaps';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

const loadedMapKeys = new Set();

function mapboxStaticUrl(lat, lng, width = 800, height = 400) {
  if (!MAPBOX_TOKEN || MAPBOX_TOKEN === 'your-mapbox-public-token') return null;
  const pin = `pin-l+ffffff(${lng},${lat})`;
  return `https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/${pin}/${lng},${lat},16,0/${width}x${height}@2x?access_token=${MAPBOX_TOKEN}`;
}

function stableMapKey(lat, lng) {
  return `${Number(lat).toFixed(4)},${Number(lng).toFixed(4)}`;
}

const MapIframe = memo(function MapIframe({ src, title, className, onLoad }) {
  return (
    <iframe
      title={title}
      src={src}
      className={className}
      loading="lazy"
      referrerPolicy="no-referrer-when-downgrade"
      allowFullScreen
      onLoad={onLoad}
    />
  );
});

/**
 * Stable map preview: static image by default (no flicker), live embed only in expand modal.
 */
export default function MapPreviewPanel({
  lat,
  lng,
  address,
  className,
  aspectClass = 'aspect-[16/10]',
  minHeight = '200px',
  roundedClass = 'rounded-xl',
  showHeader = false,
  showActions = true,
  liveMapLabel = 'Live map',
}) {
  const mapKey = lat != null && lng != null ? stableMapKey(lat, lng) : '';
  const [loaded, setLoaded] = useState(() => loadedMapKeys.has(mapKey));
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setLoaded(loadedMapKeys.has(mapKey));
  }, [mapKey]);

  const staticUrl = useMemo(() => {
    if (lat == null || lng == null) return null;
    const sLat = Number(Number(lat).toFixed(4));
    const sLng = Number(Number(lng).toFixed(4));
    return (
      googleMapsStaticUrl(sLat, sLng, { width: 640, height: 320 }) ||
      mapboxStaticUrl(sLat, sLng)
    );
  }, [mapKey, lat, lng]);

  const embedUrl = useMemo(
    () => (lat != null && lng != null ? googleMapsEmbedUrl(lat, lng) : null),
    [lat, lng]
  );
  const osmEmbed = useMemo(
    () => (lat != null && lng != null ? openStreetMapEmbedUrl(lat, lng) : null),
    [lat, lng]
  );

  const liveEmbedSrc = embedUrl || osmEmbed;
  const viewUrl = lat != null && lng != null ? googleMapsViewUrl(lat, lng, address) : '';
  const directionsUrl = lat != null && lng != null ? googleMapsDirectionsUrl(lat, lng) : '';

  const handleLoaded = useCallback(() => {
    if (mapKey) loadedMapKeys.add(mapKey);
    setLoaded(true);
  }, [mapKey]);

  if (lat == null || lng == null) return null;

  const mapBody = (
    <div
      className={cn('relative w-full overflow-hidden bg-[#0a0f18]', aspectClass)}
      style={{ minHeight }}
    >
      {!loaded && (
        <div className="absolute inset-0 z-[1] skeleton animate-pulse" aria-hidden />
      )}

      {staticUrl ? (
        <button
          type="button"
          onClick={() => (liveEmbedSrc ? setExpanded(true) : window.open(viewUrl, '_blank'))}
          className="relative h-full w-full"
          aria-label={liveEmbedSrc ? 'Open live map' : 'Open in Google Maps'}
        >
          <img
            key={mapKey}
            src={staticUrl}
            alt={address ? `Map near ${address}` : 'Location map'}
            className={cn(
              'h-full w-full object-cover transition-opacity duration-200',
              loaded ? 'opacity-100' : 'opacity-0'
            )}
            onLoad={handleLoaded}
            onError={handleLoaded}
          />
          {liveEmbedSrc && loaded && (
            <span className="absolute bottom-3 right-3 rounded-full border border-white/20 bg-black/70 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-md">
              Tap for {liveMapLabel.toLowerCase()}
            </span>
          )}
        </button>
      ) : liveEmbedSrc ? (
        <MapIframe
          src={liveEmbedSrc}
          title="Location map"
          className={cn(
            'h-full w-full border-0 transition-opacity duration-200',
            loaded ? 'opacity-100' : 'opacity-0'
          )}
          onLoad={handleLoaded}
        />
      ) : (
        <button
          type="button"
          onClick={() => viewUrl && window.open(viewUrl, '_blank')}
          className="flex h-full w-full flex-col items-center justify-center gap-2 p-6 text-center"
        >
          <MapPin className="h-10 w-10 text-text-muted" />
          <span className="text-sm text-text-secondary">
            {hasGoogleMapsKey() ? 'Open in Google Maps' : 'Add Google Maps API key for preview'}
          </span>
        </button>
      )}

      {liveEmbedSrc && staticUrl && loaded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="absolute right-3 top-3 z-[2] flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-black/60 text-white backdrop-blur-md hover:bg-black/70"
          aria-label="Expand map"
        >
          <Maximize2 size={16} />
        </button>
      )}
    </div>
  );

  return (
    <>
      <div className={cn('overflow-hidden border border-glass-border', roundedClass, className)}>
        {showHeader && (
          <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
            <div className="flex min-w-0 items-center gap-2">
              <MapPin size={14} className="shrink-0" />
              <span className="truncate text-xs text-text-muted">{address || 'Location'}</span>
            </div>
            {liveEmbedSrc && (
              <button
                type="button"
                onClick={() => setExpanded(true)}
                className="text-[10px] font-semibold uppercase tracking-wider text-cyan-300/90"
              >
                {liveMapLabel}
              </button>
            )}
          </div>
        )}
        {mapBody}
        {showActions && (
          <div className="flex gap-2 border-t border-white/10 p-2">
            <button
              type="button"
              onClick={() => window.open(viewUrl, '_blank')}
              className="btn-secondary flex-1 text-xs"
            >
              <ExternalLink size={14} />
              Open in Maps
            </button>
            <button
              type="button"
              onClick={() => window.open(directionsUrl, '_blank')}
              className="btn-primary flex-1 text-xs"
            >
              <Navigation size={14} />
              Directions
            </button>
          </div>
        )}
      </div>

      {expanded && liveEmbedSrc && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4" role="presentation">
          <button
            type="button"
            className="absolute inset-0 bg-black/85 backdrop-blur-md"
            onClick={() => setExpanded(false)}
            aria-label="Close map"
          />
          <div
            className="glass-modal-card relative flex h-[min(85vh,680px)] w-full max-w-4xl flex-col overflow-hidden"
            role="dialog"
            aria-modal="true"
          >
            <header className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3">
              <p className="truncate text-sm font-semibold">
                {address || `${lat.toFixed(5)}, ${lng.toFixed(5)}`}
              </p>
              <button
                type="button"
                onClick={() => setExpanded(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.06]"
              >
                <X size={18} />
              </button>
            </header>
            <div className="min-h-0 flex-1">
              <MapIframe src={liveEmbedSrc} title="Live map" className="h-full w-full border-0" />
            </div>
            {showActions && (
              <footer className="flex shrink-0 gap-2 border-t border-white/10 p-3">
                <button type="button" onClick={() => window.open(viewUrl, '_blank')} className="btn-secondary flex-1">
                  Open in Maps
                </button>
                <button type="button" onClick={() => window.open(directionsUrl, '_blank')} className="btn-primary flex-1">
                  Directions
                </button>
              </footer>
            )}
          </div>
        </div>
      )}
    </>
  );
}
