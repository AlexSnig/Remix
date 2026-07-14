// Audio synthesizer and custom player using Web Audio API and Audio Element
let activeAudioContext: AudioContext | null = null;
let activeOscillators: { osc: OscillatorNode; gain: GainNode }[] = [];
let voiceTimeoutId: any = null;
let presetFinishedTimeoutId: any = null;
let activeCustomAudio: HTMLAudioElement | null = null;
let activeCustomBlobUrl: string | null = null;
let activeCustomBufferSource: AudioBufferSourceNode | null = null;
let isAudioPlayingStatus = false;

export interface AudioPreset {
  id: string;
  name: string;
  description: string;
}

export const AUDIO_PRESETS: AudioPreset[] = [
  { id: 'beep_short', name: '🔔 Короткий писк / Short Beep', description: 'Простий сигнал для детектора / Simple buzzer alert' },
];

function getAudioContext(): AudioContext {
  if (!activeAudioContext) {
    activeAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (activeAudioContext.state === 'suspended') {
    activeAudioContext.resume();
  }
  return activeAudioContext;
}

export function unlockAudioContext(): void {
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    // Also play a tiny silent buffer to fully unlock iOS audio engine
    const buffer = ctx.createBuffer(1, 1, 22050);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);
  } catch (e) {
    console.warn("Could not unlock audio context:", e);
  }
}

export function isAudioCurrentlyPlaying(): boolean {
  return isAudioPlayingStatus;
}

export function stopAllAudio(): void {
  isAudioPlayingStatus = false;
  
  if (presetFinishedTimeoutId) {
    clearTimeout(presetFinishedTimeoutId);
    presetFinishedTimeoutId = null;
  }

  // Clear any timeouts
  if (voiceTimeoutId) {
    clearTimeout(voiceTimeoutId);
    voiceTimeoutId = null;
  }

  // Stop custom Web Audio buffer source
  if (activeCustomBufferSource) {
    try {
      activeCustomBufferSource.stop();
      activeCustomBufferSource.disconnect();
    } catch (e) {
      // Ignored
    }
    activeCustomBufferSource = null;
  }

  // Stop custom HTML audio
  if (activeCustomAudio) {
    try {
      activeCustomAudio.pause();
      activeCustomAudio.currentTime = 0;
    } catch (e) {
      // Ignored
    }
    activeCustomAudio = null;
  }

  // Revoke old blob urls
  if (activeCustomBlobUrl) {
    try {
      URL.revokeObjectURL(activeCustomBlobUrl);
    } catch (e) {
      // Ignored
    }
    activeCustomBlobUrl = null;
  }

  // Stop synthesizer nodes
  activeOscillators.forEach(({ osc, gain }) => {
    try {
      osc.stop();
      osc.disconnect();
      gain.disconnect();
    } catch (e) {
      // already stopped/disconnected
    }
  });
  activeOscillators = [];
}

export function playPresetSound(presetId: string, durationSeconds = 3, volume = 1.0): void {
  stopAllAudio();
  isAudioPlayingStatus = true;

  const ctx = getAudioContext();
  const now = ctx.currentTime;

  const gainNode = ctx.createGain();
  gainNode.connect(ctx.destination);
  gainNode.gain.setValueAtTime(0, now);

  let presetDurationMs = durationSeconds * 1000;

  if (presetId === 'beep_short') {
    presetDurationMs = 500;
    // Single high-pitched beep
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1000, now);
    
    osc.connect(gainNode);
    activeOscillators.push({ osc, gain: gainNode });

    gainNode.gain.linearRampToValueAtTime(0.5 * volume, now + 0.05);
    gainNode.gain.linearRampToValueAtTime(0, now + 0.4);

    osc.start(now);
    osc.stop(now + 0.5);

  } else if (presetId === 'alarm_digital') {
    // Repeated alarm beeps
    const beepDuration = 0.2;
    const interval = 0.4;
    const count = Math.ceil(durationSeconds / interval);

    gainNode.gain.setValueAtTime(volume, now);

    for (let i = 0; i < count; i++) {
       const osc = ctx.createOscillator();
       osc.type = 'square';
       osc.frequency.setValueAtTime(800, now + i * interval);

       const itemGain = ctx.createGain();
       itemGain.connect(gainNode);
       osc.connect(itemGain);
       activeOscillators.push({ osc, gain: itemGain });

       // Pulsing gain
       itemGain.gain.setValueAtTime(0, now);
       itemGain.gain.setValueAtTime(0.5, now + i * interval);
       itemGain.gain.setValueAtTime(0.5, now + i * interval + beepDuration);
       itemGain.gain.setValueAtTime(0, now + i * interval + beepDuration + 0.02);

       osc.start(now + i * interval);
       osc.stop(now + i * interval + beepDuration + 0.05);
    }

  } else if (presetId === 'police') {
    // Classic sweeping police siren
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.connect(gainNode);
    activeOscillators.push({ osc, gain: gainNode });

    gainNode.gain.linearRampToValueAtTime(0.5 * volume, now + 0.1);

    // LFO frequency modulation
    const modOsc = ctx.createOscillator();
    const modGain = ctx.createGain();
    modOsc.frequency.setValueAtTime(2, now); // Sweep rate: 2Hz
    modGain.gain.setValueAtTime(150, now);    // Sweep range: +/- 150 Hz

    osc.frequency.setValueAtTime(550, now); // center frequency

    modOsc.connect(modGain);
    modGain.connect(osc.frequency);

    modOsc.start(now);
    osc.start(now);

    modOsc.stop(now + durationSeconds);
    osc.stop(now + durationSeconds);

    // Fade out at end
    gainNode.gain.setValueAtTime(0.5 * volume, now + durationSeconds - 0.2);
    gainNode.gain.linearRampToValueAtTime(0, now + durationSeconds);

    // Cleanup reference after finished
    voiceTimeoutId = setTimeout(() => {
      stopAllAudio();
    }, durationSeconds * 1000 + 100);

  } else if (presetId === 'sonar_ping') {
    presetDurationMs = 2100;
    // sonar radar sound
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.connect(gainNode);
    activeOscillators.push({ osc, gain: gainNode });

    // Exponential decay in pitch
    osc.frequency.setValueAtTime(1200, now);
    osc.frequency.exponentialRampToValueAtTime(150, now + 2.0);

    // Exponential decay in volume
    gainNode.gain.linearRampToValueAtTime(0.6 * volume, now + 0.05);
    gainNode.gain.exponentialRampToValueAtTime(Math.max(0.00001, 0.001 * volume), now + 2.0);

    osc.start(now);
    osc.stop(now + 2.1);

  } else if (presetId === 'laser_sci') {
    // Sci-fi laser decay sweep
    const shotsCount = Math.max(1, Math.floor(durationSeconds));
    const shotDuration = 0.4;
    presetDurationMs = shotsCount * 600;
    
    gainNode.gain.setValueAtTime(volume, now);

    for (let i = 0; i < shotsCount; i++) {
       const pNow = now + i * 0.6;
       const osc = ctx.createOscillator();
       const instanceGain = ctx.createGain();
       
       osc.type = 'sawtooth';
       osc.connect(instanceGain);
       instanceGain.connect(gainNode);
       
       activeOscillators.push({ osc, gain: instanceGain });
       
       osc.frequency.setValueAtTime(880, pNow);
       osc.frequency.exponentialRampToValueAtTime(110, pNow + shotDuration);
       
       instanceGain.gain.setValueAtTime(0, pNow);
       instanceGain.gain.linearRampToValueAtTime(0.3, pNow + 0.02);
       instanceGain.gain.exponentialRampToValueAtTime(0.001, pNow + shotDuration);
       
       osc.start(pNow);
       osc.stop(pNow + shotDuration + 0.05);
    }
  }

  // Automatically reset after the estimated duration
  presetFinishedTimeoutId = setTimeout(() => {
    isAudioPlayingStatus = false;
  }, presetDurationMs);
}

export function playCustomSound(base64Data: string, fileName?: string, volume = 1.0): Promise<void> {
  return new Promise((resolve, reject) => {
    stopAllAudio();
    isAudioPlayingStatus = true;

    try {
      // 1. Process base64 format
      let base64Content = base64Data;
      let mimeType = 'audio/mpeg';

      if (base64Data.startsWith('data:')) {
        const parts = base64Data.split(';base64,');
        if (parts.length === 2) {
          const extractedMime = parts[0].split(':')[1];
          if (extractedMime && extractedMime !== 'application/octet-stream' && extractedMime !== '') {
            mimeType = extractedMime;
          }
          base64Content = parts[1];
        }
      }

      // Convert base64 to ArrayBuffer
      const raw = window.atob(base64Content);
      const rawLength = raw.length;
      const arrayBuffer = new ArrayBuffer(rawLength);
      const uInt8Array = new Uint8Array(arrayBuffer);
      for (let i = 0; i < rawLength; ++i) {
        uInt8Array[i] = raw.charCodeAt(i);
      }

      // If we have a fileName, map its extension to standard MIME types to force iOS audio support
      if (fileName) {
        const ext = fileName.split('.').pop()?.toLowerCase();
        if (ext === 'mp3') mimeType = 'audio/mpeg';
        else if (ext === 'm4a') mimeType = 'audio/mp4';
        else if (ext === 'wav') mimeType = 'audio/wav';
        else if (ext === 'aac') mimeType = 'audio/aac';
        else if (ext === 'ogg') mimeType = 'audio/ogg';
        else if (ext === 'caf') mimeType = 'audio/x-caf';
        else if (ext === 'amr') mimeType = 'audio/amr';
      }

      // Try playing via HIGH-PERFORMANCE Web Audio API first (solves iOS / Safari Blob URL bugs)
      const ctx = getAudioContext();
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      // We make a copy of arrayBuffer for decodeAudioData, as decodeAudioData consumes the buffer
      const bufferCopy = arrayBuffer.slice(0);

      ctx.decodeAudioData(
        bufferCopy,
        (audioBuffer) => {
          if (!isAudioPlayingStatus) {
            resolve();
            return;
          }
          try {
            const source = ctx.createBufferSource();
            source.buffer = audioBuffer;

            const gainNode = ctx.createGain();
            gainNode.gain.setValueAtTime(volume, ctx.currentTime);

            source.connect(gainNode);
            gainNode.connect(ctx.destination);

            activeCustomBufferSource = source;

            source.onended = () => {
              if (activeCustomBufferSource === source) {
                isAudioPlayingStatus = false;
                activeCustomBufferSource = null;
              }
              resolve();
            };

            source.start(0);
          } catch (e) {
            console.warn("BufferSource start failed, fallback to HTML5 Audio:", e);
            runFallbackHTML5Audio(arrayBuffer, mimeType, resolve, reject, volume);
          }
        },
        (decodeError) => {
          console.warn("decodeAudioData failed, fallback to standard HTML5 Audio:", decodeError);
          runFallbackHTML5Audio(arrayBuffer, mimeType, resolve, reject, volume);
        }
      );
    } catch (e) {
      isAudioPlayingStatus = false;
      reject(e);
    }
  });
}

function runFallbackHTML5Audio(
  arrayBuffer: ArrayBuffer, 
  mimeType: string, 
  resolve: () => void, 
  reject: (err: any) => void,
  volume = 1.0
) {
  try {
    const blob = new Blob([arrayBuffer], { type: mimeType });
    const objectUrl = URL.createObjectURL(blob);
    activeCustomBlobUrl = objectUrl;

    const audio = new Audio();
    audio.src = objectUrl;
    activeCustomAudio = audio;

    audio.setAttribute('playsinline', 'true');
    (audio as any).playsInline = true;
    audio.setAttribute('webkit-playsinline', 'true');
    audio.preload = 'auto';
    audio.volume = volume;

    audio.onplay = () => resolve();
    audio.onended = () => {
      isAudioPlayingStatus = false;
      if (activeCustomBlobUrl) {
        try { URL.revokeObjectURL(activeCustomBlobUrl); } catch (e) {}
        activeCustomBlobUrl = null;
      }
    };

    audio.onerror = (e) => {
      isAudioPlayingStatus = false;
      if (activeCustomBlobUrl) {
        try { URL.revokeObjectURL(activeCustomBlobUrl); } catch (e) {}
        activeCustomBlobUrl = null;
      }
      reject(e);
    };

    audio.play().catch(err => {
      isAudioPlayingStatus = false;
      console.warn("HTML5 audio playback failed on iOS:", err);
      reject(err);
    });
  } catch (err) {
    isAudioPlayingStatus = false;
    reject(err);
  }
}
