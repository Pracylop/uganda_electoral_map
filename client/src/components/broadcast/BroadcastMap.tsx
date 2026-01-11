import { useCallback, useRef, useEffect, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useBroadcastStore } from '../../stores/broadcastStore';
import { useEffectiveBasemap } from '../../hooks/useOnlineStatus';
import { getMapStyle, UGANDA_CENTER as MAP_CENTER } from '../../lib/mapStyles';
import { ReportingProgress } from './ReportingProgress';
import { PollingStationsLayer } from '../PollingStationsLayer';

interface BroadcastMapProps {
  className?: string;
  onRegionClick?: (regionId: number, regionName: string, level: number) => void;
  /** Override election ID (for comparison mode) */
  electionId?: number | null;
  /** Disable basemap click navigation (for comparison right map) */
  disableBasemapNavigation?: boolean;
  /** Label to show in corner (e.g., election name) */
  label?: string;
  /** Label color */
  labelColor?: string;
  /** Disable map interactions (for annotation mode) */
  interactionsDisabled?: boolean;
}

// Use shared constants from mapStyles.ts (MAP_CENTER, MAP_ZOOM)
const UGANDA_CENTER = MAP_CENTER;
const INITIAL_ZOOM = 6.0; // Slightly more zoomed out for broadcast

// Cache key generator for GeoJSON data
function getCacheKey(electionId: number, level: number, parentId: number | null): string {
  return `${electionId}-${level}-${parentId ?? 'null'}`;
}

// Type for cached data
interface CachedMapData {
  geojson: GeoJSON.FeatureCollection;
  bbox?: [number, number, number, number];
}

export function BroadcastMap({
  className,
  onRegionClick,
  electionId: propElectionId,
  disableBasemapNavigation = false,
  label,
  labelColor = 'bg-yellow-500',
  interactionsDisabled = false,
}: BroadcastMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isDataLoading, setIsDataLoading] = useState(false);

  // In-memory cache for GeoJSON data (persists for session)
  const dataCache = useRef<Map<string, CachedMapData>>(new Map());

  // Reference to navigation popup (to close it when loading completes)
  const navigationPopup = useRef<maplibregl.Popup | null>(null);

  const {
    selectedElectionId: storeElectionId,
    currentLevel,
    selectedRegionId,
    drillDown: storeDrillDown,
    navigateToDistrict,
    basemapOpacity,
    annotationMode,
    highlightedRegions,
    highlightColor,
    toggleRegionHighlight,
    layers,
  } = useBroadcastStore();

  // Use prop election ID if provided, otherwise use store
  const selectedElectionId = propElectionId !== undefined ? propElectionId : storeElectionId;

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
      // Note: No maxBounds - allows free zooming to see entire Uganda
      dragRotate: true,
      touchZoomRotate: true,
      touchPitch: true,
      doubleClickZoom: true,
    });

    // Add navigation controls
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

    // Handle fullscreen changes
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

  // Enable/disable map interactions (for annotation mode)
  useEffect(() => {
    const mapInstance = map.current;
    if (!mapInstance) return;

    if (interactionsDisabled) {
      // Disable all interactions when annotation mode is active
      mapInstance.dragPan.disable();
      mapInstance.scrollZoom.disable();
      mapInstance.boxZoom.disable();
      mapInstance.dragRotate.disable();
      mapInstance.keyboard.disable();
      mapInstance.doubleClickZoom.disable();
      mapInstance.touchZoomRotate.disable();
    } else {
      // Re-enable interactions
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

    // Update the OSM basemap layer opacity
    if (mapInstance.getLayer('osm')) {
      mapInstance.setPaintProperty('osm', 'raster-opacity', basemapOpacity / 100);
    }
  }, [basemapOpacity]);

  // Load election results when election or drill-down changes
  const loadElectionResults = useCallback(async (
    electionId: number,
    level: number,
    parentId: number | null
  ) => {
    const mapInstance = map.current;
    if (!mapInstance || !mapInstance.isStyleLoaded()) return;

    const cacheKey = getCacheKey(electionId, level, parentId);
    const cached = dataCache.current.get(cacheKey);

    let geojson: GeoJSON.FeatureCollection;
    let bbox: [number, number, number, number] | undefined;

    const isCacheHit = !!cached;

    if (cached) {
      // Use cached data - no loading indicator needed
      console.log('🚀 CACHE HIT:', cacheKey, '- features:', cached.geojson.features?.length);
      geojson = cached.geojson;
      bbox = cached.bbox;
    } else {
      // Fetch from API
      console.log('🌐 CACHE MISS - Fetching from API:', { electionId, level, parentId });
      setIsDataLoading(true);

      try {
        let url = `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/map/aggregated/${electionId}?level=${level}`;
        if (parentId !== null) {
          url += `&parentId=${parentId}`;
        }

        const response = await fetch(url, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('auth_token')}`
          }
        });

        if (!response.ok) throw new Error('Failed to load map data');

        const data = await response.json();
        geojson = data.type === 'FeatureCollection' ? data : data;
        bbox = data.bbox;

        // Store in cache
        dataCache.current.set(cacheKey, { geojson, bbox });
        console.log('BroadcastMap: Cached data for', cacheKey, '- features:', geojson.features?.length || 0);
      } catch (err) {
        console.error('BroadcastMap: Error loading election results:', err);
        setIsDataLoading(false);
        return;
      }
    }

    // Remove existing layers if present
    try {
      if (mapInstance.getLayer('results-fill')) mapInstance.removeLayer('results-fill');
      if (mapInstance.getLayer('results-highlight')) mapInstance.removeLayer('results-highlight');
      if (mapInstance.getLayer('results-outline')) mapInstance.removeLayer('results-outline');
      if (mapInstance.getSource('results')) mapInstance.removeSource('results');
    } catch (e) {
      console.warn('Error removing existing layers:', e);
    }

    // Add GeoJSON source
    mapInstance.addSource('results', {
      type: 'geojson',
      data: geojson
    });

    // Add fill layer colored by winning party
    mapInstance.addLayer({
      id: 'results-fill',
      type: 'fill',
      source: 'results',
      paint: {
        'fill-color': ['coalesce', ['get', 'winnerColor'], '#cccccc'],
        'fill-opacity': 0.75,
        'fill-opacity-transition': { duration: 800, delay: 0 },
        'fill-color-transition': { duration: 500, delay: 0 }
      }
    });

    // Add highlight layer for hovered regions
    mapInstance.addLayer({
      id: 'results-highlight',
      type: 'fill',
      source: 'results',
      paint: {
        'fill-color': '#ffffff',
        'fill-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 0.3, 0],
        'fill-opacity-transition': { duration: 200, delay: 0 }
      }
    });

    // Add outline layer
    mapInstance.addLayer({
      id: 'results-outline',
      type: 'line',
      source: 'results',
      paint: {
        'line-color': '#333333',
        'line-width': ['case', ['boolean', ['feature-state', 'hover'], false], 2, 0.5],
        'line-width-transition': { duration: 200, delay: 0 }
      }
    });

    // Close navigation popup after map finishes rendering
    // Use 'idle' event which fires when map is done loading tiles and rendering
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

    // Animate to bounds with generous padding for broadcast screens
    // Use faster animation for cached data (instant feel)
    const animationOptions = {
      padding: { top: 100, bottom: 100, left: 100, right: 100 },
      duration: isCacheHit ? 500 : 1500,  // 0.5s for cache, 1.5s for fresh load
      essential: true,
      curve: 1.2,
      easing: (t: number) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
    };

    if (bbox && bbox.length === 4) {
      mapInstance.fitBounds(
        [[bbox[0], bbox[1]], [bbox[2], bbox[3]]],
        animationOptions
      );
    } else if (geojson.features && geojson.features.length > 0) {
      const bounds = new maplibregl.LngLatBounds();
      geojson.features.forEach((feature: any) => {
        if (feature.geometry?.type === 'Polygon' && feature.geometry.coordinates?.[0]) {
          feature.geometry.coordinates[0].forEach((coord: [number, number]) => {
            bounds.extend(coord);
          });
        }
      });
      if (!bounds.isEmpty()) {
        mapInstance.fitBounds(bounds, animationOptions);
      }
    }

    setIsDataLoading(false);
  }, []);

  // Render highlighted regions (annotation mode)
  useEffect(() => {
    const mapInstance = map.current;
    if (!mapInstance || !isLoaded) return;

    // Remove existing annotation highlight layers
    try {
      if (mapInstance.getLayer('annotation-highlights-outline')) mapInstance.removeLayer('annotation-highlights-outline');
      if (mapInstance.getLayer('annotation-highlights')) mapInstance.removeLayer('annotation-highlights');
      if (mapInstance.getSource('annotation-highlights')) mapInstance.removeSource('annotation-highlights');
    } catch (e) {
      // Layers may not exist
    }

    // If no highlights, nothing to render
    if (highlightedRegions.length === 0) return;

    // Get the results source data to find geometries for highlighted regions
    const resultsSource = mapInstance.getSource('results') as maplibregl.GeoJSONSource;
    if (!resultsSource) return;

    // Get features from the results source
    const features = mapInstance.querySourceFeatures('results');
    if (!features || features.length === 0) return;

    // Filter to only highlighted regions and create highlight features
    const highlightFeatures: GeoJSON.Feature[] = [];
    highlightedRegions.forEach(({ id, color }) => {
      const feature = features.find(f => f.properties?.unitId === id);
      if (feature && feature.geometry) {
        highlightFeatures.push({
          type: 'Feature',
          geometry: feature.geometry as GeoJSON.Geometry,
          properties: {
            unitId: id,
            highlightColor: color,
          },
        });
      }
    });

    if (highlightFeatures.length === 0) return;

    // Add highlight source and layer
    mapInstance.addSource('annotation-highlights', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: highlightFeatures,
      },
    });

    mapInstance.addLayer({
      id: 'annotation-highlights',
      type: 'fill',
      source: 'annotation-highlights',
      paint: {
        'fill-color': ['get', 'highlightColor'],
        'fill-opacity': 0.5,
      },
    });

    // Add outline for highlighted regions
    mapInstance.addLayer({
      id: 'annotation-highlights-outline',
      type: 'line',
      source: 'annotation-highlights',
      paint: {
        'line-color': ['get', 'highlightColor'],
        'line-width': 3,
      },
    });

  }, [isLoaded, highlightedRegions]);

  // Set up click handler for drill-down
  useEffect(() => {
    const mapInstance = map.current;
    if (!mapInstance || !isLoaded) return;

    // Handler for clicks on the choropleth layer
    const handleChoroplethClick = (e: maplibregl.MapMouseEvent) => {
      const features = mapInstance.queryRenderedFeatures(e.point, {
        layers: ['results-fill']
      });

      if (features && features.length > 0) {
        const feature = features[0];
        const props = feature.properties;

        if (!props) return;

        const unitId = props.unitId;
        const unitName = props.unitName;
        const featureLevel = props.level || currentLevel;

        console.log('BroadcastMap: Region clicked', { unitId, unitName, featureLevel, annotationMode });

        // In annotation mode, toggle region highlight instead of drilling down
        if (annotationMode) {
          toggleRegionHighlight(unitId, highlightColor);
          return;
        }

        // If not at parish level (5), drill down
        if (featureLevel < 5) {
          if (onRegionClick) {
            onRegionClick(unitId, unitName, featureLevel);
          } else {
            // Use store directly if no callback provided
            storeDrillDown(unitId, unitName);
          }
        } else {
          // At parish level, show popup with results
          new maplibregl.Popup()
            .setLngLat(e.lngLat)
            .setHTML(createResultsPopupHTML(props))
            .addTo(mapInstance);
        }
      }
    };

    // Fallback handler for clicks on basemap (outside choropleth)
    // Uses cached GeoJSON data to find which district was clicked
    const handleBasemapClick = (e: maplibregl.MapMouseEvent) => {
      // Skip if basemap navigation is disabled (e.g., comparison right map)
      if (disableBasemapNavigation) return;
      // Check if the results-fill layer exists
      const hasResultsLayer = mapInstance.getLayer('results-fill');

      // Check if click was on the choropleth layer
      let features: maplibregl.MapGeoJSONFeature[] = [];
      try {
        if (hasResultsLayer) {
          features = mapInstance.queryRenderedFeatures(e.point, {
            layers: ['results-fill']
          });
        }
      } catch (err) {
        console.log('BroadcastMap: Error querying features:', err);
      }

      // If clicked on choropleth, the other handler will process it
      if (features && features.length > 0) {
        return;
      }

      // Click was on basemap - check cached national data for district lookup
      const { lng, lat } = e.lngLat;
      console.log('BroadcastMap: Basemap click at:', { lng, lat });

      // Look for cached national-level data (level 2, no parentId)
      if (!selectedElectionId) {
        console.log('BroadcastMap: No election selected');
        return;
      }

      const nationalCacheKey = getCacheKey(selectedElectionId, 2, null);
      const nationalData = dataCache.current.get(nationalCacheKey);

      if (!nationalData) {
        console.log('BroadcastMap: No cached national data found');
        return;
      }

      console.log('BroadcastMap: Checking', nationalData.geojson.features.length, 'districts');

      // Find which district contains the clicked point
      const clickedDistrict = nationalData.geojson.features.find(feature => {
        if (!feature.geometry) return false;
        return pointInPolygon([lng, lat], feature.geometry);
      });

      if (clickedDistrict && clickedDistrict.properties) {
        const { unitId, unitName } = clickedDistrict.properties as { unitId: number; unitName: string };
        console.log('BroadcastMap: Found district:', { unitId, unitName });

        // Close any existing navigation popup
        if (navigationPopup.current) {
          navigationPopup.current.remove();
        }

        // Show a brief popup indicating where we're navigating
        navigationPopup.current = new maplibregl.Popup({ closeOnClick: true, closeButton: false })
          .setLngLat(e.lngLat)
          .setHTML(`<div style="padding: 8px; font-family: system-ui;"><strong>Navigating to ${unitName}</strong></div>`)
          .addTo(mapInstance);

        // Navigate directly to district (resets stack and shows constituencies at level 3)
        navigateToDistrict(unitId, unitName);
      } else {
        console.log('BroadcastMap: No district found at click location');
      }
    };

    mapInstance.on('click', 'results-fill', handleChoroplethClick);
    mapInstance.on('click', handleBasemapClick);

    // Hover effects
    let hoveredFeatureId: string | number | null = null;

    const handleMouseMove = (e: maplibregl.MapLayerMouseEvent) => {
      mapInstance.getCanvas().style.cursor = 'pointer';

      if (e.features && e.features.length > 0) {
        const feature = e.features[0];
        const newId = feature.id;

        if (hoveredFeatureId !== null && hoveredFeatureId !== newId) {
          mapInstance.setFeatureState(
            { source: 'results', id: hoveredFeatureId as string | number },
            { hover: false }
          );
        }

        if (newId !== undefined && newId !== null) {
          hoveredFeatureId = newId;
          mapInstance.setFeatureState(
            { source: 'results', id: hoveredFeatureId as string | number },
            { hover: true }
          );
        }
      }
    };

    const handleMouseLeave = () => {
      mapInstance.getCanvas().style.cursor = '';
      if (hoveredFeatureId !== null) {
        mapInstance.setFeatureState(
          { source: 'results', id: hoveredFeatureId as string | number },
          { hover: false }
        );
        hoveredFeatureId = null;
      }
    };

    mapInstance.on('mousemove', 'results-fill', handleMouseMove);
    mapInstance.on('mouseleave', 'results-fill', handleMouseLeave);

    return () => {
      // Safely cleanup - map may be destroyed during unmount
      try {
        if (mapInstance) {
          mapInstance.off('click', 'results-fill', handleChoroplethClick);
          mapInstance.off('click', handleBasemapClick);
          mapInstance.off('mousemove', 'results-fill', handleMouseMove);
          mapInstance.off('mouseleave', 'results-fill', handleMouseLeave);
        }
      } catch (e) {
        // Map already destroyed
      }
    };
  }, [isLoaded, currentLevel, onRegionClick, storeDrillDown, navigateToDistrict, selectedElectionId, disableBasemapNavigation, annotationMode, toggleRegionHighlight, highlightColor]);

  // Load results when election or drill-down changes
  useEffect(() => {
    if (isLoaded && selectedElectionId) {
      loadElectionResults(selectedElectionId, currentLevel, selectedRegionId);
    }
  }, [isLoaded, selectedElectionId, currentLevel, selectedRegionId, loadElectionResults]);

  return (
    <div className="relative w-full h-full">
      <div
        ref={mapContainer}
        className={`w-full h-full ${className || ''}`}
      />

      {/* Election Label (for comparison mode) */}
      {label && (
        <div className={`absolute top-4 left-4 ${labelColor} text-gray-900 px-4 py-2 rounded-lg shadow-lg z-10 font-semibold`}>
          {label}
        </div>
      )}

      {/* Reporting Progress Indicator */}
      {!label && selectedElectionId && (
        <ReportingProgress electionId={selectedElectionId} />
      )}

      {/* Polling Stations Layer */}
      <PollingStationsLayer
        map={map.current}
        visible={layers.pollingStations && isLoaded}
        electionId={selectedElectionId ?? undefined}
      />

      {/* Loading Indicator */}
      {isDataLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 z-20 pointer-events-none">
          <div className="bg-gray-800 rounded-lg px-6 py-4 flex items-center gap-4 shadow-xl">
            <div className="w-8 h-8 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-white font-medium">Loading election data...</span>
          </div>
        </div>
      )}
    </div>
  );
}

// Point-in-polygon check using ray casting algorithm
function pointInPolygon(point: [number, number], geometry: GeoJSON.Geometry): boolean {
  const [x, y] = point;

  try {
    if (geometry.type === 'MultiPolygon') {
      // Check each polygon in the MultiPolygon
      return geometry.coordinates.some(polygonCoords => {
        const ring = polygonCoords?.[0];
        if (!ring || !Array.isArray(ring) || ring.length < 3) return false;
        return pointInRing(x, y, ring);
      });
    } else if (geometry.type === 'Polygon') {
      // Single Polygon - check outer ring
      const ring = geometry.coordinates?.[0];
      if (!ring || !Array.isArray(ring) || ring.length < 3) return false;
      return pointInRing(x, y, ring);
    }
    // Other geometry types (Point, LineString, etc.) - skip
    return false;
  } catch (e) {
    // Skip malformed geometries
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

// Helper function to create popup HTML (simplified from MapDashboard)
function createResultsPopupHTML(props: Record<string, any>): string {
  const unitName = props.unitName || 'Unknown';
  const winnerName = props.winnerName || 'No data';
  const winnerParty = props.winnerParty || '';
  const winnerVotes = props.winnerVotes || 0;
  const totalVotes = props.totalVotes || 0;
  const winnerColor = props.winnerColor || '#cccccc';

  const percentage = totalVotes > 0 ? ((winnerVotes / totalVotes) * 100).toFixed(1) : '0';

  return `
    <div style="min-width: 200px; font-family: system-ui, sans-serif;">
      <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: bold;">${unitName}</h3>
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
        <div style="width: 16px; height: 16px; border-radius: 50%; background: ${winnerColor};"></div>
        <div>
          <div style="font-weight: 600;">${winnerName}</div>
          <div style="font-size: 12px; color: #666;">${winnerParty}</div>
        </div>
      </div>
      <div style="font-size: 14px;">
        <span style="font-weight: 600;">${percentage}%</span>
        <span style="color: #666;"> (${winnerVotes.toLocaleString()} / ${totalVotes.toLocaleString()} votes)</span>
      </div>
    </div>
  `;
}
