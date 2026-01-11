import { useCallback, useRef, useEffect, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useBroadcastStore } from '../../stores/broadcastStore';
import { useEffectiveBasemap } from '../../hooks/useOnlineStatus';
import { getMapStyle, UGANDA_CENTER as MAP_CENTER } from '../../lib/mapStyles';
import { api } from '../../lib/api';

interface BroadcastDemographicsMapProps {
  className?: string;
  onRegionClick?: (regionId: number, regionName: string, level: number) => void;
  interactionsDisabled?: boolean;
  /** Disable basemap click navigation */
  disableBasemapNavigation?: boolean;
}

type DemographicMetric = 'population' | 'votingAge' | 'votingAgePercent' | 'malePercent';

// Use shared constants from mapStyles.ts
const UGANDA_CENTER = MAP_CENTER;
const INITIAL_ZOOM = 6.0;

// Admin level names
const LEVEL_NAMES: Record<number, string> = {
  2: 'District',
  3: 'Constituency',
  4: 'Subcounty',
  5: 'Parish',
};

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

// Cache key generator - by LEVEL only (not parentId)
function getLevelCacheKey(level: number): string {
  return `demographics-level-${level}`;
}

// Type for cached data
interface CachedMapData {
  geojson: GeoJSON.FeatureCollection;
  bbox?: [number, number, number, number];
}

// Helper to filter features by parentId
function filterFeaturesByParent(geojson: GeoJSON.FeatureCollection, parentId: number): GeoJSON.FeatureCollection {
  const filteredFeatures = geojson.features.filter(f => f.properties?.parentId === parentId);
  return {
    type: 'FeatureCollection',
    features: filteredFeatures,
  };
}

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

// Ray casting algorithm for a single ring
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

  // Ensure valid range
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

// Format large numbers for display (e.g., 1500000 -> "1.5M")
function formatCompactNumber(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  return n.toString();
}

interface HoveredUnit {
  id: number;
  name: string;
  totalPopulation: number;
  votingAgePopulation: number;
  malePopulation: number;
  femalePopulation: number;
}

export function BroadcastDemographicsMap({
  className,
  onRegionClick,
  interactionsDisabled = false,
  disableBasemapNavigation = false,
}: BroadcastDemographicsMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [metric, setMetric] = useState<DemographicMetric>('population');
  const [hoveredUnit, setHoveredUnit] = useState<HoveredUnit | null>(null);
  const hoveredIdRef = useRef<number | null>(null);

  // Dynamic scale state - updates based on displayed data range
  const [currentScale, setCurrentScale] = useState<{ stops: number[]; colors: string[] }>({
    stops: colorScales.population.stops,
    colors: colorScales.population.colors,
  });

  // In-memory cache for GeoJSON data (persists for session)
  const dataCache = useRef<Map<string, CachedMapData>>(new Map());

  // Reference to navigation popup (to close it when loading completes)
  const navigationPopup = useRef<maplibregl.Popup | null>(null);

  const {
    currentLevel,
    selectedRegionId,
    drillDown,
    navigateToDistrict,
    basemapOpacity,
  } = useBroadcastStore();

  // Get effective basemap mode (online/offline)
  const effectiveBasemap = useEffectiveBasemap();
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

  // Initialize map with dynamic basemap (online/offline)
  useEffect(() => {
    if (map.current || !mapContainer.current) return;

    // Get appropriate style based on basemap mode
    const mapStyle = getMapStyle(effectiveBasemap, isOnline);

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: mapStyle,
      center: UGANDA_CENTER,
      zoom: INITIAL_ZOOM,
      dragRotate: true,
      touchZoomRotate: true,
      touchPitch: true,
      doubleClickZoom: true,
    });

    map.current.addControl(
      new maplibregl.NavigationControl({
        showCompass: true,
        showZoom: true,
        visualizePitch: true,
      }),
      'top-right'
    );

    map.current.on('load', () => {
      setIsLoaded(true);
      // Trigger resize after load to ensure proper dimensions
      setTimeout(() => map.current?.resize(), 100);
    });

    // Trigger initial resize after a short delay (fixes blank map on first render)
    setTimeout(() => map.current?.resize(), 50);
    setTimeout(() => map.current?.resize(), 200);

    const resizeObserver = new ResizeObserver(() => {
      map.current?.resize();
    });
    resizeObserver.observe(mapContainer.current);

    const handleFullscreenChange = () => {
      setTimeout(() => map.current?.resize(), 100);
      setTimeout(() => map.current?.resize(), 300);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      resizeObserver.disconnect();
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Enable/disable map interactions
  useEffect(() => {
    const mapInstance = map.current;
    if (!mapInstance) return;

    if (interactionsDisabled) {
      mapInstance.dragPan.disable();
      mapInstance.scrollZoom.disable();
      mapInstance.boxZoom.disable();
      mapInstance.dragRotate.disable();
      mapInstance.keyboard.disable();
      mapInstance.doubleClickZoom.disable();
      mapInstance.touchZoomRotate.disable();
    } else {
      mapInstance.dragPan.enable();
      mapInstance.scrollZoom.enable();
      mapInstance.boxZoom.enable();
      mapInstance.dragRotate.enable();
      mapInstance.keyboard.enable();
      mapInstance.doubleClickZoom.enable();
      mapInstance.touchZoomRotate.enable();
    }
  }, [interactionsDisabled]);

  // Update basemap opacity
  useEffect(() => {
    const mapInstance = map.current;
    if (!mapInstance || !mapInstance.isStyleLoaded()) return;

    if (mapInstance.getLayer('osm')) {
      mapInstance.setPaintProperty('osm', 'raster-opacity', basemapOpacity / 100);
    }
  }, [basemapOpacity]);

  // Load demographics data
  const loadDemographics = useCallback(async (level: number, parentId: number | null) => {
    const mapInstance = map.current;
    if (!mapInstance || !mapInstance.isStyleLoaded()) return;

    const levelCacheKey = getLevelCacheKey(level);
    let levelData = dataCache.current.get(levelCacheKey);

    // If level not cached, fetch ALL data for this level
    if (!levelData) {
      console.log(`BroadcastDemographics: Fetching ALL level ${level} data...`);
      setIsDataLoading(true);

      try {
        const data = await api.getDemographicsGeoJSON({ level });

        if (!data || !data.features || data.features.length === 0) {
          console.error('No demographics data for level', level);
          setIsDataLoading(false);
          return;
        }

        const geojson = data as GeoJSON.FeatureCollection;
        const bbox = calculateBbox(geojson.features);

        levelData = { geojson, bbox };
        dataCache.current.set(levelCacheKey, levelData);
        console.log(`BroadcastDemographics: Cached level ${level} - ${geojson.features.length} total features`);
      } catch (err) {
        console.error('Failed to load demographics:', err);
        setIsDataLoading(false);
        return;
      }
    } else {
      console.log(`BroadcastDemographics: Using cached level ${level} data`);
    }

    // Filter by parentId if needed (client-side, instant!)
    let displayData: GeoJSON.FeatureCollection;
    let bbox: [number, number, number, number] | undefined;

    if (parentId !== null) {
      displayData = filterFeaturesByParent(levelData.geojson, parentId);
      bbox = calculateBbox(displayData.features);
      console.log(`BroadcastDemographics: Filtered to ${displayData.features.length} features for parent ${parentId}`);
    } else {
      displayData = levelData.geojson;
      bbox = levelData.bbox;
    }

    if (displayData.features.length === 0) {
      setIsDataLoading(false);
      return;
    }

    // Remove existing layers
    try {
      ['demographics-fill', 'demographics-highlight', 'demographics-outline'].forEach(layerId => {
        if (mapInstance.getLayer(layerId)) mapInstance.removeLayer(layerId);
      });
      if (mapInstance.getSource('demographics')) mapInstance.removeSource('demographics');
    } catch (e) {
      // Layers may not exist
    }

    // Add source
    mapInstance.addSource('demographics', {
      type: 'geojson',
      data: displayData,
      promoteId: 'id',
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

    // Update the scale state for the legend
    setCurrentScale({ stops: dynamicStops, colors: baseColors });

    // Build the color expression
    const colorExpr: any[] = ['interpolate', ['linear'], ['get', colorProperty]];
    for (let i = 0; i < dynamicStops.length; i++) {
      colorExpr.push(dynamicStops[i], baseColors[i]);
    }

    // Add fill layer
    mapInstance.addLayer({
      id: 'demographics-fill',
      type: 'fill',
      source: 'demographics',
      paint: {
        'fill-color': colorExpr as any,
        'fill-opacity': 0.8,
        'fill-opacity-transition': { duration: 500 },
      },
    });

    // Add highlight layer
    mapInstance.addLayer({
      id: 'demographics-highlight',
      type: 'fill',
      source: 'demographics',
      paint: {
        'fill-color': '#ffffff',
        'fill-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 0.4, 0],
      },
    });

    // Add outline layer
    mapInstance.addLayer({
      id: 'demographics-outline',
      type: 'line',
      source: 'demographics',
      paint: {
        'line-color': '#333333',
        'line-width': ['case', ['boolean', ['feature-state', 'hover'], false], 2, 0.5],
      },
    });

    // Trigger resize to ensure map renders properly
    mapInstance.resize();

    // Close navigation popup after map finishes rendering
    if (navigationPopup.current) {
      const closePopup = () => {
        if (navigationPopup.current) {
          navigationPopup.current.remove();
          navigationPopup.current = null;
        }
        mapInstance.off('idle', closePopup);
      };
      mapInstance.once('idle', closePopup);
    }

    // Animate to bounds
    if (bbox) {
      mapInstance.fitBounds(
        [[bbox[0], bbox[1]], [bbox[2], bbox[3]]],
        {
          padding: { top: 100, bottom: 100, left: 100, right: 100 },
          duration: 1500,
          essential: true,
        }
      );
    }

    console.log(`BroadcastDemographics: Layers added, ${displayData.features.length} features displayed`);
    setIsDataLoading(false);
  }, [metric]);

  // Load data when level or parent changes
  useEffect(() => {
    if (isLoaded) {
      loadDemographics(currentLevel, selectedRegionId);
    }
  }, [isLoaded, currentLevel, selectedRegionId, loadDemographics]);

  // Note: Color updates when metric changes are handled by loadDemographics
  // (metric is a dependency of loadDemographics, which triggers a re-run)

  // Hover and click handlers
  useEffect(() => {
    const mapInstance = map.current;
    if (!mapInstance || !isLoaded) return;

    const handleMouseMove = (e: maplibregl.MapLayerMouseEvent) => {
      if (!e.features || e.features.length === 0) return;

      const feature = e.features[0];
      const id = feature.properties?.id;

      // Update hover state
      if (hoveredIdRef.current !== null && hoveredIdRef.current !== id) {
        mapInstance.setFeatureState(
          { source: 'demographics', id: hoveredIdRef.current },
          { hover: false }
        );
      }

      if (id !== undefined) {
        hoveredIdRef.current = id;
        mapInstance.setFeatureState(
          { source: 'demographics', id },
          { hover: true }
        );

        setHoveredUnit({
          id,
          name: feature.properties?.name || 'Unknown',
          totalPopulation: feature.properties?.totalPopulation || 0,
          votingAgePopulation: feature.properties?.votingAgePopulation || 0,
          malePopulation: feature.properties?.malePopulation || 0,
          femalePopulation: feature.properties?.femalePopulation || 0,
        });
      }

      mapInstance.getCanvas().style.cursor = 'pointer';
    };

    const handleMouseLeave = () => {
      if (hoveredIdRef.current !== null) {
        mapInstance.setFeatureState(
          { source: 'demographics', id: hoveredIdRef.current },
          { hover: false }
        );
        hoveredIdRef.current = null;
      }
      setHoveredUnit(null);
      mapInstance.getCanvas().style.cursor = '';
    };

    // Handler for clicks on the choropleth layer
    const handleChoroplethClick = (e: maplibregl.MapLayerMouseEvent) => {
      if (interactionsDisabled || !e.features || e.features.length === 0) return;

      const feature = e.features[0];
      const id = feature.properties?.id;
      const name = feature.properties?.name;
      const level = feature.properties?.level || currentLevel;

      if (id && name && currentLevel < 5) {
        if (onRegionClick) {
          onRegionClick(id, name, level);
        } else {
          drillDown(id, name);
        }
      }
    };

    // Fallback handler for clicks on basemap (outside choropleth)
    // Uses cached GeoJSON data to find which district was clicked
    const handleBasemapClick = (e: maplibregl.MapMouseEvent) => {
      if (disableBasemapNavigation || interactionsDisabled) return;

      // Check if the demographics-fill layer exists
      const hasDemographicsLayer = mapInstance.getLayer('demographics-fill');

      // Check if click was on the choropleth layer
      let features: maplibregl.MapGeoJSONFeature[] = [];
      try {
        if (hasDemographicsLayer) {
          features = mapInstance.queryRenderedFeatures(e.point, {
            layers: ['demographics-fill']
          });
        }
      } catch (err) {
        console.log('BroadcastDemographics: Error querying features:', err);
      }

      // If clicked on choropleth, the other handler will process it
      if (features && features.length > 0) {
        return;
      }

      // Click was on basemap - check cached national data for district lookup
      const { lng, lat } = e.lngLat;
      console.log('BroadcastDemographics: Basemap click at:', { lng, lat });

      // Look for cached national-level data (level 2)
      const nationalCacheKey = getLevelCacheKey(2);
      const nationalData = dataCache.current.get(nationalCacheKey);

      if (!nationalData) {
        console.log('BroadcastDemographics: No cached national data found');
        return;
      }

      console.log('BroadcastDemographics: Checking', nationalData.geojson.features.length, 'districts');

      // Find which district contains the clicked point
      const clickedDistrict = nationalData.geojson.features.find(feature => {
        if (!feature.geometry) return false;
        return pointInPolygon([lng, lat], feature.geometry);
      });

      if (clickedDistrict && clickedDistrict.properties) {
        const { id, name } = clickedDistrict.properties as { id: number; name: string };
        console.log('BroadcastDemographics: Found district:', { id, name });

        // Close any existing navigation popup
        if (navigationPopup.current) {
          navigationPopup.current.remove();
        }

        // Show a brief popup indicating where we're navigating
        navigationPopup.current = new maplibregl.Popup({ closeOnClick: true, closeButton: false })
          .setLngLat(e.lngLat)
          .setHTML(`<div style="padding: 8px; font-family: system-ui;"><strong>Navigating to ${name}</strong></div>`)
          .addTo(mapInstance);

        // Navigate directly to district (resets stack and shows constituencies at level 3)
        navigateToDistrict(id, name);
      } else {
        console.log('BroadcastDemographics: No district found at click location');
      }
    };

    mapInstance.on('mousemove', 'demographics-fill', handleMouseMove);
    mapInstance.on('mouseleave', 'demographics-fill', handleMouseLeave);
    mapInstance.on('click', 'demographics-fill', handleChoroplethClick);
    mapInstance.on('click', handleBasemapClick);

    return () => {
      mapInstance.off('mousemove', 'demographics-fill', handleMouseMove);
      mapInstance.off('mouseleave', 'demographics-fill', handleMouseLeave);
      mapInstance.off('click', 'demographics-fill', handleChoroplethClick);
      mapInstance.off('click', handleBasemapClick);
    };
  }, [isLoaded, currentLevel, interactionsDisabled, onRegionClick, drillDown, disableBasemapNavigation, navigateToDistrict]);

  // Preload all levels in background
  useEffect(() => {
    if (!isLoaded) return;

    const preloadAllLevels = async () => {
      const levelsToLoad = [2, 3, 4, 5];

      for (const level of levelsToLoad) {
        const cacheKey = getLevelCacheKey(level);
        if (dataCache.current.has(cacheKey)) continue;

        try {
          const data = await api.getDemographicsGeoJSON({ level });
          if (data?.features?.length > 0) {
            const geojson = data as GeoJSON.FeatureCollection;
            const bbox = calculateBbox(geojson.features);
            dataCache.current.set(cacheKey, { geojson, bbox });
            console.log(`BroadcastDemographics: Pre-cached level ${level} - ${geojson.features.length} features`);
          }
        } catch (err) {
          console.error(`Failed to preload level ${level}:`, err);
        }
      }
    };

    // Start preloading after a short delay
    const timer = setTimeout(preloadAllLevels, 1000);
    return () => clearTimeout(timer);
  }, [isLoaded]);

  const formatNumber = (n: number) => n.toLocaleString();
  const formatPercent = (n: number, total: number) => total > 0 ? ((n / total) * 100).toFixed(1) + '%' : '0%';

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className={`w-full h-full ${className || ''}`} />

      {/* Metric Selector */}
      <div className="absolute top-4 left-4 z-10">
        <div className="bg-gray-900/90 backdrop-blur-sm rounded-lg p-3 border border-gray-700">
          <label className="text-xs text-gray-400 block mb-2">Display Metric</label>
          <select
            value={metric}
            onChange={(e) => setMetric(e.target.value as DemographicMetric)}
            className="bg-gray-800 text-white rounded px-3 py-2 text-sm border border-gray-600 w-48"
          >
            {Object.entries(metricLabels).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>

          {/* Color scale legend - uses dynamic scale */}
          <div className="mt-3">
            <div className="flex h-2 rounded overflow-hidden">
              {currentScale.colors.map((color, i) => (
                <div key={i} className="flex-1" style={{ backgroundColor: color }} />
              ))}
            </div>
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>
                {metric.includes('Percent')
                  ? `${currentScale.stops[0]}%`
                  : formatCompactNumber(currentScale.stops[0])}
              </span>
              <span>
                {metric.includes('Percent')
                  ? `${currentScale.stops[currentScale.stops.length - 1]}%`
                  : formatCompactNumber(currentScale.stops[currentScale.stops.length - 1])}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Level indicator */}
      <div className="absolute top-4 right-20 z-10">
        <div className="bg-gray-900/90 backdrop-blur-sm rounded-lg px-4 py-2 border border-gray-700">
          <span className="text-sm text-gray-400">Showing: </span>
          <span className="text-sm text-white font-medium">{LEVEL_NAMES[currentLevel]}s</span>
        </div>
      </div>

      {/* Hover info card */}
      {hoveredUnit && (
        <div className="absolute bottom-24 left-4 z-10">
          <div className="bg-gray-900/95 backdrop-blur-sm rounded-lg p-4 border border-gray-700 min-w-64 shadow-xl">
            <h3 className="text-lg font-bold text-white mb-2">{hoveredUnit.name}</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-400">Population</span>
                <div className="text-white font-medium">{formatNumber(hoveredUnit.totalPopulation)}</div>
              </div>
              <div>
                <span className="text-gray-400">Voting Age</span>
                <div className="text-green-400 font-medium">{formatNumber(hoveredUnit.votingAgePopulation)}</div>
              </div>
              <div>
                <span className="text-gray-400">Voting %</span>
                <div className="text-green-400 font-medium">
                  {formatPercent(hoveredUnit.votingAgePopulation, hoveredUnit.totalPopulation)}
                </div>
              </div>
              <div>
                <span className="text-gray-400">Gender</span>
                <div className="text-white font-medium">
                  {formatPercent(hoveredUnit.malePopulation, hoveredUnit.totalPopulation)} M
                </div>
              </div>
            </div>
            {currentLevel < 5 && (
              <div className="mt-3 pt-2 border-t border-gray-700 text-xs text-gray-400">
                Click to drill down
              </div>
            )}
          </div>
        </div>
      )}

      {/* Loading indicator */}
      {isDataLoading && (
        <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
          <div className="bg-gray-900/90 backdrop-blur-sm rounded-lg px-6 py-4 border border-gray-700 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-white font-medium">Loading demographics...</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
