export default function MapLoader() {
  return (
    <div className="map-loader" role="status" aria-live="polite">
      <div className="map-loader__ring" aria-hidden />
      <p className="map-loader__label">Loading Hyderabad wards…</p>
    </div>
  );
}
