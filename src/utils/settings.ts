import {DetectorSettings, DetectionZone} from '../types';

export const SETTINGS_SCHEMA_VERSION = 2;

export const DEFAULT_DETECTION_ZONE: DetectionZone = {
  x: 0,
  y: 0,
  width: 1,
  height: 1,
};

export const DEFAULT_SETTINGS: DetectorSettings = {
  schemaVersion: SETTINGS_SCHEMA_VERSION,
  sensitivity: 70,
  noiseThreshold: 1.5,
  coolDownDelay: 6,
  audioSourceType: 'preset',
  audioPresetId: 'beep_short',
  customAudioId: null,
  cameraFacingMode: 'user',
  stealthMode: false,
  autoCleanCacheEnabled: true,
  maxCacheLogsCount: 20,
  audioVolume: 100,
  kioskModeEnabled: true,
  requiredConsecutiveFrames: 2,
  globalChangeCeiling: 70,
  detectionZone: DEFAULT_DETECTION_ZONE,
  calibratedNoiseFloor: null,
};

const clamp = (value: unknown, fallback: number, min: number, max: number): number => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
};

export function normalizeSettings(raw: unknown): DetectorSettings {
  if (!raw || typeof raw !== 'object') return {...DEFAULT_SETTINGS};

  const value = raw as Partial<DetectorSettings>;
  const zone = value.detectionZone ?? DEFAULT_DETECTION_ZONE;

  const x = clamp(zone.x, 0, 0, 0.9);
  const y = clamp(zone.y, 0, 0, 0.9);
  return {
    ...DEFAULT_SETTINGS,
    ...value,
    schemaVersion: SETTINGS_SCHEMA_VERSION,
    sensitivity: clamp(value.sensitivity, DEFAULT_SETTINGS.sensitivity, 1, 100),
    noiseThreshold: clamp(value.noiseThreshold, DEFAULT_SETTINGS.noiseThreshold, 0.1, 25),
    coolDownDelay: clamp(value.coolDownDelay, DEFAULT_SETTINGS.coolDownDelay, 2, 300),
    audioVolume: clamp(value.audioVolume, DEFAULT_SETTINGS.audioVolume, 0, 100),
    maxCacheLogsCount: Math.round(clamp(value.maxCacheLogsCount, DEFAULT_SETTINGS.maxCacheLogsCount, 5, 100)),
    requiredConsecutiveFrames: Math.round(clamp(value.requiredConsecutiveFrames, 2, 1, 5)),
    globalChangeCeiling: clamp(value.globalChangeCeiling, 70, 30, 100),
    cameraFacingMode: value.cameraFacingMode === 'environment' ? 'environment' : 'user',
    audioSourceType: value.audioSourceType === 'custom' ? 'custom' : 'preset',
    customAudioId: typeof value.customAudioId === 'string' ? value.customAudioId : null,
    kioskModeEnabled: value.kioskModeEnabled !== false,
    autoCleanCacheEnabled: value.autoCleanCacheEnabled !== false,
    detectionZone: {
      x,
      y,
      width: Number(Math.min(1 - x, clamp(zone.width, 1, 0.1, 1)).toFixed(4)),
      height: Number(Math.min(1 - y, clamp(zone.height, 1, 0.1, 1)).toFixed(4)),
    },
    calibratedNoiseFloor: value.calibratedNoiseFloor == null
      ? null
      : clamp(value.calibratedNoiseFloor, 0, 0, 25),
  };
}
