import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Copy,
  AlertTriangle,
  Sparkles,
  Send,
  Award,
  FileText,
} from 'lucide-react';
import {
  analyzeComplaint,
  classifyComplaintLocally,
  buildClassificationContext,
  SLA_BY_SEVERITY,
} from '../../../lib/gemini';
import { checkDuplicate } from '../../../lib/duplicateCheck';
import { supabase } from '../../../lib/supabase';
import { findOfficerForDept } from '../../../lib/officerRouting';
import { createNotification } from '../../../contexts/NotificationContext';
import { useAuth } from '../../../contexts/AuthContext';
import DeptTag from '../../shared/DeptTag';
import SeverityBadge from '../../shared/SeverityBadge';
import LoadingSpinner from '../../shared/LoadingSpinner';

function base64ToBlob(base64) {
  const parts = base64.split(',');
  const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
  const raw = atob(parts[1]);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) arr[i] = raw.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

export default function StepAIResult({
  imageBase64,
  lat,
  lng,
  address,
  description,
  wardId,
  voiceNoteBase64,
  voiceNoteMime,
  safetySensitive,
  aiResult,
  setAiResult,
  duplicateInfo,
  setDuplicateInfo,
  submitted,
  setSubmitted,
  ticketId,
  onViewDashboard,
  onReportAnother,
}) {
  const { user } = useAuth();
  const [analyzing, setAnalyzing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (submitted) return;

    let cancelled = false;

    const classContext = buildClassificationContext({
      description,
      hasVoice: Boolean(voiceNoteBase64),
      hasImage: Boolean(imageBase64),
      safetySensitive,
    });
    const local = classifyComplaintLocally(description, {
      hasVoice: Boolean(voiceNoteBase64),
      hasImage: Boolean(imageBase64),
      safetySensitive,
    });
    setAiResult(local);
    setAnalyzing(true);
    setError('');

    checkDuplicate(lat, lng, local.dept).then((dup) => {
      if (!cancelled) setDuplicateInfo(dup);
    });

    analyzeComplaint({
      imageBase64,
      description,
      lat,
      lng,
      hasVoice: Boolean(voiceNoteBase64),
      safetySensitive,
    })
      .then((result) => {
        if (cancelled) return;
        setAiResult(result);
        return checkDuplicate(lat, lng, result.dept);
      })
      .then((dup) => {
        if (!cancelled && dup) setDuplicateInfo(dup);
      })
      .catch(() => {
        if (!cancelled) {
          setError('AI enhancement unavailable. Local classification is ready to submit.');
        }
      })
      .finally(() => {
        if (!cancelled) setAnalyzing(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    submitted,
    imageBase64,
    description,
    voiceNoteBase64,
    lat,
    lng,
    setAiResult,
    setDuplicateInfo,
    safetySensitive,
  ]);

  const handleSubmit = async () => {
    if (!user || !aiResult) return;
    setSubmitting(true);
    setError('');

    try {
      let imageUrl = null;
      if (imageBase64) {
        const ext = imageBase64.includes('image/png') ? 'png' : 'jpg';
        const path = `${user.id}/${Date.now()}.${ext}`;
        const blob = base64ToBlob(imageBase64);
        const { error: uploadError } = await supabase.storage
          .from('complaint-images')
          .upload(path, blob, {
            contentType: blob.type,
            upsert: false,
          });
        if (uploadError) throw new Error(uploadError.message);
        const { data: urlData } = supabase.storage.from('complaint-images').getPublicUrl(path);
        imageUrl = urlData.publicUrl;
      }

      let voiceNoteUrl = null;
      if (voiceNoteBase64) {
        const mime = voiceNoteMime || 'audio/webm';
        const ext = mime.includes('mp4') ? 'm4a' : 'webm';
        const voicePath = `${user.id}/${Date.now()}-voice.${ext}`;
        const voiceBlob = base64ToBlob(voiceNoteBase64);
        const { error: voiceUploadError } = await supabase.storage
          .from('complaint-images')
          .upload(voicePath, voiceBlob, {
            contentType: mime,
            upsert: false,
          });
        if (voiceUploadError) throw new Error(voiceUploadError.message);
        const { data: voiceUrlData } = supabase.storage
          .from('complaint-images')
          .getPublicUrl(voicePath);
        voiceNoteUrl = voiceUrlData.publicUrl;
      }

      const isDup = Boolean(duplicateInfo?.isDuplicate);

      const submitSeverity = safetySensitive ? Math.max(4, aiResult.severity) : aiResult.severity;
      const submitSlaHours = SLA_BY_SEVERITY[submitSeverity - 1];

      const deptValue = (aiResult.dept || 'Other').trim() || 'Other';
      const divisionValue = (aiResult.division || 'General').trim() || 'General';

      const payload = {
        citizen_id: user.id,
        image_url: imageUrl,
        voice_note_url: voiceNoteUrl,
        lat,
        lng,
        address: address.trim() || null,
        description: description.trim(),
        dept: deptValue,
        division: divisionValue,
        severity: submitSeverity,
        sla_hours: submitSlaHours,
        sla_deadline: null,
        ward_id: wardId,
        assigned_to: null,
        status: 'open',
        ai_reasoning: aiResult.ai_reasoning,
        is_duplicate: isDup,
        master_complaint_id: isDup ? duplicateInfo.masterId : null,
        safety_sensitive: Boolean(safetySensitive),
      };

      let insertResult = await supabase.from('complaints').insert(payload).select('id').single();

      // DBs without migration: safety_sensitive column causes 400 — retry without it
      if (
        insertResult.error &&
        /safety_sensitive|schema cache|PGRST204/i.test(insertResult.error.message || '')
      ) {
        const { safety_sensitive: _drop, ...withoutFlag } = payload;
        insertResult = await supabase
          .from('complaints')
          .insert(withoutFlag)
          .select('id')
          .single();
      }

      const { data: complaint, error: insertError } = insertResult;
      if (insertError) throw new Error(insertError.message);

      if (isDup && duplicateInfo.masterId) {
        const prev = duplicateInfo.masterComplaint?.duplicate_count || 0;
        await supabase
          .from('complaints')
          .update({ duplicate_count: prev + 1 })
          .eq('id', duplicateInfo.masterId);
      }

      const officer = await findOfficerForDept(deptValue);
      if (officer?.id) {
        const prefix = safetySensitive ? 'Safety-sensitive report · ' : '';
        await createNotification(
          officer.id,
          'complaint_assigned',
          safetySensitive ? 'Safety-sensitive report to review' : 'New complaint to review',
          `${prefix}${deptValue} issue reported near ${address || 'your ward'} — assign a worker and set SLA.`,
          complaint.id
        );
      }

      setSubmitted(true, complaint.id);
    } catch (err) {
      setError(err.message || 'Failed to submit complaint. Please try again.');
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

  const displaySeverity =
    aiResult && safetySensitive ? Math.max(4, aiResult.severity) : aiResult?.severity;
  const displaySlaHours =
    aiResult && displaySeverity ? SLA_BY_SEVERITY[displaySeverity - 1] : aiResult?.sla_hours;

  if (submitted && ticketId) {
    return (
      <div className="max-w-lg mx-auto text-center animate-fade-in py-4">
        <div className="mx-auto w-20 h-20 rounded-full bg-accent-emerald/15 border border-accent-emerald/40 flex items-center justify-center mb-6 animate-success-check">
          <CheckCircle2 className="w-10 h-10 text-accent-emerald" strokeWidth={1.5} />
        </div>
        <h2 className="text-2xl font-semibold text-text-primary mb-2">Complaint submitted</h2>
        <p className="text-text-secondary mb-6">
          Your report has been logged and routed to the relevant department.
          {safetySensitive && (
            <>
              {' '}
              It is flagged for <span className="text-text-primary font-medium">priority review</span>{' '}
              because you used the safety-sensitive path.
            </>
          )}
        </p>

        <div className="card-elevated p-4 mb-4 text-left">
          <p className="text-xs text-text-hint uppercase tracking-wide mb-1">Ticket ID</p>
          <div className="flex items-center gap-2">
            <code className="text-sm text-accent-cyan font-mono break-all flex-1">{ticketId}</code>
            <button
              type="button"
              onClick={copyTicketId}
              className="btn-ghost p-2 shrink-0"
              aria-label="Copy ticket ID"
            >
              <Copy size={16} />
            </button>
          </div>
          {copied && <p className="text-xs text-accent-emerald mt-1">Copied!</p>}
        </div>

        <p className="mb-6 mx-auto max-w-sm text-sm text-text-secondary">
          <Award size={16} className="inline mr-1.5 -mt-0.5 text-accent-emerald" />
          Earn <span className="font-semibold text-text-primary">+10 civic credits</span> when you
          confirm the issue is resolved.
        </p>

        {duplicateInfo?.isDuplicate && (
          <p className="text-sm text-accent-amber bg-accent-amber/10 border border-accent-amber/30 rounded-lg px-4 py-3 mb-6">
            Linked to an existing nearby report. Your voice strengthens the case for faster action.
          </p>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button type="button" onClick={onViewDashboard} className="btn-primary">
            Go to dashboard
          </button>
          {onReportAnother && (
            <button type="button" onClick={onReportAnother} className="btn-ghost">
              Report another issue
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
          <Sparkles className="w-5 h-5 text-accent-cyan" />
          AI classification
        </h2>
        <p className="text-sm text-text-secondary mt-1">
          Review how NagarRakshak categorized your complaint before submitting.
          {safetySensitive && (
            <span className="block mt-2 text-rose-200/90 text-[13px]">
              Priority filing: severity will be at least high (4/5) with a shorter SLA so staff see it
              sooner.
            </span>
          )}
        </p>
      </div>

      {error && (
        <p className="text-sm text-accent-red bg-accent-red/10 border border-accent-red/30 rounded-lg px-3 py-2 mb-4">
          {error}
        </p>
      )}

      {analyzing && aiResult && (
        <div className="mb-4 flex items-center gap-2 text-xs text-text-muted" role="status">
          <LoadingSpinner size="sm" />
          <span>Enhancing classification with AI…</span>
        </div>
      )}

      {!aiResult && analyzing ? (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <LoadingSpinner size="lg" />
          <p className="text-sm text-text-secondary">Preparing classification…</p>
        </div>
      ) : aiResult ? (
        <div className="space-y-5">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="stat-card">
              <p className="text-xs text-text-hint uppercase tracking-wide mb-2">Department</p>
              <DeptTag dept={aiResult.dept} size="lg" />
            </div>
            <div className="stat-card">
              <p className="text-xs text-text-hint uppercase tracking-wide mb-2">Severity</p>
              <SeverityBadge severity={displaySeverity} />
            </div>
          </div>

          <div className="stat-card space-y-2">
            <div className="flex flex-wrap gap-2">
              <span className="badge-violet">{aiResult.division}</span>
              <span className="badge-cyan">{aiResult.urgency_label}</span>
              <span className="badge-amber">SLA: {displaySlaHours}h</span>
              {aiResult.location_risk && (
                <span className="badge-red">High-risk zone</span>
              )}
            </div>
            <p className="text-sm text-text-secondary leading-relaxed">
              <FileText className="w-4 h-4 inline mr-1 text-text-hint" />
              {aiResult.ai_reasoning}
            </p>
          </div>

          {duplicateInfo?.isDuplicate && (
            <div className="rounded-lg border border-accent-amber/40 bg-accent-amber/10 p-4 flex gap-3">
              <AlertTriangle className="w-5 h-5 text-accent-amber shrink-0" />
              <div>
                <p className="font-medium text-accent-amber">Possible duplicate nearby</p>
                <p className="text-sm text-text-secondary mt-1">
                  A similar {aiResult.dept} complaint exists within 150 m. Submitting will link your
                  report to strengthen resolution priority.
                </p>
              </div>
            </div>
          )}

          <div className="rounded-lg border border-border-default bg-bg-surface p-3 text-sm text-text-secondary space-y-1">
            <p>
              <span className="text-text-hint">Location:</span> {address || `${lat?.toFixed(4)}, ${lng?.toFixed(4)}`}
            </p>
            <p className="line-clamp-2">
              <span className="text-text-hint">Description:</span> {description}
            </p>
            {voiceNoteBase64 && (
              <p className="text-accent-cyan">Includes optional voice note</p>
            )}
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
                Submitting…
              </>
            ) : (
              <>
                <Send size={18} />
                Submit complaint
              </>
            )}
          </button>
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-text-secondary mb-4">Could not load AI results.</p>
          <button
            type="button"
            onClick={() => {
              setAiResult(null);
              setDuplicateInfo(null);
            }}
            className="btn-ghost"
          >
            Retry analysis
          </button>
        </div>
      )}
    </div>
  );
}
