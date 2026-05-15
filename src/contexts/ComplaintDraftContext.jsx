import { createContext, useContext, useCallback, useMemo, useState } from 'react';

const STORAGE_KEY = 'nagarrakshak_complaint_draft_v1';

const EMPTY_DRAFT = {
  step: 0,
  imageBase64: null,
  reportWithoutPhoto: false,
  safetySensitive: false,
  lat: null,
  lng: null,
  address: '',
  description: '',
  wardId: null,
  nearestWard: null,
  voiceNoteBase64: null,
  voiceNoteMime: null,
  aiResult: null,
  duplicateInfo: null,
  submitted: false,
  ticketId: null,
};

function loadDraft() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...EMPTY_DRAFT };
    const parsed = JSON.parse(raw);
    return { ...EMPTY_DRAFT, ...parsed };
  } catch {
    return { ...EMPTY_DRAFT };
  }
}

function saveDraft(draft) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  } catch {
    /* quota */
  }
}

function clearStoredDraft() {
  sessionStorage.removeItem(STORAGE_KEY);
}

const ComplaintDraftContext = createContext(null);

export function ComplaintDraftProvider({ children }) {
  const [draft, setDraftState] = useState(loadDraft);

  const setDraft = useCallback((updater) => {
    setDraftState((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : { ...prev, ...updater };
      saveDraft(next);
      return next;
    });
  }, []);

  const resetDraft = useCallback(() => {
    clearStoredDraft();
    setDraftState({ ...EMPTY_DRAFT });
  }, []);

  const setStep = useCallback((step) => setDraft((d) => ({ ...d, step })), [setDraft]);
  const setImageBase64 = useCallback(
    (imageBase64) =>
      setDraft((d) => ({
        ...d,
        imageBase64,
        reportWithoutPhoto: imageBase64 ? false : d.reportWithoutPhoto,
      })),
    [setDraft]
  );
  const setReportWithoutPhoto = useCallback(
    (reportWithoutPhoto) =>
      setDraft((d) => ({
        ...d,
        reportWithoutPhoto,
        imageBase64: reportWithoutPhoto ? null : d.imageBase64,
      })),
    [setDraft]
  );
  const setLat = useCallback((lat) => setDraft((d) => ({ ...d, lat })), [setDraft]);
  const setLng = useCallback((lng) => setDraft((d) => ({ ...d, lng })), [setDraft]);
  const setAddress = useCallback((address) => setDraft((d) => ({ ...d, address })), [setDraft]);
  const setDescription = useCallback((description) => setDraft((d) => ({ ...d, description })), [setDraft]);
  const setWardId = useCallback((wardId) => setDraft((d) => ({ ...d, wardId })), [setDraft]);
  const setNearestWard = useCallback((nearestWard) => setDraft((d) => ({ ...d, nearestWard })), [setDraft]);
  const setVoiceNote = useCallback(
    (voiceNoteBase64, voiceNoteMime = 'audio/webm') =>
      setDraft((d) => ({ ...d, voiceNoteBase64, voiceNoteMime })),
    [setDraft]
  );
  const clearVoiceNote = useCallback(
    () => setDraft((d) => ({ ...d, voiceNoteBase64: null, voiceNoteMime: null })),
    [setDraft]
  );
  const setAiResult = useCallback((aiResult) => setDraft((d) => ({ ...d, aiResult })), [setDraft]);
  const setDuplicateInfo = useCallback(
    (duplicateInfo) => setDraft((d) => ({ ...d, duplicateInfo })),
    [setDraft]
  );
  const setSubmitted = useCallback(
    (submitted, ticketId = null) =>
      setDraft((d) => ({ ...d, submitted, ticketId: ticketId ?? d.ticketId })),
    [setDraft]
  );

  const setSafetySensitive = useCallback(
    (safetySensitive) => setDraft((d) => ({ ...d, safetySensitive: Boolean(safetySensitive) })),
    [setDraft]
  );

  const value = useMemo(
    () => ({
      draft,
      setDraft,
      resetDraft,
      setStep,
      setImageBase64,
      setReportWithoutPhoto,
      setSafetySensitive,
      setLat,
      setLng,
      setAddress,
      setDescription,
      setWardId,
      setNearestWard,
      setVoiceNote,
      clearVoiceNote,
      setAiResult,
      setDuplicateInfo,
      setSubmitted,
    }),
    [
      draft,
      setDraft,
      resetDraft,
      setStep,
      setImageBase64,
      setReportWithoutPhoto,
      setSafetySensitive,
      setLat,
      setLng,
      setAddress,
      setDescription,
      setWardId,
      setNearestWard,
      setVoiceNote,
      clearVoiceNote,
      setAiResult,
      setDuplicateInfo,
      setSubmitted,
    ]
  );

  return (
    <ComplaintDraftContext.Provider value={value}>{children}</ComplaintDraftContext.Provider>
  );
}

export function useComplaintDraft() {
  const ctx = useContext(ComplaintDraftContext);
  if (!ctx) throw new Error('useComplaintDraft must be used within ComplaintDraftProvider');
  return ctx;
}
