import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {Capacitor} from '@capacitor/core';
import App from './App.tsx';
import './index.css';
import {registerPwa} from './utils/pwa';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// The APK always ships a complete local asset bundle. A service worker adds no
// offline benefit there and can keep an older WebView bundle alive after an APK
// update. The web/PWA build continues to use the service worker as before.
if (Capacitor.isNativePlatform()) {
  void navigator.serviceWorker?.getRegistrations().then(registrations =>
    Promise.all(registrations.map(registration => registration.unregister())),
  );
} else {
  registerPwa();
}
