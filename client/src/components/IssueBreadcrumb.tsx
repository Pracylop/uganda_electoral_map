import { ChevronRight, Home } from 'lucide-react';

interface DrillDownItem {
  level: number;
  regionId: number | null;
  regionName: string;
}

interface IssueBreadcrumbProps {
  stack: DrillDownItem[];
  onNavigate: (index: number) => void;
  currentLevel: number;
}

const LEVEL_NAMES: Record<number, string> = {
  2: 'Districts',
  3: 'Constituencies',
  4: 'Subcounties',
  5: 'Parishes',
};

export function IssueBreadcrumb({ stack, onNavigate, currentLevel }: IssueBreadcrumbProps) {
  // Don't show if only at root level
  if (stack.length <= 1) return null;

  return (
    <nav className="fixed bottom-6 left-6 z-30 animate-slideUp">
      <div className="flex items-center gap-1 bg-gray-900/95 backdrop-blur-sm px-4 py-3 rounded-xl border border-gray-700 shadow-2xl">
        {/* Home button */}
        <button
          onClick={() => onNavigate(0)}
          className="flex items-center justify-center w-10 h-10 rounded-lg bg-gray-800 hover:bg-yellow-500 hover:text-gray-900 text-gray-300 transition-colors"
          title="Back to National View"
        >
          <Home size={20} />
        </button>

        {/* Breadcrumb items */}
        {stack.map((item, index) => (
          <span key={index} className="flex items-center">
            <ChevronRight size={18} className="text-gray-500 mx-1" />
            <button
              onClick={() => onNavigate(index)}
              className={`
                px-3 py-2 rounded-lg text-sm font-medium transition-colors
                min-h-[44px] min-w-[44px]
                ${index === stack.length - 1
                  ? 'bg-yellow-500 text-gray-900 cursor-default'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white'
                }
              `}
              disabled={index === stack.length - 1}
            >
              {item.regionName}
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

export default IssueBreadcrumb;
