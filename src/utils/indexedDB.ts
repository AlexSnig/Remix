import { CustomAudioFile, MotionLog } from '../types';

const DB_NAME = 'AndroidMotionDetectorDB';
const DB_VERSION = 2; // Incremented for upgrades if needed

let dbInstance: IDBDatabase | null = null;

export function getDB(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = request.result;

      // Audio files store
      if (!db.objectStoreNames.contains('audioFiles')) {
        db.createObjectStore('audioFiles', { keyPath: 'id' });
      }

      // Motion event logs store
      if (!db.objectStoreNames.contains('motionLogs')) {
        db.createObjectStore('motionLogs', { keyPath: 'id' });
      }
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

// Custom Audio operations
export async function saveCustomAudio(file: CustomAudioFile): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('audioFiles', 'readwrite');
    const store = transaction.objectStore('audioFiles');
    const request = store.put(file);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getCustomAudio(id: string): Promise<CustomAudioFile | null> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('audioFiles', 'readonly');
    const store = transaction.objectStore('audioFiles');
    const request = store.get(id);

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

export async function getAllCustomAudios(): Promise<CustomAudioFile[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('audioFiles', 'readonly');
    const store = transaction.objectStore('audioFiles');
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function deleteCustomAudio(id: string): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('audioFiles', 'readwrite');
    const store = transaction.objectStore('audioFiles');
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Logs operations
export async function saveMotionLog(log: MotionLog): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('motionLogs', 'readwrite');
    const store = transaction.objectStore('motionLogs');
    const request = store.put(log);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getAllMotionLogs(): Promise<MotionLog[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('motionLogs', 'readonly');
    const store = transaction.objectStore('motionLogs');
    const request = store.getAll();

    request.onsuccess = () => {
      const logs = request.result || [];
      // Sort in-place by timestamp descending (newest first)
      logs.sort((a, b) => b.timestamp - a.timestamp);
      resolve(logs);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function clearAllMotionLogs(): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('motionLogs', 'readwrite');
    const store = transaction.objectStore('motionLogs');
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Storage stats & cache cleanup logic
export interface CacheStats {
  audioBytes: number;
  logCount: number;
  thumbnailBytesSum: number;
  totalEstimatedBytes: number;
}

export async function getCacheStats(): Promise<CacheStats> {
  const audios = await getAllCustomAudios();
  const logs = await getAllMotionLogs();

  let audioBytes = 0;
  for (const aud of audios) {
    audioBytes += aud.size || aud.data.length * 0.75; // exact size or estimation from base64 string
  }

  let thumbnailBytesSum = 0;
  for (const l of logs) {
    if (l.thumbnail) {
      thumbnailBytesSum += l.thumbnail.length;
    }
  }

  const logBytes = logs.length * 200 + thumbnailBytesSum; // metadata is small, thumbnail is the main part

  return {
    audioBytes,
    logCount: logs.length,
    thumbnailBytesSum,
    totalEstimatedBytes: audioBytes + logBytes,
  };
}

/**
 * Automagically clean internal caches:
 * 1. Keeps only the newest 'maxLogs' motion logs and deletes the rest.
 * 2. Prunes unused audio files (audios that are not defined by operational settings).
 * @param maxLogs 
 * @param activeAudioId 
 */
export async function performAutoCacheClean(maxLogs: number, activeAudioId: string | null): Promise<{ prunedLogs: number, prunedAudios: number }> {
  const db = await getDB();
  const logs = await getAllMotionLogs(); // sorted descending
  let prunedLogs = 0;
  let prunedAudios = 0;

  // Prune logs
  if (logs.length > maxLogs) {
    const logsToDelete = logs.slice(maxLogs);
    const logTransaction = db.transaction('motionLogs', 'readwrite');
    const logStore = logTransaction.objectStore('motionLogs');

    for (const log of logsToDelete) {
      logStore.delete(log.id);
      prunedLogs++;
    }
  }

  // Prune unused audios to save space
  const audios = await getAllCustomAudios();
  if (audios.length > 0) {
    const audioTransaction = db.transaction('audioFiles', 'readwrite');
    const audioStore = audioTransaction.objectStore('audioFiles');

    for (const aud of audios) {
      // If the audio isn't currently chosen as the active custom audio, and it's not a Google Drive file, delete it to clean cache
      if (aud.id !== activeAudioId && !aud.id.startsWith('drive_')) {
        audioStore.delete(aud.id);
        prunedAudios++;
      }
    }
  }

  return { prunedLogs, prunedAudios };
}
