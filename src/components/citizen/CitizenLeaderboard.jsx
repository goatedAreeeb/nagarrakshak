import { useEffect, useState } from 'react';
import { Trophy, Medal } from 'lucide-react';
import { supabase } from '../../lib/supabase';

const RANK_BORDER = [
  'border-l-amber-400/55 bg-amber-500/[0.07]',
  'border-l-slate-400/45 bg-slate-400/[0.06]',
  'border-l-amber-900/45 bg-amber-950/20',
];

/**
 * City-wide top citizens by civic credits (public.users, role = citizen).
 */
export default function CitizenLeaderboard({ currentUserId }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('users')
        .select('id, name, credits, ward_id, wards(name)')
        .eq('role', 'citizen')
        .order('credits', { ascending: false })
        .limit(3);

      if (!cancelled) {
        if (error) {
          console.warn('Leaderboard:', error.message);
          setRows([]);
        } else {
          setRows(data || []);
        }
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="glass-panel dashboard-panel-glow p-5">
        <p className="text-sm text-text-muted">Loading city leaderboard…</p>
      </div>
    );
  }

  if (rows.length === 0) {
    return null;
  }

  return (
    <section className="glass-panel dashboard-panel-glow overflow-hidden">
      <div className="px-5 py-4 border-b border-glass-border flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-500/15 border border-violet-400/30">
          <Trophy className="h-5 w-5 text-violet-300" strokeWidth={1.75} />
        </div>
        <div>
          <h2 className="font-bold text-text-primary text-[17px]">City leaderboard</h2>
          <p className="text-[13px] text-text-muted">Top citizens by civic credits · all Hyderabad wards</p>
        </div>
      </div>
      <ul className="divide-y divide-glass-border">
        {rows.map((u, i) => {
          const rankClass = RANK_BORDER[i] || RANK_BORDER[2];
          const ward = u.wards?.name || (u.ward_id != null ? `Ward ${u.ward_id}` : 'Hyderabad');
          const isYou = currentUserId && u.id === currentUserId;
          return (
            <li
              key={u.id}
              className={`flex items-center gap-4 px-5 py-4 border-l-4 ${rankClass} ${isYou ? 'ring-1 ring-inset ring-cyan-400/20' : ''}`}
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.06]">
                {i === 0 ? (
                  <Medal className="h-5 w-5 text-amber-300" />
                ) : (
                  <span className="text-xs font-bold tabular-nums text-text-secondary">{i + 1}</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-text-primary truncate">
                  {u.name}
                  {isYou ? (
                    <span className="ml-2 text-[11px] font-medium uppercase tracking-wide text-cyan-400">
                      You
                    </span>
                  ) : null}
                </p>
                <p className="text-[12px] text-text-muted truncate">{ward}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-lg font-bold tabular-nums text-text-primary">{u.credits ?? 0}</p>
                <p className="text-[10px] uppercase tracking-wider text-text-hint">credits</p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
