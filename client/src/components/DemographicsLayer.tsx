import { useEffect, useCallback, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import { api } from '../lib/api';

type DemographicMetric = 'population' | 'votingAge' | 'votingAgePercent';

interface DemographicsLayerProps {
  map: maplibregl.Map | null;
  visible: boolean;
  level?: number;
  metric?: DemographicMetric;
  parentId?: number | null;
  onDistrictSelect?: (districtId: number, districtName: string) => void;
  onScaleChange?: (scale: { stops: number[]; colors: string[] }) => void;
}

// Base color scales (colors only - stops are calculated dynamically)
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
    stops: [0, 40, 45, 50, 55, 60],
    colors: ['#ffffcc', '#d9f0a3', '#addd8e', '#78c679', '#31a354', '#006837'],
  },
};

// ============================================================================
// Helper Functions (matching Broadcast version)
// ============================================================================

// Cache for GeoJSON data by level
const dataCache = new Map<string, { geojson: GeoJSON.FeatureCollection; bbox?: [number, number, number, number] }>();

function getLevelCacheKey(level: number): string {
  return `demographics-level-${level}`;
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

// Filter features by parentId
function filterFeaturesByParent(geojson: GeoJSON.FeatureCollection, parentId: number): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: geojson.features.filter(f => f.properties?.parentId === parentId),
  };
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

// Format large numbers compactly
function formatCompactNumber(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  return n.toString();
}

export function DemographicsLayer({
  map,
  visible,
  level = 2,
  metric = 'population',
  parentId = null,
  onDistrictSelect,
  onScaleChange,
}: DemographicsLayerProps) {
  // Ref to track if basemap click handler is registered
  const basemapHandlerRef = useRef<((e: maplibregl.MapMouseEvent) => void) | null>(null);

  const loadDemographics = useCallback(async () => {
    if (!map || !visible) return;

    try {
      const cacheKey = getLevelCacheKey(level);
      let levelData = dataCache.get(cacheKey);

      // Fetch data if not cached
      if (!levelData) {
        console.log(`DemographicsLayer: Fetching level ${level} data...`);
        const data = await api.getDemographicsGeoJSON({ level });

        if (!data || !data.features || data.features.length === 0) {
          console.error('No demographics data for level', level);
          return;
        }

        levelData = { geojson: data as GeoJSON.FeatureCollection };
        dataCache.set(cacheKey, levelData);
        console.log(`DemographicsLayer: Cached level ${level} - ${levelData.geojson.features.length} features`);
      } else {
        console.log(`DemographicsLayer: Using cached level ${level} data`);
      }

      // Filter by parentId if specified (client-side filtering)
      let displayData: GeoJSON.FeatureCollection;
      if (parentId !== null) {
        displayData = filterFeaturesByParent(levelData.geojson, parentId);
        console.log(`DemographicsLayer: Filtered to ${displayData.features.length} features for parent ${parentId}`);
      } else {
        displayData = levelData.geojson;
      }

      if (displayData.features.length === 0) {
        console.warn('No features to display after filtering');
        return;
      }

      // Remove existing layers if present
      try {
        if (map.getLayer('demographics-fill')) map.removeLayer('demographics-fill');
        if (map.getLayer('demographics-line')) map.removeLayer('demographics-line');
        if (map.getLayer('demographics-labels')) map.removeLayer('demographics-labels');
        if (map.getSource('demographics')) map.removeSource('demographics');
      } catch (e) {
        // Layers may not exist yet
      }

      // Add GeoJSON source
      map.addSource('demographics', {
        type: 'geojson',
        data: displayData,
        promoteId: 'id',
      });

      // Get the property to color by
      const colorProperty = metric === 'votingAgePercent' ? 'votingAgePercent' :
                           metric === 'votingAge' ? 'votingAgePopulation' : 'totalPopulation';

      // Calculate DYNAMIC color scale based on displayed data
      const baseColors = colorScales[metric].colors;
      let dynamicStops: number[];

      if (metric === 'votingAgePercent') {
        // Percentage metrics - use fixed scale
        dynamicStops = colorScales[metric].stops;
      } else {
        // Absolute metrics - calculate dynamic scale from data
        const { min, max } = calculateDataRange(displayData.features, colorProperty);
        dynamicStops = generateDynamicStops(min, max, baseColors.length);
        console.log(`DemographicsLayer: Dynamic scale for ${metric}: ${min.toLocaleString()} - ${max.toLocaleString()}`);
      }

      // Notify parent of scale change
      if (onScaleChange) {
        onScaleChange({ stops: dynamicStops, colors: baseColors });
      }

      // Build color expression with dynamic stops
      const colorExpr: any[] = ['interpolate', ['linear'], ['get', colorProperty]];
      for (let i = 0; i < dynamicStops.length; i++) {
        colorExpr.push(dynamicStops[i], baseColors[i]);
      }

      // Add fill layer
      map.addLayer({
        id: 'demographics-fill',
        type: 'fill',
        source: 'demographics',
        paint: {
          'fill-color': colorExpr as any,
          'fill-opacity': 0.7,
        },
      }, 'stations-circles'); // Insert below polling stations if they exist

      // Add border line
      map.addLayer({
        id: 'demographics-line',
        type: 'line',
        source: 'demographics',
        paint: {
          'line-color': '#333',
          'line-width': 1,
          'line-opacity': 0.5,
        },
      }, 'demographics-fill');

      // Click handler for popups
      map.on('click', 'demographics-fill', (e) => {
        if (!e.features || e.features.length === 0) return;
        const feature = e.features[0];
        const props = feature.properties;
        if (!props) return;

        const popupContent = createDemographicsPopupHTML(props);

        new maplibregl.Popup({ closeOnClick: true, maxWidth: '350px' })
          .setLngLat(e.lngLat)
          .setHTML(popupContent)
          .addTo(map);
      });

      // Hover effects
      map.on('mouseenter', 'demographics-fill', () => {
        map.getCanvas().style.cursor = 'pointer';
      });

      map.on('mouseleave', 'demographics-fill', () => {
        map.getCanvas().style.cursor = '';
      });
    } catch (err) {
      console.error('Error loading demographics:', err);
    }
  }, [map, visible, level, metric, parentId, onScaleChange]);

  // Basemap click handler for district selection
  useEffect(() => {
    if (!map || !visible || !onDistrictSelect) return;

    // Remove previous handler if exists
    if (basemapHandlerRef.current) {
      map.off('click', basemapHandlerRef.current);
    }

    const handleBasemapClick = (e: maplibregl.MapMouseEvent) => {
      // Check if click was on the demographics layer
      const hasDemographicsLayer = map.getLayer('demographics-fill');
      if (hasDemographicsLayer) {
        const features = map.queryRenderedFeatures(e.point, { layers: ['demographics-fill'] });
        if (features && features.length > 0) {
          return; // Click was on choropleth, let layer handler process it
        }
      }

      // Click was on basemap - check cached district data
      const { lng, lat } = e.lngLat;
      const districtCacheKey = getLevelCacheKey(2);
      const districtData = dataCache.get(districtCacheKey);

      if (!districtData) {
        console.log('DemographicsLayer: No cached district data for basemap navigation');
        return;
      }

      // Find which district contains the clicked point
      const clickedDistrict = districtData.geojson.features.find(feature => {
        if (!feature.geometry) return false;
        return pointInPolygon([lng, lat], feature.geometry);
      });

      if (clickedDistrict && clickedDistrict.properties) {
        const { id, name } = clickedDistrict.properties as { id: number; name: string };
        console.log('DemographicsLayer: Basemap click - navigating to district:', { id, name });

        // Show navigation popup
        new maplibregl.Popup({ closeOnClick: true, closeButton: false })
          .setLngLat(e.lngLat)
          .setHTML(`<div style="padding: 8px; font-family: system-ui;"><strong>Navigating to ${name}</strong></div>`)
          .addTo(map);

        onDistrictSelect(id, name);
      }
    };

    basemapHandlerRef.current = handleBasemapClick;
    map.on('click', handleBasemapClick);

    return () => {
      if (basemapHandlerRef.current) {
        map.off('click', basemapHandlerRef.current);
        basemapHandlerRef.current = null;
      }
    };
  }, [map, visible, onDistrictSelect]);

  // Load demographics when map or settings change
  useEffect(() => {
    if (map && visible) {
      loadDemographics();
    } else if (map && !visible) {
      // Hide layers when not visible
      try {
        if (map.getLayer('demographics-fill')) {
          map.setLayoutProperty('demographics-fill', 'visibility', 'none');
        }
        if (map.getLayer('demographics-line')) {
          map.setLayoutProperty('demographics-line', 'visibility', 'none');
        }
      } catch (e) {
        // Layers may not exist
      }
    }
  }, [map, visible, level, metric, parentId, loadDemographics]);

  // Preload district data for basemap navigation
  useEffect(() => {
    if (!map || !visible) return;

    const preloadDistricts = async () => {
      const districtCacheKey = getLevelCacheKey(2);
      if (dataCache.has(districtCacheKey)) return;

      try {
        const data = await api.getDemographicsGeoJSON({ level: 2 });
        if (data?.features?.length > 0) {
          dataCache.set(districtCacheKey, { geojson: data as GeoJSON.FeatureCollection });
          console.log('DemographicsLayer: Preloaded district data for basemap navigation');
        }
      } catch (err) {
        console.error('Failed to preload districts:', err);
      }
    };

    // Preload after a short delay
    const timer = setTimeout(preloadDistricts, 500);
    return () => clearTimeout(timer);
  }, [map, visible]);

  // Show layers when visibility changes to true
  useEffect(() => {
    if (map && visible) {
      try {
        if (map.getLayer('demographics-fill')) {
          map.setLayoutProperty('demographics-fill', 'visibility', 'visible');
        }
        if (map.getLayer('demographics-line')) {
          map.setLayoutProperty('demographics-line', 'visibility', 'visible');
        }
      } catch (e) {
        // Layers may not exist yet
      }
    }
  }, [map, visible]);

  return null;
}

// Helper function to create popup HTML
function createDemographicsPopupHTML(props: Record<string, any>): string {
  const totalPop = props.totalPopulation?.toLocaleString() || '0';
  const votingAge = props.votingAgePopulation?.toLocaleString() || '0';
  const votingPercent = props.votingAgePercent || 0;
  const malePercent = props.malePercent || 0;
  const households = props.numberOfHouseholds?.toLocaleString() || 'N/A';

  return `
    <div class="demographics-popup" style="font-family: system-ui, sans-serif;">
      <div style="font-weight: bold; font-size: 14px; color: #1a1a1a; margin-bottom: 8px; border-bottom: 1px solid #eee; padding-bottom: 6px;">
        ${props.name || 'Unknown'}
      </div>

      <div style="display: grid; gap: 6px; font-size: 13px;">
        <div style="display: flex; justify-content: space-between;">
          <span style="color: #666;">Total Population:</span>
          <strong style="color: #1a1a1a;">${totalPop}</strong>
        </div>

        <div style="display: flex; justify-content: space-between;">
          <span style="color: #666;">Voting Age (18+):</span>
          <strong style="color: #006d2c;">${votingAge}</strong>
          <span style="color: #888; font-size: 11px;">(${votingPercent}%)</span>
        </div>

        <div style="display: flex; justify-content: space-between;">
          <span style="color: #666;">Gender Split:</span>
          <span style="color: #1a1a1a;">${malePercent}% M / ${(100 - malePercent).toFixed(1)}% F</span>
        </div>

        <div style="display: flex; justify-content: space-between;">
          <span style="color: #666;">Households:</span>
          <strong style="color: #1a1a1a;">${households}</strong>
        </div>

        <div style="font-size: 11px; color: #888; margin-top: 4px; text-align: right;">
          2024 Census Data
        </div>
      </div>
    </div>
  `;
}

// Export filter panel component
export function DemographicsFilterPanel({
  visible,
  onVisibilityChange,
  metric,
  onMetricChange,
  nationalStats,
  currentScale,
}: {
  visible: boolean;
  onVisibilityChange: (visible: boolean) => void;
  metric: DemographicMetric;
  onMetricChange: (metric: DemographicMetric) => void;
  nationalStats?: {
    totalPopulation: number;
    votingAgePopulation: number;
  };
  /** Dynamic scale from DemographicsLayer */
  currentScale?: { stops: number[]; colors: string[] };
}) {
  // Use dynamic scale if provided, otherwise fall back to default
  const scale = currentScale || colorScales[metric];

  return (
    <div className="bg-gray-800/95 backdrop-blur-sm px-4 py-3 rounded-lg shadow-lg">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="font-bold text-white text-sm">Demographics</h3>
          <p className="text-gray-400 text-xs">2024 Census</p>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={visible}
            onChange={(e) => onVisibilityChange(e.target.checked)}
            className="w-4 h-4 rounded border-gray-600 text-green-500 focus:ring-green-500"
          />
          <span className="text-gray-300 text-xs">Show</span>
        </label>
      </div>

      {visible && (
        <>
          <div className="mb-3">
            <label className="text-gray-400 text-xs block mb-1">Metric:</label>
            <select
              value={metric}
              onChange={(e) => onMetricChange(e.target.value as DemographicMetric)}
              className="w-full bg-gray-700 text-white text-xs rounded px-2 py-1 border border-gray-600"
            >
              <option value="population">Total Population</option>
              <option value="votingAge">Voting Age (18+)</option>
              <option value="votingAgePercent">Voting Age %</option>
            </select>
          </div>

          {/* Color scale legend - now uses dynamic scale */}
          <div className="mb-2">
            <div className="flex h-2 rounded overflow-hidden">
              {scale.colors.map((color, i) => (
                <div
                  key={i}
                  className="flex-1"
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>
                {metric === 'votingAgePercent'
                  ? `${scale.stops[0]}%`
                  : formatCompactNumber(scale.stops[0])}
              </span>
              <span>
                {metric === 'votingAgePercent'
                  ? `${scale.stops[scale.stops.length - 1]}%`
                  : formatCompactNumber(scale.stops[scale.stops.length - 1])}
              </span>
            </div>
          </div>

          {/* National stats */}
          {nationalStats && (
            <div className="pt-2 border-t border-gray-700 text-xs">
              <div className="flex justify-between text-gray-400">
                <span>National Population:</span>
                <span className="text-white font-medium">
                  {(nationalStats.totalPopulation / 1000000).toFixed(1)}M
                </span>
              </div>
              <div className="flex justify-between text-gray-400 mt-1">
                <span>Voting Age:</span>
                <span className="text-green-400 font-medium">
                  {(nationalStats.votingAgePopulation / 1000000).toFixed(1)}M
                  ({((nationalStats.votingAgePopulation / nationalStats.totalPopulation) * 100).toFixed(1)}%)
                </span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
