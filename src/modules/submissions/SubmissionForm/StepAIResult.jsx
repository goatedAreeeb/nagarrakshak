import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Copy,
  AlertTriangle,
  Sparkles,
  Send,
  FileText,
  Clock,
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import LoadingSpinner from '../../../components/shared/LoadingSpinner';

function base64ToBlob(base64) {
  const parts = base64.split(',');
  const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
  const raw = atob(parts[1]);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) arr[i] = raw.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

const CATEGORY_LABELS = {
  school_infrastructure: 'School infrastructure',
  vocational_training: 'Vocational training',
  road_repair: 'Road repair',
  water_supply: 'Water supply',
  drainage: 'Drainage',
  health_facility: 'Health facility',
  electricity: 'Electricity',
};

const POLL_INTERVAL_MS = 1500;
const MAX_POLLS = 6;

export default function StepAIResult({
  imageBase64,
  lat,
  lng,
  address,
  description,
  language,
  voiceNoteBase64,
  voiceNoteMime,
  safetySensitive,
  submitted,
  setSubmitted,
  ticketId,
  onViewDashboard,
  onReportAnother,
}) {
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [features, setFeatures] = useState(null); // {category, entities, location_mentions, sentiment, confidence, status}
  const [polling, setPolling] = useState(false);

  useEffect(() => {
    if (!submitted || !ticketId) return;
    let cancelled = false;
    let attempts = 0;

    setPolling(true);
    const poll = async () => {
      const { data, error: pollError } = await supabase
        .from('citizen_submissions')
        .select('category, entities, location_mentions, sentiment, confidence, status')
        .eq('id', ticketId)
        .single();

      if (cancelled) return;
      if (!pollError && data) {
        setFeatures(data);
        if (data.status === 'processed' || data.status === 'needs_review' || attempts >= MAX_POLLS) {
          setPolling(false);
          return;
        }
      }
      attempts += 1;
      if (attempts < MAX_POLLS) {
        setTimeout(poll, POLL_INTERVAL_MS);
      } else {
        setPolling(false);
      }
    };

    poll();
    return () => {
      cancelled = true;
    };
  }, [submitted, ticketId]);

  const handleSubmit = async () => {
    if (!user) return;
    setSubmitting(true);
    setError('');

    try {
      const mediaRefs = [];

      if (imageBase64) {
        const ext = imageBase64.includes('image/png') ? 'png' : 'jpg';
        const path = `${user.id}/${Date.now()}.${ext}`;
        const blob = base64ToBlob(imageBase64);
        const { error: uploadError } = await supabase.storage
          .from('complaint-images')
          .upload(path, blob, { contentType: blob.type, upsert: false });
        if (uploadError) throw new Error(uploadError.message);
        mediaRefs.push({ storage_path: path, media_type: 'photo', mime_type: blob.type });
      }

      if (voiceNoteBase64) {
        const mime = voiceNoteMime || 'audio/webm';
        const ext = mime.includes('mp4') ? 'm4a' : 'webm';
        const voicePath = `${user.id}/${Date.now()}-voice.${ext}`;
        const voiceBlob = base64ToBlob(voiceNoteBase64);
        const { error: voiceUploadError } = await supabase.storage
          .from('complaint-images')
          .upload(voicePath, voiceBlob, { contentType: mime, upsert: false });
        if (voiceUploadError) throw new Error(voiceUploadError.message);
        mediaRefs.push({ storage_path: voicePath, media_type: 'voice', mime_type: mime });
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) throw new Error('Your session expired. Please sign in again.');

      const { data: fnData, error: fnError } = await supabase.functions.invoke('ingest-submission', {
        body: {
          text: description.trim(),
          language,
          channel: safetySensitive ? 'app' : imageBase64 ? 'photo' : voiceNoteBase64 ? 'voice' : 'app',
          media_refs: mediaRefs,
          lat,
          lng,
          address: address?.trim() || null,
        },
      });

      if (fnError) throw new Error(fnError.message || 'Submission failed. Please try again.');
      if (!fnData?.submission_id) throw new Error('Submission failed — no submission id returned.');

      setSubmitted(true, fnData.submission_id);
    } catch (err) {
      setError(err.message || 'Failed to send submission. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const copyTicketId = () => {
    if (!ticketId) return;
    navigator.clipboard.writeText(ticketId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (submitted && ticketId) {
    return (
      <div className="max-w-lg mx-auto text-center animate-fade-in py-4">
        <div className="mx-auto w-20 h-20 rounded-full bg-accent-emerald/15 border border-accent-emerald/40 flex items-center justify-center mb-6 animate-success-check">
          <CheckCircle2 className="w-10 h-10 text-accent-emerald" strokeWidth={1.5} />
        </div>
        <h2 className="text-2xl font-semibold text-text-primary mb-2">Submission recorded</h2>
        <p className="text-text-secondary mb-6">
          Your submission has been logged for review.
          {safetySensitive && (
            <>
              {' '}
              It is flagged for <span className="text-text-primary font-medium">priority review</span>{' '}
              because you used the safety-sensitive path.
            </>
          )}
        </p>

        <div className="card-elevated p-4 mb-4 text-left">
          <p className="text-xs text-text-hint uppercase tracking-wide mb-1">Submission ID</p>
          <div className="flex items-center gap-2">
            <code className="text-sm text-accent-cyan font-mono break-all flex-1">{ticketId}</code>
            <button
              type="button"
              onClick={copyTicketId}
              className="btn-ghost p-2 shrink-0"
              aria-label="Copy submission ID"
            >
              <Copy size={16} />
            </button>
          </div>
          {copied && <p className="text-xs text-accent-emerald mt-1">Copied!</p>}
        </div>

        <div className="card-elevated p-4 mb-6 text-left">
          <p className="text-xs text-text-hint uppercase tracking-wide mb-2 flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5" />
            AI processing
          </p>
          {polling && !features?.status && (
            <div className="flex items-center gap-2 text-sm text-text-secondary" role="status">
              <LoadingSpinner size="sm" />
              Structuring your submission…
            </div>
          )}
          {features && (
            <div className="space-y-2 text-sm">
              {features.status === 'needs_review' && (
                <p className="flex items-center gap-2 text-accent-amber">
                  <Clock size={14} />
                  Low-confidence extraction — flagged for staff review, not auto-ranked.
                </p>
              )}
              {features.category && (
                <p>
                  <span className="text-text-hint">Category:</span>{' '}
                  {CATEGORY_LABELS[features.category] || features.category}
                </p>
              )}
              {features.sentiment && (
                <p>
                  <span className="text-text-hint">Tone:</span> {features.sentiment}
                </p>
              )}
              {typeof features.confidence === 'number' && (
                <p>
                  <span className="text-text-hint">Extraction confidence:</span>{' '}
                  {Math.round(features.confidence * 100)}%
                </p>
              )}
              {!features.category && !polling && (
                <p className="text-text-muted">
                  Could not confidently categorize yet — a staff reviewer will take a look.
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button type="button" onClick={onViewDashboard} className="btn-primary">
            Go to dashboard
          </button>
          {onReportAnother && (
            <button type="button" onClick={onReportAnother} className="btn-ghost">
              Send another submission
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
          <FileText className="w-5 h-5 text-accent-cyan" />
          Review before sending
        </h2>
        <p className="text-sm text-text-secondary mt-1">
          Your submission will be structured and geo-linked automatically after sending — categorization
          isn't shown before you send, since it's computed asynchronously by the intake pipeline.
          {safetySensitive && (
            <span className="block mt-2 text-rose-200/90 text-[13px]">
              Priority filing: this submission will be flagged for faster staff review.
            </span>
          )}
        </p>
      </div>

      {error && (
        <p className="text-sm text-accent-red bg-accent-red/10 border border-accent-red/30 rounded-lg px-3 py-2 mb-4">
          {error}
        </p>
      )}

      <div className="rounded-lg border border-border-default bg-bg-surface p-3 text-sm text-text-secondary space-y-1 mb-6">
        <p>
          <span className="text-text-hint">Location:</span> {address || `${lat?.toFixed(4)}, ${lng?.toFixed(4)}`}
        </p>
        <p className="line-clamp-2">
          <span className="text-text-hint">Description:</span> {description}
        </p>
        <p>
          <span className="text-text-hint">Language:</span> {language || 'en'}
        </p>
        {voiceNoteBase64 && <p className="text-accent-cyan">Includes voice note</p>}
        {imageBase64 && <p className="text-accent-cyan">Includes photo</p>}
      </div>

      <button
        type="button"
        onClick={handleSubmit}
        disabled={submitting}
        className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60"
      >
        {submitting ? (
          <>
            <LoadingSpinner size="sm" />
            Sending…
          </>
        ) : (
          <>
            <Send size={18} />
            Send submission
          </>
        )}
      </button>
    </div>
  );
}
