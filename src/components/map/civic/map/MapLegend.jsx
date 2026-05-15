import { useCivicStore } from '../civicStore';

const ITEMS = [
  { label: 'Low risk', color: 'var(--risk-low)' },
  { label: 'Moderate', color: 'var(--risk-moderate)' },
  { label: 'High risk', color: 'var(--risk-high)' },
];

export default function MapLegend() {
  const showAllWardColors = useCivicStore((s) => s.showAllWardColors);
  const toggleShowAllWardColors = useCivicStore((s) => s.toggleShowAllWardColors);

  return (
    <aside className="map-legend" aria-label="Risk legend">
      <p className="map-legend__title">Ward risk</p>
      <ul className="map-legend__list">
        {ITEMS.map((item) => (
          <li key={item.label} className="map-legend__item">
            <span className="map-legend__swatch" style={{ background: item.color }} />
            {item.label}
          </li>
        ))}
      </ul>
      <button
        type="button"
        className={`map-legend__toggle${showAllWardColors ? ' map-legend__toggle--on' : ''}`}
        onClick={toggleShowAllWardColors}
        aria-pressed={showAllWardColors}
      >
        {showAllWardColors ? 'Exit city overview' : 'City risk overview'}
      </button>
      <p className="map-legend__hint">
        {showAllWardColors
          ? 'Full risk map at any zoom — click again to return to ward focus'
          : 'Click a ward for details · nearby wards keep faded risk colors'}
      </p>
    </aside>
  );
}
