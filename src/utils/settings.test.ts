import {describe, expect, it} from 'vitest';
import {DEFAULT_SETTINGS, normalizeSettings, SETTINGS_SCHEMA_VERSION} from './settings';

describe('normalizeSettings', () => {
  it('returns complete defaults for missing data', () => {
    expect(normalizeSettings(null)).toEqual(DEFAULT_SETTINGS);
  });

  it('migrates legacy settings and preserves a rear-camera choice', () => {
    const result = normalizeSettings({
      sensitivity: 250,
      noiseThreshold: -4,
      audioVolume: undefined,
      cameraFacingMode: 'environment',
      kioskModeEnabled: false,
      customAudioId: 'audio-1',
      audioSourceType: 'custom',
    });
    expect(result.schemaVersion).toBe(SETTINGS_SCHEMA_VERSION);
    expect(result.sensitivity).toBe(100);
    expect(result.noiseThreshold).toBe(0.1);
    expect(result.audioVolume).toBe(100);
    expect(result.cameraFacingMode).toBe('environment');
    expect(result.kioskModeEnabled).toBe(false);
    expect(result.customAudioId).toBe('audio-1');
  });

  it('clamps detection controls and normalizes malformed values', () => {
    const result = normalizeSettings({
      requiredConsecutiveFrames: 99,
      globalChangeCeiling: 5,
      calibratedNoiseFloor: 99,
      maxCacheLogsCount: '12' as unknown as number,
      detectionZone: {x: -1, y: 2, width: 0, height: 5},
      cameraFacingMode: 'invalid' as 'user',
      audioSourceType: 'invalid' as 'preset',
    });
    expect(result.requiredConsecutiveFrames).toBe(5);
    expect(result.globalChangeCeiling).toBe(30);
    expect(result.calibratedNoiseFloor).toBe(25);
    expect(result.maxCacheLogsCount).toBe(12);
    expect(result.detectionZone).toEqual({x: 0, y: 0.9, width: 0.1, height: 0.1});
    expect(result.cameraFacingMode).toBe('user');
    expect(result.audioSourceType).toBe('preset');
  });
});
