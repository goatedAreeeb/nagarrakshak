import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Megaphone, ChevronRight, X, Radio } from 'lucide-react';
import { useCityNotices } from '../../contexts/CityNoticesContext';
import { getNoticeStyle, getPriorityLabel } from '../../lib/noticeUtils';
import { cn } from '../../lib/utils';
import NoticeDetailModal from './NoticeDetailModal';
import LoadingSpinner from '../shared/LoadingSpinner';

function dismissKey(id) {
  return `nr-notice-dismiss-${id}`;
}

export default function CityBillboardStrip() {
  const { liveNotices, loading, error } = useCityNotices();
  const [detail, setDetail] = useState(null);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem('nr-dismissed-notices') || '[]');
    } catch {
      return [];
    }
  });

  const visible = useMemo(
    () => liveNotices.filter((n) => !dismissed.includes(n.id)),
    [liveNotices, dismissed]
  );

  const hero = visible[0];

  const dismiss = (id) => {
    const next = [...dismissed, id];
    setDismissed(next);
    sessionStorage.setItem('nr-dismissed-notices', JSON.stringify(next));
  };

  if (loading && !hero) {
    return (
      <div className="mb-5 flex justify-center rounded-2xl border border-white/10 bg-white/[0.03] py-6">
        <LoadingSpinner size="sm" />
      </div>
    );
  }

  if (!hero) {
    if (error) {
      return (
        <p className="mb-5 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-2 text-xs text-amber-200/90">
          City bulletin unavailable. {error}
        </p>
      );
    }
    return null;
  }

  const style = getNoticeStyle(hero.notice_type);
  const moreCount = visible.length - 1;

  return (
    <>
      <section
        className={cn(
          'relative mb-5 overflow-hidden rounded-2xl border backdrop-blur-md',
          style.border,
          style.bg,
          style.glow,
          hero.priority === 1 && 'animate-pulse-slow'
        )}
        role="region"
        aria-label="GHMC city bulletin"
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.08),transparent_55%)]" />

        <div className="relative flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4 sm:p-5">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-black/35 shadow-lg">
              {hero.priority === 1 ? (
                <Radio className={cn('h-5 w-5 animate-pulse', style.icon)} />
              ) : (
                <Megaphone className={cn('h-5 w-5', style.icon)} />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="mb-1.5 flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/70">
                  GHMC City Bulletin
                </span>
                <span
                  className={cn(
                    'rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase',
                    style.badge
                  )}
                >
                  {style.label}
                </span>
                <span className="text-[10px] font-medium text-white/50">
                  {getPriorityLabel(hero.priority)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setDetail(hero)}
                className="text-left"
              >
                <h2 className="line-clamp-2 text-base font-bold leading-snug text-text-primary sm:text-lg">
                  {hero.title}
                </h2>
                <p className={cn('mt-1 line-clamp-2 text-sm', style.accent)}>{hero.summary}</p>
              </button>
              {hero.publisher_name && (
                <p className="mt-1.5 text-[11px] text-text-muted">
                  — {hero.publisher_name}
                  {moreCount > 0 && ` · +${moreCount} more alert${moreCount > 1 ? 's' : ''}`}
                </p>
              )}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:flex-col sm:items-stretch">
            <button
              type="button"
              onClick={() => setDetail(hero)}
              className="btn-primary flex flex-1 items-center justify-center gap-1 text-xs sm:text-sm"
            >
              Read guidance
              <ChevronRight size={16} />
            </button>
            <Link
              to="/billboard"
              className="btn-secondary flex flex-1 items-center justify-center text-xs sm:text-sm"
            >
              All bulletins
            </Link>
            <button
              type="button"
              onClick={() => dismiss(hero.id)}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/30 text-text-muted hover:text-text-primary sm:absolute sm:right-3 sm:top-3"
              aria-label="Dismiss for this session"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      </section>

      {detail && <NoticeDetailModal notice={detail} onClose={() => setDetail(null)} />}
    </>
  );
}
