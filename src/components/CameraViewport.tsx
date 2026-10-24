import React, { useState, useEffect, useRef } from 'react';
import {
  Camera,
  Video,
  RefreshCw,
  Upload,
  Settings2,
  Mic,
  MicOff,
  AlertTriangle,
  Pause,
  Play,
  RotateCcw,
  CheckCircle2,
  Lock,
} from 'lucide-react';

interface CameraViewportProps {
  onCapture: (file: File, type: 'image' | 'video') => void;
}

type CameraStatus = 'idle' | 'initializing' | 'active' | 'dismissed' | 'denied' | 'error';

export const CameraViewport: React.FC<CameraViewportProps> = ({ onCapture }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>('idle');
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<number | null>(null);
  const activeAudioStreamRef = useRef<MediaStream | null>(null);

  // Settings
  const [showSettings, setShowSettings] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [mirrorPreview, setMirrorPreview] = useState(true);
  const [resolution, setResolution] = useState<'720p' | '1080p' | '480p'>('720p');
  const [photoTimer, setPhotoTimer] = useState<0 | 3 | 5>(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isShutterFlashing, setIsShutterFlashing] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  // Synthetic shutter audio
  const playShutterSound = () => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } catch {
      // AudioContext muted/unsupported
    }
  };

  const getResolutionConstraints = () => {
    switch (resolution) {
      case '1080p':
        return { width: { ideal: 1920 }, height: { ideal: 1080 } };
      case '480p':
        return { width: { ideal: 640 }, height: { ideal: 480 } };
      case '720p':
      default:
        return { width: { ideal: 1280 }, height: { ideal: 720 } };
    }
  };

  const initCamera = async () => {
    setCameraStatus('initializing');
    setCameraError(null);

    // Stop existing stream tracks
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraStatus('error');
      setCameraError('Camera API is not supported in this browser or iframe environment.');
      return;
    }

    const resConstraints = getResolutionConstraints();

    try {
      // Request video ONLY for viewfinder (never audio during preview)
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facingMode,
          ...resConstraints,
        },
        audio: false,
      });

      setStream(newStream);
      setCameraStatus('active');
      setCameraError(null);

      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
      }
    } catch (err1) {
      // Try fallback constraints without resolution ideals
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facingMode },
          audio: false,
        });

        setStream(fallbackStream);
        setCameraStatus('active');
        setCameraError(null);

        if (videoRef.current) {
          videoRef.current.srcObject = fallbackStream;
        }
      } catch (err2: unknown) {
        const errObj = err2 as { name?: string; message?: string };
        const msg = errObj.message?.toLowerCase() || '';
        const name = errObj.name || '';

        const isDismissed =
          msg.includes('dismiss') ||
          name === 'NotAllowedError' ||
          name === 'PermissionDeniedError' ||
          name === 'SecurityError';

        if (isDismissed) {
          setCameraStatus('dismissed');
          setCameraError(
            'Camera permission was dismissed or not granted yet. Click "Enable Camera" to grant access, or use the Native Camera / File button below.'
          );
        } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
          setCameraStatus('error');
          setCameraError('No webcam hardware found. You can still upload photos and videos directly.');
        } else if (name === 'NotReadableError' || name === 'TrackStartError') {
          setCameraStatus('error');
          setCameraError('Camera is in use by another app or browser tab.');
        } else {
          setCameraStatus('error');
          setCameraError(errObj.message || 'Unable to access live webcam.');
        }

        // Informative log instead of console.error to avoid unhandled crash alarms
        console.info('Live camera availability:', name || msg || 'inactive');
      }
    }
  };

  useEffect(() => {
    initCamera();
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      if (activeAudioStreamRef.current) {
        activeAudioStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (recordTimerRef.current) {
        clearInterval(recordTimerRef.current);
      }
    };
  }, [facingMode, resolution]);

  // Flip camera toggle
  const handleFlipCamera = () => {
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
  };

  // Photo Capture
  const handleCapturePhoto = () => {
    if (!stream || !videoRef.current) {
      // If camera is not active, trigger native file/cam selector
      fileInputRef.current?.click();
      return;
    }

    if (photoTimer > 0) {
      setCountdown(photoTimer);
      let remaining = photoTimer;
      const interval = setInterval(() => {
        remaining -= 1;
        if (remaining > 0) {
          setCountdown(remaining);
        } else {
          clearInterval(interval);
          setCountdown(null);
          executePhotoCapture();
        }
      }, 1000);
    } else {
      executePhotoCapture();
    }
  };

  const executePhotoCapture = () => {
    if (!videoRef.current) return;
    playShutterSound();
    setIsShutterFlashing(true);
    setTimeout(() => setIsShutterFlashing(false), 200);

    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    if (mirrorPreview && facingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' });
        onCapture(file, 'image');
      },
      'image/jpeg',
      0.92
    );
  };

  // Video Recording
  const handleToggleRecordVideo = () => {
    if (!stream) {
      // If camera is not active, trigger native video/file selector
      fileInputRef.current?.click();
      return;
    }

    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const startRecording = async () => {
    if (!stream) return;
    recordedChunksRef.current = [];

    let recordingStream = stream;

    // If audio is enabled, attempt to acquire audio track smoothly
    if (audioEnabled) {
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        activeAudioStreamRef.current = audioStream;
        recordingStream = new MediaStream([
          ...stream.getVideoTracks(),
          ...audioStream.getAudioTracks(),
        ]);
      } catch (audioErr) {
        // If microphone was denied or dismissed, continue recording video gracefully
        console.info('Microphone track skipped (recording video without mic):', audioErr);
        recordingStream = stream;
      }
    }

    let options = { mimeType: 'video/webm;codecs=vp9,opus' };
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      options = { mimeType: 'video/webm' };
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options = { mimeType: 'video/mp4' };
        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
          options = { mimeType: '' };
        }
      }
    }

    try {
      const recorder = options.mimeType
        ? new MediaRecorder(recordingStream, options)
        : new MediaRecorder(recordingStream);

      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const mime = recorder.mimeType || 'video/webm';
        const extension = mime.includes('mp4') ? 'mp4' : 'webm';
        const blob = new Blob(recordedChunksRef.current, { type: mime });
        const file = new File([blob], `video_${Date.now()}.${extension}`, { type: mime });
        onCapture(file, 'video');

        // Stop temporary audio tracks
        if (activeAudioStreamRef.current) {
          activeAudioStreamRef.current.getTracks().forEach((track) => track.stop());
          activeAudioStreamRef.current = null;
        }

        setIsRecording(false);
        setIsPaused(false);
        setRecordSeconds(0);
        if (recordTimerRef.current) {
          clearInterval(recordTimerRef.current);
          recordTimerRef.current = null;
        }
      };

      recorder.start(1000);
      setIsRecording(true);
      setIsPaused(false);
      setRecordSeconds(0);

      recordTimerRef.current = window.setInterval(() => {
        setRecordSeconds((s) => s + 1);
      }, 1000);
    } catch (err) {
      console.warn('Failed to start MediaRecorder:', err);
      // Fallback to native capture picker
      fileInputRef.current?.click();
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const togglePauseRecording = () => {
    if (!mediaRecorderRef.current) return;
    if (isPaused) {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
    } else {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
    }
  };

  const formatTimer = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const type = file.type.startsWith('video') ? 'video' : 'image';
      onCapture(file, type);
    }
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const type = file.type.startsWith('video') ? 'video' : 'image';
      onCapture(file, type);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-2xl relative overflow-hidden backdrop-blur-md">
      {/* Shutter flash effect */}
      {isShutterFlashing && (
        <div className="absolute inset-0 bg-white z-50 pointer-events-none transition-opacity duration-150 opacity-90" />
      )}

      {/* Header bar */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800/80 border border-slate-700/60 text-xs font-medium text-slate-300">
            <span
              className={`w-2 h-2 rounded-full ${
                cameraStatus === 'active'
                  ? isRecording
                    ? 'bg-red-500 animate-record-dot'
                    : 'bg-emerald-400'
                  : cameraStatus === 'initializing'
                  ? 'bg-blue-400 animate-pulse'
                  : 'bg-amber-400'
              }`}
            />
            <span>
              {isRecording
                ? `Recording (${formatTimer(recordSeconds)})`
                : cameraStatus === 'active'
                ? `${facingMode === 'user' ? 'Front Camera' : 'Back Camera'} (${resolution})`
                : cameraStatus === 'initializing'
                ? 'Connecting Camera...'
                : 'Camera Standby'}
            </span>
          </div>

          {audioEnabled ? (
            <span className="flex items-center gap-1 text-[11px] text-slate-400 bg-slate-800/50 px-2 py-0.5 rounded">
              <Mic className="w-3 h-3 text-emerald-400" /> Mic On
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[11px] text-slate-500 bg-slate-800/50 px-2 py-0.5 rounded">
              <MicOff className="w-3 h-3 text-slate-500" /> Muted
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSettings((v) => !v)}
            className={`p-1.5 rounded-lg border text-xs transition ${
              showSettings
                ? 'bg-blue-600 text-white border-blue-500'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
            title="Camera Settings"
          >
            <Settings2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Settings Drawer */}
      {showSettings && (
        <div className="mb-3 p-3 bg-slate-800/90 border border-slate-700/80 rounded-xl text-xs space-y-2.5 animate-in slide-in-from-top-2">
          <div className="flex items-center justify-between font-semibold text-slate-200 pb-1 border-b border-slate-700">
            <span>Camera &amp; Capture Settings</span>
            <button
              onClick={() => setShowSettings(false)}
              className="text-slate-400 hover:text-white text-xs underline"
            >
              Done
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div>
              <label className="text-slate-400 block mb-1">Resolution</label>
              <select
                value={resolution}
                onChange={(e) => setResolution(e.target.value as '720p' | '1080p' | '480p')}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-slate-200"
              >
                <option value="480p">SD (480p)</option>
                <option value="720p">HD (720p)</option>
                <option value="1080p">Full HD (1080p)</option>
              </select>
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Timer (Photo)</label>
              <select
                value={photoTimer}
                onChange={(e) => setPhotoTimer(Number(e.target.value) as 0 | 3 | 5)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-slate-200"
              >
                <option value={0}>Immediate (0s)</option>
                <option value={3}>3 Seconds</option>
                <option value={5}>5 Seconds</option>
              </select>
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Microphone</label>
              <button
                onClick={() => setAudioEnabled((v) => !v)}
                className={`w-full py-1.5 px-2 rounded-lg border flex items-center justify-center gap-1.5 ${
                  audioEnabled
                    ? 'bg-emerald-950/60 border-emerald-600/50 text-emerald-300'
                    : 'bg-slate-900 border-slate-700 text-slate-400'
                }`}
              >
                {audioEnabled ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
                {audioEnabled ? 'Enabled' : 'Disabled'}
              </button>
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Mirror Front Cam</label>
              <button
                onClick={() => setMirrorPreview((v) => !v)}
                className={`w-full py-1.5 px-2 rounded-lg border flex items-center justify-center gap-1.5 ${
                  mirrorPreview
                    ? 'bg-blue-950/60 border-blue-600/50 text-blue-300'
                    : 'bg-slate-900 border-slate-700 text-slate-400'
                }`}
              >
                {mirrorPreview ? 'Mirrored' : 'Natural'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Video Viewport Frame */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`relative w-full aspect-video max-h-[420px] bg-black rounded-xl overflow-hidden border transition-all flex items-center justify-center ${
          dragOver ? 'border-blue-500 ring-2 ring-blue-500/50 bg-blue-950/20' : 'border-slate-800'
        }`}
      >
        {/* Live Video Element */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-cover transition duration-300 ${
            mirrorPreview && facingMode === 'user' ? 'scale-x-[-1]' : ''
          } ${cameraStatus === 'active' ? 'block' : 'hidden'}`}
        />

        {/* Countdown Overlay */}
        {countdown !== null && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-30 flex flex-col items-center justify-center">
            <span className="text-7xl font-extrabold text-white animate-ping">{countdown}</span>
            <span className="text-sm font-medium text-slate-300 mt-2">Get ready...</span>
          </div>
        )}

        {/* Live Recording HUD overlay */}
        {isRecording && (
          <div className="absolute top-3 left-3 z-20 flex items-center gap-2 bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-full border border-red-500/40 text-red-400 font-mono text-xs">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-record-dot" />
            <span className="font-semibold text-white tracking-wider">REC {formatTimer(recordSeconds)}</span>
            {isPaused && (
              <span className="bg-amber-500/20 text-amber-300 px-1.5 py-0.2 rounded text-[10px]">PAUSED</span>
            )}
          </div>
        )}

        {/* Drop zone indicator when dragging files */}
        {dragOver && (
          <div className="absolute inset-0 bg-blue-900/60 backdrop-blur-sm z-40 flex flex-col items-center justify-center text-white border-2 border-dashed border-blue-400 rounded-xl p-4">
            <Upload className="w-12 h-12 text-blue-300 mb-2 animate-bounce" />
            <p className="font-semibold text-lg">Drop Photos or Videos to Queue</p>
            <p className="text-xs text-blue-200">Will be uploaded immediately to IMG-VID storage</p>
          </div>
        )}

        {/* Initializing Spinner */}
        {cameraStatus === 'initializing' && (
          <div className="flex flex-col items-center justify-center gap-2 p-6 text-slate-400">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs">Connecting to camera viewfinder...</span>
          </div>
        )}

        {/* Permission Dismissed / Standby Card */}
        {(cameraStatus === 'dismissed' || cameraStatus === 'denied' || cameraStatus === 'idle') && (
          <div className="p-6 max-w-md text-center bg-slate-900/95 border border-slate-700/80 rounded-2xl text-slate-200 space-y-3.5 z-10 m-4 shadow-2xl backdrop-blur-md">
            <div className="w-12 h-12 rounded-full bg-blue-600/20 border border-blue-500/40 flex items-center justify-center mx-auto text-blue-400">
              <Camera className="w-6 h-6" />
            </div>
            <div>
              <div className="text-sm font-bold text-white">Enable Live Camera</div>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Click below to grant camera access and activate the live camera preview. You can also upload photos and videos directly from your files.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              <button
                onClick={initCamera}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition shadow-md shadow-blue-900/40"
              >
                <Camera className="w-3.5 h-3.5" /> Enable Camera
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-medium border border-slate-700 flex items-center gap-1.5 transition"
              >
                <Upload className="w-3.5 h-3.5 text-emerald-400" /> Native Cam / File
              </button>
            </div>
          </div>
        )}

        {/* Other Hardware Error Card */}
        {cameraStatus === 'error' && (
          <div className="p-6 max-w-md text-center bg-slate-900/95 border border-amber-600/40 rounded-2xl text-amber-200 space-y-3 z-10 m-4 shadow-xl">
            <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto" />
            <div className="text-sm font-semibold text-amber-300">Camera Notice</div>
            <p className="text-xs text-slate-300 leading-relaxed">{cameraError}</p>
            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              <button
                onClick={initCamera}
                className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Try Again
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition"
              >
                <Upload className="w-3.5 h-3.5" /> Native Cam / Choose File
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Control Action Buttons Bar */}
      <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-3 mt-4">
        {/* Flip Camera */}
        <button
          onClick={handleFlipCamera}
          disabled={cameraStatus !== 'active' || isRecording}
          className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-200 text-xs sm:text-sm font-medium border border-slate-700 transition flex items-center gap-2 shadow-sm"
          title="Switch front / rear camera"
        >
          <RefreshCw className="w-4 h-4 text-slate-400" />
          <span>Flip Cam</span>
        </button>

        {/* Take Photo */}
        <button
          onClick={handleCapturePhoto}
          disabled={isRecording}
          className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs sm:text-sm font-semibold transition flex items-center gap-2 shadow-md shadow-blue-900/30"
        >
          <Camera className="w-4 h-4" />
          <span>Take Photo 📸</span>
        </button>

        {/* Record Video */}
        <button
          onClick={handleToggleRecordVideo}
          className={`px-4 py-2.5 rounded-xl text-white text-xs sm:text-sm font-semibold transition flex items-center gap-2 shadow-md ${
            isRecording
              ? 'bg-red-600 hover:bg-red-500 shadow-red-900/50 animate-pulse'
              : 'bg-rose-600 hover:bg-rose-500 shadow-rose-900/30'
          }`}
        >
          <Video className="w-4 h-4" />
          <span>{isRecording ? `Stop REC (${formatTimer(recordSeconds)})` : 'Record Video 🎥'}</span>
        </button>

        {/* Pause/Resume when recording */}
        {isRecording && (
          <button
            onClick={togglePauseRecording}
            className="px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs sm:text-sm font-medium border border-slate-700 transition flex items-center gap-1.5"
          >
            {isPaused ? <Play className="w-4 h-4 text-emerald-400" /> : <Pause className="w-4 h-4 text-amber-400" />}
            <span>{isPaused ? 'Resume' : 'Pause'}</span>
          </button>
        )}

        {/* Upload File / Native Camera */}
        <label
          htmlFor="deviceFileInput"
          className="px-3.5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 active:scale-95 text-white text-xs sm:text-sm font-semibold transition flex items-center gap-2 cursor-pointer shadow-md shadow-emerald-950/40"
        >
          <Upload className="w-4 h-4" />
          <span>Upload / Native Cam 📁</span>
        </label>
        <input
          ref={fileInputRef}
          type="file"
          id="deviceFileInput"
          accept="image/*,video/*"
          capture="environment"
          multiple
          onChange={handleFileChange}
          className="hidden"
        />
      </div>
    </div>
  );
};
