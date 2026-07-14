let activeAudioContext: AudioContext | null = null;
let activeOscillator: OscillatorNode | null = null;
let activeGain: GainNode | null = null;
let activeCustomAudio: HTMLAudioElement | null = null;
let activeBlobUrl: string | null = null;
let finishTimer: ReturnType<typeof setTimeout> | null = null;
let isAudioPlayingStatus = false;

export interface AudioPreset {
  id: string;
  name: string;
  description: string;
}

export const AUDIO_PRESETS: AudioPreset[] = [
  {id: 'beep_short', name: 'Короткий сигнал / Short Beep', description: 'Надійний вбудований сигнал / Reliable built-in alert'},
];

function getAudioContext(): AudioContext {
  if (!activeAudioContext) {
    const AudioContextClass = window.AudioContext || (window as typeof window & {webkitAudioContext: typeof AudioContext}).webkitAudioContext;
    activeAudioContext = new AudioContextClass();
  }
  return activeAudioContext;
}

export async function unlockAudioContext(): Promise<boolean> {
  try {
    const context = getAudioContext();
    if (context.state === 'suspended') await context.resume();
    const buffer = context.createBuffer(1, 1, 22050);
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    source.start();
    return context.state === 'running';
  } catch (error) {
    console.warn('Could not unlock audio context:', error);
    return false;
  }
}

export function isAudioCurrentlyPlaying(): boolean {
  return isAudioPlayingStatus;
}

export function stopAllAudio(): void {
  isAudioPlayingStatus = false;
  if (finishTimer) clearTimeout(finishTimer);
  finishTimer = null;

  try { activeOscillator?.stop(); } catch {}
  activeOscillator?.disconnect();
  activeGain?.disconnect();
  activeOscillator = null;
  activeGain = null;

  if (activeCustomAudio) {
    activeCustomAudio.pause();
    activeCustomAudio.currentTime = 0;
    activeCustomAudio.src = '';
  }
  activeCustomAudio = null;
  if (activeBlobUrl) URL.revokeObjectURL(activeBlobUrl);
  activeBlobUrl = null;
}

export function playPresetSound(_presetId: string, _durationSeconds = 3, volume = 1): void {
  stopAllAudio();
  const context = getAudioContext();
  const now = context.currentTime;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(1000, now);
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.5 * volume, now + 0.03);
  gain.gain.linearRampToValueAtTime(0, now + 0.45);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(now);
  oscillator.stop(now + 0.5);
  activeOscillator = oscillator;
  activeGain = gain;
  isAudioPlayingStatus = true;
  finishTimer = setTimeout(() => {
    isAudioPlayingStatus = false;
    activeOscillator = null;
    activeGain = null;
  }, 550);
}

export async function playCustomSound(blob: Blob, fileName?: string, volume = 1): Promise<void> {
  stopAllAudio();
  const mimeType = blob.type || inferMimeType(fileName);
  const playableBlob = blob.type ? blob : blob.slice(0, blob.size, mimeType);
  activeBlobUrl = URL.createObjectURL(playableBlob);
  const audio = new Audio(activeBlobUrl);
  audio.preload = 'auto';
  audio.volume = Math.min(1, Math.max(0, volume));
  activeCustomAudio = audio;
  isAudioPlayingStatus = true;

  await new Promise<void>((resolve, reject) => {
    audio.onended = () => {
      isAudioPlayingStatus = false;
      resolve();
    };
    audio.onerror = () => {
      isAudioPlayingStatus = false;
      reject(new Error(`Cannot play ${fileName ?? 'selected audio'}`));
    };
    audio.play().catch(error => {
      isAudioPlayingStatus = false;
      reject(error);
    });
  });
}

function inferMimeType(fileName?: string): string {
  const extension = fileName?.split('.').pop()?.toLowerCase();
  if (extension === 'm4a' || extension === 'mp4') return 'audio/mp4';
  if (extension === 'wav') return 'audio/wav';
  if (extension === 'ogg') return 'audio/ogg';
  if (extension === 'aac') return 'audio/aac';
  return 'audio/mpeg';
}
