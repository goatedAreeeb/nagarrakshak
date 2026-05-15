import { cn } from '../../lib/utils';

export default function EmptyState({ icon: Icon, title, description, className }) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center px-6 py-12',
        className
      )}
    >
      {Icon && (
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-bg-elevated border border-border-default">
          <Icon className="h-7 w-7 text-text-hint" strokeWidth={1.5} aria-hidden />
        </div>
      )}
      {title && (
        <h3 className="text-lg font-semibold text-text-primary mb-2">{title}</h3>
      )}
      {description && (
        <p className="text-sm text-text-secondary max-w-sm leading-relaxed">{description}</p>
      )}
    </div>
  );
}
