import { useRef, useState } from 'react';
import { Camera, Upload, RotateCcw, ImageIcon, Shield } from 'lucide-react';

const MAX_SIZE_MB = 8;

export default function StepCamera({
  imageBase64,
  setImageBase64,
  reportWithoutPhoto,
  setReportWithoutPhoto,
}) {
  const fileRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const [mode, setMode] = useState(null);
  const [error, setError] = useState('');

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setMode(null);
  };

  const readFile = (file) => {
    if (!file?.type.startsWith('image/')) {
      setError('Please select an image file (JPEG or PNG).');
      return;
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`Image must be under ${MAX_SIZE_MB} MB.`);
      return;
    }
    setError('');
    const reader = new FileReader();
    reader.onload = () => setImageBase64(reader.result);
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) readFile(file);
    e.target.value = '';
  };

  const startCamera = async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      streamRef.current = stream;
      setMode('camera');
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      });
    } catch {
      setError('Camera access denied. Use upload instead.');
    }
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);
    setImageBase64(canvas.toDataURL('image/jpeg', 0.85));
    stopCamera();
  };

  const clearImage = () => {
    setReportWithoutPhoto(false);
    setImageBase64(null);
    stopCamera();
    setError('');
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-text-primary">Capture evidence</h2>
        <p className="text-sm text-text-secondary mt-1">
          A photo helps AI route your complaint faster. If it is unsafe or not possible to photograph,
          you can continue with location and a detailed written report below.
        </p>
      </div>

      {reportWithoutPhoto && (
        <div className="mb-6 rounded-xl border border-cyan-400/35 bg-cyan-500/[0.14] px-4 py-3.5 text-sm">
          <p className="font-semibold text-white">Reporting without a photo</p>
          <p className="mt-1.5 text-neutral-200 leading-relaxed">
            Next steps: confirm location, then describe what happened (at least 25 characters). You
            can add a voice note on the details step if that is easier than typing.
          </p>
          <button
            type="button"
            onClick={() => setReportWithoutPhoto(false)}
            className="mt-3 text-sm font-semibold text-cyan-300 hover:text-cyan-200 underline underline-offset-4"
          >
            Add a photo instead
          </button>
        </div>
      )}

      {error && (
        <p className="text-sm text-accent-red bg-accent-red/10 border border-accent-red/30 rounded-lg px-3 py-2 mb-4">
          {error}
        </p>
      )}

      {imageBase64 ? (
        <div className="space-y-4">
          <div className="relative rounded-xl overflow-hidden border border-border-strong bg-bg-surface aspect-video">
            <img
              src={imageBase64}
              alt="Complaint preview"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={clearImage}
              className="btn-ghost flex-1 flex items-center justify-center gap-2"
            >
              <RotateCcw size={18} />
              Retake
            </button>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="btn-ghost flex-1 flex items-center justify-center gap-2"
            >
              <Upload size={18} />
              Replace
            </button>
          </div>
        </div>
      ) : mode === 'camera' ? (
        <div className="space-y-4">
          <div className="relative rounded-xl overflow-hidden border border-border-strong bg-black aspect-video">
            <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
          </div>
          <canvas ref={canvasRef} className="hidden" />
          <div className="flex gap-3">
            <button type="button" onClick={stopCamera} className="btn-ghost flex-1">
              Cancel
            </button>
            <button
              type="button"
              onClick={capturePhoto}
              className="btn-primary flex-1 flex items-center justify-center gap-2"
            >
              <Camera size={18} />
              Capture
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {!reportWithoutPhoto && (
            <div className="grid sm:grid-cols-2 gap-4">
              <button
                type="button"
                onClick={startCamera}
                className="flex flex-col items-center justify-center gap-3 p-8 rounded-xl border-2 border-dashed border-border-strong bg-bg-surface hover:border-accent-cyan hover:bg-accent-cyan/5 transition-all"
              >
                <Camera className="w-10 h-10 text-accent-cyan" strokeWidth={1.5} />
                <span className="font-medium text-text-primary">Use camera</span>
                <span className="text-xs text-text-hint">Opens rear camera on mobile</span>
              </button>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex flex-col items-center justify-center gap-3 p-8 rounded-xl border-2 border-dashed border-border-strong bg-bg-surface hover:border-accent-cyan hover:bg-accent-cyan/5 transition-all"
              >
                <ImageIcon className="w-10 h-10 text-accent-violet" strokeWidth={1.5} />
                <span className="font-medium text-text-primary">Upload photo</span>
                <span className="text-xs text-text-hint">JPEG or PNG, max {MAX_SIZE_MB} MB</span>
              </button>
            </div>
          )}

          {!reportWithoutPhoto && (
            <div className="rounded-xl border border-cyan-400/35 bg-cyan-500/[0.14] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
              <div className="flex gap-3">
                <Shield className="h-6 w-6 shrink-0 text-cyan-300 mt-0.5" strokeWidth={2} aria-hidden />
                <div className="min-w-0">
                  <p className="text-base font-semibold text-white">Sensitive or risky to photograph?</p>
                  <p className="text-sm text-neutral-200 mt-2 leading-relaxed">
                    For harassment, stalking, or when pulling out a phone could be unsafe, file with
                    text and GPS only. Officers still receive your report; optional voice note on the
                    next screen can replace a picture.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setError('');
                      stopCamera();
                      setReportWithoutPhoto(true);
                    }}
                    className="mt-4 w-full sm:w-auto text-left text-sm font-semibold uppercase tracking-wide text-cyan-200 hover:text-white py-2 min-h-[44px] border border-cyan-400/40 rounded-xl px-4 bg-black/25 hover:bg-black/35 transition-colors"
                  >
                    Continue without photo
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}
