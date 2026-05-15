import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useComplaintDraft } from '../../../contexts/ComplaintDraftContext.jsx';
import StepCamera from './StepCamera';
import StepLocation from './StepLocation';
import StepDescription from './StepDescription';
import StepAIResult from './StepAIResult';

const STEPS = [
  { id: 0, label: 'Photo' },
  { id: 1, label: 'Location' },
  { id: 2, label: 'Details' },
  { id: 3, label: 'Review' },
];

export default function ComplaintForm() {
  const navigate = useNavigate();
  const {
    draft,
    setStep,
    resetDraft,
    setImageBase64,
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
  } = useComplaintDraft();

  const {
    step,
    imageBase64,
    lat,
    lng,
    address,
    description,
    wardId,
    nearestWard,
    voiceNoteBase64,
    voiceNoteMime,
    aiResult,
    duplicateInfo,
    submitted,
    ticketId,
  } = draft;

  const shared = {
    imageBase64,
    setImageBase64,
    lat,
    setLat,
    lng,
    setLng,
    address,
    setAddress,
    description,
    setDescription,
    wardId,
    setWardId,
    nearestWard,
    setNearestWard,
    voiceNoteBase64,
    voiceNoteMime,
    setVoiceNote,
    clearVoiceNote,
    aiResult,
    setAiResult,
    duplicateInfo,
    setDuplicateInfo,
    submitted,
    setSubmitted: (flag, id) => setSubmitted(flag, id),
    ticketId,
  };

  const canProceed = () => {
    if (step === 0) return Boolean(imageBase64);
    if (step === 1) return lat != null && lng != null && wardId != null;
    if (step === 2) return description.trim().length >= 10;
    return false;
  };

  const handleNext = () => {
    if (step < 3 && canProceed()) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
  };

  if (submitted && ticketId) {
    return (
      <StepAIResult
        {...shared}
        ticketId={ticketId}
        onViewDashboard={() => navigate('/dashboard')}
        onReportAnother={resetDraft}
      />
    );
  }

  return (
    <div className="max-w-2xl mx-auto animate-slide-up">
      <div className="flex items-center justify-center gap-3 mb-8">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => i < step && setStep(i)}
              disabled={i > step}
              className="flex flex-col items-center gap-1.5 group disabled:cursor-default"
              aria-label={`Step ${i + 1}: ${s.label}`}
              aria-current={i === step ? 'step' : undefined}
            >
              <span
                className={`w-3 h-3 rounded-full transition-all duration-300 ${
                  i < step
                    ? 'bg-accent-cyan shadow-glow-cyan'
                    : i === step
                      ? 'bg-accent-cyan ring-4 ring-accent-cyan/25 scale-125'
                      : 'bg-border-default group-hover:bg-border-strong'
                }`}
              />
              <span
                className={`text-xs hidden sm:block ${
                  i === step ? 'text-accent-cyan font-medium' : 'text-text-hint'
                }`}
              >
                {s.label}
              </span>
            </button>
            {i < STEPS.length - 1 && (
              <span
                className={`w-8 sm:w-12 h-0.5 rounded ${
                  i < step ? 'bg-accent-cyan/60' : 'bg-border-default'
                }`}
              />
            )}
          </div>
        ))}
      </div>

      <div className="card-elevated p-6 sm:p-8 border border-border-default shadow-card">
        {step === 0 && <StepCamera {...shared} />}
        {step === 1 && <StepLocation {...shared} />}
        {step === 2 && <StepDescription {...shared} />}
        {step === 3 && (
          <StepAIResult
            {...shared}
            ticketId={ticketId}
            onViewDashboard={() => navigate('/dashboard')}
          />
        )}

        {step < 3 && (
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-border-default">
            <button
              type="button"
              onClick={handleBack}
              disabled={step === 0}
              className="btn-ghost flex items-center gap-1 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={18} />
              Back
            </button>
            <button
              type="button"
              onClick={handleNext}
              disabled={!canProceed()}
              className="btn-primary flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Continue
              <ChevronRight size={18} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
