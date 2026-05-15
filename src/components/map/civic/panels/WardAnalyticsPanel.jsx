import { useMemo } from 'react';
import ComplaintCard from '../../../citizen/ComplaintCard';
import { useCivicStore } from '../civicStore';
import { extractAreaLabel } from '../utils/wardLabels';
import { normalizeDeptKey } from '../../../../lib/utils';

function severityToNumber(label) {
  const map = { Low: 1, Medium: 2, High: 3, Critical: 4, Emergency: 5 };
  return map[label] ?? 3;
}

function issueToComplaint(issue, wardName) {
  const isOverdue = issue.slaStatus === 'Overdue';
  const createdAt = new Date(Date.now() - (issue.daysOpen ?? 0) * 86400000).toISOString();
  const slaDeadline = isOverdue
    ? new Date(Date.now() - 86400000).toISOString()
    : new Date(Date.now() + 48 * 3600000).toISOString();

  const category =
    typeof issue.category === 'string'
      ? issue.category.charAt(0).toUpperCase() + issue.category.slice(1)
      : 'Civic issue';

  return {
    id: issue.id,
    dept: normalizeDeptKey(issue.department),
    severity: severityToNumber(issue.severity),
    status: isOverdue ? 'open' : 'in_progress',
    description: category,
    wards: { name: wardName },
    created_at: createdAt,
    sla_deadline: slaDeadline,
    sla_hours: 72,
    assigned_to: isOverdue ? null : 'ward-demo',
    image_url: null,
  };
}

function Metric({ label, value, tone }) {
  return (
    <div className={`ward-panel__metric ward-panel__metric--${tone ?? 'default'}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export default function WardAnalyticsPanel() {
  const selectedWard = useCivicStore((s) => s.selectedWard);
  const wardIssues = useCivicStore((s) => s.wardIssues);
  const clearSelectedWard = useCivicStore((s) => s.clearSelectedWard);

  const recentComplaints = useMemo(() => {
    if (!selectedWard) return [];
    const wardLabel = extractAreaLabel(selectedWard.wardName);
    return wardIssues.slice(0, 5).map((issue) => issueToComplaint(issue, wardLabel));
  }, [selectedWard, wardIssues]);

  if (!selectedWard) return null;

  const a = selectedWard.analytics;
  const title = extractAreaLabel(selectedWard.wardName);

  return (
    <aside className="ward-panel">
      <header className="ward-panel__header">
        <div>
          <p className="ward-panel__eyebrow">Ward intelligence</p>
          <h2 className="ward-panel__title">{title}</h2>
          <p className="ward-panel__subtitle">{selectedWard.wardName}</p>
        </div>
        <button
          type="button"
          className="ward-panel__close"
          onClick={clearSelectedWard}
          aria-label="Close panel"
        >
          ×
        </button>
      </header>

      <section className="ward-panel__section">
        <div className="ward-panel__score-row">
          <div className="ward-panel__score">
            <span>Civic score</span>
            <strong>{a.civic_score}</strong>
            <div className="ward-panel__meter" aria-hidden>
              <span
                className="ward-panel__meter-fill ward-panel__meter-fill--civic"
                style={{ width: `${Math.min(100, a.civic_score)}%` }}
              />
            </div>
          </div>
          <div className="ward-panel__score ward-panel__score--risk">
            <span>Risk index</span>
            <strong>{a.risk_score}</strong>
            <div className="ward-panel__meter" aria-hidden>
              <span
                className="ward-panel__meter-fill ward-panel__meter-fill--risk"
                style={{ width: `${Math.min(100, a.risk_score)}%` }}
              />
            </div>
          </div>
        </div>
        <div className="ward-panel__grid">
          <Metric label="Active complaints" value={a.active_complaints} />
          <Metric label="Unresolved" value={a.unresolved_complaints} tone="warn" />
          <Metric label="SLA breach" value={`${a.sla_breach_pct}%`} tone="warn" />
          <Metric label="Escalations" value={a.escalation_count} />
        </div>
      </section>

      <section className="ward-panel__section ward-panel__section--primary">
        <h3 className="ward-panel__section-title">Primary issue</h3>
        <p className="ward-panel__issue-pill">{a.dominant_issue_category}</p>
        <p className="ward-panel__dept">{a.department}</p>
      </section>

      <section className="ward-panel__section ward-panel__section--reports">
        <h3 className="ward-panel__section-title">Recent reports</h3>
        {recentComplaints.length === 0 ? (
          <p className="ward-panel__empty">No pinpointed issues loaded.</p>
        ) : (
          <div className="ward-panel__report-cards">
            {recentComplaints.map((complaint) => (
              <ComplaintCard key={complaint.id} complaint={complaint} />
            ))}
          </div>
        )}
      </section>
    </aside>
  );
}
