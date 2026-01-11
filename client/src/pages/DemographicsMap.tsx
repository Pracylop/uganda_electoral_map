import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import maplibregl from 'maplibre-gl';
import { ArrowLeft, BarChart3 } from 'lucide-react';
import MapComponent from '../components/Map';
import { MapSettingsWidget } from '../components/MapSettingsWidget';
import { useEffectiveBasemap } from '../hooks/useOnlineStatus';
import { api } from '../lib/api';
import { boundaryService } from '../lib/boundaryService';
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

export function DemographicsMap() {
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [metric, setMetric] = useState<DemographicMetric>('population');

  // Track basemap changes
  const effectiveBasemap = useEffectiveBasemap();
  const prevBasemapRef = useRef<string | null>(null);

  // Navigation popup ref
  const navigationPopupRef = useRef<maplibregl.Popup | null>(null);

  const [isLoadingChoropleth, setIsLoadingChoropleth] = useState(false);

  // Dynamic scale state
  const [currentScale, setCurrentScale] = useState<{ stops: number[]; colors: string[] }>({
    stops: colorScales.population.stops,
    colors: colorScales.population.colors,
  });

  // UI states
  const [interactionMode, setInteractionMode] = useState<InteractionMode>('drilldown');

  // Drill-down state
  const [currentLevel, setCurrentLevel] = useState(2);
  const [parentId, setParentId] = useState<number | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([]);

  // Selected unit for stats popup
  const [selectedUnit, setSelectedUnit] = useState<UnitStats | null>(null);

  // Handle map load
  const handleMapLoad = useCallback((map: maplibregl.Map) => {
    mapRef.current = map;
    setMapLoaded(true);
  }, []);

  // Detect basemap changes
  useEffect(() => {
    if (prevBasemapRef.current !== null && prevBasemapRef.current !== effectiveBasemap) {
      setMapLoaded(false);
    }
    prevBasemapRef.current = effectiveBasemap;
  }, [effectiveBasemap]);

  // Load choropleth for current level
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
      await boundaryService.loadStaticBoundaries();

      const response = await api.getDemographicsData({
        level: currentLevel,
        parentId: parentId ?? undefined
      });

      const parentItem = breadcrumbs.length > 0 ? breadcrumbs[breadcrumbs.length - 1] : null;
      const parentFilter = parentItem
        ? { level: parentItem.level, name: parentItem.name }
        : null;

      displayData = boundaryService.createGeoJSON(currentLevel, response.data, parentFilter);
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

    map.addSource('demographics', {
      type: 'geojson',
      data: displayData,
    });

    // Build color expression
    const colorProperty = metric === 'votingAgePercent' ? 'votingAgePercent' :
                         metric === 'votingAge' ? 'votingAgePopulation' :
                         metric === 'malePercent' ? 'malePercent' : 'totalPopulation';

    const baseColors = colorScales[metric].colors;

    let dynamicStops: number[];
    if (metric === 'votingAgePercent' || metric === 'malePercent') {
      dynamicStops = colorScales[metric].stops;
    } else {
      const { min, max } = calculateDataRange(displayData.features, colorProperty);
      dynamicStops = generateDynamicStops(min, max, baseColors.length);
    }

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

    // Fit bounds
    if (bbox) {
      map.fitBounds([[bbox[0], bbox[1]], [bbox[2], bbox[3]]], {
        padding: 50,
        duration: 1000,
        essential: true,
      });
    }

    // Hover cursor
    map.on('mouseenter', 'demographics-fill', () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', 'demographics-fill', () => {
      map.getCanvas().style.cursor = '';
    });

    setIsLoadingChoropleth(false);

    // Close navigation popup
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
  }, [mapLoaded, currentLevel, parentId, metric, breadcrumbs]);

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
        setSelectedUnit(unitStats);
      } else {
        // Drill-down mode
        if (currentLevel < 5) {
          setBreadcrumbs(prev => [...prev, {
            id: props.id,
            name: props.name,
            level: currentLevel,
          }]);
          setParentId(props.id);
          setCurrentLevel(currentLevel + 1);
          setSelectedUnit(null);
        }
      }
    };

    map.on('click', 'demographics-fill', handleClick);
    return () => {
      map.off('click', 'demographics-fill', handleClick);
    };
  }, [mapLoaded, interactionMode, currentLevel]);

  // Navigate directly to a district
  const navigateToDistrict = useCallback((districtId: number, districtName: string) => {
    setBreadcrumbs([{ id: districtId, name: districtName, level: 2 }]);
    setParentId(districtId);
    setCurrentLevel(3);
    setSelectedUnit(null);
  }, []);

  // Basemap click handler
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    const map = mapRef.current;

    const handleBasemapClick = (e: maplibregl.MapMouseEvent) => {
      const hasDemographicsLayer = map.getLayer('demographics-fill');
      let features: maplibregl.MapGeoJSONFeature[] = [];

      try {
        if (hasDemographicsLayer) {
          features = map.queryRenderedFeatures(e.point, { layers: ['demographics-fill'] });
        }
      } catch (err) {
        // Layer may not exist
      }

      if (features && features.length > 0) return;

      const { lng, lat } = e.lngLat;

      if (!boundaryService.hasLevel(2)) return;

      const districtGeoJSON = boundaryService.getBoundariesGeoJSON(2);
      const clickedDistrict = districtGeoJSON.features.find(feature => {
        if (!feature.geometry) return false;
        return pointInPolygon([lng, lat], feature.geometry);
      });

      if (clickedDistrict && clickedDistrict.properties) {
        const { id, name } = clickedDistrict.properties as { id: number; name: string };

        if (navigationPopupRef.current) {
          navigationPopupRef.current.remove();
        }

        navigationPopupRef.current = new maplibregl.Popup({ closeOnClick: true, closeButton: false })
          .setLngLat(e.lngLat)
          .setHTML(`<div style="padding: 8px; font-family: system-ui; color: #333;"><strong>Navigating to ${name}</strong></div>`)
          .addTo(map);

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

  // Update colors when metric changes
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    const map = mapRef.current;

    try {
      if (!map.getLayer('demographics-fill')) return;
      if (!map.getSource('demographics')) return;

      const colorProperty = metric === 'votingAgePercent' ? 'votingAgePercent' :
                           metric === 'votingAge' ? 'votingAgePopulation' :
                           metric === 'malePercent' ? 'malePercent' : 'totalPopulation';

      const baseColors = colorScales[metric].colors;

      const source = map.getSource('demographics') as maplibregl.GeoJSONSource;
      const sourceData = (source as any)._data as GeoJSON.FeatureCollection;

      let dynamicStops: number[];
      if (metric === 'votingAgePercent' || metric === 'malePercent') {
        dynamicStops = colorScales[metric].stops;
      } else if (sourceData?.features?.length > 0) {
        const { min, max } = calculateDataRange(sourceData.features, colorProperty);
        dynamicStops = generateDynamicStops(min, max, baseColors.length);
      } else {
        dynamicStops = colorScales[metric].stops;
      }

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
    }
  };

  const goToLevel = (index: number) => {
    if (index === -1) {
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
  };

  const formatNumber = (n: number) => n.toLocaleString();
  const formatPercent = (n: number, total: number) => total > 0 ? ((n / total) * 100).toFixed(1) + '%' : '0%';

  return (
    <div className="flex-1 flex flex-col bg-gray-900 min-h-0">
      {/* Toolbar */}
      <div className="bg-gray-800 border-b border-gray-700 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            to="/demographics"
            className="p-2 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>

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
                interactionMode === 'stats' ? 'bg-[#00E5FF] text-gray-900' : 'text-gray-400 hover:text-white'
              }`}
            >
              View Stats
            </button>
            <button
              onClick={() => setInteractionMode('drilldown')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                interactionMode === 'drilldown' ? 'bg-[#00E5FF] text-gray-900' : 'text-gray-400 hover:text-white'
              }`}
            >
              Drill Down
            </button>
          </div>

          {/* Metric selector */}
          <select
            value={metric}
            onChange={(e) => setMetric(e.target.value as DemographicMetric)}
            className="bg-gray-700 text-white rounded px-3 py-1.5 text-sm border border-gray-600"
          >
            {Object.entries(metricLabels).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400">
            {LEVEL_NAMES[currentLevel]}s
            {currentLevel === 5 && ' (lowest level)'}
          </span>
          <Link
            to="/demographics/stats"
            className="flex items-center gap-2 px-3 py-1.5 bg-[#FFD700]/20 hover:bg-[#FFD700]/30 border border-[#FFD700]/40 rounded text-[#FFD700] text-sm font-medium transition-colors"
          >
            <BarChart3 className="w-4 h-4" />
            Statistics
          </Link>
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        <MapComponent onLoad={handleMapLoad} className="absolute inset-0" />

        <MapSettingsWidget position="bottom-left" />

        {isLoadingChoropleth && (
          <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
            <div className="bg-gray-800/90 backdrop-blur-sm rounded-lg px-6 py-3 flex items-center gap-3 shadow-lg border border-gray-700">
              <div className="w-5 h-5 border-2 border-[#00E5FF] border-t-transparent rounded-full animate-spin"></div>
              <span className="text-white">Loading {LEVEL_NAMES[currentLevel].toLowerCase()} data...</span>
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="absolute bottom-4 right-4 bg-gray-800/90 backdrop-blur-sm rounded-lg p-3 z-10 border border-gray-700">
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

        {/* Selected Unit Popup */}
        {selectedUnit && (
          <div className="absolute top-4 right-4 w-80 bg-gray-800/95 backdrop-blur-sm rounded-lg shadow-lg border border-gray-700 z-10">
            <div className="p-4 border-b border-gray-700 flex justify-between items-start">
              <div>
                <h2 className="text-lg font-bold text-white">{selectedUnit.name}</h2>
                <p className="text-xs text-gray-400">{LEVEL_NAMES[selectedUnit.level]} Statistics</p>
              </div>
              <button
                onClick={() => setSelectedUnit(null)}
                className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-2 gap-2 mb-3">
                <StatItem label="Population" value={formatNumber(selectedUnit.totalPopulation)} />
                <StatItem label="Voting Age" value={formatNumber(selectedUnit.votingAgePopulation)} color="text-emerald-400" />
                <StatItem label="Youth (0-17)" value={formatNumber(selectedUnit.youthPopulation)} color="text-blue-400" />
                <StatItem label="Elderly (60+)" value={formatNumber(selectedUnit.elderlyPopulation)} color="text-orange-400" />
                <StatItem label="Households" value={formatNumber(selectedUnit.numberOfHouseholds)} color="text-purple-400" />
                {selectedUnit.level < 5 && (
                  <StatItem label="Parishes" value={selectedUnit.parishCount.toString()} />
                )}
              </div>
              <div className="pt-3 border-t border-gray-700 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Gender Split</span>
                  <span className="text-white">
                    {formatPercent(selectedUnit.malePopulation, selectedUnit.totalPopulation)} M / {formatPercent(selectedUnit.femalePopulation, selectedUnit.totalPopulation)} F
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Voting Age %</span>
                  <span className="text-emerald-400 font-medium">
                    {formatPercent(selectedUnit.votingAgePopulation, selectedUnit.totalPopulation)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatItem({ label, value, color = 'text-white' }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-gray-700/50 rounded p-2">
      <div className="text-xs text-gray-400">{label}</div>
      <div className={`font-bold text-sm ${color}`}>{value}</div>
    </div>
  );
}

export default DemographicsMap;
