import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { filterLiveNotices } from '../lib/noticeUtils';

const CityNoticesContext = createContext(null);

export function CityNoticesProvider({ children, userZone }) {
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const tableMissingRef = useRef(false);

  const fetchNotices = useCallback(async () => {
    if (tableMissingRef.current) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    const { data, error: err } = await supabase
      .from('city_notices')
      .select('*')
      .order('is_pinned', { ascending: false })
      .order('priority', { ascending: true })
      .order('created_at', { ascending: false });

    if (err) {
      const missing =
        err.code === 'PGRST205' ||
        err.code === '42P01' ||
        err.status === 404 ||
        /city_notices/i.test(err.message || '');

      if (missing) {
        tableMissingRef.current = true;
        setError(
          'City bulletin table not found. Open Supabase → SQL Editor → run the file supabase/city_notices.sql'
        );
      } else {
        setError(err.message);
      }
      setNotices([]);
    } else {
      setNotices(data || []);
      setError('');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchNotices();
  }, [fetchNotices]);

  useEffect(() => {
    if (tableMissingRef.current) return;

    const channel = supabase
      .channel('city-notices-broadcast')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'city_notices' },
        () => {
          fetchNotices();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchNotices]);

  const liveNotices = filterLiveNotices(notices, userZone);
  const pinnedNotice = liveNotices[0] || null;

  const value = {
    notices,
    liveNotices,
    pinnedNotice,
    loading,
    error,
    refresh: fetchNotices,
  };

  return <CityNoticesContext.Provider value={value}>{children}</CityNoticesContext.Provider>;
}

const EMPTY_NOTICES = {
  notices: [],
  liveNotices: [],
  pinnedNotice: null,
  loading: false,
  error: '',
  refresh: () => {},
};

export function useCityNotices() {
  const ctx = useContext(CityNoticesContext);
  if (!ctx) {
    if (import.meta.env.DEV) {
      console.warn('useCityNotices: wrap routes with CityNoticesProvider');
    }
    return EMPTY_NOTICES;
  }
  return ctx;
}
