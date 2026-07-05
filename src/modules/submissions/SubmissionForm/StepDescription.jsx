import { useEffect, useRef, useState } from 'react';
import { Mic, Square, Trash2, AlertCircle, Play, Pause } from 'lucide-react';

const MAX_RECORD_SEC = 90;

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export default function StepDescription({
  description,
  setDescription,
  voiceNoteBase64,
  voiceNoteMime,
  setVoiceNote,
  clearVoiceNote,
  minChars = 10,
  reportWithoutPhoto = false,
}) {
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const audioRef = useRef(null);

  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState('');
  const [micSupported, setMicSupported] = useState(true);

  useEffect(() => {
    setMicSupported(
      typeof navigator !== 'undefined' &&
        Boolean(navigator.mediaDevices?.getUserMedia) &&
        typeof MediaRecorder !== 'undefined'
    );
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      mediaRecorderRef.current?.state === 'recording' && mediaRecorderRef.current.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const startRecording = async () => {
    if (!micSupported) {
      setError('Voice recording is not supported in this browser.');
      return;
    }

    setError('');
    chunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : 'audio/mp4';

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stopStream();
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        setRecording(false);

        const blob = new Blob(chunksRef.current, { type: mimeType });
        if (blob.size < 500) {
          setError('Recording was too short. Try again or skip the voice note.');
          return;
        }
        const dataUrl = await blobToDataUrl(blob);
        setVoiceNote(dataUrl, mimeType.split(';')[0]);
        setRecordSeconds(0);
      };

      recorder.start(250);
      setRecording(true);
      setRecordSeconds(0);

      timerRef.current = setInterval(() => {
        setRecordSeconds((s) => {
          if (s + 1 >= MAX_RECORD_SEC) {
            stopRecording();
            return MAX_RECORD_SEC;
          }
          return s + 1;
        });
      }, 1000);
    } catch {
      stopStream();
      setError('Microphone access denied. You can still type your description.');
      setRecording(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  };

  const togglePlayback = () => {
    if (!voiceNoteBase64 || !audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.play();
      setPlaying(true);
    }
  };

  const removeVoiceNote = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setPlaying(false);
    clearVoiceNote();
  };

  const charCount = description.trim().length;
  const formatTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const noPhotoNeedsLongerText = reportWithoutPhoto && !voiceNoteBase64;

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-text-primary">Describe the issue</h2>
        <p className="text-sm text-text-secondary mt-1 leading-relaxed">
          Explain what happened, when, and where.
          {noPhotoNeedsLongerText ? (
            <span className="block mt-2 text-neutral-200">
              Without a photo, enter at least <strong className="text-white">{minChars}</strong>{' '}
              characters below — or record a{' '}
              <strong className="text-white">voice note</strong> first to continue with only{' '}
              <strong className="text-white">10</strong> characters in this box.
            </span>
          ) : voiceNoteBase64 && reportWithoutPhoto ? (
            <span className="block mt-2 text-[13px] text-cyan-200/95">
              Voice note will be sent with your report. At least {minChars} characters in the box is
              enough.
            </span>
          ) : (
            <span className="block mt-2 text-neutral-200">
              Minimum <strong className="text-white">{minChars}</strong> characters.
            </span>
          )}
        </p>
      </div>

      {error && (
        <p className="text-sm text-accent-amber bg-accent-amber/10 border border-accent-amber/30 rounded-lg px-3 py-2 mb-4 flex items-start gap-2">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          {error}
        </p>
      )}

      <textarea
        id="description"
        className="input-field min-h-[160px] resize-y"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="e.g. Large pothole near the bus stop has damaged two vehicles. Water collects here when it rains."
        rows={6}
      />

      <div className="flex items-center justify-between mt-3">
        <p
          className={`text-sm font-medium ${
            charCount >= minChars ? 'text-accent-emerald' : 'text-neutral-300'
          }`}
        >
          {charCount} / {minChars}+ characters
        </p>
      </div>

      <div className="mt-6 rounded-xl border border-white/15 bg-white/[0.06] p-4">
        <p className="text-sm font-medium text-text-primary mb-1">
          {reportWithoutPhoto ? 'Voice note (recommended without a photo)' : 'Optional voice note'}
        </p>
        <p className="text-xs text-neutral-300 mb-4 leading-relaxed">
          Record up to {MAX_RECORD_SEC} seconds so officers hear tone and urgency.
          {reportWithoutPhoto
            ? ' Lets you use a shorter written summary (10 characters) once recorded.'
            : ' Not required to submit.'}
        </p>

        {voiceNoteBase64 ? (
          <div className="flex flex-wrap items-center gap-3">
            <audio
              ref={audioRef}
              src={voiceNoteBase64}
              onEnded={() => setPlaying(false)}
              className="hidden"
            />
            <button
              type="button"
              onClick={togglePlayback}
              className="btn-ghost flex items-center gap-2 text-sm"
            >
              {playing ? <Pause size={16} /> : <Play size={16} />}
              {playing ? 'Pause' : 'Play'} recording
            </button>
            <button
              type="button"
              onClick={removeVoiceNote}
              className="btn-ghost flex items-center gap-2 text-sm text-accent-red hover:text-accent-red"
            >
              <Trash2 size={16} />
              Remove
            </button>
            <span className="text-xs text-text-hint">{voiceNoteMime || 'audio'}</span>
          </div>
        ) : micSupported ? (
          <div className="flex flex-wrap items-center gap-3">
            {recording ? (
              <>
                <button
                  type="button"
                  onClick={stopRecording}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-accent-red/50 bg-accent-red/10 text-accent-red text-sm font-medium"
                >
                  <Square size={16} />
                  Stop ({formatTime(recordSeconds)})
                </button>
                <span className="text-xs text-accent-cyan flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-accent-red animate-pulse" />
                  Recording…
                </span>
              </>
            ) : (
              <button
                type="button"
                onClick={startRecording}
                className="flex items-center gap-2 rounded-lg border border-white/25 bg-white/10 px-4 py-2.5 text-sm font-semibold text-text-primary shadow-[0_0_0_1px_rgba(255,255,255,0.08)] transition-all duration-200 hover:border-white/50 hover:bg-white/15 hover:text-white hover:shadow-[0_0_24px_rgba(255,255,255,0.28)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
              >
                <Mic size={16} className="shrink-0 text-text-primary" />
                Record voice note
              </button>
            )}
          </div>
        ) : (
          <p className="text-xs text-text-muted">Voice recording is not available in this browser.</p>
        )}
      </div>
    </div>
  );
}
