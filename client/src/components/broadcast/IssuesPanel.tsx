import { useEffect, useState, useRef } from 'react';
import { X, Filter, BarChart3, MapPin, RefreshCw, Calendar, XCircle, ChevronDown, Check } from 'lucide-react';
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
    issuesDateRange,
    setIssuesDateRange,
    clearIssuesDateRange,
    selectedIssueDistrictId,
    selectedIssueDistrictName,
    clearIssueDistrict,
  } = useBroadcastStore();

  const [categories, setCategories] = useState<IssueCategory[]>([]);
  const [stats, setStats] = useState<IssueStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setCategoryDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Load categories once
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const categoriesData = await api.getIssueCategories();
        setCategories(categoriesData);
      } catch (error) {
        console.error('Failed to load categories:', error);
      }
    };
    loadCategories();
  }, []);

  // Load stats when filters change
  useEffect(() => {
    const loadStats = async () => {
      if (!issuesPanelOpen) return;

      setIsLoading(true);
      try {
        const statsData = await api.getIssueStats({
          districtId: selectedIssueDistrictId || undefined,
          categoryIds: selectedCategoryIds.length > 0 ? selectedCategoryIds : undefined,
          startDate: issuesDateRange.startDate || undefined,
          endDate: issuesDateRange.endDate || undefined,
        });
        setStats(statsData);
      } catch (error) {
        console.error('Failed to load stats:', error);
      }
      setIsLoading(false);
    };

    loadStats();
  }, [issuesPanelOpen, selectedCategoryIds, issuesDateRange, selectedIssueDistrictId]);

  if (!issuesPanelOpen) return null;

  const isLeft = sidebarPosition === 'left';
  const panelPosition = isLeft ? 'right' : 'left';

  const hasActiveFilters = selectedCategoryIds.length > 0 ||
    issuesDateRange.startDate ||
    issuesDateRange.endDate;

  const clearAllFilters = () => {
    clearCategoryFilters();
    clearIssuesDateRange();
    clearIssueDistrict();
  };

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
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700 flex-shrink-0">
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
          {/* ========== FILTERS SECTION ========== */}
          <div className="border-b border-gray-800">
            <div className="px-4 py-3 bg-gray-800/50">
              <div className="flex items-center justify-between">
                <h3 className="text-white font-medium text-sm uppercase tracking-wide">Filters</h3>
                {hasActiveFilters && (
                  <button
                    onClick={clearAllFilters}
                    className="text-xs text-yellow-500 hover:text-yellow-400 transition-colors flex items-center gap-1"
                  >
                    <XCircle size={12} />
                    Clear all
                  </button>
                )}
              </div>
            </div>

            {/* Category Filters - Dropdown */}
            <div className="p-4 border-b border-gray-800/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-400 text-sm">Categories</span>
                {selectedCategoryIds.length > 0 && (
                  <button
                    onClick={clearCategoryFilters}
                    className="text-xs text-yellow-500 hover:text-yellow-400"
                  >
                    Clear
                  </button>
                )}
              </div>
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setCategoryDropdownOpen(!categoryDropdownOpen)}
                  className="w-full flex items-center justify-between px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-left hover:border-gray-600 transition-colors"
                >
                  <span className={selectedCategoryIds.length === 0 ? 'text-gray-400' : 'text-white'}>
                    {selectedCategoryIds.length === 0
                      ? 'All categories'
                      : `${selectedCategoryIds.length} selected`
                    }
                  </span>
                  <ChevronDown
                    size={16}
                    className={`text-gray-400 transition-transform ${categoryDropdownOpen ? 'rotate-180' : ''}`}
                  />
                </button>

                {/* Dropdown Menu */}
                {categoryDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-10 max-h-64 overflow-y-auto">
                    {categories.map((category) => {
                      const isSelected = selectedCategoryIds.includes(category.id);
                      const color = category.color || getDefaultColor(category.code);

                      return (
                        <button
                          key={category.id}
                          onClick={() => toggleCategoryFilter(category.id)}
                          className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-700 transition-colors text-left"
                        >
                          <span
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: color }}
                          />
                          <span className="flex-1 text-sm text-gray-200">
                            {category.name}
                          </span>
                          {isSelected && (
                            <Check size={16} className="text-yellow-500 flex-shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Date Range Filter */}
            <div className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Calendar size={14} className="text-gray-400" />
                <span className="text-gray-400 text-sm">Date Range</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">From</label>
                  <input
                    type="date"
                    value={issuesDateRange.startDate || ''}
                    onChange={(e) => setIssuesDateRange(e.target.value || null, issuesDateRange.endDate)}
                    className="w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm text-white focus:outline-none focus:border-yellow-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">To</label>
                  <input
                    type="date"
                    value={issuesDateRange.endDate || ''}
                    onChange={(e) => setIssuesDateRange(issuesDateRange.startDate, e.target.value || null)}
                    className="w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm text-white focus:outline-none focus:border-yellow-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ========== SUMMARY SECTION ========== */}
          <div>
            <div className="px-4 py-3 bg-gray-800/50 border-b border-gray-800">
              <h3 className="text-white font-medium text-sm uppercase tracking-wide flex items-center gap-2">
                <BarChart3 size={14} />
                Summary
                {selectedIssueDistrictName && (
                  <span className="text-yellow-500 font-normal normal-case">
                    - {selectedIssueDistrictName}
                  </span>
                )}
              </h3>
              {selectedIssueDistrictId && (
                <button
                  onClick={clearIssueDistrict}
                  className="text-xs text-gray-400 hover:text-white mt-1"
                >
                  Show national summary
                </button>
              )}
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="w-5 h-5 text-yellow-500 animate-spin" />
              </div>
            ) : stats ? (
              <>
                {/* Total Issues */}
                <div className="p-4 border-b border-gray-800/50">
                  <div className="bg-gray-800 rounded-lg p-4 text-center">
                    <div className="text-3xl font-bold text-yellow-500">{stats.total}</div>
                    <div className="text-sm text-gray-400">
                      {hasActiveFilters ? 'Filtered Issues' : 'Total Issues'}
                    </div>
                  </div>
                </div>

                {/* Issues by Category */}
                <div className="p-4 border-b border-gray-800/50">
                  <h4 className="text-gray-400 text-xs uppercase tracking-wide mb-3">By Category</h4>
                  <div className="space-y-2">
                    {stats.byCategory
                      .sort((a, b) => b.count - a.count)
                      .slice(0, 5)
                      .map((item) => {
                        const maxCount = Math.max(...stats.byCategory.map(c => c.count));
                        const percentage = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
                        const color = item.color || getDefaultColor(item.categoryCode);

                        return (
                          <div key={item.categoryCode} className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span className="text-gray-300 truncate flex-1">{item.category}</span>
                              <span className="text-white font-medium ml-2">{item.count}</span>
                            </div>
                            <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-300"
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
                {!selectedIssueDistrictId && stats.topDistricts.length > 0 && (
                  <div className="p-4">
                    <h4 className="text-gray-400 text-xs uppercase tracking-wide mb-3 flex items-center gap-2">
                      <MapPin size={12} />
                      Top Districts
                    </h4>
                    <div className="space-y-1.5">
                      {stats.topDistricts.slice(0, 5).map((item, index) => (
                        <div
                          key={item.districtId || index}
                          className="flex items-center justify-between px-2 py-1.5 bg-gray-800/50 rounded"
                        >
                          <div className="flex items-center gap-2">
                            <span className="w-4 h-4 flex items-center justify-center bg-gray-700 rounded text-xs text-gray-400">
                              {index + 1}
                            </span>
                            <span className="text-sm text-gray-200">{item.district}</span>
                          </div>
                          <span className="text-sm font-medium text-yellow-500">{item.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="p-4 text-center text-gray-400 text-sm">
                No data available
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-4 py-3 border-t border-gray-800 bg-gray-900">
          <p className="text-gray-500 text-xs">
            Click on a district in the map to see its details.
          </p>
        </div>
      </div>
    </>
  );
}
