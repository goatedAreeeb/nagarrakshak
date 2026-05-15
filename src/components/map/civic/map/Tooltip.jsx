import { useCivicStore } from '../civicStore';
import { extractAreaLabel } from '../utils/wardLabels';

const TOOLTIP_WIDTH = 260;
const TOOLTIP_HEIGHT = 160;
const OFFSET = 14;
const EDGE_PAD = 12;

export default function MapTooltip({ mapWidth = 0, panelReserve = 0 }) {
  const hoverInfo = useCivicStore((s) => s.hoverInfo);
  const selectedWard = useCivicStore((s) => s.selectedWard);

  if (!hoverInfo || selectedWard?.wardId === hoverInfo.wardId) return null;

  const label = extractAreaLabel(hoverInfo.wardName);
  const boundsW = mapWidth > 0 ? mapWidth : window.innerWidth;
  const maxLeft = boundsW - panelReserve - TOOLTIP_WIDTH - EDGE_PAD;
  const left = Math.min(
    Math.max(hoverInfo.x + OFFSET, EDGE_PAD),
    Math.max(maxLeft, EDGE_PAD),
  );
  const top = Math.min(
    Math.max(hoverInfo.y + OFFSET, EDGE_PAD),
    window.innerHeight - TOOLTIP_HEIGHT - EDGE_PAD,
  );

  return (
    <div className="map-tooltip" style={{ left, top }}>
      <p className="map-tooltip__title">{label}</p>
      <div className="map-tooltip__grid">
        <span>Civic score</span><strong>{hoverInfo.civicScore}</strong>
        <span>Active issues</span><strong>{hoverInfo.activeIssues}</strong>
        <span>Unresolved</span><strong>{hoverInfo.unresolvedCount}</strong>
        <span>Top category</span><strong className="map-tooltip__cap">{hoverInfo.majorCategory}</strong>
      </div>
      <p className="map-tooltip__meta">{hoverInfo.department} · SLA breach {hoverInfo.slaBreachPct}%</p>
    </div>
  );
}
