/**
 * WebSocket Hook with Exponential Backoff Reconnection
 * Integrates with connectionStore for status tracking
 */

import { useEffect, useRef, useCallback } from 'react';
import { useConnectionStore } from '../stores/connectionStore';

interface WebSocketMessage {
  type: string;
  payload: any;
}

// Exponential backoff configuration
const RECONNECT_BASE_DELAY = 2000;   // Start at 2 seconds
const RECONNECT_MAX_DELAY = 30000;   // Max 30 seconds
const RECONNECT_MULTIPLIER = 2;

export function useWebSocket(onMessage: (message: WebSocketMessage) => void) {
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<number | null>(null);
  const reconnectDelay = useRef(RECONNECT_BASE_DELAY);
  const onMessageRef = useRef(onMessage);

  // Keep onMessage ref updated to avoid stale closures
  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  // Get connection store actions
  const {
    setStatus,
    setWsConnected,
    incrementReconnectAttempts,
    resetReconnectAttempts
  } = useConnectionStore();

  const connect = useCallback(() => {
    const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3001';
    const token = localStorage.getItem('auth_token');

    if (!token) {
      console.warn('No auth token found, skipping WebSocket connection');
      return;
    }

    // Clean up any existing connection
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      return;
    }

    console.log(`WebSocket connecting to ${WS_URL}...`);
    ws.current = new WebSocket(WS_URL);

    ws.current.onopen = () => {
      console.log('WebSocket connected');
      setWsConnected(true);
      setStatus('online');
      resetReconnectAttempts();
      reconnectDelay.current = RECONNECT_BASE_DELAY; // Reset delay on success

      // Send authentication
      ws.current?.send(
        JSON.stringify({
          type: 'AUTH',
          payload: { token }
        })
      );
    };

    ws.current.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        // Filter out auth messages
        if (message.type !== 'AUTH_OK' && message.type !== 'AUTH_REQUIRED') {
          onMessageRef.current(message);
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    ws.current.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.current.onclose = (event) => {
      console.log(`WebSocket disconnected (code: ${event.code})`);
      setWsConnected(false);

      // Only attempt reconnect if we're still online
      if (navigator.onLine) {
        setStatus('reconnecting');
        incrementReconnectAttempts();

        // Calculate next delay with exponential backoff
        const delay = Math.min(reconnectDelay.current, RECONNECT_MAX_DELAY);
        console.log(`Reconnecting in ${delay}ms...`);

        reconnectTimeout.current = window.setTimeout(() => {
          // Increase delay for next attempt
          reconnectDelay.current = Math.min(
            reconnectDelay.current * RECONNECT_MULTIPLIER,
            RECONNECT_MAX_DELAY
          );
          connect();
        }, delay);
      } else {
        setStatus('offline');
      }
    };
  }, [setStatus, setWsConnected, incrementReconnectAttempts, resetReconnectAttempts]);

  useEffect(() => {
    // Initial connection
    connect();

    // Listen for browser online/offline events
    const handleOnline = () => {
      console.log('Browser is online');
      setStatus('reconnecting');
      // Reset delay when coming back online
      reconnectDelay.current = RECONNECT_BASE_DELAY;
      // Attempt immediate reconnection if not already connected
      if (!ws.current || ws.current.readyState !== WebSocket.OPEN) {
        connect();
      }
    };

    const handleOffline = () => {
      console.log('Browser is offline');
      setStatus('offline');
      // Clear any pending reconnection attempts
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
        reconnectTimeout.current = null;
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Cleanup on unmount
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);

      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
      }
      if (ws.current) {
        ws.current.close();
      }
    };
  }, [connect, setStatus]);

  // Return the WebSocket instance for direct access if needed
  return ws.current;
}

/**
 * Send a message through WebSocket (if connected)
 */
export function sendWebSocketMessage(ws: WebSocket | null, message: WebSocketMessage): boolean {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
    return true;
  }
  return false;
}
