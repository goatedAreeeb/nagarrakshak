import { useEffect, useState } from 'react';
import { Layers, Users, MessageSquare } from 'lucide-react';
import AppShell from '../../components/layout/AppShell';
import { supabase } from '../../lib/supabase';
import LoadingSpinner from '../../components/shared/LoadingSpinner';

/**
 * Read-only cluster review for MP-office staff. Clustering itself is computed by
 * the cluster-submissions Edge Function, which is service-role-only (batch/scheduled,
 * per REPORT_2 Part V §14) — staff review results here, they don't trigger runs from
 * the browser. To (re)run clustering for a geography during development/demo:
 *   supabase functions invoke cluster-submissions \
 *     --body '{"geographic_unit_id": "<uuid>"}' \
 *     -H "Authorization: Bearer <service-role-key>"
 * A scheduled job (pg_cron -> Edge Function, or a Supabase Scheduled Function) is the
 * intended production trigger — not built in this pass (post-MVP per the time-boxed plan).
 */
export default function ClustersReviewPage() {
  const [geoUnits, setGeoUnits] = useState([]);
  const [selectedGeoId, setSelectedGeoId] = useState('');
  const [clusters, setClusters] = useState([]);
  const [expandedClusterId, setExpandedClusterId] = useState(null);
  const [members, setMembers] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    supabase
      .from('geographic_units')
      .select('id, name, level')
      .order('name')
      .then(({ data, error: geoError }) => {
        if (geoError) {
          setError(geoError.message);
        } else {
          setGeoUnits(data || []);
          if (data?.length) setSelectedGeoId(data[0].id);
        }
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!selectedGeoId) {
      setClusters([]);
      return;
    }
    setLoading(true);
    supabase
      .from('theme_clusters')
      .select('id, label, taxonomy_key, unique_reporter_count, member_count, created_at')
      .eq('geographic_unit_id', selectedGeoId)
      .order('unique_reporter_count', { ascending: false })
      .then(({ data, error: clusterError }) => {
        if (clusterError) setError(clusterError.message);
        else setClusters(data || []);
        setLoading(false);
      });
  }, [selectedGeoId]);

  const toggleExpand = async (clusterId) => {
    if (expandedClusterId === clusterId) {
      setExpandedClusterId(null);
      return;
    }
    setExpandedClusterId(clusterId);
    if (members[clusterId]) return;

    const { data, error: memberError } = await supabase
      .from('submission_cluster_membership')
      .select('similarity_score, citizen_submissions(id, raw_text, channel, language, created_at)')
      .eq('cluster_id', clusterId);

    if (!memberError) {
      setMembers((prev) => ({ ...prev, [clusterId]: data || [] }));
    }
  };

  return (
    <AppShell title="Theme clusters" breadcrumb={[{ label: 'Staff' }, { label: 'Clusters' }]}>
      <div className="max-w-3xl mx-auto space-y-5">
        <p className="text-[15px] text-text-secondary">
          Submissions clustered by semantic similarity within one geography. Unique reporter counts
          are preserved — near-duplicate submissions are grouped for review, never deleted (research
          bible Part XVI).
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
        ) : clusters.length === 0 ? (
          <div className="card-elevated p-8 text-center text-text-secondary">
            <Layers className="w-10 h-10 mx-auto mb-3 text-text-hint" strokeWidth={1.5} />
            No clusters yet for this geography. Clusters appear once submissions have been processed
            and the cluster-submissions pipeline has run.
          </div>
        ) : (
          <div className="space-y-3">
            {clusters.map((cluster) => (
              <div key={cluster.id} className="card-elevated overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleExpand(cluster.id)}
                  className="w-full text-left p-4 flex items-center justify-between gap-4"
                >
                  <div>
                    <p className="font-semibold text-text-primary">
                      {cluster.label || cluster.taxonomy_key || 'Unlabeled cluster'}
                    </p>
                    <p className="text-xs text-text-muted mt-1">
                      Created {new Date(cluster.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 shrink-0 text-sm">
                    <span className="flex items-center gap-1.5 text-text-secondary">
                      <Users size={14} />
                      {cluster.unique_reporter_count} unique
                    </span>
                    <span className="flex items-center gap-1.5 text-text-secondary">
                      <MessageSquare size={14} />
                      {cluster.member_count} submissions
                    </span>
                  </div>
                </button>

                {expandedClusterId === cluster.id && (
                  <div className="border-t border-border-default p-4 space-y-2 bg-bg-surface">
                    {!members[cluster.id] ? (
                      <LoadingSpinner size="sm" />
                    ) : members[cluster.id].length === 0 ? (
                      <p className="text-sm text-text-muted">No member submissions found.</p>
                    ) : (
                      members[cluster.id].map((m, i) => (
                        <div key={i} className="text-sm border-l-2 border-l-border-strong pl-3 py-1">
                          <p className="text-text-primary line-clamp-2">
                            {m.citizen_submissions?.raw_text || '(no text — media-only submission)'}
                          </p>
                          <p className="text-xs text-text-muted mt-0.5">
                            {m.citizen_submissions?.channel} · {m.citizen_submissions?.language || 'unknown language'} ·
                            similarity {m.similarity_score != null ? Math.round(m.similarity_score * 100) : '—'}%
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
