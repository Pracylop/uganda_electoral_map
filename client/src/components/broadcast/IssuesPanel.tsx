import { useEffect, useState } from 'react';
import { X, Filter, BarChart3, MapPin, RefreshCw } from 'lucide-react';
import { useBroadcastStore } from '../../stores/broadcastStore';
import { api } from '../../lib/api';

interface IssueCategory {
  id: number;
  name: string;
  code: string;
  description: string | null;
  severity: number;
  color: string | null;
  isActive: boolean;
}

interface IssueStats {
  total: number;
  byCategory: Array<{ category: string; categoryCode: string; color: string | null; count: number }>;
  byStatus: Array<{ status: string; count: number }>;
  topDistricts: Array<{ district: string; districtId: number | null; count: number }>;
}

// Default colors for categories
const getDefaultColor = (code: string): string => {
  const colors: Record<string, string> = {
    'campaign_blockage': '#FFA500',
    'violence': '#FF0000',
    'court_case': '#4169E1',
    'voter_intimidation': '#8B0000',
    'ballot_tampering': '#800080',
    'media_interference': '#20B2AA',
    'registration_issue': '#DAA520',
    'arrest_detention': '#DC143C',
    'property_damage': '#8B4513',
    'bribery': '#228B22',
    'hate_speech': '#FF6347',
    'other': '#808080'
  };
  return colors[code] || '#808080';
};

export function IssuesPanel() {
  const {
    issuesPanelOpen,
    toggleIssuesPanel,
    sidebarExpanded,
    sidebarPosition,
    selectedCategoryIds,
    toggleCategoryFilter,
    clearCategoryFilters,
  } = useBroadcastStore();

  const [categories, setCategories] = useState<IssueCategory[]>([]);
  const [stats, setStats] = useState<IssueStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Load categories and stats
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const [categoriesData, statsData] = await Promise.all([
          api.getIssueCategories(),
          api.getIssueStats(),
        ]);
        setCategories(categoriesData);
        setStats(statsData);
      } catch (error) {
        console.error('Failed to load issues data:', error);
      }
      setIsLoading(false);
    };

    if (issuesPanelOpen) {
      loadData();
    }
  }, [issuesPanelOpen]);

  if (!issuesPanelOpen) return null;

  const isLeft = sidebarPosition === 'left';

  // When sidebar is on left, panel appears on right (and vice versa)
  const panelPosition = isLeft ? 'right' : 'left';

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40"
        onClick={toggleIssuesPanel}
      />

      {/* Panel */}
      <div
        className={`
          fixed top-0 bottom-0
          w-80
          bg-gray-900
          shadow-2xl
          z-50
          overflow-hidden
          flex flex-col
          ${panelPosition === 'right'
            ? 'right-0 border-l border-gray-700 animate-slideInLeft'
            : 'left-0 border-r border-gray-700 animate-slideInRight'
          }
          ${panelPosition === 'right' && sidebarExpanded ? 'right-20' : ''}
          ${panelPosition === 'left' && sidebarExpanded ? 'left-20' : ''}
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-700 flex-shrink-0">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Filter size={20} className="text-yellow-500" />
            Issues Control
          </h2>
          <button
            onClick={toggleIssuesPanel}
            className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
            aria-label="Close"
          >
            <X size={24} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-6 h-6 text-yellow-500 animate-spin" />
            </div>
          ) : (
            <>
              {/* Category Filters */}
              <div className="p-4 border-b border-gray-800">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-white font-medium flex items-center gap-2">
                    <Filter size={16} />
                    Filter by Type
                  </h3>
                  {selectedCategoryIds.length > 0 && (
                    <button
                      onClick={clearCategoryFilters}
                      className="text-xs text-yellow-500 hover:text-yellow-400 transition-colors"
                    >
                      Clear all
                    </button>
                  )}
                </div>
                <p className="text-gray-400 text-xs mb-3">
                  {selectedCategoryIds.length === 0
                    ? 'Showing all issue types'
                    : `Showing ${selectedCategoryIds.length} selected type${selectedCategoryIds.length > 1 ? 's' : ''}`
                  }
                </p>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {categories.map((category) => {
                    const isSelected = selectedCategoryIds.length === 0 || selectedCategoryIds.includes(category.id);
                    const color = category.color || getDefaultColor(category.code);

                    return (
                      <button
                        key={category.id}
                        onClick={() => toggleCategoryFilter(category.id)}
                        className={`
                          w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors
                          ${selectedCategoryIds.includes(category.id)
                            ? 'bg-gray-700'
                            : selectedCategoryIds.length === 0
                              ? 'bg-gray-800/50 hover:bg-gray-800'
                              : 'bg-gray-800/30 hover:bg-gray-800/50 opacity-50'
                          }
                        `}
                      >
                        <span
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: color }}
                        />
                        <span className={`text-sm flex-1 ${isSelected ? 'text-white' : 'text-gray-400'}`}>
                          {category.name}
                        </span>
                        {stats && (
                          <span className="text-xs text-gray-500">
                            {stats.byCategory.find(c => c.categoryCode === category.code)?.count || 0}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Statistics */}
              {stats && (
                <>
                  {/* Summary Stats */}
                  <div className="p-4 border-b border-gray-800">
                    <h3 className="text-white font-medium flex items-center gap-2 mb-3">
                      <BarChart3 size={16} />
                      Summary
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-gray-800 rounded-lg p-3 text-center">
                        <div className="text-2xl font-bold text-yellow-500">{stats.total}</div>
                        <div className="text-xs text-gray-400">Total Issues</div>
                      </div>
                      <div className="bg-gray-800 rounded-lg p-3 text-center">
                        <div className="text-2xl font-bold text-yellow-500">{categories.length}</div>
                        <div className="text-xs text-gray-400">Categories</div>
                      </div>
                    </div>
                  </div>

                  {/* Issues by Category Bar Chart */}
                  <div className="p-4 border-b border-gray-800">
                    <h3 className="text-white font-medium flex items-center gap-2 mb-3">
                      <BarChart3 size={16} />
                      By Category
                    </h3>
                    <div className="space-y-2">
                      {stats.byCategory
                        .sort((a, b) => b.count - a.count)
                        .slice(0, 6)
                        .map((item) => {
                          const maxCount = Math.max(...stats.byCategory.map(c => c.count));
                          const percentage = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
                          const color = item.color || getDefaultColor(item.categoryCode);

                          return (
                            <div key={item.categoryCode} className="space-y-1">
                              <div className="flex justify-between text-xs">
                                <span className="text-gray-300 truncate flex-1">{item.category}</span>
                                <span className="text-gray-400 ml-2">{item.count}</span>
                              </div>
                              <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all duration-500"
                                  style={{
                                    width: `${percentage}%`,
                                    backgroundColor: color,
                                  }}
                                />
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>

                  {/* Top Districts */}
                  <div className="p-4">
                    <h3 className="text-white font-medium flex items-center gap-2 mb-3">
                      <MapPin size={16} />
                      Top Districts
                    </h3>
                    <div className="space-y-2">
                      {stats.topDistricts.slice(0, 5).map((item, index) => (
                        <div
                          key={item.districtId || index}
                          className="flex items-center justify-between px-3 py-2 bg-gray-800 rounded-lg"
                        >
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 flex items-center justify-center bg-gray-700 rounded text-xs text-gray-400">
                              {index + 1}
                            </span>
                            <span className="text-sm text-gray-200">{item.district}</span>
                          </div>
                          <span className="text-sm font-medium text-yellow-500">{item.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {/* Footer Hint */}
        <div className="flex-shrink-0 p-4 border-t border-gray-800 bg-gray-900">
          <p className="text-gray-400 text-xs">
            <strong>Tip:</strong> Click categories to filter the map. Selected filters apply to the choropleth view.
          </p>
        </div>
      </div>
    </>
  );
}
