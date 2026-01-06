import { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Filter, MousePointer, BarChart3, Home } from 'lucide-react';
import { useBroadcastStore } from '../../stores/broadcastStore';
import { api } from '../../lib/api';

interface BroadcastIssuesMapProps {
  className?: string;
  interactionsDisabled?: boolean;
}

const UGANDA_CENTER: [number, number] = [32.5825, 1.3733];
const INITIAL_ZOOM = 6.5;

// Uganda bounding box [southwest, northeast]
const UGANDA_BOUNDS: [[number, number], [number, number]] = [
  [29.5, -1.5],
  [35.0, 4.3]
];

// Admin level names for breadcrumb
const LEVEL_NAMES: Record<number, string> = {
  2: 'Districts',
  3: 'Constituencies',
  4: 'Subcounties',
  5: 'Parishes',
};

// Cache key generator - by LEVEL only (not parentId)
function getLevelCacheKey(level: number): string {
  return `issues-level-${level}`;
}

// Type for cached data
interface CachedIssueData {
  geojson: GeoJSON.FeatureCollection;
  metadata: { totalIssues: number; unitsWithIssues: number; maxIssuesPerUnit: number };
}

// Helper to filter features by parentId
function filterFeaturesByParent(geojson: GeoJSON.FeatureCollection, parentId: number): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: geojson.features.filter(f => f.properties?.parentId === parentId),
  };
}

// Helper to recalculate metadata from filtered features
function recalculateMetadata(features: GeoJSON.Feature[]): { totalIssues: number; unitsWithIssues: number; maxIssuesPerUnit: number } {
  let totalIssues = 0;
  let unitsWithIssues = 0;
  let maxIssuesPerUnit = 0;
  features.forEach(f => {
    const count = f.properties?.issueCount || 0;
    totalIssues += count;
    if (count > 0) unitsWithIssues++;
    if (count > maxIssuesPerUnit) maxIssuesPerUnit = count;
  });
  return { totalIssues, unitsWithIssues, maxIssuesPerUnit };
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

// Ray-casting algorithm for point-in-polygon test
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
    const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

// Check if point is inside a polygon geometry
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

export function BroadcastIssuesMap({ className, interactionsDisabled }: BroadcastIssuesMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [metadata, setMetadata] = useState<{
    totalIssues: number;
    unitsWithIssues: number;
    maxIssuesPerUnit: number;
  } | null>(null);

  // In-memory cache for choropleth data
  const dataCache = useRef<Map<string, CachedIssueData>>(new Map());

  // Click handler refs for proper cleanup
  const choroplethClickHandlerRef = useRef<((e: maplibregl.MapLayerMouseEvent) => void) | null>(null);
  const basemapClickHandlerRef = useRef<((e: maplibregl.MapMouseEvent) => void) | null>(null);

  // Navigation popup ref
  const navigationPopupRef = useRef<maplibregl.Popup | null>(null);

  const {
    basemapOpacity,
    selectedCategoryIds,
    issuesDateRange,
    toggleIssuesPanel,
    issuesPanelOpen,
    selectIssueDistrict,
    issuesInteractionMode,
    toggleIssuesInteractionMode,
    // Drill-down state from store
    currentLevel,
    selectedRegionId,
    drillDownStack,
    drillDown,
    navigateTo,
    navigateToDistrict,
    resetToNational,
  } = useBroadcastStore();

  // Check if filters are active
  const hasFilters = selectedCategoryIds.length > 0 || issuesDateRange.startDate || issuesDateRange.endDate;

  // Initialize map
  useEffect(() => {
    if (map.current || !mapContainer.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          'osm': {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '&copy; OpenStreetMap Contributors',
            maxzoom: 19,
          },
        },
        layers: [
          {
            id: 'osm',
            type: 'raster',
            source: 'osm',
          },
        ],
      },
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
    });

    // Handle resize
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

  // Pre-load all levels in background
  const preloadAllLevels = useCallback(async () => {
    const levelsToLoad = [2, 3, 4, 5];
    for (const level of levelsToLoad) {
      const cacheKey = getLevelCacheKey(level);
      if (dataCache.current.has(cacheKey)) continue;
      try {
        const data = await api.getIssuesChoropleth({ level });
        if (data?.features?.length > 0) {
          dataCache.current.set(cacheKey, {
            geojson: data as GeoJSON.FeatureCollection,
            metadata: data.metadata
          });
          console.log(`BroadcastIssues: Cached level ${level} - ${data.features.length} features`);
        }
      } catch (err) {
        console.error(`BroadcastIssues: Failed to preload level ${level}:`, err);
      }
    }
  }, []);

  // Load choropleth data function with caching
  const loadChoropleth = useCallback(async () => {
    const mapInstance = map.current;
    if (!mapInstance || !isLoaded) return;

    setIsDataLoading(true);

    // Remove existing layers (event handlers are cleaned up with layer removal)
    try {
      ['issues-choropleth-fill', 'issues-choropleth-line'].forEach(layerId => {
        if (mapInstance.getLayer(layerId)) mapInstance.removeLayer(layerId);
      });
      if (mapInstance.getSource('issues-choropleth')) {
        mapInstance.removeSource('issues-choropleth');
      }
    } catch (e) {
      // Layers may not exist
    }

    try {
      let displayData: GeoJSON.FeatureCollection;
      let displayMetadata: { totalIssues: number; unitsWithIssues: number; maxIssuesPerUnit: number };

      // If filters are active, always fetch fresh data (no caching with filters)
      if (hasFilters) {
        const params: any = { level: currentLevel };
        if (selectedRegionId) params.parentId = selectedRegionId;
        if (selectedCategoryIds.length > 0) params.categoryIds = selectedCategoryIds;
        if (issuesDateRange.startDate) params.startDate = issuesDateRange.startDate;
        if (issuesDateRange.endDate) params.endDate = issuesDateRange.endDate;

        const data = await api.getIssuesChoropleth(params);
        displayData = data as GeoJSON.FeatureCollection;
        displayMetadata = data.metadata;
      } else {
        // No filters - use caching with client-side filtering
        const cacheKey = getLevelCacheKey(currentLevel);
        let levelData = dataCache.current.get(cacheKey);

        // If level not cached, fetch ALL data for this level
        if (!levelData) {
          console.log(`BroadcastIssues: Fetching level ${currentLevel} data...`);
          const data = await api.getIssuesChoropleth({ level: currentLevel });
          if (data?.features?.length > 0) {
            levelData = { geojson: data as GeoJSON.FeatureCollection, metadata: data.metadata };
            dataCache.current.set(cacheKey, levelData);
            console.log(`BroadcastIssues: Cached level ${currentLevel} - ${levelData.geojson.features.length} features`);
          }
        } else {
          console.log(`BroadcastIssues: Using cached level ${currentLevel} data`);
        }

        if (!levelData) {
          console.error('BroadcastIssues: No data for this level');
          setIsDataLoading(false);
          return;
        }

        // Filter by parentId if needed (client-side, instant!)
        if (selectedRegionId !== null) {
          displayData = filterFeaturesByParent(levelData.geojson, selectedRegionId);
          displayMetadata = recalculateMetadata(displayData.features);
          console.log(`BroadcastIssues: Filtered to ${displayData.features.length} features for parent ${selectedRegionId}`);
        } else {
          displayData = levelData.geojson;
          displayMetadata = levelData.metadata;
        }
      }

      setMetadata(displayMetadata);

      if (!displayData || displayData.features.length === 0) {
        console.warn('BroadcastIssues: No features to display');
        setIsDataLoading(false);
        return;
      }

      // Add source
      mapInstance.addSource('issues-choropleth', {
        type: 'geojson',
        data: displayData,
      });

      // Fill layer
      mapInstance.addLayer({
        id: 'issues-choropleth-fill',
        type: 'fill',
        source: 'issues-choropleth',
        paint: {
          'fill-color': ['get', 'fillColor'],
          'fill-opacity': 0.85,
          'fill-opacity-transition': { duration: 800, delay: 0 },
        },
      });

      // Outline layer
      mapInstance.addLayer({
        id: 'issues-choropleth-line',
        type: 'line',
        source: 'issues-choropleth',
        paint: {
          'line-color': '#1f2937',
          'line-width': 1,
        },
      });

      // Hover effect
      mapInstance.on('mouseenter', 'issues-choropleth-fill', () => {
        mapInstance.getCanvas().style.cursor = 'pointer';
      });
      mapInstance.on('mouseleave', 'issues-choropleth-fill', () => {
        mapInstance.getCanvas().style.cursor = '';
      });

      // Fit bounds to features
      const bbox = calculateBbox(displayData.features);
      if (bbox) {
        mapInstance.fitBounds(
          [[bbox[0], bbox[1]], [bbox[2], bbox[3]]],
          { padding: { top: 80, bottom: 80, left: 80, right: 80 }, duration: 1000 }
        );
      }

      // Close navigation popup after map finishes rendering
      if (navigationPopupRef.current) {
        const closePopup = () => {
          if (navigationPopupRef.current) {
            navigationPopupRef.current.remove();
            navigationPopupRef.current = null;
          }
          mapInstance.off('idle', closePopup);
        };
        mapInstance.once('idle', closePopup);
      }

      // Trigger pre-load of all other levels after initial district load
      if (currentLevel === 2 && selectedRegionId === null) {
        preloadAllLevels();
      }
    } catch (error) {
      console.error('BroadcastIssues: Failed to load choropleth:', error);
    }

    setIsDataLoading(false);
  }, [isLoaded, currentLevel, selectedRegionId, hasFilters, selectedCategoryIds, issuesDateRange, preloadAllLevels]);

  // Popup for view mode
  const popup = useRef<maplibregl.Popup | null>(null);

  // Handle choropleth click - drill-down or stats mode
  useEffect(() => {
    const mapInstance = map.current;
    if (!mapInstance || !isLoaded) return;

    // Remove existing handler
    if (choroplethClickHandlerRef.current && mapInstance.getLayer('issues-choropleth-fill')) {
      mapInstance.off('click', 'issues-choropleth-fill', choroplethClickHandlerRef.current);
      choroplethClickHandlerRef.current = null;
    }

    const handleClick = (e: maplibregl.MapLayerMouseEvent) => {
      if (!e.features || e.features.length === 0) return;
      const props = e.features[0].properties;
      if (!props) return;

      if (issuesInteractionMode === 'stats') {
        // Stats mode: Select region and open panel (with level info for correct API query)
        const regionLevel = props.level || currentLevel;
        selectIssueDistrict(props.unitId, props.unitName, regionLevel);
        if (!issuesPanelOpen) {
          toggleIssuesPanel();
        }
      } else {
        // Drill-down mode
        const level = props.level || currentLevel;
        if (level < 5 && props.issueCount > 0) {
          // Drill down to children
          drillDown(props.unitId, props.unitName);
        } else {
          // At parish level or no issues - show popup
          if (popup.current) popup.current.remove();
          const issueCount = props.issueCount || 0;
          popup.current = new maplibregl.Popup({
            closeButton: true,
            closeOnClick: true,
            maxWidth: '200px',
          })
            .setLngLat(e.lngLat)
            .setHTML(`
              <div style="padding: 4px;">
                <div style="font-weight: 600; font-size: 14px; margin-bottom: 4px;">${props.unitName}</div>
                <div style="font-size: 13px; color: #666;">${issueCount} issue${issueCount !== 1 ? 's' : ''}</div>
              </div>
            `)
            .addTo(mapInstance);
        }
      }
    };

    choroplethClickHandlerRef.current = handleClick;
    mapInstance.on('click', 'issues-choropleth-fill', handleClick);

    return () => {
      if (choroplethClickHandlerRef.current && mapInstance.getLayer('issues-choropleth-fill')) {
        mapInstance.off('click', 'issues-choropleth-fill', choroplethClickHandlerRef.current);
      }
      if (popup.current) {
        popup.current.remove();
      }
    };
  }, [isLoaded, currentLevel, issuesInteractionMode, selectIssueDistrict, issuesPanelOpen, toggleIssuesPanel, drillDown]);

  // Handle basemap click - navigate to district
  useEffect(() => {
    const mapInstance = map.current;
    if (!mapInstance || !isLoaded) return;

    // Remove existing handler
    if (basemapClickHandlerRef.current) {
      mapInstance.off('click', basemapClickHandlerRef.current);
      basemapClickHandlerRef.current = null;
    }

    const handleBasemapClick = (e: maplibregl.MapMouseEvent) => {
      if (interactionsDisabled) return;

      // Check if click was on the choropleth layer
      const hasChoroplethLayer = mapInstance.getLayer('issues-choropleth-fill');
      let features: maplibregl.MapGeoJSONFeature[] = [];

      try {
        if (hasChoroplethLayer) {
          features = mapInstance.queryRenderedFeatures(e.point, {
            layers: ['issues-choropleth-fill']
          });
        }
      } catch (err) {
        console.log('BroadcastIssues: Error querying features:', err);
      }

      // If clicked on choropleth, the layer handler will process it
      if (features && features.length > 0) {
        return;
      }

      // Click was on basemap - check cached national data for district lookup
      const { lng, lat } = e.lngLat;

      // Look for cached national-level data (level 2)
      const nationalCacheKey = getLevelCacheKey(2);
      const nationalData = dataCache.current.get(nationalCacheKey);

      if (!nationalData) {
        console.log('BroadcastIssues: No cached national data for basemap navigation');
        return;
      }

      // Find which district contains the clicked point
      const clickedDistrict = nationalData.geojson.features.find(feature => {
        if (!feature.geometry) return false;
        return pointInPolygon([lng, lat], feature.geometry);
      });

      if (clickedDistrict && clickedDistrict.properties) {
        const { unitId, unitName } = clickedDistrict.properties as { unitId: number; unitName: string };
        console.log('BroadcastIssues: Navigating to district:', { unitId, unitName });

        // Close any existing navigation popup
        if (navigationPopupRef.current) {
          navigationPopupRef.current.remove();
        }

        // Show a brief popup indicating navigation
        navigationPopupRef.current = new maplibregl.Popup({ closeOnClick: true, closeButton: false })
          .setLngLat(e.lngLat)
          .setHTML(`<div style="padding: 8px; font-family: system-ui;"><strong>Navigating to ${unitName}</strong></div>`)
          .addTo(mapInstance);

        // Navigate to the district
        navigateToDistrict(unitId, unitName);
      }
    };

    basemapClickHandlerRef.current = handleBasemapClick;
    mapInstance.on('click', handleBasemapClick);

    return () => {
      if (basemapClickHandlerRef.current) {
        mapInstance.off('click', basemapClickHandlerRef.current);
      }
      if (navigationPopupRef.current) {
        navigationPopupRef.current.remove();
      }
    };
  }, [isLoaded, interactionsDisabled, navigateToDistrict]);

  // Load issues choropleth data when map is ready or level/region changes
  useEffect(() => {
    if (!map.current || !isLoaded) return;
    loadChoropleth();
  }, [isLoaded, loadChoropleth, currentLevel, selectedRegionId]);

  return (
    <div className="relative w-full h-full">
      <div
        ref={mapContainer}
        className={`w-full h-full ${className || ''}`}
      />

      {/* Title and Breadcrumb */}
      <div className="absolute top-4 left-4 z-10 space-y-2">
        {/* Title */}
        <div className="bg-gray-900/90 backdrop-blur-sm rounded-lg px-4 py-3">
          <h2 className="text-white font-bold text-lg">Electoral Issues</h2>
          {metadata && (
            <p className="text-gray-400 text-sm">
              {metadata.totalIssues} issues in {metadata.unitsWithIssues} {LEVEL_NAMES[currentLevel]?.toLowerCase() || 'regions'}
            </p>
          )}
          {(selectedCategoryIds.length > 0 || issuesDateRange.startDate || issuesDateRange.endDate) && (
            <div className="text-yellow-500 text-xs mt-1 space-y-0.5">
              {selectedCategoryIds.length > 0 && (
                <p>{selectedCategoryIds.length} category{selectedCategoryIds.length > 1 ? 'ies' : ''} selected</p>
              )}
              {(issuesDateRange.startDate || issuesDateRange.endDate) && (
                <p>
                  {issuesDateRange.startDate && issuesDateRange.endDate
                    ? `${issuesDateRange.startDate} to ${issuesDateRange.endDate}`
                    : issuesDateRange.startDate
                      ? `From ${issuesDateRange.startDate}`
                      : `Until ${issuesDateRange.endDate}`
                  }
                </p>
              )}
            </div>
          )}
        </div>

        {/* Breadcrumb Navigation */}
        <nav className="bg-gray-800 px-4 py-2.5 rounded-lg shadow-lg">
          <div className="flex items-center">
            {/* Home (root) */}
            <button
              onClick={() => {
                resetToNational();
                map.current?.fitBounds(UGANDA_BOUNDS, { padding: 50, duration: 1000 });
              }}
              className="text-gray-300 hover:text-white transition-colors"
              title="Back to National View"
            >
              <Home size={18} />
            </button>

            {/* Breadcrumb items */}
            {drillDownStack.slice(1).map((item, index) => (
              <span key={index} className="flex items-center">
                <span className="text-gray-500 mx-2">›</span>
                <button
                  onClick={() => navigateTo(index + 1)}
                  className="text-white font-semibold hover:text-gray-200 transition-colors"
                >
                  {item.regionName}
                </button>
              </span>
            ))}

            {/* Current level indicator */}
            {currentLevel < 5 && drillDownStack.length > 1 && (
              <span className="flex items-center">
                <span className="text-gray-500 mx-2">›</span>
                <span className="text-purple-400 font-medium">
                  {LEVEL_NAMES[currentLevel + 1]}
                </span>
              </span>
            )}
          </div>
        </nav>
      </div>

      {/* Filter Button */}
      {(() => {
        const hasFilters = selectedCategoryIds.length > 0 || issuesDateRange.startDate || issuesDateRange.endDate;
        const filterCount = selectedCategoryIds.length + (issuesDateRange.startDate ? 1 : 0) + (issuesDateRange.endDate ? 1 : 0);
        return (
          <button
            onClick={toggleIssuesPanel}
            className={`
              absolute top-4 right-4 z-10
              w-12 h-12 rounded-lg
              flex items-center justify-center
              transition-all duration-200
              ${issuesPanelOpen
                ? 'bg-yellow-500 text-gray-900'
                : 'bg-gray-900/90 text-white hover:bg-gray-800'
              }
              backdrop-blur-sm
              ${hasFilters ? 'ring-2 ring-yellow-500' : ''}
            `}
            title="Filter & Statistics (F)"
          >
            <Filter size={24} />
            {hasFilters && !issuesPanelOpen && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-yellow-500 text-gray-900 text-xs font-bold rounded-full flex items-center justify-center">
                {filterCount}
              </span>
            )}
          </button>
        );
      })()}

      {/* Interaction Mode Toggle */}
      <button
        onClick={toggleIssuesInteractionMode}
        className={`
          absolute top-[4.5rem] right-4 z-10
          h-12 px-3 rounded-lg
          flex items-center gap-2
          transition-all duration-200
          bg-gray-900/90 backdrop-blur-sm
          ${issuesInteractionMode === 'stats' ? 'text-yellow-500' : 'text-blue-400'}
          hover:bg-gray-800
        `}
        title={issuesInteractionMode === 'stats' ? 'Stats Mode: Click shows statistics panel' : 'View Mode: Click shows quick popup'}
      >
        {issuesInteractionMode === 'stats' ? (
          <>
            <BarChart3 size={20} />
            <span className="text-sm font-medium">Stats</span>
          </>
        ) : (
          <>
            <MousePointer size={20} />
            <span className="text-sm font-medium">View</span>
          </>
        )}
      </button>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-gray-900/90 backdrop-blur-sm rounded-lg p-4 z-10">
        <div className="text-xs text-gray-400 mb-3 font-medium">Issue Density</div>
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="w-5 h-5 rounded" style={{ backgroundColor: '#dc2626' }} />
            <span className="text-gray-200 text-sm">Critical (Most)</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="w-5 h-5 rounded" style={{ backgroundColor: '#ea580c' }} />
            <span className="text-gray-200 text-sm">High</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="w-5 h-5 rounded" style={{ backgroundColor: '#f59e0b' }} />
            <span className="text-gray-200 text-sm">Moderate</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="w-5 h-5 rounded" style={{ backgroundColor: '#fde047' }} />
            <span className="text-gray-200 text-sm">Low</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="w-5 h-5 rounded" style={{ backgroundColor: '#fef3c7' }} />
            <span className="text-gray-200 text-sm">Minimal</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="w-5 h-5 rounded" style={{ backgroundColor: '#d1d5db' }} />
            <span className="text-gray-200 text-sm">None</span>
          </div>
        </div>
      </div>

      {/* Loading Indicator */}
      {isDataLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 z-20 pointer-events-none">
          <div className="bg-gray-800 rounded-lg px-6 py-4 flex items-center gap-4 shadow-xl">
            <div className="w-8 h-8 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-white font-medium">Loading issues data...</span>
          </div>
        </div>
      )}
    </div>
  );
}
