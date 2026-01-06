interface DrillDownItem {
  level: number;
  regionId: number | null;
  regionName: string;
}

interface IssueBreadcrumbProps {
  stack: DrillDownItem[];
  onNavigate: (index: number) => void;
  onBack: () => void;
}

export function IssueBreadcrumb({ stack, onNavigate, onBack }: IssueBreadcrumbProps) {
  const hasHistory = stack.length > 1;

  return (
    <div className="flex items-center gap-1">
      {/* Back button */}
      {hasHistory && (
        <button
          onClick={onBack}
          className="p-2 hover:bg-gray-700 rounded text-gray-400 hover:text-white"
          title="Go back"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}

      {/* Breadcrumb items */}
      <div className="flex items-center gap-1 text-sm">
        <button
          onClick={() => onNavigate(0)}
          className={`px-2 py-1 rounded ${stack.length === 1 ? 'text-white font-medium' : 'text-gray-400 hover:text-white'}`}
        >
          Uganda
        </button>
        {stack.slice(1).map((item, index) => (
          <span key={index} className="flex items-center">
            <span className="text-gray-600 mx-1">›</span>
            <button
              onClick={() => onNavigate(index + 1)}
              className={`px-2 py-1 rounded ${
                index === stack.length - 2 ? 'text-white font-medium' : 'text-gray-400 hover:text-white'
              }`}
            >
              {item.regionName}
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}

export default IssueBreadcrumb;
