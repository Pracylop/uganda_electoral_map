/**
 * Connection Status Indicator
 * Shows network/WebSocket connection status for presenter workstations
 */

import { useConnectionStore, formatLastConnected } from '../stores/connectionStore';
import { useEffect, useState } from 'react';
import { RefreshCw, Wifi, WifiOff, Loader2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

export function ConnectionIndicator() {
  const queryClient = useQueryClient();
  const { status, lastConnected, reconnectAttempts } = useConnectionStore();
  const [lastConnectedText, setLastConnectedText] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Update "last connected" text periodically
  useEffect(() => {
    const updateText = () => setLastConnectedText(formatLastConnected(lastConnected));
    updateText();
    const interval = setInterval(updateText, 10000); // Update every 10 seconds
    return () => clearInterval(interval);
  }, [lastConnected]);

  // Handle manual refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      // Invalidate all queries to refresh data
      await queryClient.invalidateQueries();
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  // Determine status color and text for dark mode
  let bgColor: string;
  let textColor: string;
  let statusText: string;
  let Icon = Wifi;

  switch (status) {
    case 'online':
      bgColor = 'bg-green-900/50';
      textColor = 'text-green-400';
      statusText = 'Connected';
      Icon = Wifi;
      break;
    case 'reconnecting':
      bgColor = 'bg-yellow-900/50';
      textColor = 'text-yellow-400';
      statusText = `Reconnecting${reconnectAttempts > 0 ? ` (${reconnectAttempts})` : ''}`;
      Icon = Loader2;
      break;
    case 'offline':
      bgColor = 'bg-red-900/50';
      textColor = 'text-red-400';
      statusText = 'Offline';
      Icon = WifiOff;
      break;
    default:
      bgColor = 'bg-gray-700';
      textColor = 'text-gray-400';
      statusText = 'Unknown';
      Icon = Wifi;
  }

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm ${bgColor}`}>
      {/* Status Icon */}
      <Icon
        size={14}
        className={`${textColor} ${status === 'reconnecting' ? 'animate-spin' : ''}`}
      />

      {/* Status Text */}
      <span className={`font-medium ${textColor}`}>{statusText}</span>

      {/* Last sync time */}
      {lastConnectedText && status === 'online' && (
        <span className="text-xs text-gray-500 hidden md:inline">
          • {lastConnectedText}
        </span>
      )}

      {/* Refresh button */}
      <button
        onClick={handleRefresh}
        disabled={isRefreshing || status === 'offline'}
        className={`p-1 rounded hover:bg-gray-600 transition-colors ${
          isRefreshing || status === 'offline' ? 'opacity-50 cursor-not-allowed' : ''
        }`}
        title="Refresh data"
      >
        <RefreshCw
          size={12}
          className={`text-gray-400 ${isRefreshing ? 'animate-spin' : ''}`}
        />
      </button>
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
