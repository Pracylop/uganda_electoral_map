import { useEffect } from 'react';
import { useBroadcastStore } from '../stores/broadcastStore';

/**
 * Hook to track online/offline status and update the broadcast store.
 * Should be called once at the app root level.
 */
export function useOnlineStatusListener() {
  const setOnlineStatus = useBroadcastStore((state) => state.setOnlineStatus);

  useEffect(() => {
    const handleOnline = () => setOnlineStatus(true);
    const handleOffline = () => setOnlineStatus(false);

    // Set initial status
    setOnlineStatus(navigator.onLine);

    // Listen for changes
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [setOnlineStatus]);
}

/**
 * Hook to get the effective basemap source based on preference and online status.
 * Returns 'online' or 'offline' (resolves 'auto' based on connectivity).
 */
export function useEffectiveBasemap(): 'online' | 'offline' {
  const basemapSource = useBroadcastStore((state) => state.basemapSource);
  const isOnline = useBroadcastStore((state) => state.isOnline);

  if (basemapSource === 'auto') {
    return isOnline ? 'online' : 'offline';
  }
  return basemapSource;
}
