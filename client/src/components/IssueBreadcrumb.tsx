interface DrillDownItem {
  level: number;
  regionId: number | null;
  regionName: string;
}

interface IssueBreadcrumbProps {
  stack: DrillDownItem[];
  onNavigate: (index: number) => void;
}

const levelIcons: Record<number, string> = {
  2: '🏛️', // District
  3: '🗳️', // Constituency
  4: '🏘️', // Subcounty
  5: '📍', // Parish
};

export function IssueBreadcrumb({ stack, onNavigate }: IssueBreadcrumbProps) {
  if (stack.length === 0) return null;

  return (
    <div className="bg-gray-800/95 backdrop-blur-sm rounded-lg px-3 py-2 shadow-lg border border-gray-700">
      <div className="flex items-center gap-1 text-sm overflow-x-auto">
        {stack.map((item, index) => (
          <div key={index} className="flex items-center">
            {index > 0 && (
              <span className="text-gray-500 mx-1">›</span>
            )}
            <button
              onClick={() => onNavigate(index)}
              className={`flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-700/50 whitespace-nowrap ${
                index === stack.length - 1
                  ? 'text-white font-medium'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <span>{index === 0 ? '🇺🇬' : levelIcons[item.level] || '📍'}</span>
              <span>{item.regionName}</span>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default IssueBreadcrumb;
