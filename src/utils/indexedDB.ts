import {CustomAudioFile, MotionLog} from '../types';

const DB_NAME = 'AndroidMotionDetectorDB';
const DB_VERSION = 3;

let dbInstance: IDBDatabase | null = null;

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    /* v8 ignore next -- browser-owned IDB failure callback */
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    /* v8 ignore next -- browser-owned IDB failure callback */
    transaction.onerror = () => reject(transaction.error);
    /* v8 ignore next -- browser-owned IDB abort callback */
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'));
  });
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, payload = ''] = dataUrl.split(',');
  const mimeType = header.match(/^data:([^;]+)/)?.[1] || 'audio/mpeg';
  const binary = atob(payload);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], {type: mimeType});
}

async function normalizeAudioRecord(record: CustomAudioFile): Promise<CustomAudioFile> {
  if (record.blob && typeof record.blob === 'object') return record;
  if (!record.data) throw new Error(`Audio record ${record.id} has no playable data`);

  const blob = dataUrlToBlob(record.data);
  const migrated: CustomAudioFile = {
    id: record.id,
    name: record.name,
    blob,
    size: record.size || blob.size,
    mimeType: blob.type || 'audio/mpeg',
    timestamp: record.timestamp,
  };
  await saveCustomAudio(migrated);
  return migrated;
}

export function getDB(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('audioFiles')) db.createObjectStore('audioFiles', {keyPath: 'id'});
      if (!db.objectStoreNames.contains('motionLogs')) db.createObjectStore('motionLogs', {keyPath: 'id'});
    };
    request.onsuccess = () => {
      dbInstance = request.result;
      dbInstance.onversionchange = () => {
        dbInstance?.close();
        dbInstance = null;
      };
      resolve(dbInstance);
    };
    /* v8 ignore next -- browser-owned IDB failure callback */
    request.onerror = () => reject(request.error);
    /* v8 ignore next -- requires a second real browser tab */
    request.onblocked = () => reject(new Error('IndexedDB upgrade is blocked by another tab'));
  });
}

export async function saveCustomAudio(file: CustomAudioFile): Promise<void> {
  const db = await getDB();
  const transaction = db.transaction('audioFiles', 'readwrite');
  transaction.objectStore('audioFiles').put(file);
  await transactionDone(transaction);
}

export async function getCustomAudio(id: string): Promise<CustomAudioFile | null> {
  const db = await getDB();
  const transaction = db.transaction('audioFiles', 'readonly');
  const result = await requestResult(transaction.objectStore('audioFiles').get(id));
  return result ? normalizeAudioRecord(result as CustomAudioFile) : null;
}

export async function getAllCustomAudios(): Promise<CustomAudioFile[]> {
  const db = await getDB();
  const transaction = db.transaction('audioFiles', 'readonly');
  const records = await requestResult(transaction.objectStore('audioFiles').getAll()) as CustomAudioFile[];
  const normalized = await Promise.all(records.map(async record => {
    try {
      return await normalizeAudioRecord(record);
    } catch {
      return null;
    }
  }));
  return normalized.filter((record): record is CustomAudioFile => record !== null);
}

export async function deleteCustomAudio(id: string): Promise<void> {
  const db = await getDB();
  const transaction = db.transaction('audioFiles', 'readwrite');
  transaction.objectStore('audioFiles').delete(id);
  await transactionDone(transaction);
}

export async function saveMotionLog(log: MotionLog): Promise<void> {
  const db = await getDB();
  const transaction = db.transaction('motionLogs', 'readwrite');
  transaction.objectStore('motionLogs').put(log);
  await transactionDone(transaction);
}

export async function deleteMotionLog(id: string): Promise<void> {
  const db = await getDB();
  const transaction = db.transaction('motionLogs', 'readwrite');
  transaction.objectStore('motionLogs').delete(id);
  await transactionDone(transaction);
}

export async function getAllMotionLogs(): Promise<MotionLog[]> {
  const db = await getDB();
  const transaction = db.transaction('motionLogs', 'readonly');
  const logs = await requestResult(transaction.objectStore('motionLogs').getAll()) as MotionLog[];
  return logs.toSorted((a, b) => b.timestamp - a.timestamp);
}

export async function clearAllMotionLogs(): Promise<void> {
  const db = await getDB();
  const transaction = db.transaction('motionLogs', 'readwrite');
  transaction.objectStore('motionLogs').clear();
  await transactionDone(transaction);
}

export async function verifyStorageWritable(): Promise<void> {
  const db = await getDB();
  const transaction = db.transaction('motionLogs', 'readwrite');
  const store = transaction.objectStore('motionLogs');
  const id = `health_${Date.now()}`;
  store.put({id, timestamp: Date.now(), thumbnail: null});
  store.delete(id);
  await transactionDone(transaction);
}

export interface CacheStats {
  audioBytes: number;
  logCount: number;
  thumbnailBytesSum: number;
  totalEstimatedBytes: number;
}

export async function getCacheStats(): Promise<CacheStats> {
  const [audios, logs] = await Promise.all([getAllCustomAudios(), getAllMotionLogs()]);
  const audioBytes = audios.reduce((sum, audio) => sum + audio.size, 0);
  const thumbnailBytesSum = logs.reduce((sum, log) => sum + (log.thumbnail?.length ?? 0), 0);
  return {
    audioBytes,
    logCount: logs.length,
    thumbnailBytesSum,
    totalEstimatedBytes: audioBytes + thumbnailBytesSum + logs.length * 200,
  };
}

export async function performAutoCacheClean(maxLogs: number, _activeAudioId: string | null): Promise<{prunedLogs: number; prunedAudios: number}> {
  const db = await getDB();
  const logs = await getAllMotionLogs();
  const logsToDelete = logs.slice(maxLogs);
  if (logsToDelete.length > 0) {
    const transaction = db.transaction('motionLogs', 'readwrite');
    const store = transaction.objectStore('motionLogs');
    logsToDelete.forEach(log => store.delete(log.id));
    await transactionDone(transaction);
  }
  return {prunedLogs: logsToDelete.length, prunedAudios: 0};
}

export async function requestPersistentStorage(): Promise<boolean> {
  if (!navigator.storage?.persist) return false;
  return navigator.storage.persist();
}

export async function getStorageHealth(): Promise<{persisted: boolean; usage: number; quota: number}> {
  const [persisted, estimate] = await Promise.all([
    navigator.storage?.persisted?.() ?? Promise.resolve(false),
    navigator.storage?.estimate?.() ?? Promise.resolve({usage: 0, quota: 0}),
  ]);
  return {persisted, usage: estimate.usage ?? 0, quota: estimate.quota ?? 0};
}
