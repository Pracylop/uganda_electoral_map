import { X, Globe, HardDrive, Zap, Wifi, WifiOff, MapPin } from 'lucide-react';
import { useBroadcastStore } from '../../stores/broadcastStore';

export function LayersPanel() {
  const {
    layersPanelOpen,
    toggleLayersPanel,
    sidebarExpanded,
    sidebarPosition,
    basemapOpacity,
    setBasemapOpacity,
    basemapSource,
    setBasemapSource,
    isOnline,
    layers,
    toggleLayer,
  } = useBroadcastStore();

  if (!layersPanelOpen) return null;

  const isLeft = sidebarPosition === 'left';

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={toggleLayersPanel}
      />

      {/* Panel */}
      <div
        className={`
          fixed top-0 bottom-0
          w-80
          bg-gray-900
          shadow-2xl
          z-50
          ${isLeft
            ? `border-r border-gray-700 animate-slideInRight ${sidebarExpanded ? 'left-20' : 'left-0'}`
            : `border-l border-gray-700 animate-slideInLeft ${sidebarExpanded ? 'right-20' : 'right-0'}`
          }
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-white">Map Settings</h2>
          <button
            onClick={toggleLayersPanel}
            className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
            aria-label="Close"
          >
            <X size={24} />
          </button>
        </div>

        {/* Basemap Source */}
        <div className="p-4 border-b border-gray-800">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white font-medium">Basemap Source</h3>
            <div className="flex items-center gap-1.5 text-xs">
              {isOnline ? (
                <>
                  <Wifi size={14} className="text-green-500" />
                  <span className="text-green-500">Online</span>
                </>
              ) : (
                <>
                  <WifiOff size={14} className="text-red-500" />
                  <span className="text-red-500">Offline</span>
                </>
              )}
            </div>
          </div>
          <div className="space-y-2">
            {/* Auto option */}
            <button
              onClick={() => setBasemapSource('auto')}
              className={`
                w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left
                ${basemapSource === 'auto'
                  ? 'bg-yellow-500/20 border border-yellow-500/50'
                  : 'bg-gray-800 border border-gray-700 hover:border-gray-600'
                }
              `}
            >
              <div className={`p-2 rounded-lg ${basemapSource === 'auto' ? 'bg-yellow-500/30' : 'bg-gray-700'}`}>
                <Zap size={18} className={basemapSource === 'auto' ? 'text-yellow-500' : 'text-gray-400'} />
              </div>
              <div className="flex-1">
                <div className={`font-medium ${basemapSource === 'auto' ? 'text-yellow-500' : 'text-white'}`}>
                  Auto (Recommended)
                </div>
                <div className="text-xs text-gray-400">
                  Online when connected, offline when not
                </div>
              </div>
            </button>

            {/* Online option */}
            <button
              onClick={() => setBasemapSource('online')}
              className={`
                w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left
                ${basemapSource === 'online'
                  ? 'bg-yellow-500/20 border border-yellow-500/50'
                  : 'bg-gray-800 border border-gray-700 hover:border-gray-600'
                }
              `}
            >
              <div className={`p-2 rounded-lg ${basemapSource === 'online' ? 'bg-yellow-500/30' : 'bg-gray-700'}`}>
                <Globe size={18} className={basemapSource === 'online' ? 'text-yellow-500' : 'text-gray-400'} />
              </div>
              <div className="flex-1">
                <div className={`font-medium ${basemapSource === 'online' ? 'text-yellow-500' : 'text-white'}`}>
                  Online (OSM)
                </div>
                <div className="text-xs text-gray-400">
                  Best labels, requires internet
                </div>
              </div>
            </button>

            {/* Offline option */}
            <button
              onClick={() => setBasemapSource('offline')}
              className={`
                w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left
                ${basemapSource === 'offline'
                  ? 'bg-yellow-500/20 border border-yellow-500/50'
                  : 'bg-gray-800 border border-gray-700 hover:border-gray-600'
                }
              `}
            >
              <div className={`p-2 rounded-lg ${basemapSource === 'offline' ? 'bg-yellow-500/30' : 'bg-gray-700'}`}>
                <HardDrive size={18} className={basemapSource === 'offline' ? 'text-yellow-500' : 'text-gray-400'} />
              </div>
              <div className="flex-1">
                <div className={`font-medium ${basemapSource === 'offline' ? 'text-yellow-500' : 'text-white'}`}>
                  Offline (PMTiles)
                </div>
                <div className="text-xs text-gray-400">
                  Works without internet, fewer labels
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Map Layers */}
        <div className="p-4 border-b border-gray-800">
          <h3 className="text-white font-medium mb-3">Map Layers</h3>
          <div className="space-y-2">
            {/* Polling Stations Toggle */}
            <button
              onClick={() => toggleLayer('pollingStations')}
              className={`
                w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left
                ${layers.pollingStations
                  ? 'bg-blue-500/20 border border-blue-500/50'
                  : 'bg-gray-800 border border-gray-700 hover:border-gray-600'
                }
              `}
            >
              <div className={`p-2 rounded-lg ${layers.pollingStations ? 'bg-blue-500/30' : 'bg-gray-700'}`}>
                <MapPin size={18} className={layers.pollingStations ? 'text-blue-500' : 'text-gray-400'} />
              </div>
              <div className="flex-1">
                <div className={`font-medium ${layers.pollingStations ? 'text-blue-500' : 'text-white'}`}>
                  Polling Stations
                </div>
                <div className="text-xs text-gray-400">
                  ~51K stations clustered by parish
                </div>
              </div>
              <div className={`
                w-10 h-6 rounded-full transition-colors relative
                ${layers.pollingStations ? 'bg-blue-500' : 'bg-gray-600'}
              `}>
                <div className={`
                  absolute top-1 w-4 h-4 rounded-full bg-white transition-transform
                  ${layers.pollingStations ? 'translate-x-5' : 'translate-x-1'}
                `} />
              </div>
            </button>
          </div>
        </div>

        {/* Basemap Opacity */}
        <div className="p-4">
          <h3 className="text-white font-medium mb-3">Basemap Intensity</h3>
          <p className="text-gray-400 text-sm mb-4">
            Adjust the visibility of the underlying map. Lower values make election results more prominent.
          </p>
          <div className="space-y-3">
            <input
              type="range"
              min="0"
              max="100"
              value={basemapOpacity}
              onChange={(e) => setBasemapOpacity(parseInt(e.target.value))}
              className="w-full h-3 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-yellow-500"
            />
            <div className="flex justify-between text-sm text-gray-400">
              <span>Faded</span>
              <span className="text-yellow-500 font-medium">{basemapOpacity}%</span>
              <span>Sharp</span>
            </div>
            {/* Quick presets */}
            <div className="flex gap-2 mt-2">
              {[0, 25, 50, 75, 100].map((value) => (
                <button
                  key={value}
                  onClick={() => setBasemapOpacity(value)}
                  className={`
                    flex-1 py-2 rounded-lg text-sm font-medium transition-colors
                    ${basemapOpacity === value
                      ? 'bg-yellow-500 text-gray-900'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    }
                  `}
                >
                  {value}%
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Hint */}
        <div className="absolute bottom-4 left-4 right-4 p-4 bg-gray-800 rounded-lg">
          <p className="text-gray-400 text-sm">
            <strong>Tip:</strong> Use 0% for maximum choropleth visibility during broadcasts, or 50% for balanced view with geographic context.
          </p>
        </div>
      </div>
    </>
  );
}
