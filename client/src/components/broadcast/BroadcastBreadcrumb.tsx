import { ChevronRight, Home } from 'lucide-react';
import { useBroadcastStore } from '../../stores/broadcastStore';

const LEVEL_NAMES: Record<number, string> = {
  2: 'Districts',
  3: 'Constituencies',
  4: 'Subcounties',
  5: 'Parishes',
};

export function BroadcastBreadcrumb() {
  const {
    drillDownStack,
    currentLevel,
    navigateTo,
    sidebarExpanded,
    sidebarPosition,
  } = useBroadcastStore();

  const isLeft = sidebarPosition === 'left';

  // Don't show if only at root level
  if (drillDownStack.length <= 1) return null;

  return (
    <nav
      className={`
        fixed bottom-6
        z-30
        animate-slideUp
        ${isLeft
          ? `left-6 ${sidebarExpanded ? 'ml-20' : ''}`
          : `right-6 ${sidebarExpanded ? 'mr-20' : ''}`
        }
      `}
    >
      <div className="flex items-center gap-1 bg-gray-900/95 backdrop-blur-sm px-4 py-3 rounded-xl border border-gray-700 shadow-2xl">
        {/* Home button */}
        <button
          onClick={() => navigateTo(0)}
          className="flex items-center justify-center w-10 h-10 rounded-lg bg-gray-800 hover:bg-yellow-500 hover:text-gray-900 text-gray-300 transition-colors"
          title="Back to National View"
        >
          <Home size={20} />
        </button>

        {/* Breadcrumb items */}
        {drillDownStack.map((level, index) => (
          <span key={index} className="flex items-center">
            <ChevronRight size={18} className="text-gray-500 mx-1" />
            <button
              onClick={() => navigateTo(index)}
              className={`
                px-3 py-2 rounded-lg text-sm font-medium transition-colors
                min-h-[44px] min-w-[44px]
                ${index === drillDownStack.length - 1
                  ? 'bg-yellow-500 text-gray-900 cursor-default'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white'
                }
              `}
              disabled={index === drillDownStack.length - 1}
            >
              {level.regionName}
            </button>
          </span>
        ))}

        {/* Current level indicator */}
        {currentLevel <= 5 && (
          <span className="flex items-center">
            <ChevronRight size={18} className="text-gray-500 mx-1" />
            <span className="px-3 py-2 text-sm text-gray-500 italic">
              {LEVEL_NAMES[currentLevel]}
            </span>
          </span>
        )}
      </div>
    </nav>
  );
}
