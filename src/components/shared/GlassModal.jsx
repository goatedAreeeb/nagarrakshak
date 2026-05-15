import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

const SIZE_CLASS = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

export default function GlassModal({
  open,
  onClose,
  title,
  titleId,
  children,
  footer,
  size = 'md',
  className,
  bodyClassName,
  hideHeader = false,
  align = 'center',
}) {
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const headingId = titleId || 'glass-modal-title';

  return createPortal(
    <div
      className={cn(
        'glass-modal fixed inset-0 z-[200] flex justify-center p-4 sm:p-6',
        align === 'top' ? 'items-start pt-6 sm:pt-10' : 'items-center'
      )}
      role="presentation"
    >
      <button
        type="button"
        className="glass-modal-backdrop absolute inset-0"
        onClick={onClose}
        aria-label="Close dialog"
      />

      <div
        className={cn(
          'glass-modal-card relative flex max-h-[min(90vh,900px)] w-full flex-col animate-scale-in',
          SIZE_CLASS[size],
          className
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby={!hideHeader && title ? headingId : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        {!hideHeader && (
          <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
            {title ? (
              <h2 id={headingId} className="truncate text-lg font-bold text-text-primary">
                {title}
              </h2>
            ) : (
              <span />
            )}
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-text-primary transition-colors hover:bg-white/12"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </header>
        )}

        <div className={cn('glass-modal-body min-h-0 flex-1 overflow-y-auto overscroll-contain', bodyClassName)}>
          {children}
        </div>

        {footer && (
          <footer className="shrink-0 border-t border-white/10 px-5 py-4">{footer}</footer>
        )}
      </div>
    </div>,
    document.body
  );
}
