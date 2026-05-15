import { severityColor, severityLabel } from '../../lib/utils';

const dotSizes = { sm: 'w-1.5 h-1.5', md: 'w-2 h-2', lg: 'w-2.5 h-2.5' };

export default function SeverityBadge({ severity = 3, size = 'md', showLabel = true }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <span
            key={i}
            className={`rounded-full ${dotSizes[size]}`}
            style={{
              backgroundColor: i <= severity ? severityColor(severity) : '#1e3a5f',
            }}
          />
        ))}
      </div>
      {showLabel && (
        <span className="text-sm text-text-secondary">
          {severityLabel(severity)} — {severity}/5
        </span>
      )}
    </div>
  );
}
