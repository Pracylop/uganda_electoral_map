import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';

interface IssueCategory {
  id: number;
  name: string;
  code: string;
  color: string | null;
  severity: number;
}

interface StatsData {
  total: number;
  byCategory: Array<{ category: string; categoryCode: string; color: string | null; count: number }>;
  byStatus: Array<{ status: string; count: number }>;
  topDistricts: Array<{ district: string; districtId: number | null; count: number }>;
  casualties?: {
    totalInjuries: number;
    totalDeaths: number;
    totalArrests: number;
  };
}

const severityColors: Record<number, string> = {
  1: '#10B981',
  2: '#3B82F6',
  3: '#F59E0B',
  4: '#F97316',
  5: '#EF4444',
};

const severityLabels: Record<number, string> = {
  1: 'Low',
  2: 'Medium-Low',
  3: 'Medium',
  4: 'High',
  5: 'Critical',
};

export function IssuesStats() {
  const [categories, setCategories] = useState<IssueCategory[]>([]);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedCategories, setSelectedCategories] = useState<number[]>([]);
  const [selectedSeverity, setSelectedSeverity] = useState<number | null>(null);
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: '', end: '' });

  // Load categories
  useEffect(() => {
    api.getIssueCategories()
      .then(setCategories)
      .catch((err) => console.error('Failed to load categories:', err));
  }, []);

  // Load stats
  useEffect(() => {
    setLoading(true);
    const params: any = {};
    if (selectedCategories.length > 0) params.categoryIds = selectedCategories;
    if (dateRange.start) params.startDate = dateRange.start;
    if (dateRange.end) params.endDate = dateRange.end;

    api.getIssueStats(params)
      .then((data) => {
        // Filter by severity client-side if needed
        if (selectedSeverity) {
          const categoryMap = new Map(categories.map(c => [c.code, c.severity]));
          data.byCategory = data.byCategory.filter(c => categoryMap.get(c.categoryCode) === selectedSeverity);
        }
        setStats(data);
      })
      .catch((err) => console.error('Failed to load stats:', err))
      .finally(() => setLoading(false));
  }, [selectedCategories, selectedSeverity, dateRange, categories]);

  // Calculate severity distribution
  const severityDistribution = categories.reduce((acc, cat) => {
    const categoryStats = stats?.byCategory.find(c => c.categoryCode === cat.code);
    if (categoryStats) {
      acc[cat.severity] = (acc[cat.severity] || 0) + categoryStats.count;
    }
    return acc;
  }, {} as Record<number, number>);

  const toggleCategory = (categoryId: number) => {
    setSelectedCategories(prev =>
      prev.includes(categoryId)
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const clearFilters = () => {
    setSelectedCategories([]);
    setSelectedSeverity(null);
    setDateRange({ start: '', end: '' });
  };

  const hasFilters = selectedCategories.length > 0 || selectedSeverity || dateRange.start || dateRange.end;

  // Calculate max for bar charts
  const maxCategoryCount = Math.max(...(stats?.byCategory.map(c => c.count) || [1]));
  const maxDistrictCount = Math.max(...(stats?.topDistricts.map(d => d.count) || [1]));

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Electoral Issues Statistics</h1>
            <p className="text-gray-400 text-sm mt-1">
              {stats ? `${stats.total} total issues reported` : 'Loading...'}
            </p>
          </div>
          <Link
            to="/issues"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            Map View
          </Link>
        </div>
      </div>

      <div className="p-6">
        {/* Filters */}
        <div className="bg-gray-800 rounded-lg p-4 mb-6 border border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Filters</h2>
            {hasFilters && (
              <button
                onClick={clearFilters}
                className="text-sm text-gray-400 hover:text-white"
              >
                Clear all
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-xs text-gray-400 block mb-2">Severity</label>
              <select
                value={selectedSeverity || ''}
                onChange={(e) => setSelectedSeverity(e.target.value ? parseInt(e.target.value) : null)}
                className="w-full bg-gray-700 text-white rounded px-3 py-2 text-sm border border-gray-600"
              >
                <option value="">All Severities</option>
                {[5, 4, 3, 2, 1].map(sev => (
                  <option key={sev} value={sev}>{severityLabels[sev]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-2">From Date</label>
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                className="w-full bg-gray-700 text-white rounded px-3 py-2 text-sm border border-gray-600"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-2">To Date</label>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                className="w-full bg-gray-700 text-white rounded px-3 py-2 text-sm border border-gray-600"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-2">Categories ({selectedCategories.length} selected)</label>
              <div className="relative">
                <select
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    if (val) toggleCategory(val);
                    e.target.value = '';
                  }}
                  className="w-full bg-gray-700 text-white rounded px-3 py-2 text-sm border border-gray-600"
                >
                  <option value="">Add category...</option>
                  {categories.filter(c => !selectedCategories.includes(c.id)).map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          {selectedCategories.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {selectedCategories.map(catId => {
                const cat = categories.find(c => c.id === catId);
                return cat ? (
                  <span
                    key={catId}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-gray-600 rounded text-sm"
                  >
                    {cat.name}
                    <button
                      onClick={() => toggleCategory(catId)}
                      className="text-gray-400 hover:text-white"
                    >
                      ×
                    </button>
                  </span>
                ) : null;
              })}
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-gray-400">Loading statistics...</div>
          </div>
        ) : stats ? (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                <div className="text-3xl font-bold text-white">{stats.total}</div>
                <div className="text-gray-400 text-sm">Total Issues</div>
              </div>
              <div className="bg-gray-800 rounded-lg p-4 border border-red-900/50">
                <div className="text-3xl font-bold text-red-400">{stats.casualties?.totalDeaths || 0}</div>
                <div className="text-gray-400 text-sm">Deaths</div>
              </div>
              <div className="bg-gray-800 rounded-lg p-4 border border-orange-900/50">
                <div className="text-3xl font-bold text-orange-400">{stats.casualties?.totalInjuries || 0}</div>
                <div className="text-gray-400 text-sm">Injuries</div>
              </div>
              <div className="bg-gray-800 rounded-lg p-4 border border-blue-900/50">
                <div className="text-3xl font-bold text-blue-400">{stats.casualties?.totalArrests || 0}</div>
                <div className="text-gray-400 text-sm">Arrests</div>
              </div>
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* By Category */}
              <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                <h3 className="text-lg font-semibold mb-4">Issues by Category</h3>
                <div className="space-y-3">
                  {stats.byCategory.slice(0, 10).map((cat, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      <div className="w-28 text-sm text-gray-300 truncate" title={cat.category}>
                        {cat.category}
                      </div>
                      <div className="flex-1 h-6 bg-gray-700 rounded overflow-hidden">
                        <div
                          className="h-full rounded transition-all duration-300"
                          style={{
                            width: `${(cat.count / maxCategoryCount) * 100}%`,
                            backgroundColor: cat.color || '#F59E0B',
                          }}
                        />
                      </div>
                      <div className="w-12 text-right text-sm font-medium">{cat.count}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* By Severity */}
              <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                <h3 className="text-lg font-semibold mb-4">Issues by Severity</h3>
                <div className="space-y-3">
                  {[5, 4, 3, 2, 1].map(sev => {
                    const count = severityDistribution[sev] || 0;
                    const maxSev = Math.max(...Object.values(severityDistribution), 1);
                    return (
                      <div key={sev} className="flex items-center gap-3">
                        <div className="w-28 text-sm text-gray-300 flex items-center gap-2">
                          <span
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: severityColors[sev] }}
                          />
                          {severityLabels[sev]}
                        </div>
                        <div className="flex-1 h-6 bg-gray-700 rounded overflow-hidden">
                          <div
                            className="h-full rounded transition-all duration-300"
                            style={{
                              width: `${(count / maxSev) * 100}%`,
                              backgroundColor: severityColors[sev],
                            }}
                          />
                        </div>
                        <div className="w-12 text-right text-sm font-medium">{count}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Top Districts Table */}
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <h3 className="text-lg font-semibold mb-4">Top Districts by Issue Count</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {stats.topDistricts.slice(0, 15).map((dist, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-sm font-medium">
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{dist.district}</div>
                      <div className="h-1.5 bg-gray-700 rounded mt-1">
                        <div
                          className="h-full bg-yellow-500 rounded"
                          style={{ width: `${(dist.count / maxDistrictCount) * 100}%` }}
                        />
                      </div>
                    </div>
                    <div className="text-sm font-bold">{dist.count}</div>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-20 text-gray-400">
            No data available
          </div>
        )}
      </div>
    </div>
  );
}

export default IssuesStats;
