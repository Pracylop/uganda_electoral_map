// ============================================================================
// INCIDENTS BROADCAST HOME - Electoral Issues Dashboard
// Layout: 12-column, 3-row grid (see IncidentsBroadcastHome.layout.md)
// Note: B2+C2 spans 2 columns for the map
// ============================================================================

import { useEffect, useState, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useBroadcastStore } from '../../stores/broadcastStore';
import { UGANDA_CENTER } from '../../lib/mapStyles';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

// ============================================================================
// API HELPER
// ============================================================================
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

async function fetchApi(endpoint: string) {
  const response = await fetch(`${API_URL}${endpoint}`, {
    headers: {
      Authorization: `Bearer ${localStorage.getItem('auth_token')}`
    }
  });
  if (!response.ok) throw new Error(`API error: ${response.status}`);
  return response.json();
}

// ============================================================================
// TYPES
// ============================================================================
interface IssueCategory {
  id: number;
  name: string;
  color: string;
}

interface Issue {
  id: number;
  summary: string;
  severity: number;
  date: string;
  districtName: string;
  categoryName: string;
  categoryColor: string;
  deaths: number;
  injuries: number;
  arrests: number;
}

interface IssueStats {
  total: number;
  bySeverity: Record<number, number>;
  byCategory: Record<string, number>;
  casualties: {
    deaths: number;
    injuries: number;
    arrests: number;
  };
  topDistricts: { name: string; count: number }[];
  byDate: { date: string; count: number }[];
}

// ============================================================================
// DESIGN TOKENS
// ============================================================================
const COLORS = {
  background: '#0A0E14',
  card: 'rgba(22, 27, 34, 0.85)',
  cardBorder: 'rgba(0, 229, 255, 0.1)',
  cyan: '#00E5FF',
  gold: '#FFD700',
  red: '#EF4444',
  orange: '#F97316',
  amber: '#F59E0B',
  blue: '#3B82F6',
  green: '#10B981',
  textPrimary: '#FFFFFF',
  textSecondary: '#8B949E',
  textMuted: '#484F58',
};

// Severity colors
const SEVERITY_COLORS: Record<number, string> = {
  5: '#EF4444', // Critical - Red
  4: '#F97316', // High - Orange
  3: '#F59E0B', // Medium - Amber
  2: '#3B82F6', // Medium-Low - Blue
  1: '#10B981', // Low - Green
};

const SEVERITY_NAMES: Record<number, string> = {
  5: 'Critical',
  4: 'High',
  3: 'Medium',
  2: 'Med-Low',
  1: 'Low',
};

// Category colors for pie chart
const CATEGORY_COLORS = [
  '#EF4444', '#F97316', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#6B7280'
];

// ============================================================================
// GRID CELL COMPONENT
// ============================================================================
interface GridCellProps {
  id: string;
  label: string;
  isNavigation?: boolean;
  children?: React.ReactNode;
  noPadding?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

function GridCell({ id, label, isNavigation, children, noPadding, className, style }: GridCellProps) {
  return (
    <div
      className={`
        rounded-lg border overflow-hidden flex flex-col
        ${isNavigation ? 'cursor-pointer hover:brightness-110 transition-all duration-300' : ''}
        ${className || ''}
      `}
      style={{
        backgroundColor: COLORS.card,
        borderColor: isNavigation ? `${COLORS.cyan}30` : COLORS.cardBorder,
        ...style,
      }}
    >
      {/* Cell Header */}
      <div
        className="px-3 py-2 border-b text-xs uppercase tracking-wider flex items-center justify-between flex-shrink-0"
        style={{
          borderColor: COLORS.cardBorder,
          color: COLORS.textMuted,
        }}
      >
        <span>{id}: {label}</span>
        {isNavigation && (
          <span style={{ color: COLORS.cyan, fontSize: '10px' }}>View →</span>
        )}
      </div>

      {/* Cell Content */}
      <div className={`flex-1 ${noPadding ? '' : 'p-3'} flex items-center justify-center overflow-hidden`}>
        {children || (
          <span style={{ color: COLORS.textMuted }}>Content</span>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// A1: SEVERITY BREAKDOWN CELL
// ============================================================================
interface SeverityBreakdownCellProps {
  stats: IssueStats | null;
  loading: boolean;
}

function SeverityBreakdownCell({ stats, loading }: SeverityBreakdownCellProps) {
  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const severities = [5, 4, 3, 2, 1];
  const maxCount = Math.max(...severities.map(s => stats?.bySeverity?.[s] || 0), 1);

  return (
    <div className="w-full h-full flex flex-col justify-center p-2">
      <div className="space-y-1.5">
        {severities.map((severity) => {
          const count = stats?.bySeverity?.[severity] || 0;
          const width = (count / maxCount) * 100;

          return (
            <div key={severity} className="flex items-center gap-2">
              <div className="w-12 text-xs truncate" style={{ color: SEVERITY_COLORS[severity] }}>
                {SEVERITY_NAMES[severity]}
              </div>
              <div className="flex-1 h-3 rounded overflow-hidden" style={{ backgroundColor: `${COLORS.textMuted}20` }}>
                <div
                  className="h-full rounded"
                  style={{
                    width: `${width}%`,
                    backgroundColor: SEVERITY_COLORS[severity]
                  }}
                />
              </div>
              <div className="w-8 text-right text-xs font-mono" style={{ color: COLORS.textPrimary }}>
                {count}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-2 pt-2 border-t text-center" style={{ borderColor: COLORS.cardBorder }}>
        <span className="text-xs" style={{ color: COLORS.textMuted }}>
          Total: {stats?.total || 0}
        </span>
      </div>
    </div>
  );
}

// ============================================================================
// B1: TOTAL COUNTER CELL
// ============================================================================
interface TotalCounterCellProps {
  stats: IssueStats | null;
  loading: boolean;
}

function TotalCounterCell({ stats, loading }: TotalCounterCellProps) {
  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const total = stats?.total || 0;
  const critical = stats?.bySeverity?.[5] || 0;
  const todayCount = stats?.byDate?.find(d => {
    const today = new Date().toISOString().split('T')[0];
    return d.date === today;
  })?.count || 0;

  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-4">
      {/* Large number */}
      <div
        className="text-6xl font-bold font-mono mb-2"
        style={{ color: total > 100 ? COLORS.red : COLORS.cyan }}
      >
        {total}
      </div>
      <div className="text-sm uppercase tracking-wider mb-4" style={{ color: COLORS.textSecondary }}>
        Active Incidents
      </div>

      {/* Status indicators */}
      <div className="flex gap-4">
        {critical > 0 && (
          <div className="flex items-center gap-1">
            <div
              className="w-2 h-2 rounded-full animate-pulse"
              style={{ backgroundColor: COLORS.red }}
            />
            <span className="text-xs" style={{ color: COLORS.red }}>
              {critical} Critical
            </span>
          </div>
        )}
        <div className="flex items-center gap-1">
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: COLORS.green }}
          />
          <span className="text-xs" style={{ color: COLORS.textSecondary }}>
            {todayCount} Today
          </span>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// C1: RECENT INCIDENTS CELL
// ============================================================================
interface RecentIncidentsCellProps {
  issues: Issue[];
  loading: boolean;
}

function RecentIncidentsCell({ issues, loading }: RecentIncidentsCellProps) {
  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const recent = issues.slice(0, 4);

  return (
    <div className="w-full h-full flex flex-col p-2 overflow-hidden">
      <div className="text-xs uppercase tracking-wider mb-2" style={{ color: COLORS.textMuted }}>
        Latest Reports
      </div>

      <div className="flex-1 space-y-1.5 overflow-y-auto">
        {recent.map((issue) => {
          const timeAgo = getTimeAgo(issue.date);

          return (
            <div
              key={issue.id}
              className="flex items-center gap-2 p-1.5 rounded"
              style={{ backgroundColor: `${COLORS.textMuted}10` }}
            >
              <div
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: SEVERITY_COLORS[issue.severity] || COLORS.textMuted }}
              />
              <div className="flex-1 min-w-0">
                <div className="text-xs text-white truncate">{issue.categoryName}</div>
                <div className="text-xs truncate" style={{ color: COLORS.textMuted }}>
                  {issue.districtName}
                </div>
              </div>
              <div className="text-xs flex-shrink-0" style={{ color: COLORS.textMuted }}>
                {timeAgo}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function getTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  return `${diffDays}d`;
}

// ============================================================================
// D1: CASUALTIES SUMMARY CELL
// ============================================================================
interface CasualtiesSummaryCellProps {
  stats: IssueStats | null;
  loading: boolean;
}

function CasualtiesSummaryCell({ stats, loading }: CasualtiesSummaryCellProps) {
  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const casualties = stats?.casualties || { deaths: 0, injuries: 0, arrests: 0 };

  return (
    <div className="w-full h-full flex flex-col justify-center p-2">
      <div className="text-xs uppercase tracking-wider mb-2" style={{ color: COLORS.textMuted }}>
        Impact
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs" style={{ color: COLORS.textSecondary }}>Deaths</span>
          <span
            className="text-lg font-bold font-mono"
            style={{ color: casualties.deaths > 0 ? COLORS.red : COLORS.textMuted }}
          >
            {casualties.deaths}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs" style={{ color: COLORS.textSecondary }}>Injuries</span>
          <span
            className="text-lg font-bold font-mono"
            style={{ color: casualties.injuries > 0 ? COLORS.orange : COLORS.textMuted }}
          >
            {casualties.injuries}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs" style={{ color: COLORS.textSecondary }}>Arrests</span>
          <span
            className="text-lg font-bold font-mono"
            style={{ color: casualties.arrests > 0 ? COLORS.blue : COLORS.textMuted }}
          >
            {casualties.arrests}
          </span>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// A2: CATEGORY FILTER CELL
// ============================================================================
interface CategoryFilterCellProps {
  categories: IssueCategory[];
  selectedCategories: number[];
  onToggleCategory: (id: number) => void;
  onClearAll: () => void;
  onSelectAll: () => void;
}

function CategoryFilterCell({
  categories,
  selectedCategories,
  onToggleCategory,
  onClearAll,
  onSelectAll,
}: CategoryFilterCellProps) {
  const allSelected = selectedCategories.length === 0 || selectedCategories.length === categories.length;

  return (
    <div className="w-full h-full flex flex-col p-2 overflow-hidden">
      <div className="text-xs uppercase tracking-wider mb-2" style={{ color: COLORS.textMuted }}>
        Categories
      </div>

      <div className="flex-1 space-y-1 overflow-y-auto">
        {categories.slice(0, 6).map((category) => {
          const isSelected = selectedCategories.length === 0 || selectedCategories.includes(category.id);

          return (
            <label
              key={category.id}
              className="flex items-center gap-2 cursor-pointer p-1 rounded hover:bg-white/5"
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => onToggleCategory(category.id)}
                className="w-3 h-3 rounded"
                style={{ accentColor: category.color || COLORS.cyan }}
              />
              <span
                className="text-xs truncate"
                style={{ color: isSelected ? COLORS.textPrimary : COLORS.textMuted }}
              >
                {category.name}
              </span>
            </label>
          );
        })}
      </div>

      <div className="flex gap-1 mt-2 pt-2 border-t" style={{ borderColor: COLORS.cardBorder }}>
        <button
          onClick={onClearAll}
          className="flex-1 py-1 text-xs rounded"
          style={{
            backgroundColor: `${COLORS.textMuted}20`,
            color: COLORS.textSecondary,
          }}
        >
          Clear
        </button>
        <button
          onClick={onSelectAll}
          className="flex-1 py-1 text-xs rounded"
          style={{
            backgroundColor: allSelected ? `${COLORS.cyan}30` : `${COLORS.textMuted}20`,
            color: allSelected ? COLORS.cyan : COLORS.textSecondary,
          }}
        >
          All
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// B2+C2: INCIDENT MAP CELL (SPANNING)
// ============================================================================
interface IncidentMapCellProps {
  loading: boolean;
}

const EMPTY_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {},
  layers: [
    {
      id: 'background',
      type: 'background',
      paint: {
        'background-color': COLORS.background,
      },
    },
  ],
};

function IncidentMapCell({ loading }: IncidentMapCellProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [mapMode, setMapMode] = useState<'choropleth' | 'points'>('choropleth');

  // Initialize map
  useEffect(() => {
    if (map.current || !mapContainer.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: EMPTY_STYLE,
      center: UGANDA_CENTER,
      zoom: 5.5,
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
    });

    map.current.on('load', () => {
      setIsLoaded(true);
    });

    const resizeObserver = new ResizeObserver(() => {
      map.current?.resize();
    });
    resizeObserver.observe(mapContainer.current);

    return () => {
      resizeObserver.disconnect();
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Load choropleth data
  useEffect(() => {
    const mapInstance = map.current;
    if (!mapInstance || !isLoaded) return;

    const loadData = async () => {
      try {
        const geojson = await fetchApi('/api/issues/choropleth?level=2');

        // Remove existing layers
        try {
          if (mapInstance.getLayer('issues-fill')) mapInstance.removeLayer('issues-fill');
          if (mapInstance.getLayer('issues-outline')) mapInstance.removeLayer('issues-outline');
          if (mapInstance.getSource('issues')) mapInstance.removeSource('issues');
        } catch {
          // Layers may not exist
        }

        // Add source
        mapInstance.addSource('issues', {
          type: 'geojson',
          data: geojson
        });

        // Color based on issue count
        mapInstance.addLayer({
          id: 'issues-fill',
          type: 'fill',
          source: 'issues',
          paint: {
            'fill-color': [
              'interpolate',
              ['linear'],
              ['coalesce', ['get', 'issueCount'], 0],
              0, '#1E5F8A',
              5, '#FEF3C7',
              15, '#FCD34D',
              30, '#F97316',
              50, '#DC2626',
            ],
            'fill-opacity': 0.85,
          }
        });

        mapInstance.addLayer({
          id: 'issues-outline',
          type: 'line',
          source: 'issues',
          paint: {
            'line-color': COLORS.cyan,
            'line-width': 0.5,
            'line-opacity': 0.5,
          }
        });

        // Fit bounds
        if (geojson.bbox) {
          mapInstance.fitBounds(
            [[geojson.bbox[0], geojson.bbox[1]], [geojson.bbox[2], geojson.bbox[3]]],
            { padding: 30, duration: 500 }
          );
        }
      } catch (err) {
        console.error('Error loading issues choropleth:', err);
      }
    };

    if (mapMode === 'choropleth') {
      loadData();
    }
  }, [isLoaded, mapMode]);

  return (
    <div className="w-full h-full flex flex-col">
      {/* Mode toggle */}
      <div className="px-3 py-2 flex gap-2 border-b" style={{ borderColor: COLORS.cardBorder }}>
        <button
          onClick={() => setMapMode('choropleth')}
          className="px-2 py-1 text-xs rounded"
          style={{
            backgroundColor: mapMode === 'choropleth' ? COLORS.cyan : `${COLORS.textMuted}20`,
            color: mapMode === 'choropleth' ? '#000' : COLORS.textSecondary,
          }}
        >
          Choropleth
        </button>
        <button
          onClick={() => setMapMode('points')}
          className="px-2 py-1 text-xs rounded"
          style={{
            backgroundColor: mapMode === 'points' ? COLORS.cyan : `${COLORS.textMuted}20`,
            color: mapMode === 'points' ? '#000' : COLORS.textSecondary,
          }}
        >
          Points
        </button>
      </div>

      {/* Map container */}
      <div className="flex-1 relative">
        <div ref={mapContainer} className="w-full h-full" />

        {/* Legend */}
        <div
          className="absolute bottom-2 left-2 px-2 py-1 rounded text-xs"
          style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
        >
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: '#1E5F8A' }} />
            <span style={{ color: COLORS.textSecondary }}>Low</span>
            <div className="w-3 h-3 rounded" style={{ backgroundColor: '#FCD34D' }} />
            <span style={{ color: COLORS.textSecondary }}>Med</span>
            <div className="w-3 h-3 rounded" style={{ backgroundColor: '#DC2626' }} />
            <span style={{ color: COLORS.textSecondary }}>High</span>
          </div>
        </div>

        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// D2: TOP DISTRICTS CELL
// ============================================================================
interface TopDistrictsCellProps {
  stats: IssueStats | null;
  loading: boolean;
}

function TopDistrictsCell({ stats, loading }: TopDistrictsCellProps) {
  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const districts = stats?.topDistricts?.slice(0, 5) || [];
  const maxCount = Math.max(...districts.map(d => d.count), 1);

  return (
    <div className="w-full h-full flex flex-col p-2 overflow-hidden">
      <div className="text-xs uppercase tracking-wider mb-2" style={{ color: COLORS.textMuted }}>
        Hotspots
      </div>

      <div className="flex-1 space-y-1.5 overflow-y-auto">
        {districts.map((district, index) => (
          <div key={district.name} className="flex items-center gap-1.5">
            <span className="w-4 text-xs font-mono" style={{ color: COLORS.textMuted }}>
              {index + 1}.
            </span>
            <span className="flex-1 text-xs truncate" style={{ color: COLORS.textSecondary }}>
              {district.name}
            </span>
            <div
              className="h-2 rounded"
              style={{
                width: `${(district.count / maxCount) * 40}px`,
                backgroundColor: COLORS.red,
                opacity: 0.7 + (0.3 * (district.count / maxCount))
              }}
            />
            <span className="w-6 text-right text-xs font-mono" style={{ color: COLORS.textPrimary }}>
              {district.count}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// A3: DATE RANGE CELL
// ============================================================================
interface DateRangeCellProps {
  startDate: string;
  endDate: string;
  onDateChange: (start: string, end: string) => void;
}

function DateRangeCell({ startDate, endDate, onDateChange }: DateRangeCellProps) {
  const [localStart, setLocalStart] = useState(startDate);
  const [localEnd, setLocalEnd] = useState(endDate);

  const handleApply = () => {
    onDateChange(localStart, localEnd);
  };

  const setQuickRange = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    setLocalStart(start.toISOString().split('T')[0]);
    setLocalEnd(end.toISOString().split('T')[0]);
  };

  return (
    <div className="w-full h-full flex flex-col p-2 overflow-hidden">
      <div className="text-xs uppercase tracking-wider mb-2" style={{ color: COLORS.textMuted }}>
        Date Range
      </div>

      <div className="space-y-2">
        <div>
          <label className="text-xs block mb-1" style={{ color: COLORS.textSecondary }}>From</label>
          <input
            type="date"
            value={localStart}
            onChange={(e) => setLocalStart(e.target.value)}
            className="w-full px-2 py-1 rounded text-xs"
            style={{
              backgroundColor: `${COLORS.textMuted}20`,
              color: COLORS.textPrimary,
              border: `1px solid ${COLORS.cardBorder}`,
            }}
          />
        </div>
        <div>
          <label className="text-xs block mb-1" style={{ color: COLORS.textSecondary }}>To</label>
          <input
            type="date"
            value={localEnd}
            onChange={(e) => setLocalEnd(e.target.value)}
            className="w-full px-2 py-1 rounded text-xs"
            style={{
              backgroundColor: `${COLORS.textMuted}20`,
              color: COLORS.textPrimary,
              border: `1px solid ${COLORS.cardBorder}`,
            }}
          />
        </div>
      </div>

      <button
        onClick={handleApply}
        className="w-full py-1.5 mt-2 rounded text-xs font-medium"
        style={{
          backgroundColor: COLORS.cyan,
          color: '#000',
        }}
      >
        Apply
      </button>

      <div className="flex gap-1 mt-2">
        <button
          onClick={() => setQuickRange(1)}
          className="flex-1 py-1 text-xs rounded"
          style={{ backgroundColor: `${COLORS.textMuted}20`, color: COLORS.textSecondary }}
        >
          Today
        </button>
        <button
          onClick={() => setQuickRange(7)}
          className="flex-1 py-1 text-xs rounded"
          style={{ backgroundColor: `${COLORS.textMuted}20`, color: COLORS.textSecondary }}
        >
          Week
        </button>
        <button
          onClick={() => setQuickRange(30)}
          className="flex-1 py-1 text-xs rounded"
          style={{ backgroundColor: `${COLORS.textMuted}20`, color: COLORS.textSecondary }}
        >
          Month
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// B3: CATEGORY PIE CHART CELL
// ============================================================================
interface CategoryPieChartCellProps {
  stats: IssueStats | null;
  loading: boolean;
}

function CategoryPieChartCell({ stats, loading }: CategoryPieChartCellProps) {
  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const byCategory = stats?.byCategory || {};
  const data = Object.entries(byCategory)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  if (data.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <span className="text-sm" style={{ color: COLORS.textMuted }}>No data</span>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col p-2">
      <div className="text-xs mb-1" style={{ color: COLORS.textMuted }}>
        By Category
      </div>

      <div className="flex-1 flex items-center justify-center" style={{ minHeight: '100px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius="40%"
              outerRadius="70%"
              dataKey="value"
              isAnimationActive={false}
            >
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: '#1F2937',
                border: '1px solid #374151',
                borderRadius: '8px',
                fontSize: '11px',
              }}
              isAnimationActive={false}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 mt-1">
        {data.slice(0, 4).map((item, index) => (
          <div key={item.name} className="flex items-center gap-1 truncate">
            <div
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: CATEGORY_COLORS[index] }}
            />
            <span className="text-xs truncate" style={{ color: COLORS.textSecondary }}>
              {item.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// C3: TREND CHART CELL
// ============================================================================
interface TrendChartCellProps {
  stats: IssueStats | null;
  loading: boolean;
}

function TrendChartCell({ stats, loading }: TrendChartCellProps) {
  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const data = stats?.byDate?.slice(-14).map(d => ({
    date: new Date(d.date).toLocaleDateString('en', { month: 'short', day: 'numeric' }),
    count: d.count
  })) || [];

  if (data.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <span className="text-sm" style={{ color: COLORS.textMuted }}>No trend data</span>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col p-2">
      <div className="text-xs mb-1" style={{ color: COLORS.textMuted }}>
        Incidents Over Time
      </div>

      <div className="flex-1" style={{ minHeight: '80px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ top: 5, right: 5, left: -20, bottom: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#374151"
              vertical={false}
            />
            <XAxis
              dataKey="date"
              stroke="#6B7280"
              fontSize={9}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              stroke="#6B7280"
              fontSize={9}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1F2937',
                border: '1px solid #374151',
                borderRadius: '8px',
                fontSize: '10px',
              }}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="count"
              stroke={COLORS.red}
              strokeWidth={2}
              isAnimationActive={false}
              dot={{
                fill: COLORS.red,
                stroke: '#0A0E14',
                strokeWidth: 1,
                r: 2,
              }}
              activeDot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ============================================================================
// D3: BACK TO HOME CELL
// ============================================================================
function BackToHomeCell() {
  const { setViewMode } = useBroadcastStore();

  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-2 gap-2">
      <button
        onClick={() => setViewMode('home')}
        className="w-full py-2 rounded text-sm font-medium transition-all hover:brightness-110"
        style={{
          backgroundColor: `${COLORS.cyan}20`,
          color: COLORS.cyan,
          border: `1px solid ${COLORS.cyan}40`,
        }}
      >
        ← HOME
      </button>

      <button
        onClick={() => setViewMode('issues')}
        className="w-full py-2 rounded text-sm font-medium transition-all hover:brightness-110"
        style={{
          backgroundColor: `${COLORS.textMuted}20`,
          color: COLORS.textSecondary,
          border: `1px solid ${COLORS.cardBorder}`,
        }}
      >
        Full Map →
      </button>

      <div className="text-xs text-center" style={{ color: COLORS.textMuted }}>
        Issues Dashboard
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================
export function IncidentsBroadcastHome() {
  const [stats, setStats] = useState<IssueStats | null>(null);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [categories, setCategories] = useState<IssueCategory[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedCategories, setSelectedCategories] = useState<number[]>([]);
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0],
  });

  // Load data
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        // Load categories
        const categoriesData = await fetchApi('/api/issues/categories');
        setCategories(categoriesData);

        // Load stats
        const statsData = await fetchApi('/api/issues/stats');
        setStats(statsData);

        // Load recent issues
        const issuesData = await fetchApi('/api/issues?limit=10&sortBy=date&sortOrder=desc');
        setIssues(issuesData.data || []);
      } catch (err) {
        console.error('Error loading issues data:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Filter handlers
  const handleToggleCategory = (id: number) => {
    setSelectedCategories(prev =>
      prev.includes(id)
        ? prev.filter(c => c !== id)
        : [...prev, id]
    );
  };

  const handleClearCategories = () => {
    setSelectedCategories([]);
  };

  const handleSelectAllCategories = () => {
    setSelectedCategories([]);
  };

  const handleDateChange = (start: string, end: string) => {
    setDateRange({ start, end });
  };

  return (
    <div
      className="w-full h-full overflow-y-auto p-4"
      style={{ backgroundColor: COLORS.background }}
    >
      {/* Custom Grid with spanning map cell */}
      <div
        className="w-full h-full grid gap-4"
        style={{
          gridTemplateColumns: '2fr 4fr 4fr 2fr',
          gridTemplateRows: '25vh 50vh 25vh',
        }}
      >
        {/* ============================================================ */}
        {/* ROW 1 (TOP) - 25% height */}
        {/* ============================================================ */}

        {/* A1: Severity Breakdown */}
        <GridCell id="A1" label="Severity">
          <SeverityBreakdownCell stats={stats} loading={loading} />
        </GridCell>

        {/* B1: Total Counter */}
        <GridCell id="B1" label="Total">
          <TotalCounterCell stats={stats} loading={loading} />
        </GridCell>

        {/* C1: Recent Incidents */}
        <GridCell id="C1" label="Recent">
          <RecentIncidentsCell issues={issues} loading={loading} />
        </GridCell>

        {/* D1: Casualties Summary */}
        <GridCell id="D1" label="Casualties">
          <CasualtiesSummaryCell stats={stats} loading={loading} />
        </GridCell>

        {/* ============================================================ */}
        {/* ROW 2 (MIDDLE) - 50% height - Map spans 2 columns */}
        {/* ============================================================ */}

        {/* A2: Category Filter */}
        <GridCell id="A2" label="Categories">
          <CategoryFilterCell
            categories={categories}
            selectedCategories={selectedCategories}
            onToggleCategory={handleToggleCategory}
            onClearAll={handleClearCategories}
            onSelectAll={handleSelectAllCategories}
          />
        </GridCell>

        {/* B2+C2: Incident Map (spans 2 columns) */}
        <GridCell
          id="B2+C2"
          label="Incident Map"
          noPadding
          style={{ gridColumn: 'span 2' }}
        >
          <IncidentMapCell loading={loading} />
        </GridCell>

        {/* D2: Top Districts */}
        <GridCell id="D2" label="Hotspots">
          <TopDistrictsCell stats={stats} loading={loading} />
        </GridCell>

        {/* ============================================================ */}
        {/* ROW 3 (BOTTOM) - 25% height */}
        {/* ============================================================ */}

        {/* A3: Date Range */}
        <GridCell id="A3" label="Date Range">
          <DateRangeCell
            startDate={dateRange.start}
            endDate={dateRange.end}
            onDateChange={handleDateChange}
          />
        </GridCell>

        {/* B3: Category Pie Chart */}
        <GridCell id="B3" label="By Category">
          <CategoryPieChartCell stats={stats} loading={loading} />
        </GridCell>

        {/* C3: Trend Chart */}
        <GridCell id="C3" label="Trend">
          <TrendChartCell stats={stats} loading={loading} />
        </GridCell>

        {/* D3: Back to Home */}
        <GridCell id="D3" label="Navigation">
          <BackToHomeCell />
        </GridCell>
      </div>
    </div>
  );
}

export default IncidentsBroadcastHome;
