import { useEffect, useState } from 'react';
import { ScrollText } from 'lucide-react';
import AppShell from '../../components/layout/AppShell';
import { supabase } from '../../lib/supabase';
import LoadingSpinner from '../../components/shared/LoadingSpinner';

/** Read-only, append-only audit trail. Every human_overrides row has a matching
 *  audit_events row written atomically by log-override — this page just displays them. */
export default function AuditLogPage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    supabase
      .from('audit_events')
      .select('id, event_type, detail, created_at, users(name)')
      .order('created_at', { ascending: false })
      .limit(100)
      .then(({ data, error: fetchError }) => {
        if (fetchError) setError(fetchError.message);
        else setEvents(data || []);
        setLoading(false);
      });
  }, []);

  return (
    <AppShell title="Audit log" breadcrumb={[{ label: 'Staff' }, { label: 'Audit log' }]}>
      <div className="max-w-2xl mx-auto space-y-5">
        <p className="text-[15px] text-text-secondary">
          Append-only. Every override is logged here atomically with the action it records —
          written server-side, never directly insertable from a browser.
        </p>

        {error && (
          <p className="text-sm text-accent-red bg-accent-red/10 border border-accent-red/30 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner size="lg" />
          </div>
        ) : events.length === 0 ? (
          <div className="card-elevated p-8 text-center text-text-secondary">
            <ScrollText className="w-10 h-10 mx-auto mb-3 text-text-hint" strokeWidth={1.5} />
            No audit events yet.
          </div>
        ) : (
          <div className="space-y-2">
            {events.map((ev) => (
              <div key={ev.id} className="card-elevated p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="badge-cyan text-[11px]">{ev.event_type}</span>
                  <span className="text-xs text-text-muted">{new Date(ev.created_at).toLocaleString()}</span>
                </div>
                <p className="text-text-secondary mt-1.5">
                  {ev.users?.name && <span className="text-text-primary font-medium">{ev.users.name}</span>}{' '}
                  {ev.detail?.override_reason}
                </p>
                {ev.detail?.previous_rank !== undefined && (
                  <p className="text-xs text-text-muted mt-1">
                    rank {ev.detail.previous_rank ?? '—'} → {ev.detail.new_rank ?? '—'}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
