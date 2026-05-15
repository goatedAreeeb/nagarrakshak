import { useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function useRealtime(table, filter, onInsert, onUpdate) {
  useEffect(() => {
    const channelName = `${table}-${filter || 'all'}`;
    let config = { event: '*', schema: 'public', table };
    if (filter) {
      const [col, val] = filter.split('=');
      config = { ...config, event: 'INSERT', filter: `${col}=eq.${val}` };
    }

    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', config, (payload) => {
        if (payload.eventType === 'INSERT' && onInsert) onInsert(payload.new);
        if (payload.eventType === 'UPDATE' && onUpdate) onUpdate(payload.new);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, filter, onInsert, onUpdate]);
}
