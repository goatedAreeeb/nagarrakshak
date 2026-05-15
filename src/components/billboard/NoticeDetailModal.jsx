import { Megaphone, Shield, Calendar, User } from 'lucide-react';
import GlassModal from '../shared/GlassModal';
import { getNoticeStyle, getPriorityLabel, parseGuidance } from '../../lib/noticeUtils';
import { formatDate, cn } from '../../lib/utils';

export default function NoticeDetailModal({ notice, onClose }) {
  if (!notice) return null;

  const style = getNoticeStyle(notice.notice_type);
  const bullets = parseGuidance(notice.guidance);

  return (
    <GlassModal
      open
      onClose={onClose}
      title="GHMC City Bulletin"
      size="lg"
      align="top"
      bodyClassName="p-0"
    >
      <div
        className={cn(
          'border-b border-white/10 p-5',
          style.bg,
          style.border,
          'border-x-0 border-t-0'
        )}
      >
        <div className="flex flex-wrap items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-black/30">
            <Megaphone className={cn('h-6 w-6', style.icon)} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap gap-2">
              <span
                className={cn(
                  'rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                  style.badge
                )}
              >
                {style.label}
              </span>
              <span className="rounded-full border border-white/15 bg-white/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase text-text-secondary">
                {getPriorityLabel(notice.priority)}
              </span>
              {notice.is_pinned && (
                <span className="rounded-full border border-cyan-400/30 bg-cyan-500/15 px-2.5 py-0.5 text-[10px] font-semibold text-cyan-200">
                  Pinned
                </span>
              )}
            </div>
            <h2 className="text-xl font-bold leading-snug text-text-primary">{notice.title}</h2>
            <p className={cn('mt-2 text-sm leading-relaxed', style.accent)}>{notice.summary}</p>
          </div>
        </div>
      </div>

      <div className="space-y-5 p-5">
        {bullets.length > 0 && (
          <section>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-text-primary">
              <Shield size={16} className="text-emerald-300" />
              Safety & guidance
            </h3>
            <ul className="space-y-2">
              {bullets.map((line, i) => (
                <li
                  key={i}
                  className="flex gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-text-secondary"
                >
                  <span className="mt-0.5 font-bold text-cyan-300">•</span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="flex flex-wrap gap-4 border-t border-white/10 pt-4 text-xs text-text-muted">
          {notice.publisher_name && (
            <span className="flex items-center gap-1.5">
              <User size={14} />
              {notice.publisher_name}
              {notice.publisher_role && ` · ${notice.publisher_role}`}
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <Calendar size={14} />
            {formatDate(notice.starts_at)}
            {notice.ends_at && ` — ${formatDate(notice.ends_at)}`}
          </span>
        </div>
      </div>
    </GlassModal>
  );
}
