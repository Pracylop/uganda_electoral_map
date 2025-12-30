/**
 * Connection Status Store
 * Tracks network and WebSocket connection status for offline-first UX
 */

import { create } from 'zustand';

export type ConnectionStatus = 'online' | 'offline' | 'reconnecting';

interface ConnectionState {
  // State
  status: ConnectionStatus;
  wsConnected: boolean;
  lastConnected: number | null;
  reconnectAttempts: number;

  // Actions
  setStatus: (status: ConnectionStatus) => void;
  setWsConnected: (connected: boolean) => void;
  setLastConnected: (timestamp: number) => void;
  incrementReconnectAttempts: () => void;
  resetReconnectAttempts: () => void;
}

export const useConnectionStore = create<ConnectionState>((set) => ({
  // Initial state - check browser's online status
  status: typeof navigator !== 'undefined' && navigator.onLine ? 'online' : 'offline',
  wsConnected: false,
  lastConnected: null,
  reconnectAttempts: 0,

  // Actions
  setStatus: (status) => set({ status }),

  setWsConnected: (wsConnected) => set((state) => ({
    wsConnected,
    // Update status based on WebSocket connection
    status: wsConnected ? 'online' : (state.status === 'offline' ? 'offline' : 'reconnecting'),
    // Track when we last had a successful connection
    lastConnected: wsConnected ? Date.now() : state.lastConnected
  })),

  setLastConnected: (timestamp) => set({ lastConnected: timestamp }),

  incrementReconnectAttempts: () => set((state) => ({
    reconnectAttempts: state.reconnectAttempts + 1
  })),

  resetReconnectAttempts: () => set({ reconnectAttempts: 0 })
}));

/**
 * Format last connected time for display
 */
export function formatLastConnected(lastConnected: number | null): string {
  if (!lastConnected) return '';

  const seconds = Math.floor((Date.now() - lastConnected) / 1000);

  if (seconds < 60) {
    return `${seconds}s ago`;
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}
