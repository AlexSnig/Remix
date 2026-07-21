import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import type { DetectorSettings } from '../types';

export type NativeDetectorStatus =
  | 'idle'
  | 'starting'
  | 'armed'
  | 'triggered'
  | 'playing'
  | 'cooldown'
  | 'recovering'
  | 'audio_route_lost'
  | 'fault';

export interface NativeAudioRoute {
  kind: 'aux' | 'bluetooth' | 'unavailable';
  deviceId: number | null;
  name: string | null;
  label: string;
}

export interface NativeDetectorSnapshot {
  status: NativeDetectorStatus;
  message: string;
  motionPercent: number;
  analyzedFrameCount: number;
  lastFrameAtMs: number;
  cooldownRemainingSeconds: number;
  requiresSoundTest: boolean;
  updatedAtMs: number;
  audioRoute: NativeAudioRoute;
}

export interface ImportedNativeAudio {
  id: string;
  name: string;
  mimeType: string;
}

export interface NativeDiagnostics {
  versionName: string;
  versionCode: number;
  uptimeMs: number;
  serviceStarts: number;
  lastStartedAtMs: number;
  cameraRestarts: number;
  errors: number;
  eventCount: number;
  status: NativeDetectorStatus;
  analyzedFrameCount: number;
  lastFrameAtMs: number;
  audioRoute: NativeAudioRoute;
  batteryPercent: number | null;
  batteryTemperatureC: number | null;
  kiosk?: NativeKioskState;
}

export interface NativeMotionEvent {
  id: string;
  timestampMs: number;
  motionPercent: number;
  threshold: number;
}

export interface NativeSetupState {
  hasImportedAudio: boolean;
  audio?: ImportedNativeAudio;
  readiness: NativeSetupReadiness;
}

export interface NativeSetupReadiness {
  cameraGranted: boolean;
  audioImported: boolean;
  routeVerified: boolean;
  calibrated: boolean;
  motionTestPassed: boolean;
  audioVolume: number;
}

export type NativeAutoStartBlocker =
  | 'device_owner_required'
  | 'home_launcher_required'
  | 'lock_task_not_active'
  | 'secure_lock_requires_first_unlock'
  | 'camera_permission_missing'
  | 'audio_missing'
  | 'audio_route_not_verified'
  | 'calibration_missing'
  | 'motion_test_missing'
  | 'operator_pin_missing'
  | 'maintenance_mode_active';

export interface NativeKioskState {
  operatorPinConfigured: boolean;
  isDeviceOwner: boolean;
  isDefaultHomeApp: boolean;
  isLockTaskAllowed: boolean;
  isLockTaskActive: boolean;
  autoStartAfterRebootEnabled: boolean;
  autoStartReady: boolean;
  blockers: NativeAutoStartBlocker[];
  lastBootStartState: 'never' | 'started' | 'waiting_for_route' | 'blocked' | 'failed';
  lastBootStartAtMs: number;
  lastBootStartMessage: string;
  requiresFirstUnlock: boolean;
  maintenanceMode: boolean;
  readiness: NativeSetupReadiness;
}

interface MotionDetectorPlugin {
  start(): Promise<NativeDetectorSnapshot>;
  stop(): Promise<void>;
  getStatus(): Promise<NativeDetectorSnapshot>;
  getEvents(options: { limit: number }): Promise<{ events: NativeMotionEvent[] }>;
  clearEvents(): Promise<void>;
  deleteEvent(options: { id: string }): Promise<void>;
  checkPermissions(): Promise<{ camera: 'granted' | 'denied' | 'prompt' | 'prompt-with-rationale' }>;
  requestCameraPermission(): Promise<{ granted: boolean } | NativeDetectorSnapshot>;
  saveSettings(options: { settings: DetectorSettings }): Promise<void>;
  importAudio(): Promise<ImportedNativeAudio>;
  playTest(): Promise<NativeDetectorSnapshot>;
  confirmAudioRoute(): Promise<NativeDetectorSnapshot>;
  cancelAudioTest(): Promise<NativeDetectorSnapshot>;
  calibrate(): Promise<NativeDetectorSnapshot>;
  finishMotionTest(): Promise<void>;
  getAudioRoute(): Promise<NativeAudioRoute>;
  getSetupState(): Promise<NativeSetupState>;
  getSettings(): Promise<DetectorSettings>;
  getKioskState(): Promise<NativeKioskState>;
  configureKiosk(): Promise<NativeKioskState>;
  setAutoStartAfterReboot(options: { enabled: boolean; operatorPin: string }): Promise<NativeKioskState>;
  setOperatorPin(options: { pin: string; currentPin?: string }): Promise<void>;
  unlockKiosk(options: { pin: string }): Promise<NativeKioskState>;
  lockKiosk(options: { operatorPin: string }): Promise<NativeKioskState>;
  getDiagnostics(): Promise<NativeDiagnostics>;
  exportDiagnostics(): Promise<void>;
  addListener(eventName: 'statusChanged', listenerFunc: (status: NativeDetectorSnapshot) => void): Promise<PluginListenerHandle>;
}

export const MotionDetector = registerPlugin<MotionDetectorPlugin>('MotionDetector');

/** This guard is the only native boundary used by React. Browser/PWA builds
 * keep using their existing MediaStream and IndexedDB implementation. */
export const isNativeMotionPlatform = (): boolean =>
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
