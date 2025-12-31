import { X } from 'lucide-react';
import { useBroadcastStore } from '../../stores/broadcastStore';

interface LayerToggleProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}

function LayerToggle({ label, description, checked, onChange, disabled }: LayerToggleProps) {
  return (
    <label
      className={`
        flex items-center justify-between
        p-4
        rounded-lg
        cursor-pointer
        transition-colors
        ${disabled
          ? 'opacity-50 cursor-not-allowed bg-gray-800'
          : checked
            ? 'bg-gray-700'
            : 'bg-gray-800 hover:bg-gray-750'
        }
      `}
    >
      <div className="flex-1 mr-4">
        <span className="text-white font-medium">{label}</span>
        {description && (
          <p className="text-gray-400 text-sm mt-1">{description}</p>
        )}
      </div>
      <div className="relative">
        <input
          type="checkbox"
          checked={checked}
          onChange={onChange}
          disabled={disabled}
          className="sr-only"
        />
        <div
          className={`
            w-14 h-7
            rounded-full
            transition-colors
            ${checked ? 'bg-yellow-500' : 'bg-gray-600'}
          `}
        >
          <div
            className={`
              absolute top-0.5 left-0.5
              w-6 h-6
              bg-white
              rounded-full
              shadow-md
              transition-transform duration-200
              ${checked ? 'translate-x-7' : 'translate-x-0'}
            `}
          />
        </div>
      </div>
    </label>
  );
}

export function LayersPanel() {
  const { layersPanelOpen, toggleLayersPanel, layers, toggleLayer, sidebarExpanded, sidebarPosition } = useBroadcastStore();

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
          <h2 className="text-lg font-semibold text-white">Map Layers</h2>
          <button
            onClick={toggleLayersPanel}
            className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
            aria-label="Close"
          >
            <X size={24} />
          </button>
        </div>

        {/* Layer Toggles */}
        <div className="p-4 space-y-3">
          <LayerToggle
            label="Election Results"
            description="Show winning party colors on map"
            checked={layers.results}
            onChange={() => toggleLayer('results')}
            disabled={true} // Always on
          />
          <LayerToggle
            label="Administrative Boundaries"
            description="Show region/district outlines"
            checked={layers.boundaries}
            onChange={() => toggleLayer('boundaries')}
          />
          <LayerToggle
            label="Demographics"
            description="Population and voter data overlay"
            checked={layers.demographics}
            onChange={() => toggleLayer('demographics')}
          />
          <LayerToggle
            label="Electoral Issues"
            description="Show reported incidents"
            checked={layers.issues}
            onChange={() => toggleLayer('issues')}
          />
          <LayerToggle
            label="Historical (2021)"
            description="Compare with previous election"
            checked={layers.historical}
            onChange={() => toggleLayer('historical')}
          />
        </div>

        {/* Legend hint */}
        <div className="absolute bottom-4 left-4 right-4 p-4 bg-gray-800 rounded-lg">
          <p className="text-gray-400 text-sm">
            Layers affect what data is displayed on the map. Toggle layers on/off to customize your view.
          </p>
        </div>
      </div>
    </>
  );
}
