import { Home } from 'lucide-react';

interface DrillDownItem {
  level: number;
  regionId: number | null;
  regionName: string;
}

interface IncidentBreadcrumbProps {
  stack: DrillDownItem[];
  onNavigate: (index: number) => void;
}

const LEVEL_NAMES: Record<number, string> = {
  2: 'Districts',
  3: 'Constituencies',
  4: 'Subcounties',
  5: 'Parishes',
};

export function IncidentBreadcrumb({ stack, onNavigate }: IncidentBreadcrumbProps) {
  const currentLevel = stack[stack.length - 1]?.level || 2;
  const nextLevel = currentLevel < 5 ? currentLevel + 1 : null;

  return (
    <nav className="absolute top-4 left-4 z-30">
      <div className="flex items-center bg-gray-800 px-4 py-2.5 rounded-lg shadow-lg">
        {/* Home (root) */}
        <button
          onClick={() => onNavigate(0)}
          className="text-gray-300 hover:text-white transition-colors"
          title="Back to National View"
        >
          <Home size={18} />
        </button>

        {/* Breadcrumb items */}
        {stack.slice(1).map((item, index) => (
          <span key={index} className="flex items-center">
            <span className="text-gray-500 mx-2">›</span>
            <button
              onClick={() => onNavigate(index + 1)}
              className="text-white font-semibold hover:text-gray-200 transition-colors"
            >
              {item.regionName}
            </button>
          </span>
        ))}

        {/* Current level indicator */}
        {nextLevel && stack.length > 1 && (
          <span className="flex items-center">
            <span className="text-gray-500 mx-2">›</span>
            <span className="text-[#F59E0B] font-medium">
              {LEVEL_NAMES[nextLevel]}
            </span>
          </span>
        )}
      </div>
    </nav>
  );
}

export default IncidentBreadcrumb;
