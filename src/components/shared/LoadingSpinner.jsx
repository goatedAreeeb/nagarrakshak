import { cn } from '../../lib/utils';

const sizes = {
  sm: 'w-4 h-4 border',
  md: 'w-8 h-8 border-2',
  lg: 'w-10 h-10 border-2',
};

/**
 * Uses <span> so the spinner is valid inside <p>, <button>, and other phrasing-only parents.
 */
export default function LoadingSpinner({ size = 'md', overlay = false, className }) {
  const spinner = (
    <span
      className={cn(
        'inline-block shrink-0 rounded-full border-white/20 border-t-white animate-spin align-middle',
        sizes[size],
        className
      )}
      aria-hidden
    />
  );

  if (overlay) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black/70 backdrop-blur-md z-50">
        {spinner}
      </div>
    );
  }
  return spinner;
}
