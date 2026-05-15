import { useState, useEffect, useCallback } from 'react';
import { ThumbsUp } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { cn } from '../../lib/utils';

export default function VoteButton({ complaintId, initialCount = 0, className }) {
  const { user } = useAuth();
  const [voted, setVoted] = useState(false);
  const [count, setCount] = useState(initialCount);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setCount(initialCount);
  }, [initialCount]);

  useEffect(() => {
    if (!user?.id || !complaintId) return;

    let cancelled = false;

    (async () => {
      const { data } = await supabase
        .from('social_votes')
        .select('id')
        .eq('complaint_id', complaintId)
        .eq('user_id', user.id)
        .eq('vote_type', 'upvote')
        .maybeSingle();

      if (!cancelled) setVoted(!!data);
    })();

    return () => {
      cancelled = true;
    };
  }, [complaintId, user?.id]);

  const toggle = useCallback(async () => {
    if (!user?.id) return;
    if (pending) return;

    const nextVoted = !voted;
    const prevVoted = voted;
    const prevCount = count;

    setPending(true);
    setVoted(nextVoted);
    setCount((c) => Math.max(0, c + (nextVoted ? 1 : -1)));

    try {
      if (nextVoted) {
        const { error } = await supabase.from('social_votes').insert({
          complaint_id: complaintId,
          user_id: user.id,
          vote_type: 'upvote',
        });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('social_votes')
          .delete()
          .eq('complaint_id', complaintId)
          .eq('user_id', user.id)
          .eq('vote_type', 'upvote');
        if (error) throw error;
      }

    } catch {
      setVoted(prevVoted);
      setCount(prevCount);
    } finally {
      setPending(false);
    }
  }, [user?.id, complaintId, voted, count, pending]);

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={!user || pending}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors',
        voted
          ? 'border-accent-cyan/50 bg-accent-cyan/15 text-accent-cyan'
          : 'border-border-default bg-bg-elevated text-text-secondary hover:border-border-strong hover:text-text-primary',
        (!user || pending) && 'opacity-60 cursor-not-allowed',
        className
      )}
      aria-pressed={voted}
      aria-label={voted ? 'Remove upvote' : 'Upvote'}
    >
      <ThumbsUp className={cn('w-4 h-4', voted && 'fill-current')} strokeWidth={2} />
      <span>{count}</span>
    </button>
  );
}
