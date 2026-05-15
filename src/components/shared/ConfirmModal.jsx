import { cn } from '../../lib/utils';
import GlassModal from './GlassModal';

export default function ConfirmModal({
  open,
  title,
  message,
  onConfirm,
  onCancel,
  confirmLabel = 'Confirm',
  danger = false,
}) {
  return (
    <GlassModal
      open={open}
      onClose={onCancel}
      title={title}
      titleId="confirm-modal-title"
      size="sm"
      footer={
        <div className="flex items-center justify-end gap-3">
          <button type="button" onClick={onCancel} className="btn-secondary">
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={cn('btn-primary', danger && 'bg-white/90 hover:bg-white text-void')}
          >
            {confirmLabel}
          </button>
        </div>
      }
    >
      <p className="px-5 py-4 text-sm leading-relaxed text-text-secondary">{message}</p>
    </GlassModal>
  );
}
