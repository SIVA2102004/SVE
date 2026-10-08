import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';

// Auto-register Service Worker with silent background updates
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        // Check for updates every time the app opens or gains focus
        registration.update();

        // Listen for new worker installed in background
        registration.onupdatefound = () => {
          const installingWorker = registration.installing;
          if (installingWorker) {
            installingWorker.onstatechange = () => {
              if (
                installingWorker.state === 'installed' &&
                navigator.serviceWorker.controller
              ) {
                // New content is available; auto-reload quietly so the user gets the latest code seamlessly
                console.log('New update available. Reloading with fresh version...');
                window.location.reload();
              }
            };
          }
        };
      })
      .catch((err) => {
        console.error('Service worker registration failed:', err);
      });
  });

  // Also auto-check for updates whenever user returns to the app tab/window
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && navigator.serviceWorker.ready) {
      navigator.serviceWorker.ready.then((reg) => reg.update());
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
