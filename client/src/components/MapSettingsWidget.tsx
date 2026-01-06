import { useState, useRef, useEffect } from 'react';
import { Settings, Globe, HardDrive, Zap, Wifi, WifiOff, X } from 'lucide-react';
import { useBroadcastStore } from '../stores/broadcastStore';

interface MapSettingsWidgetProps {
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  className?: string;
}

/**
 * Floating map settings widget for basemap source and opacity controls.
 * Can be placed on any map page.
 */
export function MapSettingsWidget({ position = 'bottom-left', className = '' }: MapSettingsWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const {
    basemapOpacity,
    setBasemapOpacity,
    basemapSource,
    setBasemapSource,
    isOnline
  } = useBroadcastStore();

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Position classes
  const positionClasses = {
    'top-left': 'top-4 left-4',
    'top-right': 'top-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'bottom-right': 'bottom-4 right-4',
  };

  // Panel position (opens in opposite direction)
  const panelPositionClasses = {
    'top-left': 'top-full left-0 mt-2',
    'top-right': 'top-full right-0 mt-2',
    'bottom-left': 'bottom-full left-0 mb-2',
    'bottom-right': 'bottom-full right-0 mb-2',
  };

  return (
    <div
      ref={panelRef}
      className={`absolute z-30 ${positionClasses[position]} ${className}`}
    >
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          w-10 h-10 rounded-lg shadow-lg
          flex items-center justify-center
          transition-all duration-200
          ${isOpen
            ? 'bg-yellow-500 text-gray-900'
            : 'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white'
          }
        `}
        title="Map Settings"
      >
        <Settings size={20} className={isOpen ? 'rotate-90' : ''} style={{ transition: 'transform 0.2s' }} />
      </button>

      {/* Settings Panel */}
      {isOpen && (
        <div className={`absolute ${panelPositionClasses[position]} w-72 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl overflow-hidden`}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700 bg-gray-800/50">
            <h3 className="text-white font-medium">Map Settings</h3>
            <div className="flex items-center gap-2">
              {isOnline ? (
                <span className="flex items-center gap-1 text-xs text-green-500">
                  <Wifi size={12} />
                  Online
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs text-red-500">
                  <WifiOff size={12} />
                  Offline
                </span>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-700 text-gray-400 hover:text-white"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Basemap Source */}
          <div className="p-3 border-b border-gray-800">
            <label className="text-xs text-gray-400 uppercase tracking-wide mb-2 block">Basemap Source</label>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                onClick={() => setBasemapSource('auto')}
                className={`
                  flex flex-col items-center gap-1 p-2 rounded-lg transition-colors text-center
                  ${basemapSource === 'auto'
                    ? 'bg-yellow-500/20 border border-yellow-500/50 text-yellow-500'
                    : 'bg-gray-800 border border-gray-700 text-gray-400 hover:border-gray-600 hover:text-white'
                  }
                `}
                title="Auto: Online when connected, offline when not"
              >
                <Zap size={16} />
                <span className="text-xs font-medium">Auto</span>
              </button>
              <button
                onClick={() => setBasemapSource('online')}
                className={`
                  flex flex-col items-center gap-1 p-2 rounded-lg transition-colors text-center
                  ${basemapSource === 'online'
                    ? 'bg-yellow-500/20 border border-yellow-500/50 text-yellow-500'
                    : 'bg-gray-800 border border-gray-700 text-gray-400 hover:border-gray-600 hover:text-white'
                  }
                `}
                title="Online: Best labels, requires internet"
              >
                <Globe size={16} />
                <span className="text-xs font-medium">Online</span>
              </button>
              <button
                onClick={() => setBasemapSource('offline')}
                className={`
                  flex flex-col items-center gap-1 p-2 rounded-lg transition-colors text-center
                  ${basemapSource === 'offline'
                    ? 'bg-yellow-500/20 border border-yellow-500/50 text-yellow-500'
                    : 'bg-gray-800 border border-gray-700 text-gray-400 hover:border-gray-600 hover:text-white'
                  }
                `}
                title="Offline: Works without internet"
              >
                <HardDrive size={16} />
                <span className="text-xs font-medium">Offline</span>
              </button>
            </div>
          </div>

          {/* Basemap Opacity */}
          <div className="p-3">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-gray-400 uppercase tracking-wide">Basemap Intensity</label>
              <span className="text-xs text-yellow-500 font-medium">{basemapOpacity}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={basemapOpacity}
              onChange={(e) => setBasemapOpacity(parseInt(e.target.value))}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-yellow-500"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>Faded</span>
              <span>Sharp</span>
            </div>
            {/* Quick presets */}
            <div className="flex gap-1 mt-2">
              {[0, 25, 50, 75, 100].map((value) => (
                <button
                  key={value}
                  onClick={() => setBasemapOpacity(value)}
                  className={`
                    flex-1 py-1 rounded text-xs font-medium transition-colors
                    ${basemapOpacity === value
                      ? 'bg-yellow-500 text-gray-900'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
                    }
                  `}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MapSettingsWidget;
