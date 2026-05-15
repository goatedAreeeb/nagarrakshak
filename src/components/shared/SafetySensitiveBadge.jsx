import { Shield } from 'lucide-react';

/** Shown when a complaint was filed via the safety-sensitive citizen flow. */
export default function SafetySensitiveBadge({ className = '' }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border border-rose-400/35 bg-rose-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-100 ${className}`}
    >
      <Shield className="h-3 w-3 shrink-0" strokeWidth={2.5} aria-hidden />
      Safety
    </span>
  );
}
