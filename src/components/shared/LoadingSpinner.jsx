import { cn } from '../../lib/utils';

const sizes = { sm: 'w-4 h-4 border', md: 'w-8 h-8 border-2', lg: 'w-10 h-10 border-2' };

export default function LoadingSpinner({ size = 'md', overlay = false, className }) {
  const spinner = (
    <div
      className={cn(
        'rounded-full border-white/20 border-t-white animate-spin',
        sizes[size],
        className
      )}
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
