import { useState, useCallback, useEffect } from 'react';
import { MapPin, Users, AlertTriangle } from 'lucide-react';
import DeptTag from '../shared/DeptTag';
import SeverityBadge from '../shared/SeverityBadge';
import StatusBadge from '../shared/StatusBadge';
import SLATimer from '../shared/SLATimer';
import VoteButton from './VoteButton';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { formatRelativeTime, cn } from '../../lib/utils';

export default function FeedPost({ complaint, userVotes = {} }) {
  const { user } = useAuth();
  const [sameIssueCount, setSameIssueCount] = useState(complaint.same_issue_count || 0);
  const [sameIssueVoted, setSameIssueVoted] = useState(!!userVotes.same_issue);
  const [samePending, setSamePending] = useState(false);

  useEffect(() => {
    setSameIssueCount(complaint.same_issue_count || 0);
    setSameIssueVoted(!!userVotes.same_issue);
  }, [complaint.id, complaint.same_issue_count, userVotes.same_issue]);

  const wardName = complaint.wards?.name;
  const reporterName = complaint.users?.name;

  const toggleSameIssue = useCallback(async () => {
    if (!user?.id || samePending) return;

    const next = !sameIssueVoted;
    const prevVoted = sameIssueVoted;
    const prevCount = sameIssueCount;

    setSamePending(true);
    setSameIssueVoted(next);
    setSameIssueCount((c) => Math.max(0, c + (next ? 1 : -1)));

    try {
      if (next) {
        const { error } = await supabase.from('social_votes').insert({
          complaint_id: complaint.id,
          user_id: user.id,
          vote_type: 'same_issue',
        });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('social_votes')
          .delete()
          .eq('complaint_id', complaint.id)
          .eq('user_id', user.id)
          .eq('vote_type', 'same_issue');
        if (error) throw error;
      }
    } catch {
      setSameIssueVoted(prevVoted);
      setSameIssueCount(prevCount);
    } finally {
      setSamePending(false);
    }
  }, [user?.id, complaint.id, sameIssueVoted, sameIssueCount, samePending]);

  return (
    <article className="glass-panel overflow-hidden hover:bg-white/[0.06] transition-colors">
      {complaint.image_url ? (
        <img
          src={complaint.image_url}
          alt={complaint.description || 'Complaint photo'}
          className="w-full h-48 md:h-56 object-cover bg-bg-elevated"
          loading="lazy"
        />
      ) : null}

      <div className="p-4 md:p-5 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <DeptTag dept={complaint.dept} size="sm" />
          <StatusBadge status={complaint.status} size="sm" />
        </div>

        <SeverityBadge severity={complaint.severity} size="sm" />

        {complaint.description ? (
          <p className="text-sm text-text-primary leading-relaxed">{complaint.description}</p>
        ) : null}

        <div className="flex flex-wrap items-center gap-3 text-xs text-text-secondary">
          {wardName ? (
            <span className="inline-flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 shrink-0" />
              {wardName}
            </span>
          ) : null}
          {complaint.address ? (
            <span className="truncate max-w-[200px]">{complaint.address}</span>
          ) : null}
          {reporterName ? (
            <span className="inline-flex items-center gap-1">
              <Users className="w-3.5 h-3.5 shrink-0" />
              {reporterName}
            </span>
          ) : null}
          <span>{formatRelativeTime(complaint.created_at)}</span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border-default">
          <div className="flex flex-wrap items-center gap-2">
            <VoteButton complaintId={complaint.id} initialCount={complaint.upvote_count || 0} />
            <button
              type="button"
              onClick={toggleSameIssue}
              disabled={!user || samePending}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors',
                sameIssueVoted
                  ? 'border-accent-amber/50 bg-accent-amber/15 text-accent-amber'
                  : 'border-border-default bg-bg-elevated text-text-secondary hover:border-border-strong hover:text-text-primary',
                (!user || samePending) && 'opacity-60 cursor-not-allowed'
              )}
              aria-pressed={sameIssueVoted}
            >
              <AlertTriangle className={cn('w-4 h-4', sameIssueVoted && 'fill-current')} />
              Same issue · {sameIssueCount}
            </button>
          </div>
          <SLATimer sla_deadline={complaint.sla_deadline} sla_hours={complaint.sla_hours} size="sm" />
        </div>
      </div>
    </article>
  );
}
