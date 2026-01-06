/**
 * Hook to track online/offline status and update the connectionStore.
 * Should be called once at the app root level.
 */

import { useEffect } from 'react';
import { useConnectionStore } from '../stores/connectionStore';

export function useConnectionStatusListener() {
  const { setStatus, setLastConnected } = useConnectionStore();

  useEffect(() => {
    const handleOnline = () => {
      setStatus('online');
      setLastConnected(Date.now());
    };

    const handleOffline = () => {
      setStatus('offline');
    };

    // Set initial status
    if (navigator.onLine) {
      setStatus('online');
      setLastConnected(Date.now());
    } else {
      setStatus('offline');
    }

    // Listen for changes
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [setStatus, setLastConnected]);
}
