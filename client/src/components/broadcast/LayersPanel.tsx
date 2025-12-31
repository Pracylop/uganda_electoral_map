import { X } from 'lucide-react';
import { useBroadcastStore } from '../../stores/broadcastStore';

export function LayersPanel() {
  const { layersPanelOpen, toggleLayersPanel, sidebarExpanded, sidebarPosition, basemapOpacity, setBasemapOpacity } = useBroadcastStore();

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
