import type { NativeKioskState } from '../native/motionDetector';

const DEFAULT_CONFIRMATION_TIMEOUT_MS = 2_000;

export async function restoreKioskWithVerification(
  lockKiosk: () => Promise<NativeKioskState>,
  getKioskState: () => Promise<NativeKioskState>,
  confirmationTimeoutMs = DEFAULT_CONFIRMATION_TIMEOUT_MS,
): Promise<NativeKioskState> {
  const lockResult = await Promise.race([
    lockKiosk().then(state => ({state})),
    new Promise<{state: null}>(resolve => {
      window.setTimeout(() => resolve({state: null}), confirmationTimeoutMs);
    }),
  ]);
  const verified = await getKioskState();
  const next = verified.isLockTaskActive && !verified.maintenanceMode
    ? verified
    : lockResult.state;
  if (!next?.isLockTaskActive || next.maintenanceMode) {
    throw Object.assign(new Error('Lock Task state was not confirmed'), {
      code: 'LOCK_TASK_FAILED',
    });
  }
  return next;
}
