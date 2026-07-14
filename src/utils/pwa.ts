import {registerSW} from 'virtual:pwa-register';

type UpdateHandler = (update: () => Promise<void>) => void;

const listeners = new Set<UpdateHandler>();
let pendingUpdate: (() => Promise<void>) | null = null;

export function registerPwa(): void {
  const updateServiceWorker = registerSW({
    immediate: true,
    onNeedRefresh() {
      pendingUpdate = () => updateServiceWorker(true);
      listeners.forEach(listener => listener(pendingUpdate!));
    },
    onRegisterError(error) {
      console.error('PWA service worker registration failed:', error);
    },
  });
}

export function subscribeToPwaUpdate(listener: UpdateHandler): () => void {
  listeners.add(listener);
  if (pendingUpdate) listener(pendingUpdate);
  return () => listeners.delete(listener);
}
