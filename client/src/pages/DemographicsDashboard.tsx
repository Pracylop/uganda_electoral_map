import { useState, useEffect, useRef, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import Map from '../components/Map';
import { api } from '../lib/api';
import 'maplibre-gl/dist/maplibre-gl.css';

type DemographicMetric = 'population' | 'votingAge' | 'votingAgePercent' | 'malePercent';

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
  const [isCompareMode, setIsCompareMode] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'population' | 'votingAge'>('population');
  const [sortAsc, setSortAsc] = useState(false);
  const [isLoadingChoropleth, setIsLoadingChoropleth] = useState(false);

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

  // Load choropleth data when map is ready or metric changes
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    const map = mapRef.current;

    const loadChoropleth = async () => {
      setIsLoadingChoropleth(true);

      // Remove existing layers first (wrapped in try-catch like IssuesDashboard)
      try {
        ['demographics-fill', 'demographics-line', 'demographics-hover'].forEach(layerId => {
          if (map.getLayer(layerId)) map.removeLayer(layerId);
        });
        if (map.getSource('demographics')) map.removeSource('demographics');
      } catch (e) {
        // Layers may not exist yet
      }

      try {
        const data = await api.getDemographicsGeoJSON({ level: 2 });

        if (!data || !data.features) {
          console.error('Invalid demographics data received');
          return;
        }

        // Add source
        map.addSource('demographics', {
          type: 'geojson',
          data: data as GeoJSON.FeatureCollection,
        });

        // Get color property based on metric
        const colorProperty = metric === 'votingAgePercent' ? 'votingAgePercent' :
                             metric === 'votingAge' ? 'votingAgePopulation' :
                             metric === 'malePercent' ? 'malePercent' : 'totalPopulation';

        const scale = colorScales[metric];

        // Build color expression
        const colorExpr: any[] = ['interpolate', ['linear'], ['get', colorProperty]];
        for (let i = 0; i < scale.stops.length; i++) {
          colorExpr.push(scale.stops[i], scale.colors[i]);
        }

        // Add fill layer
        map.addLayer({
          id: 'demographics-fill',
          type: 'fill',
          source: 'demographics',
          paint: {
            'fill-color': colorExpr as any,
            'fill-opacity': 0.8,
          },
        });

        // Add border
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

        // Click handler for district selection
        map.on('click', 'demographics-fill', (e) => {
          if (!e.features || e.features.length === 0) return;
          const props = e.features[0].properties;
          if (!props) return;

          // Show popup with district info
          new maplibregl.Popup()
            .setLngLat(e.lngLat)
            .setHTML(`
              <div style="padding: 8px; color: #000;">
                <h3 style="font-weight: bold; margin-bottom: 4px;">${props.name}</h3>
                <p style="margin: 0;">Population: <strong>${Number(props.totalPopulation).toLocaleString()}</strong></p>
                <p style="margin: 0;">Voting Age: <strong>${Number(props.votingAgePopulation).toLocaleString()}</strong></p>
              </div>
            `)
            .addTo(map);
        });

        // Hover cursor
        map.on('mouseenter', 'demographics-fill', () => {
          map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', 'demographics-fill', () => {
          map.getCanvas().style.cursor = '';
        });

        setIsLoadingChoropleth(false);
      } catch (err) {
        console.error('Failed to load demographics choropleth:', err);
        setIsLoadingChoropleth(false);
      }
    };

    loadChoropleth();
  }, [mapLoaded, metric]);

  // Sort districts
  const sortedDistricts = [...districts].sort((a, b) => {
    let comparison = 0;
    if (sortBy === 'name') {
      comparison = a.districtName.localeCompare(b.districtName);
    } else if (sortBy === 'population') {
      comparison = b.totalPopulation - a.totalPopulation;
    } else if (sortBy === 'votingAge') {
      comparison = b.votingAgePopulation - a.votingAgePopulation;
    }
    return sortAsc ? -comparison : comparison;
  });

  const formatNumber = (n: number) => n.toLocaleString();
  const formatPercent = (n: number, total: number) => ((n / total) * 100).toFixed(1) + '%';

  const scale = colorScales[metric];

  return (
    <div className="h-screen flex bg-gray-900">
      {/* Left Sidebar - Statistics */}
      <div className="w-80 bg-gray-800 border-r border-gray-700 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-gray-700">
          <h1 className="text-xl font-bold text-white">Demographics</h1>
          <p className="text-sm text-gray-400">2024 Uganda National Census</p>
        </div>

        {/* National Stats */}
        {nationalStats && (
          <div className="p-4 border-b border-gray-700">
            <h2 className="text-sm font-semibold text-gray-300 mb-3">National Totals</h2>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-gray-700/50 rounded p-2">
                <div className="text-gray-400">Population</div>
                <div className="text-white font-bold">{(nationalStats.totalPopulation / 1000000).toFixed(1)}M</div>
              </div>
              <div className="bg-gray-700/50 rounded p-2">
                <div className="text-gray-400">Voting Age</div>
                <div className="text-green-400 font-bold">{(nationalStats.votingAgePopulation / 1000000).toFixed(1)}M</div>
              </div>
              <div className="bg-gray-700/50 rounded p-2">
                <div className="text-gray-400">Youth (0-17)</div>
                <div className="text-blue-400 font-bold">{(nationalStats.youthPopulation / 1000000).toFixed(1)}M</div>
              </div>
              <div className="bg-gray-700/50 rounded p-2">
                <div className="text-gray-400">Households</div>
                <div className="text-purple-400 font-bold">{(nationalStats.numberOfHouseholds / 1000000).toFixed(1)}M</div>
              </div>
            </div>
            <div className="mt-3 text-xs text-gray-500">
              Male: {formatPercent(nationalStats.malePopulation, nationalStats.totalPopulation)} |
              Female: {formatPercent(nationalStats.femalePopulation, nationalStats.totalPopulation)}
            </div>
          </div>
        )}

        {/* Metric Selector */}
        <div className="p-4 border-b border-gray-700">
          <label className="text-sm text-gray-400 block mb-2">Display Metric</label>
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
            <div className="flex h-3 rounded overflow-hidden">
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

        {/* District List */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-3 border-b border-gray-700 flex items-center justify-between">
            <span className="text-sm text-gray-400">Districts ({districts.length})</span>
            <div className="flex gap-1">
              <button
                onClick={() => { setSortBy('name'); setSortAsc(!sortAsc); }}
                className={`px-2 py-1 text-xs rounded ${sortBy === 'name' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400'}`}
              >
                Name
              </button>
              <button
                onClick={() => { setSortBy('population'); setSortAsc(!sortAsc); }}
                className={`px-2 py-1 text-xs rounded ${sortBy === 'population' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400'}`}
              >
                Pop
              </button>
            </div>
          </div>
          <div className="divide-y divide-gray-700/50">
            {sortedDistricts.map((district) => (
              <button
                key={district.districtId}
                onClick={() => {
                  if (isCompareMode && selectedDistrict) {
                    setCompareDistrict(district);
                  } else {
                    setSelectedDistrict(district);
                  }
                }}
                className={`w-full p-3 text-left hover:bg-gray-700/50 transition-colors ${
                  selectedDistrict?.districtId === district.districtId ? 'bg-blue-900/30 border-l-2 border-blue-500' :
                  compareDistrict?.districtId === district.districtId ? 'bg-green-900/30 border-l-2 border-green-500' : ''
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className="text-white text-sm font-medium">{district.districtName}</span>
                  <span className="text-gray-400 text-xs">{formatNumber(district.totalPopulation)}</span>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Voting: {formatNumber(district.votingAgePopulation)} ({formatPercent(district.votingAgePopulation, district.totalPopulation)})
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content - Map */}
      <div className="flex-1 flex flex-col">
        {/* Toolbar */}
        <div className="bg-gray-800 border-b border-gray-700 px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                setIsCompareMode(!isCompareMode);
                if (!isCompareMode) {
                  setCompareDistrict(null);
                }
              }}
              className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                isCompareMode ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {isCompareMode ? 'Exit Compare' : 'Compare Regions'}
            </button>
            {isCompareMode && (
              <span className="text-sm text-gray-400">
                {selectedDistrict ? `Selected: ${selectedDistrict.districtName}` : 'Click a district to select'}
                {compareDistrict && ` vs ${compareDistrict.districtName}`}
              </span>
            )}
          </div>
          <div className="text-sm text-gray-400">
            Click on a district to view details
          </div>
        </div>

        {/* Map */}
        <div className="flex-1 relative">
          <Map onLoad={handleMapLoad} className="absolute inset-0" />

          {/* Loading Indicator */}
          {isLoadingChoropleth && (
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-20">
              <div className="bg-gray-800/90 backdrop-blur-sm rounded-lg px-4 py-2 flex items-center gap-2 shadow-lg border border-gray-700">
                <div className="w-4 h-4 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-sm text-white">Loading demographic data...</span>
              </div>
            </div>
          )}

          {/* Selected District Detail Panel */}
          {selectedDistrict && !isCompareMode && (
            <div className="absolute top-4 right-4 w-80 bg-gray-800/95 backdrop-blur-sm rounded-lg shadow-lg border border-gray-700 z-10">
              <div className="p-4 border-b border-gray-700 flex justify-between items-center">
                <h3 className="font-bold text-white">{selectedDistrict.districtName}</h3>
                <button
                  onClick={() => setSelectedDistrict(null)}
                  className="text-gray-400 hover:text-white"
                >
                  ✕
                </button>
              </div>
              <div className="p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <StatCard label="Total Population" value={formatNumber(selectedDistrict.totalPopulation)} />
                  <StatCard label="Voting Age (18+)" value={formatNumber(selectedDistrict.votingAgePopulation)} color="text-green-400" />
                  <StatCard label="Youth (0-17)" value={formatNumber(selectedDistrict.youthPopulation)} color="text-blue-400" />
                  <StatCard label="Elderly (60+)" value={formatNumber(selectedDistrict.elderlyPopulation)} color="text-orange-400" />
                  <StatCard label="Households" value={formatNumber(selectedDistrict.numberOfHouseholds)} color="text-purple-400" />
                  <StatCard label="Parishes" value={selectedDistrict.parishCount.toString()} />
                </div>
                <div className="pt-3 border-t border-gray-700">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Gender Split</span>
                    <span className="text-white">
                      {formatPercent(selectedDistrict.malePopulation, selectedDistrict.totalPopulation)} M / {formatPercent(selectedDistrict.femalePopulation, selectedDistrict.totalPopulation)} F
                    </span>
                  </div>
                  <div className="flex justify-between text-sm mt-1">
                    <span className="text-gray-400">Voting Age %</span>
                    <span className="text-green-400 font-medium">
                      {formatPercent(selectedDistrict.votingAgePopulation, selectedDistrict.totalPopulation)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Compare Panel */}
          {isCompareMode && selectedDistrict && compareDistrict && (
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-gray-800/95 backdrop-blur-sm rounded-lg shadow-lg border border-gray-700 z-10">
              <div className="p-4 border-b border-gray-700 flex justify-between items-center">
                <h3 className="font-bold text-white">Region Comparison</h3>
                <button
                  onClick={() => { setSelectedDistrict(null); setCompareDistrict(null); }}
                  className="text-gray-400 hover:text-white"
                >
                  ✕
                </button>
              </div>
              <div className="p-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-400">
                      <th className="text-left py-2">Metric</th>
                      <th className="text-right py-2 text-blue-400">{selectedDistrict.districtName}</th>
                      <th className="text-right py-2 text-green-400">{compareDistrict.districtName}</th>
                    </tr>
                  </thead>
                  <tbody className="text-white">
                    <CompareRow label="Population" a={selectedDistrict.totalPopulation} b={compareDistrict.totalPopulation} />
                    <CompareRow label="Voting Age" a={selectedDistrict.votingAgePopulation} b={compareDistrict.votingAgePopulation} />
                    <CompareRow label="Youth" a={selectedDistrict.youthPopulation} b={compareDistrict.youthPopulation} />
                    <CompareRow label="Elderly" a={selectedDistrict.elderlyPopulation} b={compareDistrict.elderlyPopulation} />
                    <CompareRow label="Households" a={selectedDistrict.numberOfHouseholds} b={compareDistrict.numberOfHouseholds} />
                    <CompareRow
                      label="Voting %"
                      a={(selectedDistrict.votingAgePopulation / selectedDistrict.totalPopulation) * 100}
                      b={(compareDistrict.votingAgePopulation / compareDistrict.totalPopulation) * 100}
                      isPercent
                    />
                    <CompareRow
                      label="Male %"
                      a={(selectedDistrict.malePopulation / selectedDistrict.totalPopulation) * 100}
                      b={(compareDistrict.malePopulation / compareDistrict.totalPopulation) * 100}
                      isPercent
                    />
                  </tbody>
                </table>
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
      <div className={`font-bold ${color}`}>{value}</div>
    </div>
  );
}

function CompareRow({ label, a, b, isPercent = false }: { label: string; a: number; b: number; isPercent?: boolean }) {
  const diff = a - b;
  const aWins = diff > 0;

  return (
    <tr className="border-t border-gray-700">
      <td className="py-2 text-gray-400">{label}</td>
      <td className={`text-right py-2 ${aWins ? 'text-blue-400 font-medium' : ''}`}>
        {isPercent ? `${a.toFixed(1)}%` : a.toLocaleString()}
      </td>
      <td className={`text-right py-2 ${!aWins ? 'text-green-400 font-medium' : ''}`}>
        {isPercent ? `${b.toFixed(1)}%` : b.toLocaleString()}
      </td>
    </tr>
  );
}

export default DemographicsDashboard;
