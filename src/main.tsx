import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Clear legacy service workers and browser caches to resolve potential stale caching or intercepting issues (like 404 errors on API endpoints)
if (typeof window !== "undefined") {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        registration.unregister().then((success) => {
          if (success) {
            console.log("Successfully unregistered stale service worker:", registration);
          }
        });
      }
    }).catch((err) => {
      console.error("Error during service worker unregistration:", err);
    });
  }
  if ("caches" in window) {
    caches.keys().then((keys) => {
      for (const key of keys) {
        caches.delete(key).then((success) => {
          if (success) {
            console.log("Successfully cleared stale cache store:", key);
          }
        });
      }
    }).catch((err) => {
      console.error("Error during cache clearing:", err);
    });
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
