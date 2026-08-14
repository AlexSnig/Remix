export type DetectorRuntimeStatus =
  | 'idle'
  | 'starting'
  | 'ready'
  | 'armed'
  | 'triggered'
  | 'playing'
  | 'cooldown'
  | 'recovering'
  | 'error'
  | 'audio_route_lost'
  | 'fault';

export type ReadinessCheckStatus = 'pass' | 'warning' | 'fail';

export interface ReadinessCheck {
  id: 'camera' | 'audio' | 'storage' | 'persistence' | 'wake-lock' | 'secure-context';
  status: ReadinessCheckStatus;
  message: string;
}

export interface DetectionZone {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DetectorSettings {
  schemaVersion: number;
  sensitivity: number;
  noiseThreshold: number;
  coolDownDelay: number;
  audioSourceType: 'preset' | 'custom';
  audioPresetId: string;
  customAudioId: string | null;
  cameraFacingMode: 'user' | 'environment';
  stealthMode: boolean;
  autoCleanCacheEnabled: boolean;
  maxCacheLogsCount: number;
  audioVolume: number;
  kioskModeEnabled: boolean;
  requiredConsecutiveFrames: number;
  globalChangeCeiling: number;
  detectionZone: DetectionZone;
  calibratedNoiseFloor: number | null;
  /** True when calibration hit the clamp: the scene was not quiet and the
   * detector is left at its least sensitive setting. Written by calibration
   * only, never by the operator. */
  calibrationClamped: boolean;
  calibrationRawNoiseFloor: number | null;
}

export interface MotionLog {
  id: string;
  timestamp: number;
  thumbnail: string | null;
  motionPercent?: number;
  threshold?: number;
}

export interface CustomAudioFile {
  id: string;
  name: string;
  blob: Blob;
  size: number;
  mimeType: string;
  timestamp: number;
  data?: string;
}
