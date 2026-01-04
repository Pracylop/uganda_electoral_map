import { useState, useEffect, useRef, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import Map from '../components/Map';
import { api } from '../lib/api';
import 'maplibre-gl/dist/maplibre-gl.css';

type DemographicMetric = 'population' | 'votingAge' | 'votingAgePercent' | 'malePercent';
type InteractionMode = 'stats' | 'drilldown';

interface DistrictStats {
  districtId: number;
  districtName: string;
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

// Color scales for different metrics
const colorScales: Record<DemographicMetric, { stops: number[]; colors: string[] }> = {
  population: {
    stops: [0, 100000, 300000, 500000, 1000000, 2000000],
    colors: ['#f7fbff', '#c6dbef', '#6baed6', '#2171b5', '#08519c', '#08306b'],
  },
  votingAge: {
    stops: [0, 50000, 150000, 300000, 500000, 1000000],
    colors: ['#f7fcf5', '#c7e9c0', '#74c476', '#31a354', '#006d2c', '#00441b'],
  },
  votingAgePercent: {
    stops: [40, 45, 48, 50, 52, 55],
    colors: ['#ffffcc', '#d9f0a3', '#addd8e', '#78c679', '#31a354', '#006837'],
  },
  malePercent: {
    stops: [45, 48, 49, 50, 51, 52],
    colors: ['#f1eef6', '#d4b9da', '#c994c7', '#df65b0', '#e7298a', '#ce1256'],
  },
};

const metricLabels: Record<DemographicMetric, string> = {
  population: 'Total Population',
  votingAge: 'Voting Age (18+)',
  votingAgePercent: 'Voting Age %',
  malePercent: 'Male %',
};

export function DemographicsDashboard() {
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [metric, setMetric] = useState<DemographicMetric>('population');
  const [nationalStats, setNationalStats] = useState<NationalStats | null>(null);
  const [districts, setDistricts] = useState<DistrictStats[]>([]);
  const [selectedDistrict, setSelectedDistrict] = useState<DistrictStats | null>(null);
  const [compareDistrict, setCompareDistrict] = useState<DistrictStats | null>(null);
  const [isLoadingChoropleth, setIsLoadingChoropleth] = useState(false);
  const [sourceLoaded, setSourceLoaded] = useState(false);

  // New UI states
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [interactionMode, setInteractionMode] = useState<InteractionMode>('stats');
  const [isComparing, setIsComparing] = useState(false);

  // Load demographics stats
  useEffect(() => {
    api.getDemographicsStats()
      .then((data) => {
        setNationalStats(data.national);
        setDistricts(data.districts);
      })
      .catch((err) => console.error('Failed to load demographics:', err));
  }, []);

  // Handle map load
  const handleMapLoad = useCallback((map: maplibregl.Map) => {
    mapRef.current = map;
    setMapLoaded(true);
  }, []);

  // Load choropleth data once when map is ready
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    const map = mapRef.current;

    const loadChoropleth = async () => {
      if (map.getSource('demographics')) {
        setSourceLoaded(true);
        return;
      }

      setIsLoadingChoropleth(true);

      try {
        const data = await api.getDemographicsGeoJSON({ level: 2 });

        if (!data || !data.features) {
          console.error('Invalid demographics data received');
          setIsLoadingChoropleth(false);
          return;
        }

        map.addSource('demographics', {
          type: 'geojson',
          data: data as GeoJSON.FeatureCollection,
        });

        const colorProperty = 'totalPopulation';
        const scale = colorScales.population;
        const colorExpr: any[] = ['interpolate', ['linear'], ['get', colorProperty]];
        for (let i = 0; i < scale.stops.length; i++) {
          colorExpr.push(scale.stops[i], scale.colors[i]);
        }

        map.addLayer({
          id: 'demographics-fill',
          type: 'fill',
          source: 'demographics',
          paint: {
            'fill-color': colorExpr as any,
            'fill-opacity': 0.8,
          },
        });

        map.addLayer({
          id: 'demographics-line',
          type: 'line',
          source: 'demographics',
          paint: {
            'line-color': '#333',
            'line-width': 1,
            'line-opacity': 0.7,
          },
        });

        // Hover cursor
        map.on('mouseenter', 'demographics-fill', () => {
          map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', 'demographics-fill', () => {
          map.getCanvas().style.cursor = '';
        });

        setSourceLoaded(true);
        setIsLoadingChoropleth(false);
      } catch (err) {
        console.error('Failed to load demographics choropleth:', err);
        setIsLoadingChoropleth(false);
      }
    };

    loadChoropleth();
  }, [mapLoaded]);

  // Handle map clicks based on interaction mode
  useEffect(() => {
    if (!mapRef.current || !sourceLoaded) return;
    const map = mapRef.current;

    const handleClick = (e: maplibregl.MapLayerMouseEvent) => {
      if (!e.features || e.features.length === 0) return;
      const props = e.features[0].properties;
      if (!props) return;

      const district = districts.find(d => d.districtId === props.id);
      if (!district) return;

      if (interactionMode === 'stats') {
        if (isComparing && selectedDistrict) {
          setCompareDistrict(district);
        } else {
          setSelectedDistrict(district);
          setSidebarOpen(true); // Open sidebar to show stats
        }
      } else {
        // Drill-down mode - show popup for now (future: drill to constituencies)
        new maplibregl.Popup()
          .setLngLat(e.lngLat)
          .setHTML(`
            <div style="padding: 8px; color: #000;">
              <h3 style="font-weight: bold; margin-bottom: 4px;">${props.name}</h3>
              <p style="margin: 0; font-size: 12px; color: #666;">Click to drill down (coming soon)</p>
            </div>
          `)
          .addTo(map);
      }
    };

    map.on('click', 'demographics-fill', handleClick);
    return () => {
      map.off('click', 'demographics-fill', handleClick);
    };
  }, [sourceLoaded, districts, interactionMode, isComparing, selectedDistrict]);

  // Update fill color when metric changes
  useEffect(() => {
    if (!mapRef.current || !sourceLoaded) return;
    const map = mapRef.current;

    try {
      if (!map.getLayer('demographics-fill')) return;

      const colorProperty = metric === 'votingAgePercent' ? 'votingAgePercent' :
                           metric === 'votingAge' ? 'votingAgePopulation' :
                           metric === 'malePercent' ? 'malePercent' : 'totalPopulation';

      const scale = colorScales[metric];
      const colorExpr: any[] = ['interpolate', ['linear'], ['get', colorProperty]];
      for (let i = 0; i < scale.stops.length; i++) {
        colorExpr.push(scale.stops[i], scale.colors[i]);
      }

      map.setPaintProperty('demographics-fill', 'fill-color', colorExpr);
    } catch (err) {
      console.error('Failed to update metric:', err);
    }
  }, [metric, sourceLoaded]);

  const formatNumber = (n: number) => n.toLocaleString();
  const formatPercent = (n: number, total: number) => ((n / total) * 100).toFixed(1) + '%';
  const scale = colorScales[metric];

  // Clear selection
  const clearSelection = () => {
    setSelectedDistrict(null);
    setCompareDistrict(null);
    setIsComparing(false);
  };

  // Start comparison
  const startComparison = () => {
    if (selectedDistrict) {
      setIsComparing(true);
      setCompareDistrict(null);
    }
  };

  return (
    <div className="h-screen flex bg-gray-900">
      {/* Collapsible Sidebar */}
      <div
        className={`bg-gray-800 border-r border-gray-700 flex flex-col overflow-hidden transition-all duration-300 ${
          sidebarOpen ? 'w-80' : 'w-0'
        }`}
      >
        {sidebarOpen && (
          <>
            {/* Header */}
            <div className="p-4 border-b border-gray-700 flex justify-between items-center">
              <div>
                <h1 className="text-lg font-bold text-white">Demographics</h1>
                <p className="text-xs text-gray-400">2024 Census Data</p>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white"
                title="Collapse sidebar"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                </svg>
              </button>
            </div>

            {/* Context-specific content */}
            {selectedDistrict ? (
              // District Stats View
              <div className="flex-1 overflow-y-auto">
                <div className="p-4 border-b border-gray-700">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h2 className="text-lg font-bold text-white">{selectedDistrict.districtName}</h2>
                      <p className="text-xs text-gray-400">District Statistics</p>
                    </div>
                    <button
                      onClick={clearSelection}
                      className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white"
                      title="Back to national"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  {/* District Stats Grid */}
                  <div className="grid grid-cols-2 gap-2">
                    <StatCard label="Population" value={formatNumber(selectedDistrict.totalPopulation)} />
                    <StatCard label="Voting Age" value={formatNumber(selectedDistrict.votingAgePopulation)} color="text-green-400" />
                    <StatCard label="Youth (0-17)" value={formatNumber(selectedDistrict.youthPopulation)} color="text-blue-400" />
                    <StatCard label="Elderly (60+)" value={formatNumber(selectedDistrict.elderlyPopulation)} color="text-orange-400" />
                    <StatCard label="Households" value={formatNumber(selectedDistrict.numberOfHouseholds)} color="text-purple-400" />
                    <StatCard label="Parishes" value={selectedDistrict.parishCount.toString()} />
                  </div>

                  {/* Gender & Voting */}
                  <div className="mt-3 pt-3 border-t border-gray-700 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Gender Split</span>
                      <span className="text-white">
                        {formatPercent(selectedDistrict.malePopulation, selectedDistrict.totalPopulation)} M / {formatPercent(selectedDistrict.femalePopulation, selectedDistrict.totalPopulation)} F
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Voting Age %</span>
                      <span className="text-green-400 font-medium">
                        {formatPercent(selectedDistrict.votingAgePopulation, selectedDistrict.totalPopulation)}
                      </span>
                    </div>
                  </div>

                  {/* Compare Button */}
                  {!isComparing && (
                    <button
                      onClick={startComparison}
                      className="mt-4 w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-medium transition-colors"
                    >
                      Compare with another district
                    </button>
                  )}
                </div>

                {/* Comparison Panel */}
                {isComparing && (
                  <div className="p-4 border-b border-gray-700 bg-gray-750">
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="text-sm font-semibold text-white">Comparison Mode</h3>
                      <button
                        onClick={() => { setIsComparing(false); setCompareDistrict(null); }}
                        className="text-xs text-gray-400 hover:text-white"
                      >
                        Cancel
                      </button>
                    </div>

                    {compareDistrict ? (
                      <div className="space-y-2">
                        <div className="text-sm text-gray-400 mb-2">
                          <span className="text-blue-400">{selectedDistrict.districtName}</span>
                          {' vs '}
                          <span className="text-green-400">{compareDistrict.districtName}</span>
                        </div>
                        <CompareTable a={selectedDistrict} b={compareDistrict} />
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400">
                        Click on another district to compare
                      </p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              // National Stats View
              <>
                {nationalStats && (
                  <div className="p-4 border-b border-gray-700">
                    <h2 className="text-sm font-semibold text-gray-300 mb-3">National Totals</h2>
                    <div className="grid grid-cols-2 gap-2">
                      <StatCard label="Population" value={`${(nationalStats.totalPopulation / 1000000).toFixed(1)}M`} />
                      <StatCard label="Voting Age" value={`${(nationalStats.votingAgePopulation / 1000000).toFixed(1)}M`} color="text-green-400" />
                      <StatCard label="Youth (0-17)" value={`${(nationalStats.youthPopulation / 1000000).toFixed(1)}M`} color="text-blue-400" />
                      <StatCard label="Households" value={`${(nationalStats.numberOfHouseholds / 1000000).toFixed(1)}M`} color="text-purple-400" />
                    </div>
                    <div className="mt-2 text-xs text-gray-500">
                      {formatPercent(nationalStats.malePopulation, nationalStats.totalPopulation)} Male | {formatPercent(nationalStats.femalePopulation, nationalStats.totalPopulation)} Female
                    </div>
                  </div>
                )}

                {/* Metric Selector */}
                <div className="p-4 border-b border-gray-700">
                  <label className="text-xs text-gray-400 block mb-2">Display Metric</label>
                  <select
                    value={metric}
                    onChange={(e) => setMetric(e.target.value as DemographicMetric)}
                    className="w-full bg-gray-700 text-white rounded px-3 py-2 text-sm border border-gray-600"
                  >
                    {Object.entries(metricLabels).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>

                  {/* Legend */}
                  <div className="mt-3">
                    <div className="flex h-2 rounded overflow-hidden">
                      {scale.colors.map((color, i) => (
                        <div key={i} className="flex-1" style={{ backgroundColor: color }} />
                      ))}
                    </div>
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>{metric.includes('Percent') ? `${scale.stops[0]}%` : formatNumber(scale.stops[0])}</span>
                      <span>{metric.includes('Percent') ? `${scale.stops[scale.stops.length - 1]}%` : formatNumber(scale.stops[scale.stops.length - 1])}</span>
                    </div>
                  </div>
                </div>

                {/* District count info */}
                <div className="p-4 text-sm text-gray-400">
                  <p>{districts.length} districts loaded</p>
                  <p className="text-xs mt-1">Click on a district to view details</p>
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* Main Content - Map */}
      <div className="flex-1 flex flex-col">
        {/* Toolbar */}
        <div className="bg-gray-800 border-b border-gray-700 px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Sidebar Toggle */}
            {!sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-2 hover:bg-gray-700 rounded text-gray-400 hover:text-white"
                title="Open sidebar"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            )}

            {/* Interaction Mode Toggle */}
            <div className="flex bg-gray-700 rounded-lg p-0.5">
              <button
                onClick={() => setInteractionMode('stats')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  interactionMode === 'stats'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                View Stats
              </button>
              <button
                onClick={() => setInteractionMode('drilldown')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  interactionMode === 'drilldown'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Drill Down
              </button>
            </div>

            {/* Metric selector (compact) when sidebar closed */}
            {!sidebarOpen && (
              <select
                value={metric}
                onChange={(e) => setMetric(e.target.value as DemographicMetric)}
                className="bg-gray-700 text-white rounded px-3 py-1.5 text-sm border border-gray-600"
              >
                {Object.entries(metricLabels).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            )}
          </div>

          <div className="flex items-center gap-3">
            {selectedDistrict && (
              <span className="text-sm text-gray-400">
                Selected: <span className="text-white">{selectedDistrict.districtName}</span>
              </span>
            )}
            <span className="text-xs text-gray-500">
              {interactionMode === 'stats' ? 'Click to view statistics' : 'Click to drill down'}
            </span>
          </div>
        </div>

        {/* Map */}
        <div className="flex-1 relative">
          <Map onLoad={handleMapLoad} className="absolute inset-0" />

          {/* Loading Indicator */}
          {isLoadingChoropleth && (
            <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
              <div className="bg-gray-800/90 backdrop-blur-sm rounded-lg px-6 py-3 flex items-center gap-3 shadow-lg border border-gray-700">
                <div className="w-5 h-5 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-white">Loading demographic data...</span>
              </div>
            </div>
          )}

          {/* Legend (when sidebar closed) */}
          {!sidebarOpen && (
            <div className="absolute bottom-4 left-4 bg-gray-800/90 backdrop-blur-sm rounded-lg p-3 z-10 border border-gray-700">
              <div className="text-xs text-gray-400 mb-1">{metricLabels[metric]}</div>
              <div className="flex h-2 w-32 rounded overflow-hidden">
                {scale.colors.map((color, i) => (
                  <div key={i} className="flex-1" style={{ backgroundColor: color }} />
                ))}
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>{metric.includes('Percent') ? `${scale.stops[0]}%` : formatNumber(scale.stops[0])}</span>
                <span>{metric.includes('Percent') ? `${scale.stops[scale.stops.length - 1]}%` : formatNumber(scale.stops[scale.stops.length - 1])}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Helper components
function StatCard({ label, value, color = 'text-white' }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-gray-700/50 rounded p-2">
      <div className="text-xs text-gray-400">{label}</div>
      <div className={`font-bold text-sm ${color}`}>{value}</div>
    </div>
  );
}

function CompareTable({ a, b }: { a: DistrictStats; b: DistrictStats }) {
  const formatNum = (n: number) => n.toLocaleString();
  const formatPct = (n: number, t: number) => ((n / t) * 100).toFixed(1) + '%';

  const rows = [
    { label: 'Population', aVal: a.totalPopulation, bVal: b.totalPopulation },
    { label: 'Voting Age', aVal: a.votingAgePopulation, bVal: b.votingAgePopulation },
    { label: 'Youth', aVal: a.youthPopulation, bVal: b.youthPopulation },
    { label: 'Elderly', aVal: a.elderlyPopulation, bVal: b.elderlyPopulation },
    { label: 'Households', aVal: a.numberOfHouseholds, bVal: b.numberOfHouseholds },
  ];

  return (
    <div className="text-xs space-y-1">
      {rows.map(row => {
        const aWins = row.aVal > row.bVal;
        return (
          <div key={row.label} className="flex justify-between items-center py-1 border-b border-gray-700/50">
            <span className="text-gray-400 w-20">{row.label}</span>
            <span className={`${aWins ? 'text-blue-400 font-medium' : 'text-gray-300'}`}>
              {formatNum(row.aVal)}
            </span>
            <span className={`${!aWins ? 'text-green-400 font-medium' : 'text-gray-300'}`}>
              {formatNum(row.bVal)}
            </span>
          </div>
        );
      })}
      <div className="flex justify-between items-center py-1">
        <span className="text-gray-400 w-20">Voting %</span>
        <span className="text-blue-300">{formatPct(a.votingAgePopulation, a.totalPopulation)}</span>
        <span className="text-green-300">{formatPct(b.votingAgePopulation, b.totalPopulation)}</span>
      </div>
    </div>
  );
}

export default DemographicsDashboard;
