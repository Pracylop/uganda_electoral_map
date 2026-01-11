import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Map } from 'lucide-react';
import { api } from '../lib/api';

interface UnitStats {
  id: number;
  name: string;
  level: number;
  totalPopulation: number;
  malePopulation: number;
  femalePopulation: number;
  votingAgePopulation: number;
  youthPopulation: number;
  elderlyPopulation: number;
  numberOfHouseholds: number;
  parishCount: number;
}

interface NationalStats {
  totalPopulation: number;
  malePopulation: number;
  femalePopulation: number;
  votingAgePopulation: number;
  youthPopulation: number;
  elderlyPopulation: number;
  numberOfHouseholds: number;
  parishCount: number;
}

export function DemographicsStats() {
  const [nationalStats, setNationalStats] = useState<NationalStats | null>(null);
  const [districtStats, setDistrictStats] = useState<UnitStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Table state
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<keyof UnitStats>('totalPopulation');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Comparison state
  const [selectedUnit, setSelectedUnit] = useState<UnitStats | null>(null);
  const [compareUnit, setCompareUnit] = useState<UnitStats | null>(null);
  const [isComparing, setIsComparing] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const data = await api.getDemographicsStats();
        setNationalStats(data.national);

        // Transform district data
        const districts: UnitStats[] = data.districts.map((d: any) => ({
          id: d.districtId,
          name: d.districtName,
          level: 2,
          totalPopulation: d.totalPopulation,
          malePopulation: d.malePopulation,
          femalePopulation: d.femalePopulation,
          votingAgePopulation: d.votingAgePopulation,
          youthPopulation: d.youthPopulation,
          elderlyPopulation: d.elderlyPopulation,
          numberOfHouseholds: d.numberOfHouseholds,
          parishCount: d.parishCount,
        }));
        setDistrictStats(districts);
      } catch (err) {
        console.error('Failed to load demographics:', err);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  const formatNumber = (n: number) => n.toLocaleString();
  const formatPercent = (n: number, total: number) =>
    total > 0 ? ((n / total) * 100).toFixed(1) + '%' : '0%';

  // Sorting
  const handleSort = (field: keyof UnitStats) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const filteredAndSortedData = districtStats
    .filter(d => d.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      const aVal = a[sortField] as number;
      const bVal = b[sortField] as number;
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    });

  const maxPopulation = Math.max(...districtStats.map(d => d.totalPopulation), 1);

  // Selection handlers
  const handleTableRowClick = (unit: UnitStats) => {
    if (isComparing && selectedUnit) {
      setCompareUnit(unit);
    } else {
      setSelectedUnit(unit);
    }
  };

  const startComparison = () => {
    if (selectedUnit) {
      setIsComparing(true);
      setCompareUnit(null);
    }
  };

  const clearSelection = () => {
    setSelectedUnit(null);
    setCompareUnit(null);
    setIsComparing(false);
  };

  if (isLoading) {
    return (
      <div className="flex-1 bg-base flex items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 border-2 border-[#00E5FF] border-t-transparent rounded-full animate-spin" />
          <span className="text-white">Loading demographics data...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-base flex flex-col">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              to="/demographics"
              className="p-2 hover:bg-gray-700 rounded-lg text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-white">Demographics Statistics</h1>
              <p className="text-sm text-gray-400">
                {filteredAndSortedData.length} districts • 2024 Census Data
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search districts..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="bg-gray-700 text-white rounded-lg pl-9 pr-3 py-2 text-sm border border-gray-600 focus:border-[#00E5FF] focus:outline-none w-64"
              />
              <svg
                className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>

            {/* Comparison buttons */}
            {selectedUnit && (
              <button
                onClick={startComparison}
                className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                  isComparing
                    ? 'bg-yellow-600 text-white'
                    : 'bg-[#00E5FF] hover:bg-[#00E5FF]/80 text-gray-900'
                }`}
              >
                {isComparing ? 'Select to compare...' : 'Compare'}
              </button>
            )}
            {(selectedUnit || compareUnit) && (
              <button
                onClick={clearSelection}
                className="px-3 py-2 text-sm font-medium rounded-lg bg-gray-700 hover:bg-gray-600 text-white transition-colors"
              >
                Clear
              </button>
            )}

            {/* Map link */}
            <Link
              to="/demographics/map"
              className="flex items-center gap-2 px-3 py-2 bg-[#00E5FF]/20 hover:bg-[#00E5FF]/30 border border-[#00E5FF]/40 rounded-lg text-[#00E5FF] text-sm font-medium transition-colors"
            >
              <Map className="w-4 h-4" />
              View Map
            </Link>
          </div>
        </div>
      </div>

      {/* Comparison Panel */}
      {selectedUnit && compareUnit && (
        <div className="bg-gray-800 border-b border-gray-700 px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">
              Comparing:{' '}
              <span className="text-[#00E5FF]">{selectedUnit.name}</span> vs{' '}
              <span className="text-emerald-400">{compareUnit.name}</span>
            </h3>
          </div>
          <ComparisonBars a={selectedUnit} b={compareUnit} />
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-800 sticky top-0 z-10">
            <tr>
              <th className="text-left py-3 px-4 text-gray-400 font-medium w-12">#</th>
              <th className="text-left py-3 px-4 text-gray-400 font-medium">District</th>
              <SortableHeader
                field="totalPopulation"
                label="Population"
                current={sortField}
                direction={sortDirection}
                onSort={handleSort}
              />
              <SortableHeader
                field="votingAgePopulation"
                label="Voting Age"
                current={sortField}
                direction={sortDirection}
                onSort={handleSort}
              />
              <SortableHeader
                field="youthPopulation"
                label="Youth (0-17)"
                current={sortField}
                direction={sortDirection}
                onSort={handleSort}
              />
              <SortableHeader
                field="elderlyPopulation"
                label="Elderly (60+)"
                current={sortField}
                direction={sortDirection}
                onSort={handleSort}
              />
              <SortableHeader
                field="numberOfHouseholds"
                label="Households"
                current={sortField}
                direction={sortDirection}
                onSort={handleSort}
              />
              <th className="text-left py-3 px-4 text-gray-400 font-medium w-48">
                Population Bar
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredAndSortedData.map((unit, index) => {
              const isSelected = selectedUnit?.id === unit.id;
              const isCompare = compareUnit?.id === unit.id;
              const barWidth = (unit.totalPopulation / maxPopulation) * 100;

              return (
                <tr
                  key={unit.id}
                  onClick={() => handleTableRowClick(unit)}
                  className={`border-b border-gray-800 cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-[#00E5FF]/10'
                      : isCompare
                      ? 'bg-emerald-900/20'
                      : 'hover:bg-gray-800/50'
                  }`}
                >
                  <td className="py-3 px-4 text-gray-500">{index + 1}</td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <span
                        className={`font-medium ${
                          isSelected
                            ? 'text-[#00E5FF]'
                            : isCompare
                            ? 'text-emerald-400'
                            : 'text-white'
                        }`}
                      >
                        {unit.name}
                      </span>
                      {isSelected && (
                        <span className="text-xs bg-[#00E5FF]/30 text-[#00E5FF] px-1.5 py-0.5 rounded">
                          Selected
                        </span>
                      )}
                      {isCompare && (
                        <span className="text-xs bg-emerald-600/30 text-emerald-400 px-1.5 py-0.5 rounded">
                          Compare
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-white font-medium">
                    {formatNumber(unit.totalPopulation)}
                  </td>
                  <td className="py-3 px-4 text-emerald-400">
                    {formatNumber(unit.votingAgePopulation)}
                  </td>
                  <td className="py-3 px-4 text-blue-400">
                    {formatNumber(unit.youthPopulation)}
                  </td>
                  <td className="py-3 px-4 text-orange-400">
                    {formatNumber(unit.elderlyPopulation)}
                  </td>
                  <td className="py-3 px-4 text-purple-400">
                    {formatNumber(unit.numberOfHouseholds)}
                  </td>
                  <td className="py-3 px-4">
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${
                          isSelected
                            ? 'bg-[#00E5FF]'
                            : isCompare
                            ? 'bg-emerald-500'
                            : 'bg-yellow-500'
                        }`}
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filteredAndSortedData.length === 0 && (
          <div className="flex items-center justify-center py-12 text-gray-400">
            No districts found matching "{searchQuery}"
          </div>
        )}
      </div>

      {/* Summary Footer */}
      {nationalStats && (
        <div className="bg-gray-800 border-t border-gray-700 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-6 text-sm">
            <div>
              <span className="text-gray-400">National Total: </span>
              <span className="text-white font-bold">
                {(nationalStats.totalPopulation / 1000000).toFixed(1)}M
              </span>
            </div>
            <div>
              <span className="text-gray-400">Voting Age: </span>
              <span className="text-emerald-400 font-bold">
                {(nationalStats.votingAgePopulation / 1000000).toFixed(1)}M
              </span>
              <span className="text-gray-500 ml-1">
                ({formatPercent(nationalStats.votingAgePopulation, nationalStats.totalPopulation)})
              </span>
            </div>
            <div>
              <span className="text-gray-400">Gender: </span>
              <span className="text-white">
                {formatPercent(nationalStats.malePopulation, nationalStats.totalPopulation)} M
              </span>
              <span className="text-gray-500"> / </span>
              <span className="text-white">
                {formatPercent(nationalStats.femalePopulation, nationalStats.totalPopulation)} F
              </span>
            </div>
          </div>
          <div className="text-xs text-gray-500">2024 Census Data</div>
        </div>
      )}
    </div>
  );
}

// Sortable Header Component
function SortableHeader({
  field,
  label,
  current,
  direction,
  onSort,
}: {
  field: keyof UnitStats;
  label: string;
  current: keyof UnitStats;
  direction: 'asc' | 'desc';
  onSort: (field: keyof UnitStats) => void;
}) {
  const isActive = current === field;

  return (
    <th
      onClick={() => onSort(field)}
      className="text-left py-3 px-4 text-gray-400 font-medium cursor-pointer hover:text-white transition-colors select-none"
    >
      <div className="flex items-center gap-1">
        {label}
        {isActive && (
          <svg
            className={`w-4 h-4 transition-transform ${direction === 'asc' ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        )}
      </div>
    </th>
  );
}

// Comparison Bars Component
function ComparisonBars({ a, b }: { a: UnitStats; b: UnitStats }) {
  const formatNum = (n: number) => n.toLocaleString();

  const metrics = [
    { label: 'Total Population', aVal: a.totalPopulation, bVal: b.totalPopulation, color: 'bg-yellow-500' },
    { label: 'Voting Age (18+)', aVal: a.votingAgePopulation, bVal: b.votingAgePopulation, color: 'bg-emerald-500' },
    { label: 'Youth (0-17)', aVal: a.youthPopulation, bVal: b.youthPopulation, color: 'bg-blue-500' },
    { label: 'Elderly (60+)', aVal: a.elderlyPopulation, bVal: b.elderlyPopulation, color: 'bg-orange-500' },
    { label: 'Households', aVal: a.numberOfHouseholds, bVal: b.numberOfHouseholds, color: 'bg-purple-500' },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
      {metrics.map(({ label, aVal, bVal, color }) => {
        const max = Math.max(aVal, bVal);
        const aPercent = max > 0 ? (aVal / max) * 100 : 0;
        const bPercent = max > 0 ? (bVal / max) * 100 : 0;
        const aWins = aVal > bVal;

        return (
          <div key={label} className="bg-gray-700/50 rounded-lg p-3">
            <div className="text-xs text-gray-400 mb-2">{label}</div>

            {/* A bar */}
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs text-[#00E5FF] w-16 truncate">{a.name}</span>
              <div className="flex-1 bg-gray-600 rounded-full h-3 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${aWins ? color : 'bg-gray-500'}`}
                  style={{ width: `${aPercent}%` }}
                />
              </div>
              <span
                className={`text-xs w-20 text-right ${
                  aWins ? 'text-white font-medium' : 'text-gray-400'
                }`}
              >
                {formatNum(aVal)}
              </span>
            </div>

            {/* B bar */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-emerald-400 w-16 truncate">{b.name}</span>
              <div className="flex-1 bg-gray-600 rounded-full h-3 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${!aWins ? color : 'bg-gray-500'}`}
                  style={{ width: `${bPercent}%` }}
                />
              </div>
              <span
                className={`text-xs w-20 text-right ${
                  !aWins ? 'text-white font-medium' : 'text-gray-400'
                }`}
              >
                {formatNum(bVal)}
              </span>
            </div>

            {/* Difference */}
            <div className="mt-2 text-xs text-center">
              <span className={aWins ? 'text-[#00E5FF]' : 'text-emerald-400'}>
                {aWins ? a.name : b.name}
              </span>
              <span className="text-gray-500"> leads by </span>
              <span className="text-white font-medium">{formatNum(Math.abs(aVal - bVal))}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default DemographicsStats;
