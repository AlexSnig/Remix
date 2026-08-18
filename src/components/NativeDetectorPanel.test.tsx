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
      saveSettings: vi.fn().mockResolvedValue(undefined),
      getDiagnostics: vi.fn().mockResolvedValue({dailySummaries: [], triggersTotal: 0}),
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

describe('NativeDetectorPanel detection zone', () => {
  afterEach(cleanup);

  beforeEach(() => {
    motionDetectorMock.getSettings.mockReset().mockResolvedValue(DEFAULT_SETTINGS);
    motionDetectorMock.saveSettings.mockReset().mockResolvedValue(undefined);
  });

  const activeClasses = 'native-action-active';

  it('marks the stored zone as the selected preset', async () => {
    render(<NativeDetectorPanel
      lang="uk"
      settings={DEFAULT_SETTINGS}
      onSettingsChange={vi.fn()}
      onRuntimeStatusChange={vi.fn()}
    />);

    const full = await screen.findByRole('button', {name: 'Весь кадр'});
    expect(full.className).toContain(activeClasses);
    expect(screen.getByRole('button', {name: 'Центр'}).className).not.toContain(activeClasses);
  }, 10_000);

  it('follows the stored zone when it is not the full frame', async () => {
    render(<NativeDetectorPanel
      lang="uk"
      settings={{...DEFAULT_SETTINGS, detectionZone: {x: 0.2, y: 0.15, width: 0.6, height: 0.7}}}
      onSettingsChange={vi.fn()}
      onRuntimeStatusChange={vi.fn()}
    />);

    expect((await screen.findByRole('button', {name: 'Центр'})).className).toContain(activeClasses);
    expect(screen.getByRole('button', {name: 'Весь кадр'}).className).not.toContain(activeClasses);
  }, 10_000);

  it('sends the chosen preset to native', async () => {
    render(<NativeDetectorPanel
      lang="uk"
      settings={DEFAULT_SETTINGS}
      onSettingsChange={vi.fn()}
      onRuntimeStatusChange={vi.fn()}
    />);

    fireEvent.click(await screen.findByRole('button', {name: 'Центр'}));
    await waitFor(() => expect(motionDetectorMock.saveSettings).toHaveBeenCalledWith({
      settings: expect.objectContaining({detectionZone: {x: 0.2, y: 0.15, width: 0.6, height: 0.7}}),
    }));
  }, 10_000);
});

describe('NativeDetectorPanel daily state', () => {
  afterEach(cleanup);

  beforeEach(() => {
    motionDetectorMock.getSettings.mockReset().mockResolvedValue(DEFAULT_SETTINGS);
    motionDetectorMock.getDiagnostics.mockReset();
  });

  const renderPanel = () => render(<NativeDetectorPanel
    lang="uk"
    settings={DEFAULT_SETTINGS}
    onSettingsChange={vi.fn()}
    onRuntimeStatusChange={vi.fn()}
  />);

  it('reports the newest day, its last trigger and the cumulative total', async () => {
    const lastTrigger = new Date(2026, 7, 19, 17, 42).getTime();
    motionDetectorMock.getDiagnostics.mockResolvedValue({
      triggersTotal: 1234,
      dailySummaries: [
        {
          day: '2026-08-19',
          triggers: 74,
          firstTriggerAtMs: new Date(2026, 7, 19, 9, 5).getTime(),
          lastTriggerAtMs: lastTrigger,
          cameraRestarts: 0,
          routeLosses: 0,
          serviceStarts: 1,
          minBatteryPercent: 96,
          maxBatteryTemperatureC: 33.5,
        },
        {
          day: '2026-08-18',
          triggers: 41,
          firstTriggerAtMs: 1,
          lastTriggerAtMs: 2,
          cameraRestarts: 2,
          routeLosses: 1,
          serviceStarts: 1,
          minBatteryPercent: 88,
          maxBatteryTemperatureC: 35.0,
        },
      ],
    });

    renderPanel();

    expect(await screen.findByText(/74 спрацювань/)).toBeVisible();
    expect(screen.getByText(/17:42/)).toBeVisible();
    expect(screen.getByText('1234')).toBeVisible();
    expect(screen.getByText('96% · 33.5°C')).toBeVisible();
    expect(screen.getByText(/41 спрацювань/)).toBeVisible();
  }, 10_000);

  it('says so plainly when no day has been recorded yet', async () => {
    motionDetectorMock.getDiagnostics.mockResolvedValue({triggersTotal: 0, dailySummaries: []});

    renderPanel();

    expect(await screen.findByText('Ще немає записаних днів')).toBeVisible();
  }, 10_000);

  it('never surfaces a diagnostics failure as an operator error', async () => {
    motionDetectorMock.getDiagnostics.mockRejectedValue(new Error('diagnostics unavailable'));

    renderPanel();

    await screen.findByRole('button', {name: 'Весь кадр'});
    expect(screen.queryByText(/diagnostics unavailable/)).toBeNull();
  }, 10_000);
});
