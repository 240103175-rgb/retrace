// #160 service worker registration, cache clearing between users, and the offline banner.
import { useEffect, useState } from 'react';
import { T } from './text';

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  });
}

/** Removes cached API data (called on sign-in and sign-out). */
export function clearOfflineData() {
  navigator.serviceWorker?.controller?.postMessage({ type: 'clear' });
}

export function useOnline() {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

export function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <div className="offline-banner" role="status" data-testid="offline-banner">
      {T.offline}
    </div>
  );
}
