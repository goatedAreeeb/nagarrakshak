import { useRef, useState } from 'react';
import { Camera, Upload, RotateCcw, ImageIcon } from 'lucide-react';

const MAX_SIZE_MB = 8;

export default function StepCamera({ imageBase64, setImageBase64 }) {
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
    setImageBase64(null);
    stopCamera();
    setError('');
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-text-primary">Capture evidence</h2>
        <p className="text-sm text-text-secondary mt-1">
          Take a clear photo of the civic issue. This helps AI classify the complaint faster.
        </p>
      </div>

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
