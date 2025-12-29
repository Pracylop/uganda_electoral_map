import maplibregl from 'maplibre-gl';
import Map from './Map';
import { DrillDownState, BreadcrumbItem, LEVEL_NAMES } from '../hooks/useElectionMap';

interface Election {
  id: number;
  name: string;
  electionDate: string;
  electionType: string;
}

interface MapPanelProps {
  // Election data
  elections: Election[];
  selectedElection: number | null;
  onElectionChange: (electionId: number) => void;

  // Drill-down state
  drillDown: DrillDownState;
  onBreadcrumbClick: (item: BreadcrumbItem) => void;

  // Map handlers
  onMapLoad: (map: maplibregl.Map) => void;

  // Styling
  isComparisonMode?: boolean;
  variant?: 'left' | 'right' | 'single';
  className?: string;
}

export function MapPanel({
  elections,
  selectedElection,
  onElectionChange,
  drillDown,
  onBreadcrumbClick,
  onMapLoad,
  isComparisonMode = false,
  variant = 'single',
  className = ''
}: MapPanelProps) {
  const isLeft = variant === 'left';
  const isRight = variant === 'right';
  const isSingle = variant === 'single';

  // Color schemes based on variant
  const selectorBgColor = isRight ? 'bg-green-600' : 'bg-blue-600';
  const levelTextColor = isRight ? 'text-green-400' : 'text-blue-400';

  return (
    <div className={`relative h-full ${className}`}>
      <Map onLoad={onMapLoad} className="absolute inset-0" />

      {/* Election Selector - shown in comparison mode on each panel */}
      {isComparisonMode && (
        <div className={`absolute top-4 right-4 ${selectorBgColor} px-3 py-1 rounded-lg shadow-lg z-10`}>
          <select
            value={selectedElection || ''}
            onChange={(e) => onElectionChange(parseInt(e.target.value))}
            className="bg-transparent text-white text-sm font-medium focus:outline-none cursor-pointer"
          >
            {elections.map((election) => (
              <option key={election.id} value={election.id} className="text-gray-900">
                {election.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Breadcrumb Navigation */}
      {selectedElection && (
        <div className={`absolute top-4 left-4 bg-gray-800/95 backdrop-blur-sm px-4 py-2 rounded-lg shadow-lg z-10 ${isComparisonMode ? 'max-w-[70%]' : 'max-w-[80%]'}`}>
          <div className="flex items-center gap-2 text-sm flex-wrap">
            {drillDown.breadcrumb.map((item, index) => (
              <span key={item.id} className="flex items-center">
                {index > 0 && <span className="mx-1 text-gray-500">›</span>}
                <button
                  onClick={() => onBreadcrumbClick(item)}
                  className={`hover:text-blue-400 transition-colors ${
                    index === drillDown.breadcrumb.length - 1
                      ? 'text-white font-medium'
                      : 'text-gray-400'
                  }`}
                >
                  {item.name}
                </button>
              </span>
            ))}
            {drillDown.currentLevel <= 5 && (
              <span className="flex items-center">
                <span className="mx-1 text-gray-500">›</span>
                <span className={`${levelTextColor} font-medium`}>
                  {LEVEL_NAMES[drillDown.currentLevel]}s
                </span>
              </span>
            )}
          </div>
        </div>
      )}

      {/* Legend */}
      {selectedElection && (
        <div className={`absolute bottom-6 left-6 bg-gray-800 rounded-lg shadow-lg ${isComparisonMode ? 'p-2 text-xs' : 'p-4 max-w-xs'}`}>
          <h3 className={`font-bold ${isComparisonMode ? 'mb-1 text-sm' : 'mb-2'}`}>
            {LEVEL_NAMES[drillDown.currentLevel]} Map
          </h3>
          <p className={`text-gray-400 ${isComparisonMode ? '' : 'text-sm mb-2'}`}>
            Colored by winner
          </p>
          {isSingle && (
            <p className="text-xs text-gray-500">
              {drillDown.currentLevel < 5
                ? 'Click on any region to drill down'
                : 'Click on any parish to see detailed results'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default MapPanel;
