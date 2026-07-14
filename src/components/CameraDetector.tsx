import React, { useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, RefreshCw, AlertTriangle, Play, ShieldAlert, Check, List, Settings, Music, Square } from 'lucide-react';
import { DetectorSettings, MotionLog } from '../types';
import { saveMotionLog, performAutoCacheClean } from '../utils/indexedDB';
import { playPresetSound, playCustomSound, isAudioCurrentlyPlaying, stopAllAudio } from '../utils/audio';
import { TRANSLATIONS, Language } from '../utils/lang';
import SettingsPanel from './SettingsPanel';

interface CameraDetectorProps {
  settings: DetectorSettings;
  customAudioData: string | null;
  onCustomAudioSaved: (data: string | null) => void;
  onLogTriggered: (log: MotionLog) => void;
  isDetecting: boolean;
  setIsDetecting: (val: boolean) => void;
  onSettingsChange: (settings: DetectorSettings) => void;
  lang: Language;
  onOpenLogs?: () => void;
  logCount?: number;
  onCoolDown: boolean;
  setOnCoolDown: (val: boolean) => void;
  coolDownRemaining: number;
  setCoolDownRemaining: React.Dispatch<React.SetStateAction<number>>;
  isAlarmPlaying: boolean;
  setIsAlarmPlaying: (val: boolean) => void;
  minimalMode?: boolean;
}

export default function CameraDetector({
  settings,
  customAudioData,
  onCustomAudioSaved,
  onLogTriggered,
  isDetecting,
  setIsDetecting,
  onSettingsChange,
  lang,
  onOpenLogs,
  logCount = 0,
  onCoolDown,
  setOnCoolDown,
  coolDownRemaining,
  setCoolDownRemaining,
  isAlarmPlaying,
  setIsAlarmPlaying,
  minimalMode = false,
}: CameraDetectorProps) {
  const t = TRANSLATIONS[lang];
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const visibleCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const hiddenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [currentDiffAmount, setCurrentDiffAmount] = useState<number>(0);
  const [zoomLevel, setZoomLevel] = useState<number>(1.0);
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [isAudioPlaying, setIsAudioPlaying] = useState<boolean>(false);
  const [showSliders, setShowSliders] = useState<boolean>(false);
  const [activeTrackName, setActiveTrackName] = useState<string>('');

  useEffect(() => {
    const updateActiveTrackName = async () => {
      if (settings.audioSourceType === 'preset') {
        const presetNames: Record<string, string> = {
          'beep_short': lang === 'uk' ? 'Короткий сигнал' : 'Short Beep',
          'alarm_classic': lang === 'uk' ? 'Класична сирена' : 'Classic Siren',
          'digital_beeps': lang === 'uk' ? 'Цифрові сигнали' : 'Digital Beeps',
          'police_siren': lang === 'uk' ? 'Поліцейська сирена' : 'Police Siren',
          'air_raid': lang === 'uk' ? 'Повітряна тривога' : 'Air Raid Siren',
        };
        setActiveTrackName(presetNames[settings.audioPresetId] || settings.audioPresetId);
      } else if (settings.customAudioId) {
        try {
          const { getCustomAudio } = await import('../utils/indexedDB');
          const file = await getCustomAudio(settings.customAudioId);
          if (file) {
            setActiveTrackName(file.name);
          } else {
            setActiveTrackName(lang === 'uk' ? 'Невідомий файл з Диску' : 'Unknown Drive File');
          }
        } catch (e) {
          setActiveTrackName(lang === 'uk' ? 'Аудіо з Диску' : 'Drive Audio');
        }
      } else {
        setActiveTrackName(lang === 'uk' ? 'Сигнал за замовчуванням' : 'Default Signal');
      }
    };
    updateActiveTrackName();

    const handleSyncUpdate = () => {
      updateActiveTrackName();
    };
    window.addEventListener('custom-audios-updated', handleSyncUpdate);
    return () => {
      window.removeEventListener('custom-audios-updated', handleSyncUpdate);
    };
  }, [settings.audioSourceType, settings.audioPresetId, settings.customAudioId, lang]);
  
  // Auto hide sliders if no interaction for 15 seconds
  const autoHideTimerRef = useRef<NodeJS.Timeout | null>(null);

  const resetAutoHideTimer = () => {
    if (autoHideTimerRef.current) {
      clearTimeout(autoHideTimerRef.current);
    }
    if (showSliders) {
      autoHideTimerRef.current = setTimeout(() => {
        setShowSliders(false);
      }, 15000);
    }
  };

  useEffect(() => {
    resetAutoHideTimer();
    return () => {
      if (autoHideTimerRef.current) {
        clearTimeout(autoHideTimerRef.current);
      }
    };
  }, [
    showSliders,
    settings.coolDownDelay,
    settings.sensitivity,
    settings.noiseThreshold,
    settings.audioVolume
  ]);
  
  // Back references for thread loop safety
  const prevFrameRef = useRef<Uint8ClampedArray | null>(null);
  const settingsRef = useRef<DetectorSettings>(settings);
  const isDetectingRef = useRef<boolean>(isDetecting);
  const onCoolDownRef = useRef<boolean>(false);
  const isAudioPlayingRef = useRef<boolean>(false);
  const animationFrameRef = useRef<number | null>(null);

  const isStartingRef = useRef<boolean>(false);

  const customAudioDataRef = useRef<string | null>(customAudioData);
  const zoomLevelRef = useRef<number>(zoomLevel);

  // Sync settings and states to refs
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    customAudioDataRef.current = customAudioData;
  }, [customAudioData]);

  useEffect(() => {
    zoomLevelRef.current = zoomLevel;
  }, [zoomLevel]);

  useEffect(() => {
    isDetectingRef.current = isDetecting;
    if (!isDetecting) {
      setCurrentDiffAmount(0);
      setOnCoolDown(false);
      setCoolDownRemaining(0);
      setIsAudioPlaying(false);
      isAudioPlayingRef.current = false;
      setIsAlarmPlaying(false);
      stopAllAudio();
    }
  }, [isDetecting]);

  useEffect(() => {
    onCoolDownRef.current = onCoolDown;
  }, [onCoolDown]);

  // Cooldown countdown is handled by App.tsx master timer

  // Initialize and clean up Camera stream
  const createSimulatedStream = (): MediaStream => {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');
    
    let frame = 0;
    const intervalId = setInterval(() => {
      if (!ctx) return;
      frame++;
      
      // Draw grid pattern
      ctx.fillStyle = '#0a0f1d'; // dark background
      ctx.fillRect(0, 0, 640, 480);
      
      // Horizontal scanning laser line
      const laserY = (frame * 4) % 480;
      
      // Draw subtle grid lines
      ctx.strokeStyle = 'rgba(30, 41, 59, 0.4)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 640; i += 40) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, 480);
        ctx.stroke();
      }
      for (let j = 0; j < 480; j += 40) {
        ctx.beginPath();
        ctx.moveTo(0, j);
        ctx.lineTo(640, j);
        ctx.stroke();
      }
      
      // Moving simulated target to create motion
      const x = 320 + Math.cos(frame * 0.04) * 160;
      const y = 240 + Math.sin(frame * 0.02) * 100;
      
      // Target marker
      ctx.strokeStyle = '#F27D26';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 15 + Math.sin(frame * 0.1) * 3, 0, Math.PI * 2);
      ctx.stroke();
      
      // Scanning line
      ctx.strokeStyle = 'rgba(242, 125, 38, 0.3)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, laserY);
      ctx.lineTo(640, laserY);
      ctx.stroke();
      
      // Overlay text
      ctx.fillStyle = '#64748b';
      ctx.font = '12px monospace';
      ctx.fillText(lang === 'uk' ? 'СИМУЛЬОВАНИЙ ПОТІК КАМЕРИ' : 'SIMULATED CAMERA FEED', 20, 35);
      ctx.fillText(`SYSTEM OK • FRAME ${frame}`, 20, 55);
      ctx.fillText(lang === 'uk' ? 'ПОШУК РУХУ...' : 'SEARCHING FOR MOTION...', 20, 75);
    }, 1000 / 12);
    
    const stream = (canvas as any).captureStream ? (canvas as any).captureStream(12) : null;
    if (stream) {
      stream.getVideoTracks().forEach((track: any) => {
        const originalStop = track.stop;
        track.stop = () => {
          clearInterval(intervalId);
          if (originalStop) originalStop.call(track);
        };
      });
      return stream;
    }
    return new MediaStream();
  };

  const startCamera = async (overrideFacingMode?: 'user' | 'environment') => {
    if (isStartingRef.current) return;
    isStartingRef.current = true;

    const activeMode = overrideFacingMode || settings.cameraFacingMode;

    if (stream) {
      stopCamera();
    }
    setCameraError(null);
    setIsCameraActive(false);

    try {
      // First try standard facingMode request to acquire permissions (which unlocks camera labels)
      const initialConstraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: activeMode },
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      };

      let mediaStream: MediaStream;
      let usingSimulatedCamera = false;
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia(initialConstraints);
      } catch (e) {
        console.warn("First GUM attempt failed, retrying generic video input", e);
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false
          });
        } catch (e2) {
          console.warn("No physical camera device found. Starting simulated scanning camera.", e2);
          mediaStream = createSimulatedStream();
          usingSimulatedCamera = true;
        }
      }

      // Permissions are unlocked, so we can check available devices and labels
      let devices: MediaDeviceInfo[] = [];
      if (!usingSimulatedCamera) {
        try {
          devices = await navigator.mediaDevices.enumerateDevices();
        } catch (e) {
          console.warn("Failed to enumerate devices", e);
        }
      }

      const videoDevices = devices.filter(d => d.kind === 'videoinput');
      console.log("All detected video input devices:", videoDevices);

      if (videoDevices.length > 1) {
        let targetDevice: MediaDeviceInfo | undefined = undefined;

        if (activeMode === 'environment') {
          // Look for rear / back / environment / main / задня / основна / camera 0 / 0
          targetDevice = videoDevices.find(d => {
            const label = d.label.toLowerCase();
            return label.includes('back') || 
                   label.includes('rear') || 
                   label.includes('env') || 
                   label.includes('main') || 
                   label.includes('основн') || 
                   label.includes('задн') || 
                   label.includes('камера 0') ||
                   label.includes('camera 0');
          });

          if (!targetDevice) {
            // Pick the last video input device as mobile back cameras are typically ordered last
            targetDevice = videoDevices[videoDevices.length - 1];
          }
        } else {
          // user -> front / user /передня / селфі / camera 1
          targetDevice = videoDevices.find(d => {
            const label = d.label.toLowerCase();
            return label.includes('front') || 
                   label.includes('user') || 
                   label.includes('передн') || 
                   label.includes('селф') || 
                   label.includes('камера 1') ||
                   label.includes('camera 1');
          });

          if (!targetDevice) {
            targetDevice = videoDevices[0];
          }
        }

        // If a specific target device is found, let's re-stream it!
        const currentTrack = mediaStream.getVideoTracks()[0];
        const currentTrackSettings = currentTrack?.getSettings();
        const currentDeviceId = currentTrackSettings?.deviceId;

        if (targetDevice && targetDevice.deviceId && targetDevice.deviceId !== currentDeviceId) {
          console.log("Switching to specific camera:", targetDevice.label, targetDevice.deviceId);
          const oldTracks = mediaStream.getTracks();
          try {
            const newStream = await navigator.mediaDevices.getUserMedia({
              video: {
                deviceId: { exact: targetDevice.deviceId },
                width: { ideal: 640 },
                height: { ideal: 480 }
              },
              audio: false
            });
            oldTracks.forEach(track => track.stop());
            mediaStream = newStream;
          } catch (e1) {
            console.warn("Failed to switch camera using exact deviceId, trying with ideal", e1);
            try {
              const newStream2 = await navigator.mediaDevices.getUserMedia({
                video: {
                  deviceId: targetDevice.deviceId,
                  width: { ideal: 640 },
                  height: { ideal: 480 }
                },
                audio: false
              });
              oldTracks.forEach(track => track.stop());
              mediaStream = newStream2;
            } catch (e2) {
              console.warn("Failed switching camera completely. Keeping original stream", e2);
              // Do not stop old tracks since we are keeping the original stream
            }
          }
        }
      }

      mediaStream.getVideoTracks().forEach(track => {
        track.onended = () => {
          setIsCameraActive(false);
          setStream(null);
        };
      });

      setStream(mediaStream);
      setIsCameraActive(true);
      
      // Use requestAnimationFrame for smoother operation on Safari/iOS
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        // On iOS, sometimes we need a small delay or a user gesture, but here we try auto-play
        const playPromise = videoRef.current.play();
        if (playPromise !== undefined) {
          playPromise.catch(err => {
            console.warn("Video auto-play blocked or failed:", err);
          });
        }
      }
    } catch (err: any) {
      console.error("Camera access error:", err);
      if (err.name === 'NotAllowedError') {
        setCameraError(t.noCameraPermission);
      } else if (err.name === 'NotFoundError') {
        setCameraError(`${t.noCameraFound} (${t.backCamera})`);
      } else {
        setCameraError(`${t.cameraConnectionError} ${err.message || ''}`);
      }
      setIsDetecting(false);
    } finally {
      isStartingRef.current = false;
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setIsCameraActive(false);
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    prevFrameRef.current = null;
  };

  // Re-start camera when facingMode changes
  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, [settings.cameraFacingMode]);

  // Main Motion Detection Processing Loop (runs at 10-12 FPS to stay extremely battery friendly on Galaxy A07)
  useEffect(() => {
    let lastProcessTime = 0;
    const processFrame = () => {
      if (!isCameraActive || !videoRef.current) {
        animationFrameRef.current = requestAnimationFrame(processFrame);
        return;
      }

      const now = performance.now();
      // Throttle to max 10 FPS (every 100ms) for maximum efficiency
      if (now - lastProcessTime < 100) {
        animationFrameRef.current = requestAnimationFrame(processFrame);
        return;
      }
      lastProcessTime = now;

      const video = videoRef.current;
      const visibleCanvas = visibleCanvasRef.current;
      const hiddenCanvas = hiddenCanvasRef.current;

      if (!visibleCanvas || !hiddenCanvas || video.paused || video.ended) {
        animationFrameRef.current = requestAnimationFrame(processFrame);
        return;
      }

      const vCtx = visibleCanvas.getContext('2d');
      const hCtx = hiddenCanvas.getContext('2d', { willReadFrequently: true });

      if (!vCtx || !hCtx) {
        animationFrameRef.current = requestAnimationFrame(processFrame);
        return;
      }

      const width = visibleCanvas.width;
      const height = visibleCanvas.height;

      // Calculate crop dimensions for digital zoom
      const activeZoom = zoomLevelRef.current;
      const svWidth = video.videoWidth || 640;
      const svHeight = video.videoHeight || 480;
      
      const sWidth = svWidth / activeZoom;
      const sHeight = svHeight / activeZoom;
      const sx = (svWidth - sWidth) / 2;
      const sy = (svHeight - sHeight) / 2;

      // Draw active camera crop on visible canvas
      try {
        vCtx.drawImage(video, sx, sy, sWidth, sHeight, 0, 0, width, height);
      } catch (err) {
        animationFrameRef.current = requestAnimationFrame(processFrame);
        return;
      }

      // Draw to a very small canvas for diffing (extremely safe for CPU)
      const diffWidth = 36;
      const diffHeight = 48;
      hCtx.drawImage(video, sx, sy, sWidth, sHeight, 0, 0, diffWidth, diffHeight);

      const frameData = hCtx.getImageData(0, 0, diffWidth, diffHeight);
      const data = frameData.data;

      if (prevFrameRef.current) {
        const prevData = prevFrameRef.current;
        let changedPixels = 0;
        const totalPixels = diffWidth * diffHeight;

        // Sensitivities map: lower sensitivity setting -> higher difference threshold
        // Setting sensitivity 100 = threshold of 10, sensitivity 1 = threshold of 90
        const activeSensitivity = settingsRef.current.sensitivity;
        const diffThreshold = Math.max(10, 100 - activeSensitivity * 0.9);

        // Motion bounding boxes accumulator
        let minX = diffWidth, maxX = 0, minY = diffHeight, maxY = 0;
        let diffPointsCount = 0;

        for (let i = 0; i < data.length; i += 4) {
          const rDiff = Math.abs(data[i] - prevData[i]);
          const gDiff = Math.abs(data[i+1] - prevData[i+1]);
          const bDiff = Math.abs(data[i+2] - prevData[i+2]);

          // Average channel variation
          const avgDiff = (rDiff + gDiff + bDiff) / 3;

          if (avgDiff > diffThreshold) {
            changedPixels++;
            
            // Map 1D index to small 2D canvas coordinates
            const pixelIndex = i / 4;
            const px = pixelIndex % diffWidth;
            const py = Math.floor(pixelIndex / diffWidth);
            
            if (px < minX) minX = px;
            if (px > maxX) maxX = px;
            if (py < minY) minY = py;
            if (py > maxY) maxY = py;
            
            diffPointsCount++;
          }
        }

        const percentageChanged = (changedPixels / totalPixels) * 100;
        // Apply responsive exponential smoothing to render numbers nicely in the UI
        setCurrentDiffAmount(prev => Number((prev * 0.4 + percentageChanged * 0.6).toFixed(2)));

        // If movement is detected and exceeds noise threshold
        const noiseThreshold = settingsRef.current.noiseThreshold;
        
        // Render motion box overlays if there was any activity
        if (diffPointsCount > 4 && isDetectingRef.current) {
          // Scale coords back to visible canvas size
          const scaleX = width / diffWidth;
          const scaleY = height / diffHeight;
          const rx = minX * scaleX;
          const ry = minY * scaleY;
          const rw = (maxX - minX + 1) * scaleX;
          const rh = (maxY - minY + 1) * scaleY;

          // Draw indicator rectangle on visible feed
          vCtx.strokeStyle = 'rgba(239, 68, 68, 0.8)'; // Red-500
          vCtx.lineWidth = 3;
          vCtx.strokeRect(rx, ry, rw, rh);
          
          // Draw flashing target icon
          vCtx.fillStyle = 'rgba(239, 68, 68, 0.2)';
          vCtx.fillRect(rx, ry, rw, rh);
        }

        // Trigger action!
        const currentlyPlaying = isAudioCurrentlyPlaying();
        if (currentlyPlaying !== isAudioPlayingRef.current) {
          const finishedPlaying = isAudioPlayingRef.current && !currentlyPlaying;
          isAudioPlayingRef.current = currentlyPlaying;
          setIsAudioPlaying(currentlyPlaying);
          setIsAlarmPlaying(currentlyPlaying);

          if (finishedPlaying && isDetectingRef.current) {
            // Audio has completely finished playing!
            // Start the cooldown countdown timer now!
            onCoolDownRef.current = true; // Synchronously block immediate triggering in the same tick!
            setOnCoolDown(true);
            const forcedCooldown = Math.max(2, settingsRef.current.coolDownDelay);
            setCoolDownRemaining(forcedCooldown);
          }
        }

        if (percentageChanged >= noiseThreshold && isDetectingRef.current && !onCoolDownRef.current && !currentlyPlaying && !isAudioPlayingRef.current) {
          handleMotionTriggered(visibleCanvas);
        }
      }

      // Store current frame's pixels for next comparison
      prevFrameRef.current = data;
      animationFrameRef.current = requestAnimationFrame(processFrame);
    };

    animationFrameRef.current = requestAnimationFrame(processFrame);
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isCameraActive]);

  // Action on Triggered Detector
  const handleMotionTriggered = async (visibleCanvas: HTMLCanvasElement) => {
    // Block multiple triggers by setting audio playing flags immediately
    setIsAudioPlaying(true);
    isAudioPlayingRef.current = true;
    setIsAlarmPlaying(true);

    // Capture instantaneous thumbnail from camera
    let thumbnail: string | null = null;
    try {
      thumbnail = visibleCanvas.toDataURL('image/jpeg', 0.5); // Downscaled JPEG format
    } catch (e) {
      console.warn("Unable to capture video snapshot due to browser sandbox limits:", e);
    }

    const newLog: MotionLog = {
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      timestamp: Date.now(),
      thumbnail,
    };

    // Save strictly to local IndexedDB and report state back
    await saveMotionLog(newLog);
    onLogTriggered(newLog);

    // Audio Playback
    try {
      const volumeMultiplier = (settingsRef.current.audioVolume ?? 100) / 100;
      if (settingsRef.current.audioSourceType === 'preset') {
        playPresetSound(settingsRef.current.audioPresetId, 4, volumeMultiplier);
      } else {
        const audioData = customAudioDataRef.current;
        if (audioData) {
          await playCustomSound(audioData, undefined, volumeMultiplier);
        } else {
          // Fallback to digital alarm preset if custom sound was unreadable/empty
          playPresetSound('beep_short', 4, volumeMultiplier);
        }
      }
    } catch (e) {
      console.error("Audio playback failure:", e);
    }

    // Auto cleanup of old caches
    if (settingsRef.current.autoCleanCacheEnabled) {
      try {
        await performAutoCacheClean(settingsRef.current.maxCacheLogsCount, settingsRef.current.customAudioId);
      } catch (e) {
        console.warn("Auto cache clean failed:", e);
      }
    }
  };

  const togglePlayPreview = async () => {
    if (isAudioCurrentlyPlaying()) {
      stopAllAudio();
      setIsAudioPlaying(false);
      setIsAlarmPlaying(false);
    } else {
      setIsAudioPlaying(true);
      setIsAlarmPlaying(true);
      const volumeMultiplier = (settings.audioVolume ?? 100) / 100;
      try {
        if (settings.audioSourceType === 'preset') {
          playPresetSound(settings.audioPresetId, 4, volumeMultiplier);
        } else {
          if (customAudioData) {
            await playCustomSound(customAudioData, undefined, volumeMultiplier);
          } else {
            playPresetSound('beep_short', 4, volumeMultiplier);
          }
        }
      } catch (e) {
        console.error("Test playback failed:", e);
        setIsAudioPlaying(false);
        setIsAlarmPlaying(false);
      }
    }
  };

  const toggleFacingMode = () => {
    const nextMode = settings.cameraFacingMode === 'user' ? 'environment' : 'user';
    onSettingsChange({
      ...settings,
      cameraFacingMode: nextMode,
    });
  };

  const toggleDetecting = () => {
    setIsDetecting(!isDetecting);
    // When stopping, reset last diff readings and cooldowns
    if (isDetecting) {
      setCurrentDiffAmount(0);
      setOnCoolDown(false);
      setCoolDownRemaining(0);
    }
  };

  return (
    <div className="bg-[#111111] border border-gray-800 rounded-3xl overflow-hidden shadow-2xl relative">
      {/* Hidden processing canvas: 36x48 for light computer-vision math */}
      <canvas ref={hiddenCanvasRef} width={36} height={48} className="hidden" />

      {/* Video tag source for frame grabbing - Modified to be visible but transparent to avoid iOS recording dialog */}
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        className="absolute opacity-0 pointer-events-none"
        style={{ width: '1px', height: '1px', top: 0, left: 0 }}
        onError={() => {
          setCameraError(lang === 'uk' ? 'Помилка відеотрансляції. Скористайтеся кнопкою перезапуску.' : 'Video stream error. Please reboot application.');
        }}
      />

      {/* Primary Display Feed */}
      <div className="relative aspect-[3/4] w-full max-w-sm mx-auto bg-[#050505] flex items-center justify-center overflow-hidden">
        
        {/* Simulated Night Vision Grid */}
        <div className="absolute inset-0 opacity-15 pointer-events-none z-10" style={{ backgroundImage: 'radial-gradient(circle, #444 1px, transparent 1px)', backgroundSize: '18px 18px' }}></div>

        {/* Overlay Corners */}
        <div className="absolute top-6 left-6 w-8 h-8 border-t-2 border-l-2 border-[#F27D26]/70 z-10 pointer-events-none"></div>
        <div className="absolute top-6 right-6 w-8 h-8 border-t-2 border-r-2 border-[#F27D26]/70 z-10 pointer-events-none"></div>
        <div className="absolute bottom-6 left-6 w-8 h-8 border-b-2 border-l-2 border-[#F27D26]/70 z-10 pointer-events-none"></div>
        <div className="absolute bottom-6 right-6 w-8 h-8 border-b-2 border-r-2 border-[#F27D26]/70 z-10 pointer-events-none"></div>

        {isCameraActive ? (
          <canvas
            ref={visibleCanvasRef}
            width={480}
            height={640}
            style={{
              transform: settings.cameraFacingMode === 'user' ? 'scaleX(-1)' : 'scaleX(1)',
              transformOrigin: 'center center',
            }}
            className={`w-full h-full object-cover transition-all duration-300 ${isAudioPlaying ? 'brightness-[0.4]' : 'brightness-100'}`}
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-gray-500 p-6 text-center z-20">
            <CameraOff className="w-20 h-20 mb-4 text-[#F27D26]/70 animate-pulse" />
            <p className="font-mono text-sm tracking-widest text-gray-400 uppercase mb-2">SEARCHING FOR MOTION...</p>
            {cameraError ? (
              <div className="space-y-4 px-4 max-w-sm flex flex-col items-center">
                <p className="text-red-450 text-xs font-sans leading-normal">{cameraError}</p>
                <button
                  onClick={() => window.location.reload()}
                  className="font-sans font-black text-xs bg-red-950/80 border border-red-500/40 hover:bg-red-900 hover:text-white text-red-300 py-2.5 px-4 rounded-xl active:scale-95 transition-all select-none cursor-pointer inline-flex items-center gap-1.5 shadow-md animate-bounce"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>{lang === 'uk' ? 'Перезавантажити джерело' : 'Reboot sensor'}</span>
                </button>
              </div>
            ) : (
              <p className="text-gray-500 text-xs px-4 max-w-sm font-sans leading-normal">
                {lang === 'uk' ? 'Натисніть «Підключити камеру» нижче, щоб надати камере доступ для виявлення відвідувачів' : 'Press "Connect camera" to grant active lens access'}
              </p>
            )}
          </div>
        )}

        {/* Hot Live Sensitivity Bar overlay - FOREGROUND z-50 */}
        {isCameraActive && (
          <div className="absolute top-3 left-3 right-3 bg-black/90 backdrop-blur-md rounded-xl py-2 px-3 border border-gray-800 flex flex-col gap-1.5 z-55">
            <div className="flex justify-between items-center text-xs font-sans">
              <span className="text-gray-450 font-semibold">{t.currentChange}</span>
              <span className={`font-mono font-bold ${currentDiffAmount >= settings.noiseThreshold ? 'text-red-500 animate-pulse' : 'text-zinc-300'}`}>
                {currentDiffAmount.toFixed(1)}%
              </span>
            </div>
            
            {/* Real-time bar container with threshold notch */}
            <div className="w-full h-2.5 bg-gray-900 rounded-full relative overflow-hidden animate-[pulse_6s_infinite]">
              <div 
                className={`h-full rounded-full transition-all duration-75 ${currentDiffAmount >= settings.noiseThreshold ? 'bg-red-500' : 'bg-zinc-200'}`}
                style={{ width: `${Math.min(100, (currentDiffAmount / Math.max(1, settings.noiseThreshold * 2)) * 100)}%` }}
              />
              {/* Threshold mark line */}
              <div 
                className="absolute top-0 bottom-0 w-0.5 bg-red-450 z-20 shadow-glow" 
                style={{ left: '50%' }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-gray-500 font-mono">
              <span>{t.normalState}</span>
              <span className="text-zinc-400 font-medium">{t.sensorThreshold} ({settings.noiseThreshold}%)</span>
            </div>
          </div>
        )}

        {/* Single-track Playlist Player overlay - FOREGROUND z-50 */}
        {isCameraActive && (
          <div className="absolute top-[96px] left-3 right-3 bg-black/90 backdrop-blur-md rounded-xl py-2 px-3 border border-gray-800 flex items-center justify-between gap-3.5 z-55 animate-fade-in shadow-lg">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-[#F27D26]/10 border border-[#F27D26]/25 flex items-center justify-center shrink-0">
                <Music className="w-4 h-4 text-[#F27D26] animate-[pulse_2s_infinite]" />
              </div>
              <div className="text-left leading-none min-w-0 font-sans">
                <p className="text-[9px] font-black uppercase text-[#F27D26]/90 tracking-wider">
                  {lang === 'uk' ? 'ОБРАНИЙ АКТИВНИЙ СИГНАЛ (1 ТРЕК)' : 'SELECTED ACTIVE ALARM (1 TRACK)'}
                </p>
                <p className="text-[11px] font-bold text-gray-200 truncate mt-1 max-w-[190px]" title={activeTrackName}>
                  {activeTrackName || (lang === 'uk' ? 'Завантаження...' : 'Loading...')}
                </p>
              </div>
            </div>

            {/* Play/Stop control */}
            <button
              type="button"
              onClick={togglePlayPreview}
              className={`w-7.5 h-7.5 rounded-lg flex items-center justify-center cursor-pointer transition-all active:scale-90 shrink-0 ${
                isAudioPlaying
                  ? 'bg-red-500/20 text-red-400 border border-red-500/35'
                  : 'bg-zinc-900 border border-zinc-800 hover:border-[#F27D26]/40 text-zinc-350 hover:text-white'
              }`}
            >
              {isAudioPlaying ? (
                <Square className="w-3 h-3 text-red-500 fill-red-500 animate-pulse" />
              ) : (
                <Play className="w-3 h-3 text-zinc-350 fill-zinc-350 ml-0.5" />
              )}
            </button>
          </div>
        )}

        {/* Playback / Cooldown timer block placed right under playlist block */}
        {(onCoolDown || isAudioPlaying) && isCameraActive && (
          <div className="absolute top-[152px] left-3 right-3 bg-black/95 backdrop-blur-md rounded-xl py-2 px-3 border border-orange-500/30 flex justify-between items-center gap-2 z-55 animate-fade-in shadow-lg">
            <div className="flex items-center gap-2 min-w-0">
              <span className={`w-2 h-2 rounded-full ${isAudioPlaying ? 'bg-red-500 animate-[ping_1.2s_infinite]' : 'bg-orange-500'} shrink-0`} />
              <ShieldAlert className={`w-4 h-4 ${isAudioPlaying ? 'text-red-500 animate-bounce' : 'text-orange-500'} shrink-0`} />
              <div className="text-left leading-none min-w-0 font-sans">
                <p className={`text-[10px] font-black uppercase tracking-wider ${isAudioPlaying ? 'text-red-400' : 'text-orange-400'}`}>
                  {isAudioPlaying ? (lang === 'uk' ? 'СИГНАЛ АКТИВНИЙ' : 'ALARM ACTIVE') : (lang === 'uk' ? 'ОЧІКУВАННЯ' : 'COOLDOWN')}
                </p>
                <p className="text-[9px] text-gray-400 truncate mt-0.5">
                  {isAudioPlaying 
                    ? (lang === 'uk' ? 'Відтворюється аудіофайл' : 'Audio streaming active') 
                    : t.cooldownMessage}
                </p>
              </div>
            </div>

            {onCoolDown && coolDownRemaining > 0 && !isAudioPlaying && (
              <div className="bg-orange-950/40 border border-orange-500/30 py-0.5 px-2 rounded-lg flex items-center gap-1 shrink-0">
                <span className="font-mono text-xs font-black text-white">
                  {coolDownRemaining}
                </span>
                <span className="text-[8px] font-sans font-bold text-orange-400 uppercase">
                  {t.secShort}
                </span>
              </div>
            )}
            {isAudioPlaying && (
              <div className="bg-red-950/40 border border-red-500/30 py-0.5 px-2 rounded-lg flex items-center gap-1 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
                <span className="text-[8px] font-sans font-bold text-red-500 uppercase">
                  {lang === 'uk' ? 'ГОЛОС' : 'VOICE'}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Dynamic State Overlay Indicators - PLAYBACK ONLY (событие сработало) */}
        {isAudioPlaying && (
          <div id="playback-overlay" className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center z-30 animate-fade-in p-4 pt-14 text-center">
            <div className="w-16 h-16 bg-black/85 border-2 border-red-500 rounded-full flex items-center justify-center mb-3 shadow-[0_4px_16px_rgba(239,68,68,0.35)] animate-[pulse_1.5s_infinite]">
              <ShieldAlert className="w-8 h-8 text-red-500 animate-bounce" />
            </div>
            <p className="font-sans font-black text-red-500 text-xl mb-1 truncate drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)]">
              {lang === 'uk' ? 'Подія спрацювала' : 'Event triggered'}
            </p>
            <p className="font-sans text-xs font-bold text-slate-100 max-w-xs mb-3.5 leading-normal drop-shadow-[0_2px_3px_rgba(0,0,0,0.95)]">
              {lang === 'uk' 
                ? 'Відтворюється аудіофайл. Зачекайте завершення.' 
                : 'Audio track is playing. Please wait.'}
            </p>
            <div className="flex items-center gap-2 text-xs font-mono text-emerald-400 bg-black border-2 border-emerald-950 px-4 py-2.5 rounded-xl shadow-md animate-pulse">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              <span>{lang === 'uk' ? 'Аудіопотік активний' : 'Audio stream active'}</span>
            </div>
          </div>
        )}

        {/* Toggle Settings sliders button - bottom and center, larger */}
        {isCameraActive && (
          <button
            type="button"
            onClick={() => setShowSliders(!showSliders)}
            className={`absolute bottom-3 left-1/2 -translate-x-1/2 z-30 w-12 h-12 rounded-full backdrop-blur-md border transition-all active:scale-95 cursor-pointer select-none flex items-center justify-center ${
              showSliders 
                ? 'bg-[#F27D26] text-black shadow-md border-[#F27D26]' 
                : 'bg-black/60 text-white border-white/20 hover:bg-[#151515] hover:border-white/35'
            }`}
            title={lang === 'uk' ? 'Налаштування' : 'Settings'}
          >
            <Settings className={`w-5.5 h-5.5 ${showSliders ? 'animate-[spin_4s_linear_infinite]' : ''}`} />
          </button>
        )}

        {/* Overlaid sliders inside camera viewport */}
        {isCameraActive && showSliders && (() => {
          const delayPercent = ((settings.coolDownDelay - 2) / 58) * 100;
          const sensPercent = ((settings.sensitivity - 10) / 89) * 100;
          const noisePercent = ((settings.noiseThreshold - 0.3) / 7.7) * 100;
          const volumePercent = (settings.audioVolume ?? 100);

          return (
            <div 
              onMouseMove={resetAutoHideTimer}
              onTouchStart={resetAutoHideTimer}
              className="absolute bottom-16 left-3 right-3 bg-black/55 backdrop-blur-md rounded-2xl p-3.5 border border-white/10 z-20 flex flex-col gap-3 text-left font-sans text-xs shadow-2xl animate-fade-in"
            >
              
              {/* 1. Задержка (Scanning Delay) */}
              <div className="space-y-1">
                <div className="flex justify-between items-center text-gray-300 font-bold leading-none">
                  <span>{lang === 'uk' ? 'Затримка' : 'Delay'}</span>
                  <span className="text-[#F27D26] font-mono font-black bg-black/50 px-2 py-0.5 rounded border border-gray-800">{settings.coolDownDelay} {t.secShort}</span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="60"
                  step="1"
                  value={settings.coolDownDelay}
                  onChange={(e) => onSettingsChange({ ...settings, coolDownDelay: parseInt(e.target.value) })}
                  className="w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-[#F27D26]"
                  style={{
                    background: `linear-gradient(to right, #F27D26 0%, #F27D26 ${delayPercent}%, #27272a ${delayPercent}%, #27272a 100%)`
                  }}
                />
              </div>

              {/* 2. Чувствительность (Sensitivity) */}
              <div className="space-y-1 border-t border-gray-850/35 pt-2">
                <div className="flex justify-between items-center text-gray-300 font-bold leading-none">
                  <span>{lang === 'uk' ? 'Чутливість' : 'Sensitivity'}</span>
                  <span className="text-[#F27D26] font-mono font-black bg-black/50 px-2 py-0.5 rounded border border-gray-800">{settings.sensitivity}%</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="99"
                  value={settings.sensitivity}
                  onChange={(e) => onSettingsChange({ ...settings, sensitivity: parseInt(e.target.value) })}
                  className="w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-[#F27D26]"
                  style={{
                    background: `linear-gradient(to right, #F27D26 0%, #F27D26 ${sensPercent}%, #27272a ${sensPercent}%, #27272a 100%)`
                  }}
                />
              </div>

              {/* 3. Шум (Noise Threshold) */}
              <div className="space-y-1 border-t border-gray-850/35 pt-2">
                <div className="flex justify-between items-center text-gray-300 font-bold leading-none">
                  <span>{lang === 'uk' ? 'Поріг шуму' : 'Noise threshold'}</span>
                  <span className="text-zinc-100 font-mono font-black bg-black/50 px-2 py-0.5 rounded border border-gray-800">{settings.noiseThreshold}%</span>
                </div>
                <input
                  type="range"
                  min="0.3"
                  max="8.0"
                  step="0.1"
                  value={settings.noiseThreshold}
                  onChange={(e) => onSettingsChange({ ...settings, noiseThreshold: parseFloat(e.target.value) })}
                  className="w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-[#F27D26]"
                  style={{
                    background: `linear-gradient(to right, #F27D26 0%, #F27D26 ${noisePercent}%, #27272a ${noisePercent}%, #27272a 100%)`
                  }}
                />
              </div>

              {/* 4. Громкость (Audio Volume) */}
              <div className="space-y-1 border-t border-gray-850/35 pt-2">
                <div className="flex justify-between items-center text-gray-300 font-bold leading-none">
                  <span>{lang === 'uk' ? 'Гучність сигналу' : 'Signal volume'}</span>
                  <span className="text-[#F27D26] font-mono font-black bg-black/50 px-2 py-0.5 rounded border border-gray-800">{settings.audioVolume ?? 100}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={settings.audioVolume ?? 100}
                  onChange={(e) => onSettingsChange({ ...settings, audioVolume: parseInt(e.target.value) })}
                  className="w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-[#F27D26]"
                  style={{
                    background: `linear-gradient(to right, #F27D26 0%, #F27D26 ${volumePercent}%, #27272a ${volumePercent}%, #27272a 100%)`
                  }}
                />
              </div>

            </div>
          );
        })()}

        {isDetecting && !onCoolDown && !isAudioPlaying && (
          <div className={`absolute ${minimalMode ? 'bottom-[122px]' : 'bottom-3'} right-3 bg-red-600 text-white font-mono text-[10px] tracking-wider px-2.5 py-1 rounded-full flex items-center gap-1.5 font-bold animate-[pulse_1.8s_infinite] shadow-lg z-10 select-none`}>
            <span className="w-1.5 h-1.5 rounded-full bg-white block animate-ping" />
            <span>{t.scanMode}</span>
          </div>
        )}
      </div>

      {/* Camera Buttons Block directly under the screen */}
      <div className="p-4 bg-[#141414] border-t border-[#1C1C1E] flex flex-col gap-3">
        {/* Camera Face Selector buttons */}
        <div className="flex flex-col xs:flex-row items-center justify-between gap-2.5">
          <span className="text-[11px] font-mono text-gray-400 uppercase tracking-widest pl-1 font-bold">
            {lang === 'uk' ? 'Камера' : 'Camera lens'}
          </span>
          <div className="flex bg-[#1E1E1E] border border-gray-800 p-0.5 rounded-xl w-full xs:w-auto">
            <button
              type="button"
              id="btn-cam-front-bottom"
              onClick={async () => {
                onSettingsChange({
                  ...settings,
                  cameraFacingMode: 'user',
                });
                await startCamera('user');
              }}
              className={`flex-1 xs:flex-none px-4 h-9 rounded-lg text-xs font-sans font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer select-none ${
                settings.cameraFacingMode === 'user'
                  ? 'bg-[#F27D26] text-black shadow-md font-black'
                  : 'text-gray-400 hover:text-white hover:bg-gray-850'
              }`}
            >
              <span>{t.frontCamera}</span>
              {settings.cameraFacingMode === 'user' && <Check className="w-3 h-3 text-black shrink-0" />}
            </button>
            <button
              type="button"
              id="btn-cam-back-bottom"
              onClick={async () => {
                onSettingsChange({
                  ...settings,
                  cameraFacingMode: 'environment',
                });
                await startCamera('environment');
              }}
              className={`flex-1 xs:flex-none px-4 h-9 rounded-lg text-xs font-sans font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer select-none ${
                settings.cameraFacingMode === 'environment'
                  ? 'bg-[#F27D26] text-black shadow-md font-black'
                  : 'text-gray-400 hover:text-white hover:bg-gray-850'
              }`}
            >
              <span>{t.backCamera}</span>
              {settings.cameraFacingMode === 'environment' && <Check className="w-3 h-3 text-black shrink-0" />}
            </button>
          </div>
        </div>

        {/* Digital Zoom Controls - область приближення */}
        <div className="flex flex-col xs:flex-row items-center justify-between gap-2.5 border-t border-gray-850/50 pt-3">
          <span className="text-[11px] font-mono text-gray-400 uppercase tracking-widest pl-1 font-bold">
            {lang === 'uk' ? 'Приближення' : 'Digital Zoom'}
          </span>
          <div className="flex items-center gap-3 w-full xs:w-auto bg-[#1E1E1E] border border-gray-800 p-1.5 rounded-xl justify-between xs:justify-start">
            <span className="text-[11px] font-mono text-gray-200 font-bold min-w-[32px] text-center">
              {zoomLevel.toFixed(1)}x
            </span>
            <input
              type="range"
              min="1.0"
              max="4.0"
              step="0.1"
              value={zoomLevel}
              disabled={!isCameraActive}
              onChange={(e) => setZoomLevel(parseFloat(e.target.value))}
              className="flex-1 xs:flex-none w-28 xs:w-36 h-2 bg-gray-950 rounded-lg appearance-none cursor-pointer accent-[#F27D26] disabled:opacity-30 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:bg-[#F27D26] [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-black [&::-webkit-slider-thumb]:shadow-md [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:bg-[#F27D26] [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-black [&::-moz-range-thumb]:shadow-md"
            />
            <button
              type="button"
              disabled={zoomLevel === 1.0 || !isCameraActive}
              onClick={() => setZoomLevel(1.0)}
              className="text-[10px] font-sans font-black bg-gray-850 hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed text-slate-300 px-2 py-1 rounded-lg transition-all cursor-pointer select-none"
            >
              1.0x
            </button>
          </div>
        </div>

        {/* Connect Camera / Status buttons on the next row */}
        <div className="flex flex-wrap gap-2.5 items-center justify-between border-t border-gray-850/50 pt-3">
          <div className="w-full">
            {!isCameraActive ? (
              <button
                id="camera-init-btn"
                onClick={startCamera}
                className="w-full h-11 px-4 rounded-xl bg-gray-850 hover:bg-gray-800 border border-gray-750 text-white text-xs font-sans font-bold flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer shadow-md"
              >
                <Camera className="w-4 h-4 animate-bounce text-white" />
                <span>{lang === 'uk' ? 'Підключити камеру' : 'Connect camera'}</span>
              </button>
            ) : (
              <div className="text-[11px] text-gray-400 font-sans flex items-center gap-1.5 bg-black/40 px-3 h-11 rounded-xl border border-gray-800/60 justify-center w-full">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 block animate-ping" />
                <span className="truncate">{t.cameraActiveStatus} ({settings.cameraFacingMode === 'user' ? t.frontCamera : t.backCamera})</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
