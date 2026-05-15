import { useState } from 'react';
import { CheckCircle, XCircle, ImageIcon } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { createNotification } from '../../contexts/NotificationContext';
import { useAuth } from '../../contexts/AuthContext';
import LoadingSpinner from '../shared/LoadingSpinner';

export default function ClosureVerify({ complaint, onVerified, onReopened }) {
  const { user, refreshProfile } = useAuth();
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (complaint.citizen_verified === true || complaint.status === 'closed') {
    return (
      <div className="rounded-xl border border-accent-emerald/40 bg-accent-emerald/10 p-4">
        <p className="text-sm font-medium text-accent-emerald flex items-center gap-2">
          <CheckCircle size={18} />
          You confirmed this issue as resolved. +10 civic credits added. Thank you!
        </p>
      </div>
    );
  }

  const notifyOfficer = async (title, message) => {
    let officerId = complaint.assigned_to;
    if (!officerId) {
      const { data: officers } = await supabase
        .from('users')
        .select('id')
        .eq('role', 'officer')
        .eq('dept', complaint.dept)
        .limit(1);
      officerId = officers?.[0]?.id;
    }
    if (officerId) {
      await createNotification(
        officerId,
        'closure_rejected',
        title,
        message,
        complaint.id
      );
    }
  };

  const handleConfirm = async () => {
    setLoading(true);
    setError('');
    const { error: updateErr } = await supabase
      .from('complaints')
      .update({
        status: 'closed',
        citizen_verified: true,
      })
      .eq('id', complaint.id);

    if (updateErr) {
      setError(updateErr.message);
      setLoading(false);
      return;
    }

    const { data: profile } = await supabase
      .from('users')
      .select('credits')
      .eq('id', user.id)
      .single();

    if (profile) {
      await supabase
        .from('users')
        .update({ credits: (profile.credits || 0) + 10 })
        .eq('id', user.id);
      refreshProfile?.();
    }

    setLoading(false);
    onVerified?.({ ...complaint, status: 'closed', citizen_verified: true });
  };

  const handleReopen = async () => {
    if (!reason.trim()) {
      setError('Please describe why the issue is not resolved.');
      return;
    }
    setLoading(true);
    setError('');

    const { error: updateErr } = await supabase
      .from('complaints')
      .update({
        status: 'reopened',
        citizen_verified: false,
      })
      .eq('id', complaint.id);

    if (updateErr) {
      setError(updateErr.message);
      setLoading(false);
      return;
    }

    await supabase.from('escalations').insert({
      complaint_id: complaint.id,
      from_role: 'citizen',
      to_role: 'officer',
      reason: reason.trim(),
      resolved: false,
    });

    await notifyOfficer(
      'Closure rejected by citizen',
      `Citizen reopened complaint: "${reason.trim().slice(0, 120)}${reason.length > 120 ? '…' : ''}"`
    );

    if (complaint.assigned_to && complaint.assigned_to !== user?.id) {
      await createNotification(
        complaint.assigned_to,
        'closure_rejected',
        'Task reopened',
        'The citizen rejected the resolution. Please revisit this complaint.',
        complaint.id
      );
    }

    setLoading(false);
    onReopened?.({ ...complaint, status: 'reopened', citizen_verified: false });
  };

  return (
    <div className="rounded-xl border border-accent-amber/40 bg-accent-amber/10 p-4 space-y-4">
      <p className="text-sm font-medium text-text-primary">
        This complaint has been marked resolved. Do you confirm the fix?
      </p>

      {complaint.closure_image_url && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-text-secondary mb-1.5">Before</p>
            {complaint.image_url ? (
              <img
                src={complaint.image_url}
                alt="Before"
                className="w-full h-28 object-cover rounded-lg border border-border-default"
              />
            ) : (
              <div className="w-full h-28 rounded-lg border border-border-default bg-bg-elevated flex items-center justify-center">
                <ImageIcon className="text-text-hint" size={24} />
              </div>
            )}
          </div>
          <div>
            <p className="text-xs text-text-secondary mb-1.5">After</p>
            <img
              src={complaint.closure_image_url}
              alt="After resolution"
              className="w-full h-28 object-cover rounded-lg border border-accent-emerald/40"
            />
          </div>
        </div>
      )}

      {!showRejectForm ? (
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-accent-emerald px-4 py-2.5 text-sm font-semibold text-bg-base hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? <LoadingSpinner size="sm" /> : <CheckCircle size={18} />}
            Yes, Resolved
          </button>
          <button
            type="button"
            onClick={() => setShowRejectForm(true)}
            disabled={loading}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg border border-accent-red/50 bg-accent-red/10 px-4 py-2.5 text-sm font-semibold text-accent-red hover:bg-accent-red/20 transition-colors disabled:opacity-50"
          >
            <XCircle size={18} />
            No, Reopen
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why is the issue not resolved? Describe what still needs fixing…"
            rows={3}
            className="input-field resize-none"
          />
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => {
                setShowRejectForm(false);
                setReason('');
                setError('');
              }}
              className="btn-ghost flex-1"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleReopen}
              disabled={loading}
              className="flex-1 rounded-lg bg-accent-red px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 inline-flex items-center justify-center gap-2"
            >
              {loading ? <LoadingSpinner size="sm" /> : null}
              Submit & Reopen
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-accent-red">{error}</p>}
    </div>
  );
}
