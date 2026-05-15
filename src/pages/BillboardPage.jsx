import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Megaphone, Radio, PenSquare } from 'lucide-react';
import AppShell from '../components/layout/AppShell';
import { useAuth } from '../contexts/AuthContext';
import { useCityNotices } from '../contexts/CityNoticesContext';
import {
  getNoticeStyle,
  getPriorityLabel,
  parseGuidance,
  isNoticeLive,
} from '../lib/noticeUtils';
import { formatDate, cn } from '../lib/utils';
import NoticeDetailModal from '../components/billboard/NoticeDetailModal';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import EmptyState from '../components/shared/EmptyState';

export default function BillboardPage() {
  return (
    <AppShell title="City Bulletin" breadcrumb={[{ label: 'City Bulletin' }]}>
      <BillboardPageContent />
    </AppShell>
  );
}

function BillboardPageContent() {
  const { role } = useAuth();
  const { notices, liveNotices, loading, error, refresh } = useCityNotices();
  const [selected, setSelected] = useState(null);
  const isCityHead = role === 'city';

  const archived = notices.filter((n) => !isNoticeLive(n));

  return (
    <>
      <div className="mx-auto max-w-3xl space-y-6 animate-fade-in">
        <header className="text-center sm:text-left">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-cyan-200">
            <Radio size={14} />
            Official GHMC channel
          </div>
          <h1 className="text-2xl font-bold text-text-primary">City Bulletin Board</h1>
          <p className="mt-2 text-sm leading-relaxed text-text-secondary">
            Outbreak alerts, vaccination drives, emergencies, and civic guidance — one place for
            every citizen and city staff member.
          </p>
        </header>

        {error && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-4 text-sm text-amber-100">
            <p className="font-medium text-amber-50">Setup required</p>
            <p className="mt-2 leading-relaxed">{error}</p>
            <p className="mt-3 text-xs text-amber-200/80">
              File: <code className="rounded bg-black/30 px-1">supabase/city_notices.sql</code> in
              your project → paste in Supabase SQL Editor → Run → refresh this page.
            </p>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-20">
            <LoadingSpinner size="lg" />
          </div>
        ) : liveNotices.length === 0 && !error ? (
          <EmptyState
            icon={Megaphone}
            title="No active bulletins"
            description={
              isCityHead
                ? 'Use Post Bulletin in the sidebar to publish an official city notice.'
                : 'Check back for official updates from the City Head.'
            }
          />
        ) : liveNotices.length > 0 ? (
          <ul className="space-y-4">
            {liveNotices.map((notice) => (
              <NoticeCard key={notice.id} notice={notice} onOpen={() => setSelected(notice)} />
            ))}
          </ul>
        ) : null}

        {archived.length > 0 && (
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-text-muted">
              Recent / ended
            </h2>
            <ul className="space-y-3 opacity-70">
              {archived.slice(0, 5).map((notice) => (
                <NoticeCard
                  key={notice.id}
                  notice={notice}
                  onOpen={() => setSelected(notice)}
                  compact
                />
              ))}
            </ul>
          </section>
        )}

        {isCityHead && (
          <div className="flex justify-center">
            <Link to="/billboard/publish" className="btn-primary inline-flex items-center gap-2 text-sm">
              <PenSquare size={16} />
              Post bulletin
            </Link>
          </div>
        )}

        <button type="button" onClick={refresh} className="btn-ghost mx-auto block text-sm">
          Refresh bulletins
        </button>
      </div>

      {selected && <NoticeDetailModal notice={selected} onClose={() => setSelected(null)} />}
    </>
  );
}

function NoticeCard({ notice, onOpen, compact = false }) {
  const style = getNoticeStyle(notice.notice_type);
  const bullets = parseGuidance(notice.guidance).slice(0, compact ? 2 : 4);

  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          'w-full overflow-hidden rounded-2xl border text-left transition-transform hover:scale-[1.01]',
          style.border,
          style.bg,
          style.glow
        )}
      >
        <div className="p-5">
          <div className="mb-2 flex flex-wrap gap-2">
            <span
              className={cn(
                'rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase',
                style.badge
              )}
            >
              {style.label}
            </span>
            <span className="text-[10px] font-medium text-text-muted">
              {getPriorityLabel(notice.priority)}
            </span>
          </div>
          <h3 className={cn('font-bold text-text-primary', compact ? 'text-base' : 'text-lg')}>
            {notice.title}
          </h3>
          <p className={cn('mt-2 text-sm leading-relaxed', style.accent)}>{notice.summary}</p>
          {bullets.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {bullets.map((line, i) => (
                <li key={i} className="flex gap-2 text-xs text-text-secondary">
                  <span className="text-cyan-400">•</span>
                  <span className="line-clamp-2">{line}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-[11px] text-text-muted">
            {notice.publisher_name || 'GHMC'} · {formatDate(notice.starts_at)}
          </p>
        </div>
      </button>
    </li>
  );
}
