export interface DetectorSettings {
  sensitivity: number;         // 1-100, where higher is more sensitive (lower diff threshold)
  noiseThreshold: number;      // percent of pixels that need to change to trigger motion (0.1% to 10%)
  coolDownDelay: number;       // seconds to wait before next event triggers
  audioSourceType: 'preset' | 'custom';
  audioPresetId: string;
  customAudioId: string | null;
  cameraFacingMode: 'user' | 'environment';
  stealthMode: boolean;
  autoCleanCacheEnabled: boolean;
  maxCacheLogsCount: number;   // automatically prune logs to this number to save cache
  audioVolume?: number;        // 0-100, where 0 is muted and 100 is max volume
  kioskModeEnabled?: boolean;   // whether kiosk mode on startup is active
  customFolderId?: string;      // custom Google Drive folder ID for background auto-sync
  lastSyncTimestamp?: number;   // when the background sync last ran successfully
}

export interface MotionLog {
  id: string;
  timestamp: number;
  thumbnail: string | null;    // base64 jpeg of the frame when motion was detected
}

export interface CustomAudioFile {
  id: string;
  name: string;
  data: string;                // base64 representation of the audio file
  size: number;                // size in bytes
  timestamp: number;
}
