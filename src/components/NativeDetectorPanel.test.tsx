import {cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {DEFAULT_SETTINGS} from '../utils/settings';
import NativeDetectorPanel from './NativeDetectorPanel';

const {motionDetectorMock, lockedIncompleteState} = vi.hoisted(() => {
  const readiness = {
    cameraGranted: true,
    audioImported: true,
    routeVerified: false,
    calibrated: false,
    motionTestPassed: false,
    audioVolume: 100,
  };
  const lockedIncompleteState = {
    operatorPinConfigured: true,
    isDeviceOwner: true,
    isDefaultHomeApp: true,
    isLockTaskAllowed: true,
    isLockTaskActive: true,
    autoStartAfterRebootEnabled: false,
    autoStartReady: false,
    blockers: ['audio_route_not_verified', 'calibration_missing', 'motion_test_missing'],
    lastBootStartState: 'never',
    lastBootStartAtMs: 0,
    lastBootStartMessage: 'Ще не було перезавантаження після налаштування',
    requiresFirstUnlock: false,
    maintenanceMode: false,
    readiness,
  };
  const idleStatus = {
    status: 'idle',
    message: 'Готово до запуску',
    motionPercent: 0,
    analyzedFrameCount: 0,
    lastFrameAtMs: 0,
    cooldownRemainingSeconds: 0,
    requiresSoundTest: true,
    updatedAtMs: 1,
    audioRoute: {kind: 'aux', deviceId: 1, name: 'AUX', label: 'AUX'},
  };
  return {
    lockedIncompleteState,
    motionDetectorMock: {
      getStatus: vi.fn().mockResolvedValue(idleStatus),
      getAudioRoute: vi.fn().mockResolvedValue(idleStatus.audioRoute),
      getSetupState: vi.fn().mockResolvedValue({
        hasImportedAudio: true,
        audio: {id: 'audio', name: 'Narration.mp3', mimeType: 'audio/mpeg'},
        readiness,
      }),
      getKioskState: vi.fn().mockResolvedValue(lockedIncompleteState),
      getEvents: vi.fn().mockResolvedValue({events: []}),
      getSettings: vi.fn(),
      getAudioLibrary: vi.fn().mockResolvedValue({items: []}),
      addListener: vi.fn().mockResolvedValue({remove: vi.fn()}),
      unlockKiosk: vi.fn(),
    },
  };
});

vi.mock('../native/motionDetector', () => ({MotionDetector: motionDetectorMock}));

describe('NativeDetectorPanel kiosk access', () => {
  afterEach(cleanup);

  beforeEach(() => {
    motionDetectorMock.getSettings.mockReset().mockResolvedValue(DEFAULT_SETTINGS);
    motionDetectorMock.unlockKiosk.mockReset().mockResolvedValue({
      ...lockedIncompleteState,
      isLockTaskActive: false,
      maintenanceMode: true,
      blockers: [...lockedIncompleteState.blockers, 'maintenance_mode_active'],
    });
  });

  it('offers PIN-gated operator mode before auto-start readiness is complete', async () => {
    render(<NativeDetectorPanel
      lang="uk"
      settings={DEFAULT_SETTINGS}
      onSettingsChange={vi.fn()}
      onRuntimeStatusChange={vi.fn()}
    />);

    const openOperatorMode = await screen.findByRole('button', {name: 'Відкрити операторський режим'});
    const enableAutoStart = screen.getByRole('button', {name: 'Увімкнути kiosk і автозапуск'});
    expect(openOperatorMode).toBeDisabled();
    expect(enableAutoStart).toBeDisabled();
    expect(screen.getByRole('button', {name: 'Підключити або змінити Bluetooth-колонку'})).toBeEnabled();
    expect(screen.getByText(/будь-яка A2DP\/BLE-колонка/)).toBeVisible();

    fireEvent.change(screen.getByPlaceholderText('PIN оператора'), {target: {value: '1234'}});
    expect(openOperatorMode).toBeEnabled();
    expect(enableAutoStart).toBeDisabled();

    fireEvent.click(openOperatorMode);
    await waitFor(() => expect(motionDetectorMock.unlockKiosk).toHaveBeenCalledWith({pin: '1234'}));
    expect(await screen.findByText(/Операторський режим активний/)).toBeVisible();
  }, 10_000);
});
