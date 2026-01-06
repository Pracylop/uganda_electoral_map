import { useEffect, useRef } from 'react';
import { Wifi, WifiOff, ChevronRight, Pencil } from 'lucide-react';
import { useBroadcastStore } from '../../stores/broadcastStore';
import { useConnectionStore } from '../../stores/connectionStore';

interface BroadcastHeaderProps {
  electionName?: string;
  electionType?: string;
}

export function BroadcastHeader({ electionName, electionType }: BroadcastHeaderProps) {
  const { headerVisible, showHeader, hideHeader, drillDownStack, sidebarExpanded, sidebarPosition, viewMode, annotationMode, toggleAnnotationMode } = useBroadcastStore();
  const { status } = useConnectionStore();
  const isOnline = status === 'online';
  const hideTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLeft = sidebarPosition === 'left';

  // Auto-hide header after 5 seconds of inactivity
  useEffect(() => {
    const resetHideTimer = () => {
      showHeader();
      if (hideTimeout.current) {
        clearTimeout(hideTimeout.current);
      }
      hideTimeout.current = setTimeout(() => {
        hideHeader();
      }, 5000);
    };

    // Reset timer on any interaction
    window.addEventListener('mousemove', resetHideTimer);
    window.addEventListener('touchstart', resetHideTimer);
    window.addEventListener('keydown', resetHideTimer);

    // Initial timer
    resetHideTimer();

    return () => {
      window.removeEventListener('mousemove', resetHideTimer);
      window.removeEventListener('touchstart', resetHideTimer);
      window.removeEventListener('keydown', resetHideTimer);
      if (hideTimeout.current) {
        clearTimeout(hideTimeout.current);
      }
    };
  }, [showHeader, hideHeader]);

  return (
    <header
      className={`
        fixed top-0
        flex items-center justify-between
        px-6 py-3
        bg-gray-900/90 backdrop-blur-sm
        border-b border-gray-700
        transition-all duration-200 ease-in
        z-30
        ${isLeft
          ? `left-0 right-0 ${sidebarExpanded ? 'ml-20' : ''}`
          : `left-0 right-0 ${sidebarExpanded ? 'mr-20' : ''}`
        }
        ${headerVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-full'}
      `}
    >
      {/* Election Info */}
      <div className="flex items-center gap-4">
        {electionName && (
          <>
            <span className="text-lg font-semibold text-white">{electionName}</span>
            {electionType && (
              <span className="px-2 py-1 bg-yellow-500 text-gray-900 text-sm font-medium rounded">
                {electionType}
              </span>
            )}
          </>
        )}
      </div>

      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-gray-300">
        {drillDownStack.map((level, index) => (
          <span key={index} className="flex items-center gap-2">
            {index > 0 && <ChevronRight size={16} className="text-gray-500" />}
            <span
              className={`
                ${index === drillDownStack.length - 1
                  ? 'text-yellow-400 font-semibold'
                  : 'text-gray-400'
                }
              `}
            >
              {level.regionName}
            </span>
          </span>
        ))}
      </nav>

      {/* Tools & Status */}
      <div className="flex items-center gap-4">
        {/* Annotation Button - only show in map views */}
        {(viewMode === 'map' || viewMode === 'demographics' || viewMode === 'issues') && (
          <button
            onClick={toggleAnnotationMode}
            className={`
              flex items-center gap-2 px-3 py-1.5 rounded-lg
              transition-colors duration-200
              ${annotationMode
                ? 'bg-yellow-500 text-gray-900'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }
            `}
            title="Toggle Annotation Mode (A)"
          >
            <Pencil size={18} />
            <span className="text-sm font-medium">Annotate</span>
          </button>
        )}

        {/* Connection Status */}
        {isOnline ? (
          <span className="flex items-center gap-2 text-green-400">
            <Wifi size={18} />
            <span className="text-sm">Live</span>
          </span>
        ) : (
          <span className="flex items-center gap-2 text-orange-400">
            <WifiOff size={18} />
            <span className="text-sm">Offline</span>
          </span>
        )}
      </div>
    </header>
  );
}
