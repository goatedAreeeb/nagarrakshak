import { useEffect, useState } from 'react';
import { Database, ExternalLink, AlertTriangle } from 'lucide-react';
import AppShell from '../../components/layout/AppShell';
import { supabase } from '../../lib/supabase';
import LoadingSpinner from '../../components/shared/LoadingSpinner';

const CONFIDENCE_STYLES = {
  high: 'text-accent-emerald',
  medium: 'text-accent-amber',
  low: 'text-accent-red',
};

/**
 * Read-only evidence browser for MP-office staff. Every figure here shows its
 * source, retrieval date, and freshness label — never a bare number (research
 * bible Part XX: "hardcoded demo data presented as live integration" is an
 * explicitly named weak-solution pattern; this page is honest about which
 * records are live-fetched (LGD) vs. cached single samples (UDISE+, Census).
 */
export default function EvidencePage() {
  const [geoUnits, setGeoUnits] = useState([]);
  const [selectedGeoId, setSelectedGeoId] = useState('');
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    supabase
      .from('geographic_units')
      .select('id, name, level')
      .order('name')
      .then(({ data, error: geoError }) => {
        if (geoError) setError(geoError.message);
        else {
          setGeoUnits(data || []);
          if (data?.length) setSelectedGeoId(data[0].id);
        }
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!selectedGeoId) {
      setRecords([]);
      return;
    }
    setLoading(true);
    supabase
      .from('evidence_records')
      .select('id, category, metric_name, metric_value, unit, retrieved_at, dataset_version, freshness_label, confidence, raw_payload, dataset_sources(name, source_url, is_live)')
      .eq('geographic_unit_id', selectedGeoId)
      .order('category')
      .then(({ data, error: evError }) => {
        if (evError) setError(evError.message);
        else setRecords(data || []);
        setLoading(false);
      });
  }, [selectedGeoId]);

  return (
    <AppShell title="Evidence" breadcrumb={[{ label: 'Staff' }, { label: 'Evidence' }]}>
      <div className="max-w-3xl mx-auto space-y-5">
        <p className="text-[15px] text-text-secondary">
          Public-dataset evidence joined to each geography. Every figure shows its source,
          retrieval date, and freshness — no number here is presented as more current or more
          representative than it actually is.
        </p>

        {geoUnits.length > 0 && (
          <div>
            <label htmlFor="geo-select" className="mb-1.5 block text-sm text-text-secondary">
              Geography
            </label>
            <select
              id="geo-select"
              className="input-field"
              value={selectedGeoId}
              onChange={(e) => setSelectedGeoId(e.target.value)}
            >
              {geoUnits.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} ({g.level})
                </option>
              ))}
            </select>
          </div>
        )}

        {error && (
          <p className="text-sm text-accent-red bg-accent-red/10 border border-accent-red/30 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner size="lg" />
          </div>
        ) : records.length === 0 ? (
          <div className="card-elevated p-8 text-center text-text-secondary">
            <Database className="w-10 h-10 mx-auto mb-3 text-text-hint" strokeWidth={1.5} />
            No evidence records for this geography yet.
          </div>
        ) : (
          <div className="space-y-3">
            {records.map((rec) => (
              <div key={rec.id} className="card-elevated p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-text-hint">{rec.category}</p>
                    <p className="text-lg font-semibold text-text-primary mt-0.5">
                      {rec.metric_value?.toLocaleString()} {rec.unit}
                    </p>
                    <p className="text-sm text-text-secondary mt-0.5">
                      {rec.metric_name.replace(/_/g, ' ')}
                    </p>
                  </div>
                  <span className={`text-xs font-semibold uppercase ${CONFIDENCE_STYLES[rec.confidence] || ''}`}>
                    {rec.confidence} confidence
                  </span>
                </div>

                <div className="mt-3 pt-3 border-t border-border-default text-xs text-text-muted space-y-1">
                  <p className="flex items-center gap-1.5">
                    <Database size={12} />
                    Source: <span className="text-text-secondary">{rec.dataset_sources?.name}</span>
                    {rec.dataset_sources?.is_live ? (
                      <span className="badge-cyan text-[10px] px-1.5 py-0">live-fetched</span>
                    ) : (
                      <span className="badge-amber text-[10px] px-1.5 py-0">cached sample</span>
                    )}
                  </p>
                  <p>Dataset version: {rec.dataset_version}</p>
                  <p>Retrieved: {new Date(rec.retrieved_at).toLocaleDateString()}</p>
                  <p className="flex items-start gap-1.5 text-accent-amber">
                    <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                    {rec.freshness_label}
                  </p>
                  {rec.dataset_sources?.source_url && (
                    <p className="flex items-center gap-1.5 truncate">
                      <ExternalLink size={12} className="shrink-0" />
                      <span className="truncate">{rec.dataset_sources.source_url}</span>
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
