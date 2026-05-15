import { useState, useEffect, useCallback, useMemo } from 'react';
import { AlertTriangle, Rss } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { trendingScore, cn } from '../../lib/utils';
import { getSLAStatus } from '../../lib/slaEngine';
import FeedPost from './FeedPost';
import LoadingSpinner from '../shared/LoadingSpinner';
import EmptyState from '../shared/EmptyState';

const TABS = [
  { id: 'near', label: 'Near Me' },
  { id: 'trending', label: 'Trending' },
  { id: 'ward', label: 'My Ward' },
  { id: 'urgent', label: 'Urgent' },
];

const ACTIVE_STATUSES = ['open', 'assigned', 'in_progress', 'reopened'];
const NEAR_RADIUS_KM = 3;

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function buildVoteMap(rows) {
  const map = {};
  rows?.forEach((row) => {
    if (!map[row.complaint_id]) map[row.complaint_id] = {};
    map[row.complaint_id][row.vote_type] = true;
  });
  return map;
}

export default function NagarFeed() {
  const { user, profile } = useAuth();
  const [tab, setTab] = useState('near');
  const [complaints, setComplaints] = useState([]);
  const [wards, setWards] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const [voteMap, setVoteMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchComplaints = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: err } = await supabase
        .from('complaints')
        .select('*, wards(name)')
        .in('status', ACTIVE_STATUSES)
        .eq('is_duplicate', false)
        .order('created_at', { ascending: false })
        .limit(100);

      if (err) throw err;
      setComplaints(data || []);
    } catch (err) {
      console.warn('Feed fetch:', err?.message || err);
      setError(err);
      setComplaints([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchVotes = useCallback(async () => {
    if (!user?.id) {
      setVoteMap({});
      return;
    }
    const { data } = await supabase
      .from('social_votes')
      .select('complaint_id, vote_type')
      .eq('user_id', user.id);
    setVoteMap(buildVoteMap(data));
  }, [user?.id]);

  useEffect(() => {
    fetchComplaints();
    fetchVotes();
  }, [fetchComplaints, fetchVotes]);

  useEffect(() => {
    supabase
      .from('wards')
      .select('id, name, lat, lng, zone')
      .then(({ data }) => setWards(data || []));
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { enableHighAccuracy: false, timeout: 8000 }
    );
  }, []);

  const handleInsert = useCallback(async (row) => {
    if (!row?.id || row.is_duplicate) return;
    if (!ACTIVE_STATUSES.includes(row.status)) return;

    const { data } = await supabase
      .from('complaints')
      .select('*, wards(name)')
      .eq('id', row.id)
      .single();

    if (!data) return;
    setComplaints((prev) => {
      if (prev.some((c) => c.id === data.id)) return prev;
      return [data, ...prev];
    });
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel('feed-complaints-insert')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'complaints' },
        (payload) => handleInsert(payload.new)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [handleInsert]);

  const wardAlert = useMemo(() => {
    const wardId = profile?.ward_id;
    if (!wardId) return null;
    const count = complaints.filter(
      (c) =>
        c.ward_id === wardId &&
        (c.severity || 0) >= 3 &&
        ACTIVE_STATUSES.includes(c.status)
    ).length;
    if (count === 0) return null;
    const wardLabel =
      profile?.wards?.name || wards.find((w) => w.id === wardId)?.name || 'your ward';
    return { count, wardLabel };
  }, [complaints, profile?.ward_id, profile?.wards?.name, wards]);

  const filtered = useMemo(() => {
    let list = [...complaints];

    if (tab === 'near') {
      if (userLocation) {
        list = list
          .map((c) => ({
            ...c,
            _distance: haversineKm(userLocation.lat, userLocation.lng, c.lat, c.lng),
          }))
          .filter((c) => c._distance <= NEAR_RADIUS_KM)
          .sort((a, b) => a._distance - b._distance);
      } else if (profile?.ward_id) {
        list = list.filter((c) => c.ward_id === profile.ward_id);
      }
    } else if (tab === 'trending') {
      list.sort((a, b) => trendingScore(b) - trendingScore(a));
    } else if (tab === 'ward') {
      list = profile?.ward_id ? list.filter((c) => c.ward_id === profile.ward_id) : [];
    } else if (tab === 'urgent') {
      list = list
        .filter((c) => {
          const sla = getSLAStatus(c.sla_deadline, c.sla_hours);
          return (c.severity || 0) >= 4 || sla.status === 'breached' || sla.status === 'warning';
        })
        .sort((a, b) => (b.severity || 0) - (a.severity || 0));
    }

    return list;
  }, [complaints, tab, userLocation, profile?.ward_id]);

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <header className="pb-3 border-b border-glass-border">
        <h1 className="text-2xl font-bold">Civic Pulse</h1>
        <p className="text-[15px] text-text-muted mt-0.5">Live issues across Hyderabad</p>
      </header>
      {wardAlert ? (
        <div role="alert" className="flex items-start gap-3 rounded-2xl glass px-4 py-3 text-sm">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <p>
            <strong>{wardAlert.count}</strong> high-severity issue
            {wardAlert.count === 1 ? '' : 's'} in <strong>{wardAlert.wardLabel}</strong> need
            attention (severity 3+).
          </p>
        </div>
      ) : null}

      <div className="flex gap-1 p-1 rounded-full glass">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              'flex-1 min-w-[4.5rem] px-3 py-2 rounded-full text-sm font-semibold transition-all',
              tab === t.id ? 'pill-tab-active' : 'pill-tab-inactive'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'near' && !userLocation && profile?.ward_id ? (
        <p className="text-xs text-text-hint px-1">
          Location unavailable — showing issues in your registered ward.
        </p>
      ) : null}

      {loading ? (
        <div className="flex justify-center py-16">
          <LoadingSpinner size="lg" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-accent-red/30 bg-accent-red/10 px-4 py-3 text-sm text-accent-red">
          Could not load feed: {error.message}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Rss}
          title="No issues here"
          description={
            tab === 'ward' && !profile?.ward_id
              ? 'Set your ward in profile to see ward-specific posts.'
              : 'No active complaints match this filter right now.'
          }
        />
      ) : (
        <ul className="space-y-4">
          {filtered.map((c) => (
            <li key={c.id}>
              <FeedPost complaint={c} userVotes={voteMap[c.id] || {}} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
