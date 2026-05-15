import { useEffect, useState, useCallback, useRef } from 'react';
import { MapPin, Navigation, Loader2, AlertCircle, Crosshair } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { findNearestWard } from '../../../lib/utils';
import {
  getCurrentPosition,
  reverseGeocode,
  isWithinHyderabad,
  formatCoordLabel,
} from '../../../lib/geolocation';
import LoadingSpinner from '../../shared/LoadingSpinner';
import MapPreviewPanel from '../../shared/MapPreviewPanel';

function wardDistanceKm(ward, lat, lng) {
  if (!ward?.lat || !ward?.lng) return null;
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(ward.lat - lat);
  const dLng = toRad(ward.lng - lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat)) * Math.cos(toRad(ward.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function StepLocation({
  lat,
  setLat,
  lng,
  setLng,
  address,
  setAddress,
  wardId,
  setWardId,
  nearestWard,
  setNearestWard,
}) {
  const [loading, setLoading] = useState(false);
  const [loadingWards, setLoadingWards] = useState(true);
  const [error, setError] = useState('');
  const [gpsAccuracy, setGpsAccuracy] = useState(null);
  const [locationSource, setLocationSource] = useState(null);
  const [wardDistance, setWardDistance] = useState(null);
  const wardsRef = useRef([]);
  const initDone = useRef(false);
  const lastWardCoords = useRef('');

  useEffect(() => {
    supabase
      .from('wards')
      .select('id, name, lat, lng, zone')
      .then(({ data, error: wardError }) => {
        if (wardError) setError('Could not load ward data.');
        else wardsRef.current = data || [];
        setLoadingWards(false);
      });
  }, []);

  const assignWardForCoords = useCallback(
    (latitude, longitude) => {
      const key = `${latitude.toFixed(5)},${longitude.toFixed(5)}`;
      if (lastWardCoords.current === key && wardId) return nearestWard;

      const ward = findNearestWard(wardsRef.current, latitude, longitude);
      lastWardCoords.current = key;

      if (ward) {
        const km = wardDistanceKm(ward, latitude, longitude);
        setWardDistance(km);
        if (ward.id !== wardId) setWardId(ward.id);
        if (nearestWard?.id !== ward.id) setNearestWard(ward);
        return ward;
      }

      setWardDistance(null);
      if (wardId != null) setWardId(null);
      if (nearestWard != null) setNearestWard(null);
      return null;
    },
    [wardId, nearestWard, setWardId, setNearestWard]
  );

  const applyCoords = useCallback(
    async (latitude, longitude, { accuracy = null, source = 'gps' } = {}) => {
      setLat(latitude);
      setLng(longitude);
      setGpsAccuracy(accuracy);
      setLocationSource(source);
      setError('');

      if (wardsRef.current.length > 0) {
        assignWardForCoords(latitude, longitude);
      }

      const place = await reverseGeocode(latitude, longitude);
      setAddress(place);

      if (!isWithinHyderabad(latitude, longitude)) {
        setError(
          'Your GPS is outside Greater Hyderabad municipal limits. We still route to the nearest GHMC ward centroid for assignment.'
        );
      }
    },
    [setLat, setLng, setAddress, assignWardForCoords]
  );

  const detectLocation = useCallback(async () => {
    setLoading(true);
    setError('');
    lastWardCoords.current = '';

    try {
      const pos = await getCurrentPosition();
      const { latitude, longitude, accuracy } = pos.coords;

      if (
        latitude == null ||
        longitude == null ||
        Number.isNaN(latitude) ||
        Number.isNaN(longitude)
      ) {
        throw new Error('Could not read a valid GPS position.');
      }

      await applyCoords(latitude, longitude, { accuracy, source: 'gps' });
    } catch (err) {
      const code = err?.code;
      if (code === 1) {
        setError('Location permission denied. Allow location access in browser settings, then tap refresh.');
      } else if (code === 2) {
        setError('Position unavailable. Try again outdoors or check device location services.');
      } else if (code === 3) {
        setError('Location request timed out. Tap refresh to try again.');
      } else {
        setError(err?.message || 'Could not detect your location.');
      }
    } finally {
      setLoading(false);
    }
  }, [applyCoords]);

  useEffect(() => {
    if (loadingWards || wardsRef.current.length === 0 || initDone.current) return;
    initDone.current = true;

    if (lat != null && lng != null) {
      assignWardForCoords(lat, lng);
    } else {
      detectLocation();
    }
  }, [loadingWards, lat, lng, assignWardForCoords, detectLocation]);

  useEffect(() => {
    if (lat == null || lng == null || wardsRef.current.length === 0) return;
    assignWardForCoords(lat, lng);
  }, [lat, lng, loadingWards]);

  const outsideGhmc = lat != null && lng != null && !isWithinHyderabad(lat, lng);

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-text-primary">Pin location</h2>
        <p className="mt-1 text-sm text-text-secondary">
          We read your device GPS live. Your exact address is saved; GHMC ward is the nearest
          municipal zone centroid.
        </p>
      </div>

      {error && (
        <p className="mb-4 flex items-start gap-2 rounded-xl border border-white/15 bg-white/[0.06] px-3 py-2 text-sm text-text-secondary">
          <AlertCircle size={16} className="mt-0.5 shrink-0 text-amber-300" />
          {error}
        </p>
      )}

      {loadingWards ? (
        <div className="flex justify-center py-16">
          <LoadingSpinner size="lg" />
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={detectLocation}
            disabled={loading}
            className="btn-primary mb-4 flex w-full items-center justify-center gap-2 disabled:opacity-60"
          >
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Getting live GPS…
              </>
            ) : (
              <>
                <Navigation size={18} />
                {lat != null ? 'Refresh live GPS' : 'Use my current location'}
              </>
            )}
          </button>

          {lat != null && lng != null && (
            <>
              {locationSource === 'gps' && (
                <p className="mb-3 flex items-center gap-2 text-xs text-emerald-300/90">
                  <Crosshair size={14} />
                  Live GPS
                  {gpsAccuracy != null && ` · ±${Math.round(gpsAccuracy)}m`}
                </p>
              )}

              <div className="mb-6">
                <MapPreviewPanel
                  lat={lat}
                  lng={lng}
                  address={address}
                  aspectClass="aspect-[2/1]"
                  minHeight="180px"
                  showActions={false}
                  roundedClass="rounded-xl"
                />
              </div>

              <div className="space-y-4">
                <div className="glass-inset flex items-start gap-3 p-3">
                  <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-text-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                      Your coordinates
                    </p>
                    <p className="mt-1 font-mono text-sm text-text-primary">
                      {lat.toFixed(6)}, {lng.toFixed(6)}
                    </p>
                    {address && (
                      <p className="mt-2 text-sm text-text-secondary leading-snug">{address}</p>
                    )}
                  </div>
                </div>

                {nearestWard && wardId && (
                  <div className="glass-inset border-l-2 border-l-white/30 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                      Nearest GHMC ward {outsideGhmc ? '(centroid)' : ''}
                    </p>
                    <p className="mt-1 text-base font-semibold text-text-primary">{nearestWard.name}</p>
                    {nearestWard.zone && (
                      <span className="badge-cyan mt-2 inline-block">{nearestWard.zone} Zone</span>
                    )}
                    {wardDistance != null && (
                      <p className="mt-2 text-xs text-text-muted">
                        ~{wardDistance.toFixed(1)} km from ward center
                        {outsideGhmc && ' · You are outside GHMC city limits; routing uses nearest zone'}
                      </p>
                    )}
                  </div>
                )}

                <div>
                  <label htmlFor="address" className="mb-1.5 block text-sm text-text-secondary">
                    Address
                  </label>
                  <input
                    id="address"
                    type="text"
                    className="input-field"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Street, landmark, area"
                  />
                  {address === formatCoordLabel(lat, lng) && (
                    <p className="mt-1.5 text-xs text-text-muted">
                      Add a landmark if the address line only shows coordinates.
                    </p>
                  )}
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
