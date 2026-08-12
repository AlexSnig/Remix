import { describe, expect, it, vi } from 'vitest';
import type { NativeKioskState } from '../native/motionDetector';
import { canOpenOperatorMode, restoreKioskWithVerification } from './kioskTransition';

function state(overrides: Partial<NativeKioskState> = {}): NativeKioskState {
  return {
    isDeviceOwner: true,
    isDefaultHomeApp: true,
    isLockTaskAllowed: true,
    isLockTaskActive: false,
    operatorPinConfigured: true,
    autoStartAfterRebootEnabled: true,
    autoStartReady: true,
    requiresFirstUnlock: false,
    maintenanceMode: true,
    blockers: [],
    lastBootStartState: 'started',
    lastBootStartAtMs: 1,
    lastBootStartMessage: 'started',
    readiness: {
      cameraGranted: true,
      audioImported: true,
      routeVerified: true,
      calibrated: true,
      motionTestPassed: true,
      audioVolume: 100,
    },
    ...overrides,
  };
}

describe('restoreKioskWithVerification', () => {
  it('returns the freshly verified native kiosk state', async () => {
    const locked = state({isLockTaskActive: true, maintenanceMode: false});
    await expect(restoreKioskWithVerification(
      vi.fn().mockResolvedValue(locked),
      vi.fn().mockResolvedValue(locked),
    )).resolves.toEqual(locked);
  });

  it('recovers when the lock call does not resolve after Android enters Lock Task', async () => {
    const locked = state({isLockTaskActive: true, maintenanceMode: false});
    await expect(restoreKioskWithVerification(
      () => new Promise<NativeKioskState>(() => undefined),
      vi.fn().mockResolvedValue(locked),
      0,
    )).resolves.toEqual(locked);
  });

  it('rejects when Android does not confirm Lock Task', async () => {
    const unlocked = state();
    await expect(restoreKioskWithVerification(
      vi.fn().mockResolvedValue(unlocked),
      vi.fn().mockResolvedValue(unlocked),
    )).rejects.toMatchObject({code: 'LOCK_TASK_FAILED'});
  });

  it('preserves a native PIN rejection', async () => {
    const pinError = Object.assign(new Error('Incorrect PIN'), {code: 'INCORRECT_PIN'});
    await expect(restoreKioskWithVerification(
      vi.fn().mockRejectedValue(pinError),
      vi.fn(),
    )).rejects.toBe(pinError);
  });
});

describe('canOpenOperatorMode', () => {
  it('keeps maintenance available before auto-start readiness is complete', () => {
    expect(canOpenOperatorMode(state({
      autoStartAfterRebootEnabled: false,
      autoStartReady: false,
      isLockTaskActive: true,
      maintenanceMode: false,
      blockers: ['audio_route_not_verified', 'calibration_missing', 'motion_test_missing'],
    }))).toBe(true);
  });

  it('keeps maintenance available after auto-start is enabled', () => {
    expect(canOpenOperatorMode(state({maintenanceMode: false}))).toBe(true);
  });

  it('does not offer PIN-gated maintenance without Device Owner or a PIN', () => {
    expect(canOpenOperatorMode(state({isDeviceOwner: false, maintenanceMode: false}))).toBe(false);
    expect(canOpenOperatorMode(state({operatorPinConfigured: false, maintenanceMode: false}))).toBe(false);
    expect(canOpenOperatorMode(state({maintenanceMode: true}))).toBe(false);
  });
});
