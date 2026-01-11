import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Map as MapIcon,
  BarChart3,
  ChevronRight,
  AlertTriangle,
  Users,
  Skull,
  ShieldAlert,
} from 'lucide-react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { api } from '../lib/api';

interface IncidentCategory {
  id: number;
  name: string;
  code: string;
  color: string | null;
  severity: number;
}

interface IncidentSummary {
  totalIncidents: number;
  totalDeaths: number;
  totalInjuries: number;
  totalArrests: number;
  byCategory: { name: string; count: number }[];
  topDistricts: { name: string; count: number }[];
}

interface MonthlyData {
  month: string;
  count: number;
  label: string;
}

// Helper to calculate centroid of a polygon
function calculateCentroid(coordinates: number[][][]): [number, number] {
  let totalX = 0;
  let totalY = 0;
  let totalPoints = 0;

  const ring = coordinates[0];
  for (const point of ring) {
    totalX += point[0];
    totalY += point[1];
    totalPoints++;
  }

  return [totalX / totalPoints, totalY / totalPoints];
}

function calculateMultiPolygonCentroid(coordinates: number[][][][]): [number, number] {
  let totalX = 0;
  let totalY = 0;
  let totalPoints = 0;

  for (const polygon of coordinates) {
    const ring = polygon[0];
    for (const point of ring) {
      totalX += point[0];
      totalY += point[1];
      totalPoints++;
    }
  }

  return [totalX / totalPoints, totalY / totalPoints];
}

// Generate months from Aug 2025 to current
function generateMonthsRange(): string[] {
  const months: string[] = [];
  const start = new Date(2025, 7, 1); // August 2025
  const now = new Date();

  let current = new Date(start);
  while (current <= now) {
    months.push(`${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`);
    current.setMonth(current.getMonth() + 1);
  }
  return months;
}

export function IncidentsHome() {
  const [categories, setCategories] = useState<IncidentCategory[]>([]);
  const [summary, setSummary] = useState<IncidentSummary | null>(null);
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [mapData, setMapData] = useState<GeoJSON.FeatureCollection | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        // Load categories
        const cats = await api.getIssueCategories();
        setCategories(cats);

        // Load stats from the dedicated stats endpoint
        const stats = await api.getIssueStats({}) as any;

        // Transform the data for our summary
        const byCategory = stats.byCategory
          .map((c: any) => ({ name: c.category, count: c.count }))
          .slice(0, 5);

        const topDistricts = stats.topDistricts
          .map((d: any) => ({ name: d.district, count: d.count }))
          .slice(0, 10);

        setSummary({
          totalIncidents: stats.total,
          totalDeaths: stats.casualties?.deaths || 0,
          totalInjuries: stats.casualties?.injuries || 0,
          totalArrests: stats.casualties?.arrests || 0,
          byCategory,
          topDistricts,
        });

        // Load choropleth data for the map
        const choropleth = await api.getIssuesChoropleth({ level: 2 });
        setMapData(choropleth as unknown as GeoJSON.FeatureCollection);

        // Load all issues to aggregate by month
        const { issues } = await api.getIssues({ limit: 10000 });

        // Aggregate by month
        const monthCounts: Record<string, number> = {};
        const monthsRange = generateMonthsRange();

        // Initialize all months with 0
        monthsRange.forEach(m => { monthCounts[m] = 0; });

        // Count issues by month
        issues.forEach((issue: any) => {
          if (issue.date) {
            const date = new Date(issue.date);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            if (monthCounts[monthKey] !== undefined) {
              monthCounts[monthKey]++;
            }
          }
        });

        // Format for chart
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const chartData: MonthlyData[] = monthsRange.map(m => {
          const [year, month] = m.split('-');
          return {
            month: m,
            count: monthCounts[m],
            label: `${monthNames[parseInt(month) - 1]} ${year.slice(2)}`
          };
        });
        setMonthlyData(chartData);

      } catch (err) {
        console.error('Failed to load incidents:', err);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  // Initialize map when data is ready
  useEffect(() => {
    if (!mapContainerRef.current || !mapData || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: {
        version: 8,
        sources: {},
        layers: [
          {
            id: 'background',
            type: 'background',
            paint: {
              'background-color': '#0f1419'
            }
          }
        ]
      },
      center: [32.5825, 1.3733],
      zoom: 6.3,
      interactive: false,
    });

    mapRef.current = map;

    map.on('load', () => {
      // Add district boundaries with choropleth fill
      map.addSource('districts', {
        type: 'geojson',
        data: mapData
      });

      // Choropleth fill layer
      map.addLayer({
        id: 'district-fill',
        type: 'fill',
        source: 'districts',
        paint: {
          'fill-color': ['get', 'fillColor'],
          'fill-opacity': 0.7
        }
      });

      // District boundary lines
      map.addLayer({
        id: 'district-boundaries',
        type: 'line',
        source: 'districts',
        paint: {
          'line-color': '#3b82f6',
          'line-width': 1,
          'line-opacity': 0.6
        }
      });

      // Create centroid points with incident counts
      const maxCount = Math.max(...mapData.features.map(f => (f.properties as any)?.issueCount || 0), 1);

      const centroidFeatures: any[] = [];
      for (const feature of mapData.features) {
        const props = feature.properties as any;
        if (!props?.issueCount || props.issueCount <= 0) continue;

        const geom = feature.geometry as any;
        let centroid: [number, number] | null = null;

        if (geom.type === 'Polygon') {
          centroid = calculateCentroid(geom.coordinates);
        } else if (geom.type === 'MultiPolygon') {
          centroid = calculateMultiPolygonCentroid(geom.coordinates);
        }

        if (centroid) {
          centroidFeatures.push({
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: centroid
            },
            properties: {
              name: props.unitName,
              count: props.issueCount,
              normalizedSize: Math.sqrt(props.issueCount / maxCount)
            }
          });
        }
      }

      map.addSource('centroids', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: centroidFeatures
        }
      });

      // Add dots sized by incident count
      map.addLayer({
        id: 'incident-dots',
        type: 'circle',
        source: 'centroids',
        paint: {
          'circle-radius': [
            'interpolate', ['linear'], ['get', 'normalizedSize'],
            0, 4,
            0.3, 8,
            0.6, 14,
            1, 22
          ],
          'circle-color': '#F59E0B',
          'circle-opacity': 0.85,
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 1.5
        }
      });
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [mapData]);

  return (
    <div className="flex-1 bg-base flex flex-col min-h-0">
      {/* Header */}
      <div className="relative overflow-hidden flex-shrink-0">
        <div className="absolute inset-0 bg-gradient-to-br from-[#F59E0B]/10 via-transparent to-[#EF4444]/5" />
        <div className="relative px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#F59E0B]/20 rounded-lg">
                <AlertTriangle className="w-5 h-5" style={{ color: '#F59E0B' }} />
              </div>
              <div>
                <h1 className="text-2xl font-headline font-bold text-white">Electoral Incidents</h1>
                <p className="text-gray-400 text-sm">Track and analyze electoral irregularities</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Link
                to="/incidents/map"
                className="flex items-center gap-2 px-4 py-2 bg-[#F59E0B]/20 hover:bg-[#F59E0B]/30 border border-[#F59E0B]/40 rounded-lg text-sm font-medium text-[#F59E0B] transition-colors"
              >
                <MapIcon className="w-4 h-4" />
                Full Map
              </Link>
              <Link
                to="/incidents/stats"
                className="flex items-center gap-2 px-4 py-2 bg-[#EF4444]/20 hover:bg-[#EF4444]/30 border border-[#EF4444]/40 rounded-lg text-sm font-medium text-[#EF4444] transition-colors"
              >
                <BarChart3 className="w-4 h-4" />
                Statistics
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      {isLoading ? (
        <div className="grid grid-cols-4 gap-4 px-6 py-4 flex-shrink-0">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-surface/90 rounded-lg border border-gray-700/50 p-4 animate-pulse">
              <div className="h-4 bg-gray-700 rounded w-20 mb-2" />
              <div className="h-6 bg-gray-700 rounded w-12" />
            </div>
          ))}
        </div>
      ) : summary && (
        <div className="grid grid-cols-4 gap-4 px-6 py-4 flex-shrink-0">
          <StatCard
            icon={<AlertTriangle className="w-4 h-4" />}
            iconColor="#F59E0B"
            label="Total Incidents"
            value={summary.totalIncidents.toLocaleString()}
          />
          <StatCard
            icon={<Skull className="w-4 h-4" />}
            iconColor="#EF4444"
            label="Fatalities"
            value={summary.totalDeaths.toLocaleString()}
          />
          <StatCard
            icon={<Users className="w-4 h-4" />}
            iconColor="#F97316"
            label="Injuries"
            value={summary.totalInjuries.toLocaleString()}
          />
          <StatCard
            icon={<ShieldAlert className="w-4 h-4" />}
            iconColor="#3B82F6"
            label="Arrests"
            value={summary.totalArrests.toLocaleString()}
          />
        </div>
      )}

      {/* Main Content - Map and Chart side by side */}
      <div className="flex-1 grid grid-cols-2 gap-4 px-6 pb-6 min-h-0">
        {/* Left - Choropleth Map */}
        <div className="bg-surface/90 rounded-xl border border-gray-700/50 overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700/50">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <MapIcon className="w-4 h-4 text-gray-400" />
              Incidents by District
            </h2>
            <Link to="/incidents/map?type=points" className="text-xs text-[#F59E0B] hover:text-[#F59E0B]/80">
              Open full map →
            </Link>
          </div>
          <div ref={mapContainerRef} className="flex-1 min-h-0" />
          {/* Legend */}
          <div className="px-4 py-2 border-t border-gray-700/50 flex items-center justify-between text-xs text-gray-400">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#1a1a2e]" /> Low
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#F59E0B]" /> High
              </span>
            </div>
            <span>Dot size = incident count</span>
          </div>
        </div>

        {/* Right - Time Series Chart */}
        <div className="bg-surface/90 rounded-xl border border-gray-700/50 overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700/50">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-gray-400" />
              Incidents Over Time
            </h2>
            <span className="text-xs text-gray-500">Aug 2025 - Present</span>
          </div>
          <div className="flex-1 p-4" style={{ minHeight: '250px' }}>
            {monthlyData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={monthlyData}
                  margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="incidentGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.5} />
                      <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#374151"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="label"
                    stroke="#6B7280"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="#6B7280"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1F2937',
                      border: '1px solid #374151',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)',
                    }}
                    labelStyle={{ color: '#9CA3AF' }}
                    itemStyle={{ color: '#F59E0B' }}
                    formatter={(value) => [value, 'Incidents']}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="#F59E0B"
                    strokeWidth={2}
                    fill="url(#incidentGradient)"
                    dot={{
                      fill: '#F59E0B',
                      stroke: '#0A0E14',
                      strokeWidth: 2,
                      r: 4,
                    }}
                    activeDot={{
                      fill: '#ffffff',
                      stroke: '#F59E0B',
                      strokeWidth: 2,
                      r: 6,
                    }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                Loading chart data...
              </div>
            )}
          </div>
          {/* Chart Legend */}
          <div className="px-4 py-2 border-t border-gray-700/50 flex items-center justify-center gap-4 text-xs text-gray-400">
            <div className="flex items-center gap-1">
              <div className="w-3 h-0.5 bg-[#F59E0B] rounded" />
              <span>Reported Incidents</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Section - Categories and Top Districts */}
      <div className="grid grid-cols-3 gap-4 px-6 pb-6 flex-shrink-0">
        {/* Top Districts */}
        <div className="bg-surface/90 rounded-xl border border-gray-700/50 p-4">
          <h3 className="text-sm font-semibold text-white mb-3">Most Affected Districts</h3>
          <div className="space-y-2">
            {summary?.topDistricts.slice(0, 5).map((district, index) => {
              const maxCount = summary.topDistricts[0]?.count || 1;
              const barWidth = (district.count / maxCount) * 100;
              return (
                <div key={district.name}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-gray-300">{index + 1}. {district.name}</span>
                    <span className="text-gray-500">{district.count}</span>
                  </div>
                  <div className="w-full bg-gray-700/50 rounded-full h-1">
                    <div
                      className="h-1 rounded-full bg-gradient-to-r from-[#F59E0B] to-[#EF4444]/60"
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Categories */}
        <div className="bg-surface/90 rounded-xl border border-gray-700/50 p-4">
          <h3 className="text-sm font-semibold text-white mb-3">Top Categories</h3>
          <div className="space-y-2">
            {summary?.byCategory.slice(0, 5).map((cat) => {
              const category = categories.find(c => c.name === cat.name);
              const color = category?.color || '#F59E0B';
              return (
                <div key={cat.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                    <span className="text-xs text-gray-300 truncate">{cat.name}</span>
                  </div>
                  <span className="text-xs text-gray-500">{cat.count}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Quick Links */}
        <div className="bg-surface/90 rounded-xl border border-gray-700/50 p-4">
          <h3 className="text-sm font-semibold text-white mb-3">Quick Actions</h3>
          <div className="space-y-2">
            <Link
              to="/incidents/map"
              className="flex items-center justify-between p-2 rounded-lg bg-gray-800/50 hover:bg-gray-700/50 transition-colors group"
            >
              <div className="flex items-center gap-2">
                <MapIcon className="w-4 h-4 text-[#F59E0B]" />
                <span className="text-sm text-gray-300">Interactive Map</span>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-white" />
            </Link>
            <Link
              to="/incidents/stats"
              className="flex items-center justify-between p-2 rounded-lg bg-gray-800/50 hover:bg-gray-700/50 transition-colors group"
            >
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-[#EF4444]" />
                <span className="text-sm text-gray-300">Full Statistics</span>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-white" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

// Stat Card Component
interface StatCardProps {
  icon: React.ReactNode;
  iconColor: string;
  label: string;
  value: string;
}

function StatCard({ icon, iconColor, label, value }: StatCardProps) {
  return (
    <div className="bg-surface/90 rounded-lg border border-gray-700/50 p-4">
      <div className="flex items-center gap-2 mb-1">
        <div style={{ color: iconColor }}>{icon}</div>
        <span className="text-gray-400 text-xs">{label}</span>
      </div>
      <p className="text-xl font-bold text-white">{value}</p>
    </div>
  );
}

export default IncidentsHome;
