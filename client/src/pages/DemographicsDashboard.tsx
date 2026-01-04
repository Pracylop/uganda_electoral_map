import { useState, useEffect, useRef, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import MapComponent from '../components/Map';
import { api } from '../lib/api';
import 'maplibre-gl/dist/maplibre-gl.css';

type DemographicMetric = 'population' | 'votingAge' | 'votingAgePercent' | 'malePercent';
type InteractionMode = 'stats' | 'drilldown';

// Admin levels: 1=Subregion, 2=District, 3=Constituency, 4=Subcounty, 5=Parish
const LEVEL_NAMES: Record<number, string> = {
  1: 'Subregion',
  2: 'District',
  3: 'Constituency',
  4: 'Subcounty',
  5: 'Parish',
};

interface BreadcrumbItem {
  id: number;
  name: string;
  level: number;
}

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

// Cache key generator for GeoJSON data
function getCacheKey(level: number, parentId: number | null): string {
  return `demographics-${level}-${parentId ?? 'null'}`;
}

// Type for cached data
interface CachedMapData {
  geojson: GeoJSON.FeatureCollection;
  bbox?: [number, number, number, number];
}

export function DemographicsDashboard() {
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [metric, setMetric] = useState<DemographicMetric>('population');
  const [nationalStats, setNationalStats] = useState<NationalStats | null>(null);
  const [isLoadingChoropleth, setIsLoadingChoropleth] = useState(false);

  // In-memory cache for GeoJSON data (persists for session)
  const dataCache = useRef<Map<string, CachedMapData>>(new Map());

  // UI states
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [interactionMode, setInteractionMode] = useState<InteractionMode>('stats');

  // Drill-down state
  const [currentLevel, setCurrentLevel] = useState(2); // Start at district level
  const [parentId, setParentId] = useState<number | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([]);

  // Selected unit for stats
  const [selectedUnit, setSelectedUnit] = useState<UnitStats | null>(null);
  const [compareUnit, setCompareUnit] = useState<UnitStats | null>(null);
  const [isComparing, setIsComparing] = useState(false);

  // Load national stats
  useEffect(() => {
    api.getDemographicsStats()
      .then((data) => {
        setNationalStats(data.national);
      })
      .catch((err) => console.error('Failed to load demographics:', err));
  }, []);

  // Handle map load
  const handleMapLoad = useCallback((map: maplibregl.Map) => {
    mapRef.current = map;
    setMapLoaded(true);
  }, []);

  // Load choropleth for current level (with caching)
  const loadChoropleth = useCallback(async () => {
    if (!mapRef.current || !mapLoaded) return;
    const map = mapRef.current;

    const cacheKey = getCacheKey(currentLevel, parentId);
    const cached = dataCache.current.get(cacheKey);

    let geojson: GeoJSON.FeatureCollection;
    let bbox: [number, number, number, number] | undefined;

    // Remove existing layers
    try {
      ['demographics-fill', 'demographics-line'].forEach(layerId => {
        if (map.getLayer(layerId)) map.removeLayer(layerId);
      });
      if (map.getSource('demographics')) map.removeSource('demographics');
    } catch (e) {
      // Layers may not exist
    }

    if (cached) {
      // Use cached data - no loading indicator needed (instant response)
      console.log('Demographics: Using cached data for', cacheKey);
      geojson = cached.geojson;
      bbox = cached.bbox;
    } else {
      // Fetch from API - show loading indicator
      console.log('Demographics: Fetching from API', { currentLevel, parentId });
      setIsLoadingChoropleth(true);

      try {
        const data = await api.getDemographicsGeoJSON({
          level: currentLevel,
          parentId: parentId || undefined,
        });

        if (!data || !data.features || data.features.length === 0) {
          console.error('No data for this level');
          setIsLoadingChoropleth(false);
          return;
        }

        geojson = data as GeoJSON.FeatureCollection;

        // Calculate bbox for caching
        const bounds = new maplibregl.LngLatBounds();
        data.features.forEach((feature: any) => {
          if (feature.geometry?.coordinates) {
            const addCoords = (coords: any) => {
              if (typeof coords[0] === 'number') {
                bounds.extend(coords as [number, number]);
              } else {
                coords.forEach(addCoords);
              }
            };
            addCoords(feature.geometry.coordinates);
          }
        });
        if (!bounds.isEmpty()) {
          bbox = [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()];
        }

        // Store in cache for future use
        dataCache.current.set(cacheKey, { geojson, bbox });
        console.log('Demographics: Cached data for', cacheKey, '- features:', geojson.features?.length || 0);
      } catch (err) {
        console.error('Failed to load demographics choropleth:', err);
        setIsLoadingChoropleth(false);
        return;
      }
    }

    // Add source and layers (whether from cache or fresh fetch)
    map.addSource('demographics', {
      type: 'geojson',
      data: geojson,
    });

    // Build color expression for current metric
    const colorProperty = metric === 'votingAgePercent' ? 'votingAgePercent' :
                         metric === 'votingAge' ? 'votingAgePopulation' :
                         metric === 'malePercent' ? 'malePercent' : 'totalPopulation';
    const scale = colorScales[metric];
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

    // Fit bounds with smooth animation
    const animationOptions = {
      padding: 50,
      duration: 1000,
      essential: true,
    };

    if (bbox) {
      map.fitBounds([[bbox[0], bbox[1]], [bbox[2], bbox[3]]], animationOptions);
    }

    // Hover cursor (add only once by checking if handler exists)
    map.on('mouseenter', 'demographics-fill', () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', 'demographics-fill', () => {
      map.getCanvas().style.cursor = '';
    });

    setIsLoadingChoropleth(false);

    // Pre-fetch child level data in the background for instant drill-down
    if (currentLevel < 5) {
      prefetchChildData(geojson.features, currentLevel + 1);
    }
  }, [mapLoaded, currentLevel, parentId, metric]);

  // Pre-fetch child data for all visible units (background, no loading indicator)
  const prefetchChildData = useCallback(async (
    features: GeoJSON.Feature[],
    childLevel: number
  ) => {
    console.log(`Demographics: Pre-fetching level ${childLevel} data for ${features.length} units`);

    // Process in small batches to avoid overwhelming the server
    const BATCH_SIZE = 10;
    const BATCH_DELAY = 100; // ms between batches

    for (let i = 0; i < features.length; i += BATCH_SIZE) {
      const batch = features.slice(i, i + BATCH_SIZE);

      // Fetch batch in parallel
      await Promise.all(batch.map(async (feature) => {
        const unitId = feature.properties?.id;
        if (!unitId) return;

        const cacheKey = getCacheKey(childLevel, unitId);

        // Skip if already cached
        if (dataCache.current.has(cacheKey)) {
          return;
        }

        try {
          const data = await api.getDemographicsGeoJSON({
            level: childLevel,
            parentId: unitId,
          });

          if (data && data.features && data.features.length > 0) {
            const geojson = data as GeoJSON.FeatureCollection;

            // Calculate bbox
            const bounds = new maplibregl.LngLatBounds();
            data.features.forEach((f: any) => {
              if (f.geometry?.coordinates) {
                const addCoords = (coords: any) => {
                  if (typeof coords[0] === 'number') {
                    bounds.extend(coords as [number, number]);
                  } else {
                    coords.forEach(addCoords);
                  }
                };
                addCoords(f.geometry.coordinates);
              }
            });

            const bbox: [number, number, number, number] | undefined = !bounds.isEmpty()
              ? [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()]
              : undefined;

            dataCache.current.set(cacheKey, { geojson, bbox });
            console.log(`Demographics: Pre-cached ${cacheKey} (${geojson.features.length} features)`);
          }
        } catch (err) {
          // Silent fail for pre-fetch - will be fetched on demand if needed
          console.warn(`Demographics: Pre-fetch failed for ${cacheKey}`);
        }
      }));

      // Small delay between batches
      if (i + BATCH_SIZE < features.length) {
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
      }
    }

    console.log(`Demographics: Pre-fetch complete for level ${childLevel}`);
  }, []);

  // Load choropleth when level/parent changes
  useEffect(() => {
    loadChoropleth();
  }, [loadChoropleth]);

  // Handle map clicks
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    const map = mapRef.current;

    const handleClick = (e: maplibregl.MapLayerMouseEvent) => {
      if (!e.features || e.features.length === 0) return;
      const props = e.features[0].properties;
      if (!props) return;

      const unitStats: UnitStats = {
        id: props.id,
        name: props.name,
        level: props.level || currentLevel,
        totalPopulation: props.totalPopulation || 0,
        malePopulation: props.malePopulation || 0,
        femalePopulation: props.femalePopulation || 0,
        votingAgePopulation: props.votingAgePopulation || 0,
        youthPopulation: props.youthPopulation || 0,
        elderlyPopulation: props.elderlyPopulation || 0,
        numberOfHouseholds: props.numberOfHouseholds || 0,
        parishCount: props.parishCount || 0,
      };

      if (interactionMode === 'stats') {
        if (isComparing && selectedUnit) {
          setCompareUnit(unitStats);
        } else {
          setSelectedUnit(unitStats);
          setSidebarOpen(true);
        }
      } else {
        // Drill-down mode
        if (currentLevel < 5) { // Can drill down until parish level
          // Add to breadcrumbs
          setBreadcrumbs(prev => [...prev, {
            id: props.id,
            name: props.name,
            level: currentLevel,
          }]);
          setParentId(props.id);
          setCurrentLevel(currentLevel + 1);
          setSelectedUnit(null);
          setCompareUnit(null);
        }
      }
    };

    map.on('click', 'demographics-fill', handleClick);
    return () => {
      map.off('click', 'demographics-fill', handleClick);
    };
  }, [mapLoaded, interactionMode, isComparing, selectedUnit, currentLevel]);

  // Update colors when metric changes (without reloading data)
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
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
      // Layer might not exist yet
    }
  }, [metric, mapLoaded]);

  // Navigation functions
  const goBack = () => {
    if (breadcrumbs.length > 0) {
      const newBreadcrumbs = [...breadcrumbs];
      newBreadcrumbs.pop();
      setBreadcrumbs(newBreadcrumbs);

      if (newBreadcrumbs.length === 0) {
        setParentId(null);
        setCurrentLevel(2);
      } else {
        const lastCrumb = newBreadcrumbs[newBreadcrumbs.length - 1];
        setParentId(lastCrumb.id);
        setCurrentLevel(lastCrumb.level + 1);
      }
      setSelectedUnit(null);
      setCompareUnit(null);
    }
  };

  const goToLevel = (index: number) => {
    if (index === -1) {
      // Go to national (district) level
      setBreadcrumbs([]);
      setParentId(null);
      setCurrentLevel(2);
    } else {
      const newBreadcrumbs = breadcrumbs.slice(0, index + 1);
      setBreadcrumbs(newBreadcrumbs);
      const crumb = newBreadcrumbs[newBreadcrumbs.length - 1];
      setParentId(crumb.id);
      setCurrentLevel(crumb.level + 1);
    }
    setSelectedUnit(null);
    setCompareUnit(null);
  };

  const formatNumber = (n: number) => n.toLocaleString();
  const formatPercent = (n: number, total: number) => total > 0 ? ((n / total) * 100).toFixed(1) + '%' : '0%';
  const scale = colorScales[metric];

  const clearSelection = () => {
    setSelectedUnit(null);
    setCompareUnit(null);
    setIsComparing(false);
  };

  const startComparison = () => {
    if (selectedUnit) {
      setIsComparing(true);
      setCompareUnit(null);
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
            {selectedUnit ? (
              // Unit Stats View
              <div className="flex-1 overflow-y-auto">
                <div className="p-4 border-b border-gray-700">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h2 className="text-lg font-bold text-white">{selectedUnit.name}</h2>
                      <p className="text-xs text-gray-400">{LEVEL_NAMES[selectedUnit.level]} Statistics</p>
                    </div>
                    <button
                      onClick={clearSelection}
                      className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <StatCard label="Population" value={formatNumber(selectedUnit.totalPopulation)} />
                    <StatCard label="Voting Age" value={formatNumber(selectedUnit.votingAgePopulation)} color="text-green-400" />
                    <StatCard label="Youth (0-17)" value={formatNumber(selectedUnit.youthPopulation)} color="text-blue-400" />
                    <StatCard label="Elderly (60+)" value={formatNumber(selectedUnit.elderlyPopulation)} color="text-orange-400" />
                    <StatCard label="Households" value={formatNumber(selectedUnit.numberOfHouseholds)} color="text-purple-400" />
                    {selectedUnit.level < 5 && (
                      <StatCard label="Parishes" value={selectedUnit.parishCount.toString()} />
                    )}
                  </div>

                  <div className="mt-3 pt-3 border-t border-gray-700 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Gender Split</span>
                      <span className="text-white">
                        {formatPercent(selectedUnit.malePopulation, selectedUnit.totalPopulation)} M / {formatPercent(selectedUnit.femalePopulation, selectedUnit.totalPopulation)} F
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Voting Age %</span>
                      <span className="text-green-400 font-medium">
                        {formatPercent(selectedUnit.votingAgePopulation, selectedUnit.totalPopulation)}
                      </span>
                    </div>
                  </div>

                  {!isComparing && (
                    <button
                      onClick={startComparison}
                      className="mt-4 w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-medium transition-colors"
                    >
                      Compare with another {LEVEL_NAMES[currentLevel].toLowerCase()}
                    </button>
                  )}
                </div>

                {isComparing && (
                  <div className="p-4 border-b border-gray-700 bg-gray-750">
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="text-sm font-semibold text-white">Comparison Mode</h3>
                      <button
                        onClick={() => { setIsComparing(false); setCompareUnit(null); }}
                        className="text-xs text-gray-400 hover:text-white"
                      >
                        Cancel
                      </button>
                    </div>

                    {compareUnit ? (
                      <div className="space-y-2">
                        <div className="text-sm text-gray-400 mb-2">
                          <span className="text-blue-400">{selectedUnit.name}</span>
                          {' vs '}
                          <span className="text-green-400">{compareUnit.name}</span>
                        </div>
                        <CompareTable a={selectedUnit} b={compareUnit} />
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400">
                        Click on another {LEVEL_NAMES[currentLevel].toLowerCase()} to compare
                      </p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              // National/Current Level Stats View
              <>
                {nationalStats && breadcrumbs.length === 0 && (
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

                {breadcrumbs.length > 0 && (
                  <div className="p-4 border-b border-gray-700">
                    <h2 className="text-sm font-semibold text-gray-300 mb-2">
                      Viewing: {LEVEL_NAMES[currentLevel]}s
                    </h2>
                    <p className="text-xs text-gray-400">
                      in {breadcrumbs[breadcrumbs.length - 1].name}
                    </p>
                  </div>
                )}

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

                <div className="p-4 text-sm text-gray-400">
                  <p>Showing: {LEVEL_NAMES[currentLevel]}s</p>
                  <p className="text-xs mt-1">
                    {interactionMode === 'stats' ? 'Click to view statistics' : 'Click to drill down'}
                  </p>
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
            {!sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-2 hover:bg-gray-700 rounded text-gray-400 hover:text-white"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            )}

            {/* Back button */}
            {breadcrumbs.length > 0 && (
              <button
                onClick={goBack}
                className="p-2 hover:bg-gray-700 rounded text-gray-400 hover:text-white"
                title="Go back"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}

            {/* Breadcrumbs */}
            <div className="flex items-center gap-1 text-sm">
              <button
                onClick={() => goToLevel(-1)}
                className={`px-2 py-1 rounded ${breadcrumbs.length === 0 ? 'text-white font-medium' : 'text-gray-400 hover:text-white'}`}
              >
                Uganda
              </button>
              {breadcrumbs.map((crumb, index) => (
                <span key={crumb.id} className="flex items-center">
                  <span className="text-gray-600 mx-1">›</span>
                  <button
                    onClick={() => goToLevel(index)}
                    className={`px-2 py-1 rounded ${
                      index === breadcrumbs.length - 1 ? 'text-white font-medium' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {crumb.name}
                  </button>
                </span>
              ))}
            </div>

            {/* Interaction Mode Toggle */}
            <div className="flex bg-gray-700 rounded-lg p-0.5 ml-4">
              <button
                onClick={() => setInteractionMode('stats')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  interactionMode === 'stats' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                View Stats
              </button>
              <button
                onClick={() => setInteractionMode('drilldown')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  interactionMode === 'drilldown' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                Drill Down
              </button>
            </div>

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
            <span className="text-sm text-gray-400">
              {LEVEL_NAMES[currentLevel]}s
              {currentLevel === 5 && ' (lowest level)'}
            </span>
          </div>
        </div>

        {/* Map */}
        <div className="flex-1 relative">
          <MapComponent onLoad={handleMapLoad} className="absolute inset-0" />

          {isLoadingChoropleth && (
            <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
              <div className="bg-gray-800/90 backdrop-blur-sm rounded-lg px-6 py-3 flex items-center gap-3 shadow-lg border border-gray-700">
                <div className="w-5 h-5 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-white">Loading {LEVEL_NAMES[currentLevel].toLowerCase()} data...</span>
              </div>
            </div>
          )}

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

function StatCard({ label, value, color = 'text-white' }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-gray-700/50 rounded p-2">
      <div className="text-xs text-gray-400">{label}</div>
      <div className={`font-bold text-sm ${color}`}>{value}</div>
    </div>
  );
}

function CompareTable({ a, b }: { a: UnitStats; b: UnitStats }) {
  const formatNum = (n: number) => n.toLocaleString();
  const formatPct = (n: number, t: number) => t > 0 ? ((n / t) * 100).toFixed(1) + '%' : '0%';

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
