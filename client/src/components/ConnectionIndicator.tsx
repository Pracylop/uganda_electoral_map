/**
 * Connection Status Indicator
 * Shows network/WebSocket connection status for presenter workstations
 */

import { useConnectionStore, formatLastConnected } from '../stores/connectionStore';
import { useEffect, useState } from 'react';

export function ConnectionIndicator() {
  const { status, lastConnected, reconnectAttempts } = useConnectionStore();
  const [lastConnectedText, setLastConnectedText] = useState('');

  // Update "last connected" text periodically
  useEffect(() => {
    if (status !== 'online') {
      setLastConnectedText(formatLastConnected(lastConnected));
      const interval = setInterval(() => {
        setLastConnectedText(formatLastConnected(lastConnected));
      }, 10000); // Update every 10 seconds
      return () => clearInterval(interval);
    }
  }, [status, lastConnected]);

  // Determine status color and text
  let bgColor: string;
  let textColor: string;
  let statusText: string;
  let dotColor: string;

  switch (status) {
    case 'online':
      bgColor = 'bg-green-50';
      textColor = 'text-green-700';
      dotColor = 'bg-green-500';
      statusText = 'Connected';
      break;
    case 'reconnecting':
      bgColor = 'bg-yellow-50';
      textColor = 'text-yellow-700';
      dotColor = 'bg-yellow-500';
      statusText = `Reconnecting${reconnectAttempts > 0 ? ` (${reconnectAttempts})` : ''}...`;
      break;
    case 'offline':
      bgColor = 'bg-red-50';
      textColor = 'text-red-700';
      dotColor = 'bg-red-500';
      statusText = 'Offline';
      break;
    default:
      bgColor = 'bg-gray-50';
      textColor = 'text-gray-700';
      dotColor = 'bg-gray-400';
      statusText = 'Unknown';
  }

  return (
    <div
      className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${bgColor} ${textColor}`}
      title={status === 'offline' && lastConnectedText ? `Last sync: ${lastConnectedText}` : undefined}
    >
      {/* Animated pulse dot for reconnecting */}
      <span className={`relative flex h-2.5 w-2.5`}>
        {status === 'reconnecting' && (
          <span
            className={`animate-ping absolute inline-flex h-full w-full rounded-full ${dotColor} opacity-75`}
          />
        )}
        <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${dotColor}`} />
      </span>

      <span className="font-medium">{statusText}</span>

      {/* Show last connected time when offline */}
      {status === 'offline' && lastConnectedText && (
        <span className="text-xs opacity-75">({lastConnectedText})</span>
      )}
    </div>
  );
}

/**
 * Compact version for tight spaces
 */
export function ConnectionDot() {
  const { status, reconnectAttempts } = useConnectionStore();

  let dotColor: string;
  let title: string;

  switch (status) {
    case 'online':
      dotColor = 'bg-green-500';
      title = 'Connected';
      break;
    case 'reconnecting':
      dotColor = 'bg-yellow-500';
      title = `Reconnecting (attempt ${reconnectAttempts})`;
      break;
    case 'offline':
      dotColor = 'bg-red-500';
      title = 'Offline - using cached data';
      break;
    default:
      dotColor = 'bg-gray-400';
      title = 'Unknown status';
  }

  return (
    <span className="relative flex h-3 w-3" title={title}>
      {status === 'reconnecting' && (
        <span
          className={`animate-ping absolute inline-flex h-full w-full rounded-full ${dotColor} opacity-75`}
        />
      )}
      <span className={`relative inline-flex rounded-full h-3 w-3 ${dotColor}`} />
    </span>
  );
}
