import {beforeEach, describe, expect, it} from 'vitest';
import {clearAllMotionLogs, deleteCustomAudio, deleteMotionLog, getAllCustomAudios, getAllMotionLogs, getCacheStats, getCustomAudio, getDB, getStorageHealth, performAutoCacheClean, requestPersistentStorage, saveCustomAudio, saveMotionLog, verifyStorageWritable} from './indexedDB';

describe('IndexedDB persistence', () => {
  beforeEach(async () => {
    const db = await getDB();
    await Promise.all([
      new Promise<void>((resolve, reject) => {
        const tx = db.transaction('audioFiles', 'readwrite');
        tx.objectStore('audioFiles').clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      }),
      clearAllMotionLogs(),
    ]);
  });

  it('stores Blob audio and keeps inactive files during log pruning', async () => {
    const audio = {id: 'audio-1', name: 'test.mp3', blob: new Blob(['audio'], {type: 'audio/mpeg'}), size: 5, mimeType: 'audio/mpeg', timestamp: 1};
    await saveCustomAudio(audio);
    expect((await getCustomAudio(audio.id))?.name).toBe('test.mp3');
    expect(await getAllCustomAudios()).toHaveLength(1);

    await Promise.all([1, 2, 3].map(timestamp => saveMotionLog({id: `log-${timestamp}`, timestamp, thumbnail: 'abc'})));
    expect((await getAllMotionLogs()).map(log => log.timestamp)).toEqual([3, 2, 1]);
    expect(await performAutoCacheClean(2, null)).toEqual({prunedLogs: 1, prunedAudios: 0});
    expect(await getAllMotionLogs()).toHaveLength(2);
    expect(await getAllCustomAudios()).toHaveLength(1);

    const stats = await getCacheStats();
    expect(stats).toMatchObject({audioBytes: 5, logCount: 2, thumbnailBytesSum: 6});
    await deleteMotionLog('log-3');
    await deleteCustomAudio(audio.id);
    expect(await getAllMotionLogs()).toHaveLength(1);
    expect(await getAllCustomAudios()).toHaveLength(0);
  });

  it('reports storage persistence and quota', async () => {
    Object.defineProperty(navigator, 'storage', {configurable: true, value: {
      persist: async () => true,
      persisted: async () => true,
      estimate: async () => ({usage: 10, quota: 100}),
    }});
    expect(await requestPersistentStorage()).toBe(true);
    expect(await getStorageHealth()).toEqual({persisted: true, usage: 10, quota: 100});
  });

  it('migrates a legacy base64 record and ignores corrupt records', async () => {
    const db = await getDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('audioFiles', 'readwrite');
      const store = tx.objectStore('audioFiles');
      store.put({id: 'legacy', name: 'legacy.mp3', data: 'data:audio/mpeg;base64,YQ==', size: 0, timestamp: 2});
      store.put({id: 'broken', name: 'broken.mp3', size: 0, timestamp: 3});
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    const migrated = await getCustomAudio('legacy');
    expect(migrated?.mimeType).toBe('audio/mpeg');
    expect(migrated?.size).toBe(1);
    expect((await getAllCustomAudios()).map(audio => audio.id)).toEqual(['legacy']);
    expect(await getCustomAudio('missing')).toBeNull();
  });

  it('uses safe storage fallbacks when the API is unavailable', async () => {
    Object.defineProperty(navigator, 'storage', {configurable: true, value: undefined});
    expect(await requestPersistentStorage()).toBe(false);
    expect(await getStorageHealth()).toEqual({persisted: false, usage: 0, quota: 0});
  });

  it('closes the cached connection when a new database version arrives', async () => {
    const db = await getDB();
    db.onversionchange?.(new IDBVersionChangeEvent('versionchange', {oldVersion: 3, newVersion: 4}));
    const reopened = await getDB();
    expect(reopened).not.toBe(db);
  });

  it('verifies a write transaction without leaving a health record', async () => {
    await verifyStorageWritable();
    expect(await getAllMotionLogs()).toEqual([]);
  });
});
