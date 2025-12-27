import { useEffect, useRef } from 'react';

interface WebSocketMessage {
  type: string;
  payload: any;
}

export function useWebSocket(onMessage: (message: WebSocketMessage) => void) {
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<number | null>(null);

  useEffect(() => {
    const connect = () => {
      const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3001';
      const token = localStorage.getItem('auth_token');

      if (!token) {
        console.warn('No auth token found, skipping WebSocket connection');
        return;
      }

      ws.current = new WebSocket(WS_URL);

      ws.current.onopen = () => {
        console.log('WebSocket connected');
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
          if (message.type !== 'AUTH_OK' && message.type !== 'AUTH_REQUIRED') {
            onMessage(message);
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      ws.current.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      ws.current.onclose = () => {
        console.log('WebSocket disconnected, attempting to reconnect...');
        // Attempt to reconnect after 5 seconds
        reconnectTimeout.current = setTimeout(connect, 5000);
      };
    };

    connect();

    // Cleanup on unmount
    return () => {
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
      }
      if (ws.current) {
        ws.current.close();
      }
    };
  }, [onMessage]);

  return ws.current;
}
