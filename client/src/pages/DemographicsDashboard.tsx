import { useState, useEffect, useRef, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import MapComponent from '../components/Map';
import { MapSettingsWidget } from '../components/MapSettingsWidget';
import { useEffectiveBasemap } from '../hooks/useOnlineStatus';
import { api } from '../lib/api';
// cacheService removed - using static boundaries
import { boundaryService } from '../lib/boundaryService';
import 'maplibre-gl/dist/maplibre-gl.css';

type DemographicMetric = 'population' | 'votingAge' | 'votingAgePercent' | 'malePercent';
type InteractionMode = 'stats' | 'drilldown';
type ViewMode = 'map' | 'statistics';

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

// Helper to calculate bbox from features
function calculateBbox(features: GeoJSON.Feature[]): [number, number, number, number] | undefined {
  const bounds = new maplibregl.LngLatBounds();
  features.forEach((f: any) => {
    if (f.geometry?.coordinates) {
      const addCoords = (coords: any) => {
        if (typeof coords[0] === 'number') bounds.extend(coords as [number, number]);
        else coords.forEach(addCoords);
      };
      addCoords(f.geometry.coordinates);
    }
  });
  return !bounds.isEmpty()
    ? [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()]
    : undefined;
}

// Calculate min/max values from features for a given property
function calculateDataRange(features: GeoJSON.Feature[], property: string): { min: number; max: number } {
  let min = Infinity;
  let max = -Infinity;

  features.forEach(f => {
    const value = f.properties?.[property];
    if (typeof value === 'number' && value > 0) {
      min = Math.min(min, value);
      max = Math.max(max, value);
    }
  });

  if (min === Infinity) min = 0;
  if (max === -Infinity) max = 100;
  if (min === max) max = min + 1;

  return { min, max };
}

// Generate evenly spaced stops between min and max
function generateDynamicStops(min: number, max: number, numStops: number): number[] {
  const range = max - min;
  return Array.from({ length: numStops }, (_, i) =>
    Math.round(min + (range * i) / (numStops - 1))
  );
}

// Format large numbers compactly
function formatCompactNumber(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  return n.toString();
}

// Point-in-polygon check using ray casting algorithm
function pointInPolygon(point: [number, number], geometry: GeoJSON.Geometry): boolean {
  const [x, y] = point;

  try {
    if (geometry.type === 'MultiPolygon') {
      return geometry.coordinates.some(polygonCoords => {
        const ring = polygonCoords?.[0];
        if (!ring || !Array.isArray(ring) || ring.length < 3) return false;
        return pointInRing(x, y, ring);
      });
    } else if (geometry.type === 'Polygon') {
      const ring = geometry.coordinates?.[0];
      if (!ring || !Array.isArray(ring) || ring.length < 3) return false;
      return pointInRing(x, y, ring);
    }
    return false;
  } catch (e) {
    return false;
  }
}

function pointInRing(x: number, y: number, ring: number[][]): boolean {
  if (!ring || ring.length < 3) return false;

  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const coord_i = ring[i];
    const coord_j = ring[j];
    if (!coord_i || !coord_j) continue;

    const xi = coord_i[0], yi = coord_i[1];
    const xj = coord_j[0], yj = coord_j[1];

    if (xi === undefined || yi === undefined || xj === undefined || yj === undefined) continue;

    const intersect = ((yi > y) !== (yj > y)) &&
      (x < (xj - xi) * (y - yi) / (yj - yi) + xi);

    if (intersect) inside = !inside;
  }
  return inside;
}

export function DemographicsDashboard() {
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [metric, setMetric] = useState<DemographicMetric>('population');

  // Track basemap changes to reload map data when basemap changes
  const effectiveBasemap = useEffectiveBasemap();
  const prevBasemapRef = useRef<string | null>(null);

  // Navigation popup ref for basemap click feedback
  const navigationPopupRef = useRef<maplibregl.Popup | null>(null);

  const [nationalStats, setNationalStats] = useState<NationalStats | null>(null);
  const [isLoadingChoropleth, setIsLoadingChoropleth] = useState(false);

  // Dynamic scale state - updates based on displayed data range
  const [currentScale, setCurrentScale] = useState<{ stops: number[]; colors: string[] }>({
    stops: colorScales.population.stops,
    colors: colorScales.population.colors,
  });

  // UI states
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [interactionMode, setInteractionMode] = useState<InteractionMode>('stats');
  const [viewMode, setViewMode] = useState<ViewMode>('map');

  // Statistics view state
  const [districtStats, setDistrictStats] = useState<UnitStats[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<keyof UnitStats>('totalPopulation');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Drill-down state
  const [currentLevel, setCurrentLevel] = useState(2); // Start at district level
  const [parentId, setParentId] = useState<number | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([]);

  // Selected unit for stats
  const [selectedUnit, setSelectedUnit] = useState<UnitStats | null>(null);
  const [compareUnit, setCompareUnit] = useState<UnitStats | null>(null);
  const [isComparing, setIsComparing] = useState(false);

  // Load national stats and district data
  useEffect(() => {
    api.getDemographicsStats()
      .then((data) => {
        setNationalStats(data.national);
        // Transform district data to UnitStats format
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
      })
      .catch((err) => console.error('Failed to load demographics:', err));
  }, []);

  // Handle map load
  const handleMapLoad = useCallback((map: maplibregl.Map) => {
    mapRef.current = map;
    setMapLoaded(true);
  }, []);

  // Detect basemap changes and reset map loaded state to trigger reload
  useEffect(() => {
    if (prevBasemapRef.current !== null && prevBasemapRef.current !== effectiveBasemap) {
      // Basemap changed - reset loaded state to trigger reload when map recreates
      setMapLoaded(false);
    }
    prevBasemapRef.current = effectiveBasemap;
  }, [effectiveBasemap]);

  // Pre-load state - tracks which levels are loaded
  const [preloadProgress, setPreloadProgress] = useState({ loading: false, levelsLoaded: new Set<number>() });

  // Pre-load all boundaries (single static file now loads all 6 levels)
  const preloadAllLevels = useCallback(async () => {
    if (preloadProgress.loading || preloadProgress.levelsLoaded.size > 0) return;

    setPreloadProgress({ loading: true, levelsLoaded: new Set() });
    console.log('Demographics: Loading static boundaries...');

    try {
      // Single call loads all 6 levels from static file
      await boundaryService.loadStaticBoundaries();
      const stats = boundaryService.getStats();
      console.log('Demographics: Static boundaries loaded', stats);

      // Mark all levels as loaded
      setPreloadProgress({
        loading: false,
        levelsLoaded: new Set([2, 3, 4, 5]),
      });
    } catch (err) {
      console.error('Demographics: Failed to load boundaries:', err);
      setPreloadProgress(prev => ({ ...prev, loading: false }));
    }

    console.log(`Demographics: Pre-load complete!`);
  }, [preloadProgress.loading, preloadProgress.levelsLoaded.size]);

  // Load choropleth for current level (using boundary/data separation)
  const loadChoropleth = useCallback(async () => {
    if (!mapRef.current || !mapLoaded) return;
    const map = mapRef.current;

    // Remove existing layers
    try {
      ['demographics-fill', 'demographics-line'].forEach(layerId => {
        if (map.getLayer(layerId)) map.removeLayer(layerId);
      });
      if (map.getSource('demographics')) map.removeSource('demographics');
    } catch (e) {
      // Layers may not exist
    }

    setIsLoadingChoropleth(true);

    let displayData: GeoJSON.FeatureCollection;
    let bbox: [number, number, number, number] | undefined;

    try {
      // Step 1: Ensure boundaries are loaded (single static file)
      await boundaryService.loadStaticBoundaries();

      // Step 2: Fetch demographics DATA only (tiny ~30KB payload vs 100MB+)
      const response = await api.getDemographicsData({
        level: currentLevel,
        parentId: parentId ?? undefined
      });

      // Step 3: Build parent filter from breadcrumbs (for static boundaries)
      const parentItem = breadcrumbs.length > 0 ? breadcrumbs[breadcrumbs.length - 1] : null;
      const parentFilter = parentItem
        ? { level: parentItem.level, name: parentItem.name }
        : null;

      // Step 4: Join boundaries with data (instant, client-side)
      displayData = boundaryService.createGeoJSON(currentLevel, response.data, parentFilter);

      // Calculate bbox from features
      bbox = calculateBbox(displayData.features);

      console.log(`Demographics: Joined ${displayData.features.length} features at level ${currentLevel}`);
    } catch (err) {
      console.error('Failed to load demographics choropleth:', err);
      setIsLoadingChoropleth(false);
      return;
    }

    if (displayData.features.length === 0) {
      console.warn('No features to display');
      setIsLoadingChoropleth(false);
      return;
    }

    // Add source and layers (whether from cache or fresh fetch)
    map.addSource('demographics', {
      type: 'geojson',
      data: displayData,
    });

    // Build color expression for current metric with DYNAMIC scale
    const colorProperty = metric === 'votingAgePercent' ? 'votingAgePercent' :
                         metric === 'votingAge' ? 'votingAgePopulation' :
                         metric === 'malePercent' ? 'malePercent' : 'totalPopulation';

    // Get base colors for this metric
    const baseColors = colorScales[metric].colors;

    // For percentage metrics, use fixed scales; for absolute metrics, use dynamic scales
    let dynamicStops: number[];
    if (metric === 'votingAgePercent' || metric === 'malePercent') {
      // Percentage metrics - use fixed scale
      dynamicStops = colorScales[metric].stops;
    } else {
      // Absolute metrics (population, votingAge) - calculate dynamic scale from data
      const { min, max } = calculateDataRange(displayData.features, colorProperty);
      dynamicStops = generateDynamicStops(min, max, baseColors.length);
    }

    // Update the scale state for legends
    setCurrentScale({ stops: dynamicStops, colors: baseColors });

    const colorExpr: any[] = ['interpolate', ['linear'], ['get', colorProperty]];
    for (let i = 0; i < dynamicStops.length; i++) {
      colorExpr.push(dynamicStops[i], baseColors[i]);
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

    // Close navigation popup after map finishes rendering
    if (navigationPopupRef.current) {
      const closePopup = () => {
        if (navigationPopupRef.current) {
          navigationPopupRef.current.remove();
          navigationPopupRef.current = null;
        }
        map.off('idle', closePopup);
      };
      map.once('idle', closePopup);
    }

    // Trigger pre-load of all other levels after initial district load
    if (currentLevel === 2 && parentId === null) {
      preloadAllLevels();
    }
  }, [mapLoaded, currentLevel, parentId, metric, breadcrumbs, preloadAllLevels]);

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

  // Navigate directly to a district (resets stack and shows constituencies)
  const navigateToDistrict = useCallback((districtId: number, districtName: string) => {
    setBreadcrumbs([{ id: districtId, name: districtName, level: 2 }]);
    setParentId(districtId);
    setCurrentLevel(3); // Show constituencies
    setSelectedUnit(null);
    setCompareUnit(null);
    setIsComparing(false);
  }, []);

  // Basemap click handler - navigate to district when clicking outside choropleth
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    const map = mapRef.current;

    const handleBasemapClick = (e: maplibregl.MapMouseEvent) => {
      // Check if demographics layer exists
      const hasDemographicsLayer = map.getLayer('demographics-fill');

      // Check if click was on the choropleth layer
      let features: maplibregl.MapGeoJSONFeature[] = [];
      try {
        if (hasDemographicsLayer) {
          features = map.queryRenderedFeatures(e.point, {
            layers: ['demographics-fill']
          });
        }
      } catch (err) {
        // Layer may not exist
      }

      // If clicked on choropleth, let the other handler process it
      if (features && features.length > 0) {
        return;
      }

      // Click was on basemap - check district boundaries
      const { lng, lat } = e.lngLat;

      // Use boundaryService to get district boundaries
      if (!boundaryService.hasLevel(2)) {
        return; // District boundaries not loaded
      }

      const districtGeoJSON = boundaryService.getBoundariesGeoJSON(2);

      // Find which district contains the clicked point
      const clickedDistrict = districtGeoJSON.features.find(feature => {
        if (!feature.geometry) return false;
        return pointInPolygon([lng, lat], feature.geometry);
      });

      if (clickedDistrict && clickedDistrict.properties) {
        const { id, name } = clickedDistrict.properties as { id: number; name: string };

        // Close any existing navigation popup
        if (navigationPopupRef.current) {
          navigationPopupRef.current.remove();
        }

        // Show navigation popup
        navigationPopupRef.current = new maplibregl.Popup({ closeOnClick: true, closeButton: false })
          .setLngLat(e.lngLat)
          .setHTML(`<div style="padding: 8px; font-family: system-ui; color: #333;"><strong>Navigating to ${name}</strong></div>`)
          .addTo(map);

        // Navigate to the district
        navigateToDistrict(id, name);
      }
    };

    map.on('click', handleBasemapClick);
    return () => {
      map.off('click', handleBasemapClick);
      if (navigationPopupRef.current) {
        navigationPopupRef.current.remove();
      }
    };
  }, [mapLoaded, navigateToDistrict]);

  // Update colors when metric changes (without reloading data)
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    const map = mapRef.current;

    try {
      if (!map.getLayer('demographics-fill')) return;
      if (!map.getSource('demographics')) return;

      const colorProperty = metric === 'votingAgePercent' ? 'votingAgePercent' :
                           metric === 'votingAge' ? 'votingAgePopulation' :
                           metric === 'malePercent' ? 'malePercent' : 'totalPopulation';

      // Get base colors for this metric
      const baseColors = colorScales[metric].colors;

      // Get the current displayed data to calculate dynamic scale
      const source = map.getSource('demographics') as maplibregl.GeoJSONSource;
      const sourceData = (source as any)._data as GeoJSON.FeatureCollection;

      let dynamicStops: number[];
      if (metric === 'votingAgePercent' || metric === 'malePercent') {
        // Percentage metrics - use fixed scale
        dynamicStops = colorScales[metric].stops;
      } else if (sourceData?.features?.length > 0) {
        // Absolute metrics - calculate dynamic scale from current data
        const { min, max } = calculateDataRange(sourceData.features, colorProperty);
        dynamicStops = generateDynamicStops(min, max, baseColors.length);
      } else {
        // Fallback to fixed scale
        dynamicStops = colorScales[metric].stops;
      }

      // Update the scale state for legends
      setCurrentScale({ stops: dynamicStops, colors: baseColors });

      const colorExpr: any[] = ['interpolate', ['linear'], ['get', colorProperty]];
      for (let i = 0; i < dynamicStops.length; i++) {
        colorExpr.push(dynamicStops[i], baseColors[i]);
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

  // Statistics view helpers
  const handleSort = (field: keyof UnitStats) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
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

  // Select unit for comparison from statistics table
  const handleTableRowClick = (unit: UnitStats) => {
    if (isComparing && selectedUnit) {
      setCompareUnit(unit);
    } else {
      setSelectedUnit(unit);
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
                      {currentScale.colors.map((color, i) => (
                        <div key={i} className="flex-1" style={{ backgroundColor: color }} />
                      ))}
                    </div>
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>{metric.includes('Percent') ? `${currentScale.stops[0]}%` : formatCompactNumber(currentScale.stops[0])}</span>
                      <span>{metric.includes('Percent') ? `${currentScale.stops[currentScale.stops.length - 1]}%` : formatCompactNumber(currentScale.stops[currentScale.stops.length - 1])}</span>
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
            {/* View Mode Toggle */}
            <div className="flex bg-gray-700 rounded-lg p-0.5">
              <button
                onClick={() => setViewMode('map')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center gap-1.5 ${
                  viewMode === 'map' ? 'bg-green-600 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
                Map
              </button>
              <button
                onClick={() => setViewMode('statistics')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center gap-1.5 ${
                  viewMode === 'statistics' ? 'bg-green-600 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Statistics
              </button>
            </div>
            <span className="text-sm text-gray-400">
              {LEVEL_NAMES[currentLevel]}s
              {currentLevel === 5 && ' (lowest level)'}
            </span>
          </div>
        </div>

        {/* Main Content Area - Map or Statistics */}
        {viewMode === 'map' ? (
          <div className="flex-1 relative">
            <MapComponent onLoad={handleMapLoad} className="absolute inset-0" />

            {/* Map Settings Widget */}
            <MapSettingsWidget position="bottom-left" />

            {isLoadingChoropleth && (
              <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
                <div className="bg-gray-800/90 backdrop-blur-sm rounded-lg px-6 py-3 flex items-center gap-3 shadow-lg border border-gray-700">
                  <div className="w-5 h-5 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-white">Loading {LEVEL_NAMES[currentLevel].toLowerCase()} data...</span>
                </div>
              </div>
            )}

            {/* Pre-load progress indicator */}
            {preloadProgress.loading && (
              <div className="absolute top-4 right-4 z-20">
                <div className="bg-gray-800/95 backdrop-blur-sm rounded-lg px-4 py-3 shadow-lg border border-gray-700 min-w-48">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-sm text-white font-medium">Caching all levels...</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-green-500 h-2 rounded-full transition-all duration-150"
                      style={{ width: `${(preloadProgress.levelsLoaded.size / 4) * 100}%` }}
                    />
                  </div>
                  <div className="text-xs text-gray-400 mt-1 text-right">
                    {preloadProgress.levelsLoaded.size} / 4 levels
                  </div>
                </div>
              </div>
            )}

            {/* Ready indicator - brief flash when preload completes */}
            {!preloadProgress.loading && preloadProgress.levelsLoaded.size === 4 && (
              <div className="absolute top-4 right-4 z-20 animate-pulse">
                <div className="bg-green-600/90 backdrop-blur-sm rounded-lg px-4 py-2 shadow-lg border border-green-500">
                  <span className="text-sm text-white font-medium">Ready for instant navigation</span>
                </div>
              </div>
            )}

            {!sidebarOpen && (
              <div className="absolute bottom-4 left-4 bg-gray-800/90 backdrop-blur-sm rounded-lg p-3 z-10 border border-gray-700">
                <div className="text-xs text-gray-400 mb-1">{metricLabels[metric]}</div>
                <div className="flex h-2 w-32 rounded overflow-hidden">
                  {currentScale.colors.map((color, i) => (
                    <div key={i} className="flex-1" style={{ backgroundColor: color }} />
                  ))}
                </div>
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>{metric.includes('Percent') ? `${currentScale.stops[0]}%` : formatCompactNumber(currentScale.stops[0])}</span>
                  <span>{metric.includes('Percent') ? `${currentScale.stops[currentScale.stops.length - 1]}%` : formatCompactNumber(currentScale.stops[currentScale.stops.length - 1])}</span>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Statistics View */
          <div className="flex-1 overflow-hidden flex flex-col bg-gray-900">
            {/* Statistics Header */}
            <div className="p-4 border-b border-gray-700 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <h2 className="text-lg font-bold text-white">District Rankings</h2>
                <span className="text-sm text-gray-400">{filteredAndSortedData.length} districts</span>
              </div>
              <div className="flex items-center gap-3">
                {/* Search */}
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search districts..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-gray-800 text-white rounded-lg pl-9 pr-3 py-2 text-sm border border-gray-600 focus:border-blue-500 focus:outline-none w-64"
                  />
                  <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                {/* Quick action buttons */}
                {selectedUnit && (
                  <button
                    onClick={startComparison}
                    className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                      isComparing ? 'bg-yellow-600 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'
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
              </div>
            </div>

            {/* Comparison Panel (when comparing) */}
            {selectedUnit && compareUnit && (
              <div className="p-4 bg-gray-800 border-b border-gray-700">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-white">
                    Comparing: <span className="text-blue-400">{selectedUnit.name}</span> vs <span className="text-green-400">{compareUnit.name}</span>
                  </h3>
                </div>
                <ComparisonBars a={selectedUnit} b={compareUnit} />
              </div>
            )}

            {/* Statistics Table */}
            <div className="flex-1 overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-800 sticky top-0">
                  <tr>
                    <th className="text-left py-3 px-4 text-gray-400 font-medium w-12">#</th>
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">District</th>
                    <SortableHeader field="totalPopulation" label="Population" current={sortField} direction={sortDirection} onSort={handleSort} />
                    <SortableHeader field="votingAgePopulation" label="Voting Age" current={sortField} direction={sortDirection} onSort={handleSort} />
                    <SortableHeader field="youthPopulation" label="Youth (0-17)" current={sortField} direction={sortDirection} onSort={handleSort} />
                    <SortableHeader field="elderlyPopulation" label="Elderly (60+)" current={sortField} direction={sortDirection} onSort={handleSort} />
                    <SortableHeader field="numberOfHouseholds" label="Households" current={sortField} direction={sortDirection} onSort={handleSort} />
                    <th className="text-left py-3 px-4 text-gray-400 font-medium w-48">Population Bar</th>
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
                          isSelected ? 'bg-blue-900/30' : isCompare ? 'bg-green-900/30' : 'hover:bg-gray-800/50'
                        }`}
                      >
                        <td className="py-3 px-4 text-gray-500">{index + 1}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <span className={`font-medium ${isSelected ? 'text-blue-400' : isCompare ? 'text-green-400' : 'text-white'}`}>
                              {unit.name}
                            </span>
                            {isSelected && <span className="text-xs bg-blue-600 px-1.5 py-0.5 rounded">Selected</span>}
                            {isCompare && <span className="text-xs bg-green-600 px-1.5 py-0.5 rounded">Compare</span>}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-white font-medium">{formatNumber(unit.totalPopulation)}</td>
                        <td className="py-3 px-4 text-green-400">{formatNumber(unit.votingAgePopulation)}</td>
                        <td className="py-3 px-4 text-blue-400">{formatNumber(unit.youthPopulation)}</td>
                        <td className="py-3 px-4 text-orange-400">{formatNumber(unit.elderlyPopulation)}</td>
                        <td className="py-3 px-4 text-purple-400">{formatNumber(unit.numberOfHouseholds)}</td>
                        <td className="py-3 px-4">
                          <div className="w-full bg-gray-700 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full transition-all ${isSelected ? 'bg-blue-500' : isCompare ? 'bg-green-500' : 'bg-yellow-500'}`}
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
              <div className="p-4 bg-gray-800 border-t border-gray-700 flex items-center justify-between">
                <div className="flex items-center gap-6 text-sm">
                  <div>
                    <span className="text-gray-400">National Total: </span>
                    <span className="text-white font-bold">{(nationalStats.totalPopulation / 1000000).toFixed(1)}M</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Voting Age: </span>
                    <span className="text-green-400 font-bold">{(nationalStats.votingAgePopulation / 1000000).toFixed(1)}M</span>
                    <span className="text-gray-500 ml-1">({formatPercent(nationalStats.votingAgePopulation, nationalStats.totalPopulation)})</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Gender: </span>
                    <span className="text-white">{formatPercent(nationalStats.malePopulation, nationalStats.totalPopulation)} M</span>
                    <span className="text-gray-500"> / </span>
                    <span className="text-white">{formatPercent(nationalStats.femalePopulation, nationalStats.totalPopulation)} F</span>
                  </div>
                </div>
                <div className="text-xs text-gray-500">
                  2024 Census Data
                </div>
              </div>
            )}
          </div>
        )}
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

// Sortable table header component
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
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </div>
    </th>
  );
}

// Visual comparison bars component
function ComparisonBars({ a, b }: { a: UnitStats; b: UnitStats }) {
  const formatNum = (n: number) => n.toLocaleString();

  const metrics = [
    { label: 'Total Population', aVal: a.totalPopulation, bVal: b.totalPopulation, color: 'bg-yellow-500' },
    { label: 'Voting Age (18+)', aVal: a.votingAgePopulation, bVal: b.votingAgePopulation, color: 'bg-green-500' },
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
              <span className="text-xs text-blue-400 w-16 truncate">{a.name}</span>
              <div className="flex-1 bg-gray-600 rounded-full h-3 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${aWins ? color : 'bg-gray-500'}`}
                  style={{ width: `${aPercent}%` }}
                />
              </div>
              <span className={`text-xs w-20 text-right ${aWins ? 'text-white font-medium' : 'text-gray-400'}`}>
                {formatNum(aVal)}
              </span>
            </div>

            {/* B bar */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-green-400 w-16 truncate">{b.name}</span>
              <div className="flex-1 bg-gray-600 rounded-full h-3 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${!aWins ? color : 'bg-gray-500'}`}
                  style={{ width: `${bPercent}%` }}
                />
              </div>
              <span className={`text-xs w-20 text-right ${!aWins ? 'text-white font-medium' : 'text-gray-400'}`}>
                {formatNum(bVal)}
              </span>
            </div>

            {/* Difference */}
            <div className="mt-2 text-xs text-center">
              <span className={aWins ? 'text-blue-400' : 'text-green-400'}>
                {aWins ? a.name : b.name}
              </span>
              <span className="text-gray-500"> leads by </span>
              <span className="text-white font-medium">
                {formatNum(Math.abs(aVal - bVal))}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default DemographicsDashboard;
