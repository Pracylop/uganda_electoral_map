import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import maplibregl from 'maplibre-gl';
import Map from '../components/Map';
import { MapSettingsWidget } from '../components/MapSettingsWidget';
import NationalDashboard from '../components/NationalDashboard';
import { GestureTutorial, useGestureTutorial } from '../components/GestureTutorial';
import { GestureIndicator } from '../components/GestureIndicator';
import { PresentationControls } from '../components/PresentationControls';
import { useSwipeNavigation, SwipeIndicator } from '../hooks/useSwipeNavigation';
import { useWebSocket } from '../hooks/useWebSocket';
import { useElectionsWithOffline } from '../hooks/useElectionData';
import { invalidateElectionQueries } from '../lib/queryClient';
import { useEffectiveBasemap } from '../hooks/useOnlineStatus';
import type { DrillDownState, BreadcrumbItem } from '../hooks/useElectionMap';
import {
  LEVEL_NAMES,
  INITIAL_DRILL_DOWN,
  createResultsPopupHTML,
  createInitialDrillDown
} from '../hooks/useElectionMap';
import 'maplibre-gl/dist/maplibre-gl.css';

// Presentation mode hook for keyboard shortcuts
function usePresentationMode() {
  const [isPresentationMode, setIsPresentationMode] = useState(false);

  const togglePresentationMode = useCallback(() => {
    setIsPresentationMode(prev => {
      const newValue = !prev;
      // Request fullscreen when entering presentation mode
      if (newValue && document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(console.error);
      } else if (!newValue && document.fullscreenElement) {
        document.exitFullscreen().catch(console.error);
      }
      return newValue;
    });
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // F11 or Escape to toggle presentation mode
      if (e.key === 'F11') {
        e.preventDefault();
        togglePresentationMode();
      } else if (e.key === 'Escape' && isPresentationMode) {
        setIsPresentationMode(false);
      }
    };

    // Listen for fullscreen change events
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && isPresentationMode) {
        setIsPresentationMode(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [isPresentationMode, togglePresentationMode]);

  return { isPresentationMode, setIsPresentationMode, togglePresentationMode } as const;
}

// Election type from API
interface Election {
  id: number;
  name: string;
  year?: number;
  electionDate: string;
  electionType: { name: string; code: string; electoralLevel: number };
  electionTypeName: string;
  electionTypeCode: string;
  isActive: boolean;
  createdAt: string;
  _count: { candidates: number; results: number };
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

    const intersect = ((yi > y) !== (yj > y)) &&
      (x < (xj - xi) * (y - yi) / (yj - yi) + xi);

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

export function MapDashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedElection, setSelectedElection] = useState<number | null>(null);
  const [isMapDataLoading, setIsMapDataLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'map' | 'dashboard'>('map');
  const mapRef = useRef<maplibregl.Map | null>(null);

  // Load elections with offline support
  const { data: electionsData, isLoading } = useElectionsWithOffline();
  const elections: Election[] = electionsData ?? [];

  // Presentation mode for TV broadcast
  const { isPresentationMode, togglePresentationMode, setIsPresentationMode } = usePresentationMode();

  // Touch gesture tutorial
  const { showTutorial, dismissTutorial, openTutorial } = useGestureTutorial();

  // Map container ref for gesture indicator
  const mapContainerRef = useRef<HTMLDivElement>(null);

  // Drill-down state (left map / single map)
  const [drillDown, setDrillDown] = useState<DrillDownState>(INITIAL_DRILL_DOWN);

  // Comparison mode state
  const [isComparisonMode, setIsComparisonMode] = useState(false);
  const [rightElection, setRightElection] = useState<number | null>(null);
  const [rightDrillDown, setRightDrillDown] = useState<DrillDownState>(INITIAL_DRILL_DOWN);
  const [isSyncEnabled, setIsSyncEnabled] = useState(true);
  const [isSwingMode, setIsSwingMode] = useState(false); // Swing visualization toggle
  const [showPollingStations, setShowPollingStations] = useState(false); // Polling station markers toggle
  const [leftMapLoaded, setLeftMapLoaded] = useState(false); // Track when left map is ready
  const [rightMapLoaded, setRightMapLoaded] = useState(false); // Track when right map is ready
  const rightMapRef = useRef<maplibregl.Map | null>(null);
  const isSyncingRef = useRef(false); // Prevent infinite sync loops
  const isSyncEnabledRef = useRef(true); // Ref for closure access
  const isProgrammaticMoveRef = useRef(false); // Disable sync during fitBounds

  // Basemap click navigation refs
  const basemapClickHandlerRef = useRef<((e: maplibregl.MapMouseEvent) => void) | null>(null);
  const navigationPopupRef = useRef<maplibregl.Popup | null>(null);
  const districtDataCacheRef = useRef<GeoJSON.FeatureCollection | null>(null);

  // Results layer click handler ref (to prevent accumulating handlers)
  const resultsClickHandlerRef = useRef<((e: maplibregl.MapLayerMouseEvent) => void) | null>(null);

  // Track basemap changes to reload map data when basemap changes
  const effectiveBasemap = useEffectiveBasemap();
  const prevBasemapRef = useRef<string | null>(null);

  // WebSocket connection for real-time updates
  useWebSocket((message) => {
    if (message.type === 'RESULT_APPROVED' && selectedElection) {
      const payload = message.payload as { electionId: number };
      // Refresh map if approved result is for current election
      if (payload.electionId === selectedElection) {
        loadElectionResults(selectedElection, drillDown.currentLevel, drillDown.currentParentId);
        // Also invalidate React Query cache for offline support
        invalidateElectionQueries(payload.electionId);
      }
    }
  });

  useEffect(() => {
    const electionId = searchParams.get('election');
    if (electionId) {
      const parsedId = parseInt(electionId);
      setSelectedElection(parsedId);
      // Set appropriate initial level for the election type
      const election = elections.find(e => e.id === parsedId);
      if (election) {
        setDrillDown(createInitialDrillDown(election.electionType?.code));
      }
    } else if (elections.length > 0) {
      // Default to 2021 Presidential Election, or first available if not found
      const defaultElection = elections.find(e =>
        e.name === '2021 Presidential Election' ||
        (e.electionType?.code === 'PRES' && e.year === 2021)
      ) || elections.find(e => e.electionDate);

      if (defaultElection) {
        setSelectedElection(defaultElection.id);
        setSearchParams({ election: defaultElection.id.toString() });
        setDrillDown(createInitialDrillDown(defaultElection.electionType?.code));
      }
    }
  }, [elections, searchParams]);

  useEffect(() => {
    if (selectedElection && leftMapLoaded && mapRef.current) {
      loadElectionResults(selectedElection, drillDown.currentLevel, drillDown.currentParentId);
    }
  }, [selectedElection, drillDown.currentLevel, drillDown.currentParentId, leftMapLoaded]);

  // Detect basemap changes and reset map loaded state to trigger reload
  useEffect(() => {
    if (prevBasemapRef.current !== null && prevBasemapRef.current !== effectiveBasemap) {
      // Basemap changed - reset loaded states to trigger reload when map recreates
      setLeftMapLoaded(false);
      setRightMapLoaded(false);
    }
    prevBasemapRef.current = effectiveBasemap;
  }, [effectiveBasemap]);

  // Polling station clustering layer
  useEffect(() => {
    if (!mapRef.current || !leftMapLoaded) return;
    const map = mapRef.current;

    // Helper to remove polling station layers
    const removePollingStationLayers = () => {
      try {
        if (map.getLayer('polling-clusters')) map.removeLayer('polling-clusters');
        if (map.getLayer('polling-cluster-count')) map.removeLayer('polling-cluster-count');
        if (map.getLayer('polling-unclustered')) map.removeLayer('polling-unclustered');
        if (map.getSource('polling-stations')) map.removeSource('polling-stations');
      } catch (e) {
        // Layers may not exist
      }
    };

    // If not showing polling stations, remove layers and return
    if (!showPollingStations || !selectedElection) {
      removePollingStationLayers();
      return;
    }

    // Fetch and display polling stations
    const loadPollingStations = async () => {
      try {
        // Remove existing layers first
        removePollingStationLayers();

        // Fetch polling station GeoJSON
        const response = await fetch(
          `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/polling-stations/geojson?electionId=${selectedElection}`,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem('auth_token')}`
            }
          }
        );

        if (!response.ok) throw new Error('Failed to load polling stations');
        const geojson = await response.json();

        console.log('Loaded polling stations:', geojson.features?.length || 0, 'parishes');

        // Add clustered source
        map.addSource('polling-stations', {
          type: 'geojson',
          data: geojson,
          cluster: true,
          clusterMaxZoom: 14, // Max zoom to cluster points
          clusterRadius: 50,  // Cluster radius in pixels
          clusterProperties: {
            // Sum up station counts in clusters
            totalStations: ['+', ['get', 'stationCount']],
            totalVoters: ['+', ['get', 'totalVoters']]
          }
        });

        // Clustered circles layer
        map.addLayer({
          id: 'polling-clusters',
          type: 'circle',
          source: 'polling-stations',
          filter: ['has', 'point_count'],
          paint: {
            // Color based on cluster size
            'circle-color': [
              'step',
              ['get', 'point_count'],
              '#51bbd6',   // Blue for small clusters
              10, '#f1f075', // Yellow for medium
              50, '#f28cb1'  // Pink for large
            ],
            // Size based on cluster size
            'circle-radius': [
              'step',
              ['get', 'point_count'],
              15,    // 15px for < 10 points
              10, 20, // 20px for 10-50 points
              50, 25  // 25px for 50+ points
            ],
            'circle-stroke-width': 2,
            'circle-stroke-color': '#fff'
          }
        });

        // Cluster count labels
        map.addLayer({
          id: 'polling-cluster-count',
          type: 'symbol',
          source: 'polling-stations',
          filter: ['has', 'point_count'],
          layout: {
            'text-field': '{point_count_abbreviated}',
            'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
            'text-size': 12
          },
          paint: {
            'text-color': '#333'
          }
        });

        // Individual (unclustered) station markers
        map.addLayer({
          id: 'polling-unclustered',
          type: 'circle',
          source: 'polling-stations',
          filter: ['!', ['has', 'point_count']],
          paint: {
            'circle-color': '#ff8c00', // Orange for individual stations
            'circle-radius': 8,
            'circle-stroke-width': 2,
            'circle-stroke-color': '#fff'
          }
        });

        // Click on cluster to zoom in
        map.on('click', 'polling-clusters', (e) => {
          const features = map.queryRenderedFeatures(e.point, {
            layers: ['polling-clusters']
          });
          if (!features.length) return;

          const clusterId = features[0].properties?.cluster_id;
          const source = map.getSource('polling-stations') as maplibregl.GeoJSONSource;

          source.getClusterExpansionZoom(clusterId).then((zoom) => {
            map.easeTo({
              center: (features[0].geometry as GeoJSON.Point).coordinates as [number, number],
              zoom: zoom
            });
          });
        });

        // Click on individual station to show popup
        map.on('click', 'polling-unclustered', (e) => {
          if (!e.features || e.features.length === 0) return;
          const props = e.features[0].properties;
          const coords = (e.features[0].geometry as GeoJSON.Point).coordinates.slice() as [number, number];

          // Parse stations array (stored as string in GeoJSON properties)
          let stationsList = '';
          try {
            const stations = JSON.parse(props?.stations || '[]');
            stationsList = stations.slice(0, 5).map((s: any) => `<li>${s.name}</li>`).join('');
            if (stations.length > 5) {
              stationsList += `<li class="text-gray-400">+${stations.length - 5} more...</li>`;
            }
          } catch (e) {
            stationsList = '<li>Station data unavailable</li>';
          }

          new maplibregl.Popup()
            .setLngLat(coords)
            .setHTML(`
              <div style="font-family: system-ui; max-width: 250px;">
                <h3 style="font-weight: bold; margin: 0 0 8px 0; color: #333;">${props?.parishName || 'Parish'}</h3>
                <p style="margin: 0 0 4px 0; font-size: 12px; color: #666;">
                  ${props?.subcounty || ''} ${props?.constituency ? '• ' + props.constituency : ''}
                </p>
                <div style="display: flex; gap: 16px; margin: 8px 0; font-size: 13px;">
                  <div><strong>${props?.stationCount || 0}</strong> stations</div>
                  <div><strong>${(props?.totalVoters || 0).toLocaleString()}</strong> voters</div>
                </div>
                <div style="font-size: 12px; color: #555;">
                  <strong>Stations:</strong>
                  <ul style="margin: 4px 0 0 16px; padding: 0;">${stationsList}</ul>
                </div>
              </div>
            `)
            .addTo(map);
        });

        // Change cursor on hover
        map.on('mouseenter', 'polling-clusters', () => {
          map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', 'polling-clusters', () => {
          map.getCanvas().style.cursor = '';
        });
        map.on('mouseenter', 'polling-unclustered', () => {
          map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', 'polling-unclustered', () => {
          map.getCanvas().style.cursor = '';
        });

      } catch (err) {
        console.error('Failed to load polling stations:', err);
      }
    };

    loadPollingStations();

    // Cleanup on unmount or when dependencies change
    return () => {
      removePollingStationLayers();
    };
  }, [showPollingStations, selectedElection, leftMapLoaded]);

  // Keep sync ref in sync with state (for closure access)
  useEffect(() => {
    isSyncEnabledRef.current = isSyncEnabled;
  }, [isSyncEnabled]);

  // Resize maps when presentation mode changes
  useEffect(() => {
    const resizeMaps = () => {
      if (mapRef.current) {
        mapRef.current.resize();
      }
      if (rightMapRef.current) {
        rightMapRef.current.resize();
      }
    };
    // Resize immediately and after layout settles
    resizeMaps();
    const timer1 = setTimeout(resizeMaps, 100);
    const timer2 = setTimeout(resizeMaps, 300);
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [isPresentationMode]);

  const loadElectionResults = async (
    electionId: number,
    level: number = 2,
    parentId: number | null = null
  ) => {
    const map = mapRef.current;
    if (!map) return;

    console.log('Loading election results for election:', electionId, 'level:', level, 'parentId:', parentId);
    setIsMapDataLoading(true);

    try {
      // Use aggregated endpoint which has explode logic for MultiPolygons
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
      // Handle both direct GeoJSON and wrapped response formats
      const geojson = data.type === 'FeatureCollection' ? data : data;
      console.log('GeoJSON features count:', geojson.features?.length || 0);

      // Cache district-level data for basemap click navigation
      if (level === 2 && parentId === null) {
        districtDataCacheRef.current = geojson;
      }

      // Remove existing results layers if present
      try {
        if (map.getLayer('results-fill')) map.removeLayer('results-fill');
        if (map.getLayer('results-highlight')) map.removeLayer('results-highlight');
        if (map.getLayer('results-outline')) map.removeLayer('results-outline');
        if (map.getSource('results')) map.removeSource('results');
      } catch (e) {
        console.warn('Error removing existing layers:', e);
      }

      // Add GeoJSON source
      map.addSource('results', {
        type: 'geojson',
        data: geojson
      });

      // Add fill layer colored by winning party with smooth transitions
      map.addLayer({
        id: 'results-fill',
        type: 'fill',
        source: 'results',
        paint: {
          'fill-color': ['coalesce', ['get', 'winnerColor'], '#cccccc'],
          'fill-opacity': 0.75,
          'fill-opacity-transition': { duration: 800, delay: 0 },  // Smooth fade-in
          'fill-color-transition': { duration: 500, delay: 0 }     // Color morph
        }
      });

      // Add glow/highlight layer for hovered regions
      map.addLayer({
        id: 'results-highlight',
        type: 'fill',
        source: 'results',
        paint: {
          'fill-color': '#ffffff',
          'fill-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 0.3, 0],
          'fill-opacity-transition': { duration: 200, delay: 0 }
        }
      });

      // Add outline layer with emphasis
      map.addLayer({
        id: 'results-outline',
        type: 'line',
        source: 'results',
        paint: {
          'line-color': '#333333',
          'line-width': ['case', ['boolean', ['feature-state', 'hover'], false], 2, 0.5],
          'line-width-transition': { duration: 200, delay: 0 }
        }
      });

      // Remove existing click handler to prevent accumulation
      if (resultsClickHandlerRef.current) {
        map.off('click', 'results-fill', resultsClickHandlerRef.current);
      }

      // Add click handler for drill-down and popups
      const handleResultsClick = (e: maplibregl.MapLayerMouseEvent) => {
        if (!e.features || e.features.length === 0) return;

        const feature = e.features[0];
        const props = feature.properties;

        if (!props) return;

        const unitId = props.unitId;
        const unitName = props.unitName;
        const featureLevel = props.level || level;

        // If not at parish level (5), drill down to children
        if (featureLevel < 5) {
          const nextLevel = featureLevel + 1;
          const newDrillDownState = (prev: DrillDownState) => ({
            currentLevel: nextLevel,
            currentParentId: unitId,
            breadcrumb: [
              ...prev.breadcrumb,
              { id: unitId, name: unitName, level: featureLevel }
            ]
          });

          setDrillDown(newDrillDownState);

          // Mirror to right map if sync is enabled
          if (isSyncEnabledRef.current) {
            setRightDrillDown(newDrillDownState);
          }
          return;
        }

        // At parish level, show popup with results
        new maplibregl.Popup()
          .setLngLat(e.lngLat)
          .setHTML(createResultsPopupHTML(props))
          .addTo(map);
      };

      resultsClickHandlerRef.current = handleResultsClick;
      map.on('click', 'results-fill', handleResultsClick);

      // Track hovered feature for highlight effect
      let hoveredFeatureId: string | number | null = null;

      // Hover effects with highlight
      map.on('mousemove', 'results-fill', (e) => {
        map.getCanvas().style.cursor = 'pointer';

        if (e.features && e.features.length > 0) {
          const feature = e.features[0];
          const newId = feature.id;

          // Clear previous hover state
          if (hoveredFeatureId !== null && hoveredFeatureId !== newId) {
            map.setFeatureState(
              { source: 'results', id: hoveredFeatureId },
              { hover: false }
            );
          }

          // Set new hover state
          if (newId !== undefined && newId !== null) {
            hoveredFeatureId = newId;
            map.setFeatureState(
              { source: 'results', id: hoveredFeatureId },
              { hover: true }
            );
          }
        }
      });

      map.on('mouseleave', 'results-fill', () => {
        map.getCanvas().style.cursor = '';
        // Clear hover state
        if (hoveredFeatureId !== null) {
          map.setFeatureState(
            { source: 'results', id: hoveredFeatureId },
            { hover: false }
          );
          hoveredFeatureId = null;
        }
      });

      // Dramatic camera animation to results bounds
      // Disable sync during programmatic camera movement
      isProgrammaticMoveRef.current = true;

      // Animation options for broadcast-quality transitions
      const animationOptions = {
        padding: 50,
        duration: 1500,    // 1.5 second fly animation
        essential: true,   // Ensures animation runs even when prefers-reduced-motion
        curve: 1.2,        // Smooth easing curve
        easing: (t: number) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2  // Ease-in-out cubic
      };

      if (data.bbox && data.bbox.length === 4) {
        map.fitBounds(
          [[data.bbox[0], data.bbox[1]], [data.bbox[2], data.bbox[3]]],
          animationOptions
        );
      } else if (geojson.features && geojson.features.length > 0) {
        // Fallback: calculate bounds from features
        const bounds = new maplibregl.LngLatBounds();
        geojson.features.forEach((feature: any) => {
          if (feature.geometry?.type === 'Polygon' && feature.geometry.coordinates?.[0]) {
            feature.geometry.coordinates[0].forEach((coord: [number, number]) => {
              bounds.extend(coord);
            });
          }
        });
        if (!bounds.isEmpty()) {
          map.fitBounds(bounds, animationOptions);
        }
      }
      // Re-enable sync after animation completes
      setTimeout(() => { isProgrammaticMoveRef.current = false; }, 1600);
      setIsMapDataLoading(false);

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
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load election results'
      );
      setIsMapDataLoading(false);
    }
  };

  const handleElectionChange = (electionId: number) => {
    setSelectedElection(electionId);
    setSearchParams({ election: electionId.toString() });
    // Reset drill-down state with appropriate level for election type
    const election = elections.find(e => e.id === electionId);
    const initialState = createInitialDrillDown(election?.electionType?.code);
    setDrillDown(initialState);
  };

  // Navigate breadcrumb - go back to a specific level
  const handleBreadcrumbClick = (item: BreadcrumbItem) => {
    if (item.level === 0) {
      // Go back to national view (district level)
      setDrillDown(INITIAL_DRILL_DOWN);
      // Mirror to right map if sync is enabled
      if (isSyncEnabledRef.current) {
        setRightDrillDown(INITIAL_DRILL_DOWN);
      }
    } else {
      // Go back to a specific level
      const updateState = (prev: DrillDownState) => {
        const itemIndex = prev.breadcrumb.findIndex(b => b.id === item.id);
        const newBreadcrumb = prev.breadcrumb.slice(0, itemIndex + 1);
        return {
          currentLevel: item.level + 1,
          currentParentId: item.id,
          breadcrumb: newBreadcrumb
        };
      };
      setDrillDown(updateState);
      // Mirror to right map if sync is enabled
      if (isSyncEnabledRef.current) {
        setRightDrillDown(updateState);
      }
    }
  };

  // Go back one level (for swipe navigation)
  const goBackOneLevel = useCallback(() => {
    if (drillDown.breadcrumb.length > 1) {
      const parentItem = drillDown.breadcrumb[drillDown.breadcrumb.length - 2];
      handleBreadcrumbClick(parentItem);
    } else {
      // Already at top level, reset to initial
      setDrillDown(INITIAL_DRILL_DOWN);
      if (isSyncEnabledRef.current) {
        setRightDrillDown(INITIAL_DRILL_DOWN);
      }
    }
  }, [drillDown.breadcrumb]);

  // Navigate directly to a district (from basemap click)
  const navigateToDistrict = useCallback((districtId: number, districtName: string) => {
    const newDrillDownState: DrillDownState = {
      currentLevel: 3, // Show constituencies
      currentParentId: districtId,
      breadcrumb: [
        { id: 0, name: 'Uganda', level: 0 },
        { id: districtId, name: districtName, level: 2 }
      ]
    };
    setDrillDown(newDrillDownState);
    // Mirror to right map if sync is enabled
    if (isSyncEnabledRef.current) {
      setRightDrillDown(newDrillDownState);
    }
  }, []);

  // Navigate to next/previous election (for swipe navigation)
  const navigateElection = useCallback((direction: 'next' | 'prev') => {
    if (!selectedElection || elections.length === 0) return;
    const currentIndex = elections.findIndex(e => e.id === selectedElection);
    if (currentIndex === -1) return;

    let newIndex: number;
    if (direction === 'next') {
      newIndex = currentIndex < elections.length - 1 ? currentIndex + 1 : 0;
    } else {
      newIndex = currentIndex > 0 ? currentIndex - 1 : elections.length - 1;
    }

    handleElectionChange(elections[newIndex].id);
  }, [selectedElection, elections]);

  // Basemap click handler - navigate to district when clicking outside choropleth
  useEffect(() => {
    if (!mapRef.current || !leftMapLoaded) return;
    const map = mapRef.current;

    // Remove existing handler if any
    if (basemapClickHandlerRef.current) {
      map.off('click', basemapClickHandlerRef.current);
      basemapClickHandlerRef.current = null;
    }

    const handleBasemapClick = (e: maplibregl.MapMouseEvent) => {
      // Check if results layer exists
      const hasResultsLayer = map.getLayer('results-fill');

      // Check if click was on the results layer
      let features: maplibregl.MapGeoJSONFeature[] = [];
      try {
        if (hasResultsLayer) {
          features = map.queryRenderedFeatures(e.point, {
            layers: ['results-fill']
          });
        }
      } catch (err) {
        // Layer may not exist
      }

      // If clicked on results layer, let the other handler process it
      if (features && features.length > 0) {
        return;
      }

      // Need cached district data for point-in-polygon check
      if (!districtDataCacheRef.current) {
        return;
      }

      // Click was on basemap - check cached district data
      const { lng, lat } = e.lngLat;

      // Find which district contains the clicked point
      const clickedDistrict = districtDataCacheRef.current.features.find(feature => {
        if (!feature.geometry) return false;
        return pointInPolygon([lng, lat], feature.geometry);
      });

      if (clickedDistrict && clickedDistrict.properties) {
        const { unitId, unitName } = clickedDistrict.properties as { unitId: number; unitName: string };

        // Close any existing navigation popup
        if (navigationPopupRef.current) {
          navigationPopupRef.current.remove();
        }

        // Show navigation popup
        navigationPopupRef.current = new maplibregl.Popup({ closeOnClick: true, closeButton: false })
          .setLngLat(e.lngLat)
          .setHTML(`<div style="padding: 8px; font-family: system-ui; color: #333;"><strong>Navigating to ${unitName}</strong></div>`)
          .addTo(map);

        // Navigate to the district
        navigateToDistrict(unitId, unitName);
      }
    };

    basemapClickHandlerRef.current = handleBasemapClick;
    map.on('click', handleBasemapClick);

    return () => {
      if (basemapClickHandlerRef.current) {
        map.off('click', basemapClickHandlerRef.current);
      }
      if (navigationPopupRef.current) {
        navigationPopupRef.current.remove();
      }
    };
  }, [leftMapLoaded, navigateToDistrict]);

  // Swipe navigation - enable in presentation mode for touch gestures
  const swipeState = useSwipeNavigation({
    enabled: isPresentationMode && viewMode === 'map',
    onSwipeRight: goBackOneLevel,  // Swipe right = go back
    onSwipeUp: () => navigateElection('next'),
    onSwipeDown: () => navigateElection('prev'),
    swipeThreshold: 100,
  });

  const handleMapLoad = useCallback((map: maplibregl.Map) => {
    mapRef.current = map;
    setLeftMapLoaded(true);
    // Results will be loaded by the effect that watches leftMapLoaded

    // Set up sync handler for left map (only for user interactions)
    map.on('moveend', () => {
      if (!isSyncEnabledRef.current || isSyncingRef.current || isProgrammaticMoveRef.current || !rightMapRef.current) return;
      isSyncingRef.current = true;
      rightMapRef.current.jumpTo({
        center: map.getCenter(),
        zoom: map.getZoom(),
        bearing: map.getBearing(),
        pitch: map.getPitch()
      });
      isSyncingRef.current = false;
    });
  }, []);

  // Right map handlers for comparison mode
  const handleRightMapLoad = useCallback((map: maplibregl.Map) => {
    rightMapRef.current = map;
    setRightMapLoaded(true);
    // Results will be loaded by the effect that watches rightMapLoaded

    // Set up sync handler for right map (only for user interactions)
    map.on('moveend', () => {
      if (!isSyncEnabledRef.current || isSyncingRef.current || isProgrammaticMoveRef.current || !mapRef.current) return;
      isSyncingRef.current = true;
      mapRef.current.jumpTo({
        center: map.getCenter(),
        zoom: map.getZoom(),
        bearing: map.getBearing(),
        pitch: map.getPitch()
      });
      isSyncingRef.current = false;
    });
  }, []);

  const loadElectionResultsForMap = async (
    map: maplibregl.Map,
    electionId: number,
    level: number = 2,
    parentId: number | null = null,
    isRightMap: boolean = false
  ) => {
    if (!map) return;

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
      const geojson = data.type === 'FeatureCollection' ? data : data;

      // Remove existing layers
      try {
        if (map.getLayer('results-fill')) map.removeLayer('results-fill');
        if (map.getLayer('results-highlight')) map.removeLayer('results-highlight');
        if (map.getLayer('results-outline')) map.removeLayer('results-outline');
        if (map.getSource('results')) map.removeSource('results');
      } catch (e) {
        console.warn('Error removing existing layers:', e);
      }

      map.addSource('results', { type: 'geojson', data: geojson });

      // Fill layer with smooth transitions
      map.addLayer({
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

      // Highlight layer for hover
      map.addLayer({
        id: 'results-highlight',
        type: 'fill',
        source: 'results',
        paint: {
          'fill-color': '#ffffff',
          'fill-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 0.3, 0],
          'fill-opacity-transition': { duration: 200, delay: 0 }
        }
      });

      // Outline layer
      map.addLayer({
        id: 'results-outline',
        type: 'line',
        source: 'results',
        paint: {
          'line-color': '#333333',
          'line-width': ['case', ['boolean', ['feature-state', 'hover'], false], 2, 0.5],
          'line-width-transition': { duration: 200, delay: 0 }
        }
      });

      // Add click handler for drill-down (right map)
      if (isRightMap) {
        map.on('click', 'results-fill', (e) => {
          if (!e.features || e.features.length === 0) return;
          const feature = e.features[0];
          const props = feature.properties;
          if (!props) return;

          const unitId = props.unitId;
          const unitName = props.unitName;
          const featureLevel = props.level || level;

          // If not at parish level (5), drill down to children
          if (featureLevel < 5) {
            const nextLevel = featureLevel + 1;
            const newDrillDownState = (prev: DrillDownState) => ({
              currentLevel: nextLevel,
              currentParentId: unitId,
              breadcrumb: [
                ...prev.breadcrumb,
                { id: unitId, name: unitName, level: featureLevel }
              ]
            });

            setRightDrillDown(newDrillDownState);

            // Mirror to left map if sync is enabled
            if (isSyncEnabledRef.current) {
              setDrillDown(newDrillDownState);
            }
          }
        });

        // Hover effects with highlight for right map
        let rightHoveredId: string | number | null = null;

        map.on('mousemove', 'results-fill', (e) => {
          map.getCanvas().style.cursor = 'pointer';
          if (e.features && e.features.length > 0) {
            const newId = e.features[0].id;
            if (rightHoveredId !== null && rightHoveredId !== newId) {
              map.setFeatureState({ source: 'results', id: rightHoveredId }, { hover: false });
            }
            if (newId !== undefined && newId !== null) {
              rightHoveredId = newId;
              map.setFeatureState({ source: 'results', id: rightHoveredId }, { hover: true });
            }
          }
        });

        map.on('mouseleave', 'results-fill', () => {
          map.getCanvas().style.cursor = '';
          if (rightHoveredId !== null) {
            map.setFeatureState({ source: 'results', id: rightHoveredId }, { hover: false });
            rightHoveredId = null;
          }
        });
      }

      // Dramatic camera animation for right map
      if (data.bbox && data.bbox.length === 4) {
        isProgrammaticMoveRef.current = true;
        map.fitBounds(
          [[data.bbox[0], data.bbox[1]], [data.bbox[2], data.bbox[3]]],
          {
            padding: 50,
            duration: 1500,
            essential: true,
            curve: 1.2,
            easing: (t: number) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
          }
        );
        setTimeout(() => { isProgrammaticMoveRef.current = false; }, 1600);
      }
    } catch (err) {
      console.error('Error loading map data:', err);
    }
  };

  // Handle right election change
  const handleRightElectionChange = (electionId: number) => {
    setRightElection(electionId);
    setRightDrillDown(INITIAL_DRILL_DOWN);
  };

  // Handle right breadcrumb click
  const handleRightBreadcrumbClick = (item: BreadcrumbItem) => {
    if (item.level === 0) {
      setRightDrillDown(INITIAL_DRILL_DOWN);
      // Mirror to left map if sync is enabled
      if (isSyncEnabledRef.current) {
        setDrillDown(INITIAL_DRILL_DOWN);
      }
    } else {
      const updateState = (prev: DrillDownState) => {
        const itemIndex = prev.breadcrumb.findIndex(b => b.id === item.id);
        const newBreadcrumb = prev.breadcrumb.slice(0, itemIndex + 1);
        return {
          currentLevel: item.level + 1,
          currentParentId: item.id,
          breadcrumb: newBreadcrumb
        };
      };
      setRightDrillDown(updateState);
      // Mirror to left map if sync is enabled
      if (isSyncEnabledRef.current) {
        setDrillDown(updateState);
      }
    }
  };

  // Effect to load right map results when election or drill-down changes
  useEffect(() => {
    if (rightElection && rightMapLoaded && rightMapRef.current && isComparisonMode) {
      loadElectionResultsForMap(rightMapRef.current, rightElection, rightDrillDown.currentLevel, rightDrillDown.currentParentId, true);
    }
  }, [rightElection, rightDrillDown.currentLevel, rightDrillDown.currentParentId, isComparisonMode, rightMapLoaded]);

  // Load swing data for comparison visualization
  const loadSwingData = async (
    election1Id: number,
    election2Id: number,
    level: number = 2,
    parentId: number | null = null
  ) => {
    const map = mapRef.current;
    if (!map) return;

    try {
      let url = `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/map/swing/${election1Id}/${election2Id}?level=${level}`;
      if (parentId !== null) {
        url += `&parentId=${parentId}`;
      }

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`
        }
      });

      if (!response.ok) throw new Error('Failed to load swing data');

      const data = await response.json();

      // Remove existing layers
      try {
        if (map.getLayer('results-fill')) map.removeLayer('results-fill');
        if (map.getLayer('results-highlight')) map.removeLayer('results-highlight');
        if (map.getLayer('results-outline')) map.removeLayer('results-outline');
        if (map.getLayer('swing-labels')) map.removeLayer('swing-labels');
        if (map.getSource('results')) map.removeSource('results');
      } catch (e) {
        console.warn('Error removing existing layers:', e);
      }

      map.addSource('results', { type: 'geojson', data });

      // Swing fill layer - uses swingColor for regions that changed, gradient for others
      map.addLayer({
        id: 'results-fill',
        type: 'fill',
        source: 'results',
        paint: {
          'fill-color': [
            'case',
            ['==', ['get', 'swingType'], 'changed'], ['get', 'swingColor'],
            ['==', ['get', 'swingType'], 'new'], ['get', 'swingColor'],
            ['==', ['get', 'swingType'], 'gained'], ['get', 'swingColor'],
            ['==', ['get', 'swingType'], 'lost'], ['get', 'swingColor'],
            '#808080' // no_data
          ],
          'fill-opacity': [
            'case',
            ['==', ['get', 'swingType'], 'changed'], 0.9,  // Highlight changed regions
            0.7
          ],
          'fill-opacity-transition': { duration: 800, delay: 0 }
        }
      });

      // Highlight layer for hover
      map.addLayer({
        id: 'results-highlight',
        type: 'fill',
        source: 'results',
        paint: {
          'fill-color': '#ffffff',
          'fill-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 0.3, 0]
        }
      });

      // Outline - thicker for changed regions
      map.addLayer({
        id: 'results-outline',
        type: 'line',
        source: 'results',
        paint: {
          'line-color': [
            'case',
            ['==', ['get', 'swingType'], 'changed'], '#ffff00', // Yellow border for changed
            '#333333'
          ],
          'line-width': [
            'case',
            ['==', ['get', 'swingType'], 'changed'], 3,
            0.5
          ]
        }
      });

      // Fit bounds
      if (data.bbox && data.bbox.length === 4) {
        isProgrammaticMoveRef.current = true;
        map.fitBounds(
          [[data.bbox[0], data.bbox[1]], [data.bbox[2], data.bbox[3]]],
          { padding: 50, duration: 1500, essential: true }
        );
        setTimeout(() => { isProgrammaticMoveRef.current = false; }, 1600);
      }

    } catch (err) {
      console.error('Error loading swing data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load swing data');
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className={`flex-1 flex flex-col bg-gray-900 text-white overflow-hidden ${isPresentationMode ? 'presentation-mode' : ''}`}>
      {/* Header - Hidden in presentation mode */}
      {!isPresentationMode && (
      <div className="bg-gray-800 px-6 py-4 border-b border-gray-700">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">
              {viewMode === 'map' ? 'Electoral Map' : 'National Results Dashboard'}
            </h1>
            <p className="text-gray-400 mt-1">
              {viewMode === 'map'
                ? 'Interactive visualization of election results'
                : 'Live national election results'}
            </p>
          </div>
          <div className="flex gap-4 items-end">
            {/* View Mode Toggle */}
            <div>
              <label className="block text-sm font-medium mb-2">View Mode</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setViewMode('map')}
                  className={`px-4 py-2 rounded-md transition-colors ${
                    viewMode === 'map'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  Map
                </button>
                <button
                  onClick={() => setViewMode('dashboard')}
                  className={`px-4 py-2 rounded-md transition-colors ${
                    viewMode === 'dashboard'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                  disabled={!selectedElection}
                >
                  Dashboard
                </button>
              </div>
            </div>
            {/* Polling Stations Toggle */}
            {viewMode === 'map' && (
              <div>
                <label className="block text-sm font-medium mb-2">Stations</label>
                <button
                  onClick={() => setShowPollingStations(!showPollingStations)}
                  disabled={!selectedElection}
                  className={`px-4 py-2 rounded-md transition-colors ${
                    showPollingStations
                      ? 'bg-orange-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  } ${!selectedElection ? 'opacity-50 cursor-not-allowed' : ''}`}
                  title="Show polling station markers"
                >
                  {showPollingStations ? 'Hide' : 'Show'}
                </button>
              </div>
            )}
            {/* Comparison Mode Toggle */}
            {viewMode === 'map' && (
              <div>
                <label className="block text-sm font-medium mb-2">Compare</label>
                <button
                  onClick={() => {
                    const enteringComparisonMode = !isComparisonMode;
                    setIsComparisonMode(enteringComparisonMode);
                    if (enteringComparisonMode && selectedElection) {
                      // When entering comparison mode, set right election to something different
                      const otherElection = elections.find(e => e.id !== selectedElection);
                      if (otherElection) {
                        setRightElection(otherElection.id);
                      }
                    } else {
                      // When exiting comparison mode, reset right map state
                      setRightMapLoaded(false);
                      rightMapRef.current = null;
                    }
                  }}
                  className={`px-4 py-2 rounded-md transition-colors ${
                    isComparisonMode
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {isComparisonMode ? 'Exit Compare' : 'Compare Elections'}
                </button>
              </div>
            )}
            {/* Presentation Mode Toggle */}
            {viewMode === 'map' && (
              <div>
                <label className="block text-sm font-medium mb-2">Broadcast</label>
                <button
                  onClick={togglePresentationMode}
                  className="px-4 py-2 rounded-md transition-colors bg-purple-600 text-white hover:bg-purple-700"
                  title="Press F11 to toggle (Esc to exit)"
                >
                  Present
                </button>
              </div>
            )}
            {/* Election Selector - only show in single map mode */}
            {!isComparisonMode && (
              <div className="w-64">
                <label className="block text-sm font-medium mb-2">
                  Select Election
                </label>
                <select
                  value={selectedElection || ''}
                  onChange={(e) => handleElectionChange(parseInt(e.target.value))}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Choose an election...</option>
                  {elections.map((election) => (
                    <option key={election.id} value={election.id}>
                      {election.name} ({new Date(election.electionDate).toLocaleDateString()})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      </div>
      )}

      {/* Presentation Mode Overlay - Minimal UI for broadcast */}
      {isPresentationMode && selectedElection && (
        <div className="absolute top-0 left-0 right-0 z-50 pointer-events-none">
          {/* Election Title Bar */}
          <div className="flex justify-between items-start p-4">
            <div className="bg-black/70 backdrop-blur-sm px-6 py-3 rounded-lg pointer-events-auto">
              <h1 className="text-2xl font-bold text-white">
                {elections.find(e => e.id === selectedElection)?.name}
              </h1>
              <p className="text-gray-300 text-sm">
                {LEVEL_NAMES[drillDown.currentLevel]} View
                {drillDown.breadcrumb.length > 1 && ` - ${drillDown.breadcrumb[drillDown.breadcrumb.length - 1].name}`}
              </p>
            </div>
            {/* Exit Button */}
            <button
              onClick={togglePresentationMode}
              className="bg-red-600/80 hover:bg-red-600 text-white px-4 py-2 rounded-lg pointer-events-auto transition-colors"
            >
              Exit (Esc)
            </button>
          </div>
        </div>
      )}

      {/* Error Display - Hidden in presentation mode */}
      {!isPresentationMode && error && (
        <div className="bg-red-900/50 border border-red-700 rounded-md p-4 m-6">
          <p className="text-red-200">{error}</p>
        </div>
      )}

      {/* Content Container - use absolute positioning for proper height */}
      <div className="flex-1 relative overflow-hidden">
        {viewMode === 'map' ? (
          <>
            {/* Comparison Mode Controls - Floating Center - Hidden in presentation mode */}
            {isComparisonMode && !isPresentationMode && (
              <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-20 flex gap-2">
                {/* Swing Mode Toggle */}
                <button
                  onClick={() => {
                    setIsSwingMode(!isSwingMode);
                    // When enabling swing mode, load swing data
                    if (!isSwingMode && selectedElection && rightElection) {
                      loadSwingData(selectedElection, rightElection, drillDown.currentLevel, drillDown.currentParentId);
                    }
                  }}
                  className={`px-4 py-2 rounded-lg shadow-lg font-medium transition-colors ${
                    isSwingMode
                      ? 'bg-orange-600 text-white hover:bg-orange-700'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                  title="Show swing analysis between elections"
                >
                  {isSwingMode ? '📊 Swing View' : '📈 Compare'}
                </button>
                {/* Sync Toggle */}
                <button
                  onClick={() => setIsSyncEnabled(!isSyncEnabled)}
                  className={`px-4 py-2 rounded-lg shadow-lg font-medium transition-colors ${
                    isSyncEnabled
                      ? 'bg-purple-600 text-white hover:bg-purple-700'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {isSyncEnabled ? '🔗 Sync On' : '🔓 Sync Off'}
                </button>
              </div>
            )}

            <div ref={mapContainerRef} className={`absolute inset-0 flex ${isComparisonMode ? 'gap-1' : ''}`}>
              {/* Left Map Panel */}
            <div className={`relative ${isComparisonMode ? 'w-1/2' : 'w-full'}`}>
              <Map key="left-map" onLoad={handleMapLoad} className="absolute inset-0" />

              {/* Map Settings Widget */}
              {!isPresentationMode && (
                <MapSettingsWidget position="bottom-left" />
              )}

              {/* Loading Indicator */}
              {isMapDataLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 z-20">
                  <div className="bg-gray-800 rounded-lg px-6 py-4 flex items-center gap-4 shadow-xl">
                    <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    <span className="text-white font-medium">Loading election data...</span>
                  </div>
                </div>
              )}

              {/* Left Election Selector for comparison mode - Hidden in presentation mode */}
              {isComparisonMode && !isPresentationMode && (
                <div className="absolute top-4 right-4 bg-blue-600 px-3 py-1 rounded-lg shadow-lg z-10">
                  <select
                    value={selectedElection || ''}
                    onChange={(e) => handleElectionChange(parseInt(e.target.value))}
                    className="bg-transparent text-white text-sm font-medium focus:outline-none cursor-pointer"
                  >
                    {elections.map((election) => (
                      <option key={election.id} value={election.id} className="text-gray-900">
                        {election.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Breadcrumb Navigation - Hidden in presentation mode */}
              {selectedElection && !isPresentationMode && (
                <div className="absolute top-4 left-4 bg-gray-800/95 backdrop-blur-sm px-4 py-2 rounded-lg shadow-lg z-10 max-w-[80%]">
                  <div className="flex items-center gap-2 text-sm flex-wrap">
                    {drillDown.breadcrumb.map((item, index) => (
                      <span key={item.id} className="flex items-center">
                        {index > 0 && <span className="mx-1 text-gray-500">›</span>}
                        <button
                          onClick={() => handleBreadcrumbClick(item)}
                          className={`hover:text-blue-400 transition-colors ${
                            index === drillDown.breadcrumb.length - 1
                              ? 'text-white font-medium'
                              : 'text-gray-400'
                          }`}
                        >
                          {item.name}
                        </button>
                      </span>
                    ))}
                    {drillDown.currentLevel <= 5 && (
                      <span className="flex items-center">
                        <span className="mx-1 text-gray-500">›</span>
                        <span className="text-blue-400 font-medium">
                          {LEVEL_NAMES[drillDown.currentLevel]}s
                        </span>
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Legend - Hidden in presentation mode */}
              {selectedElection && !isPresentationMode && (
                <div className={`absolute bottom-6 left-6 bg-gray-800 rounded-lg shadow-lg ${isComparisonMode ? 'p-2 text-xs' : 'p-4 max-w-xs'}`}>
                  <h3 className={`font-bold ${isComparisonMode ? 'mb-1 text-sm' : 'mb-2'}`}>
                    {LEVEL_NAMES[drillDown.currentLevel]} Map
                  </h3>
                  <p className={`text-gray-400 ${isComparisonMode ? '' : 'text-sm mb-2'}`}>
                    Colored by winner
                  </p>
                  {!isComparisonMode && (
                    <p className="text-xs text-gray-500">
                      {drillDown.currentLevel < 5
                        ? 'Click on any region to drill down'
                        : 'Click on any parish to see detailed results'}
                    </p>
                  )}
                </div>
              )}

            </div>

            {/* Right Map Panel (Comparison Mode) */}
            {isComparisonMode && (
              <div className="relative w-1/2 border-l border-gray-600">
                <Map key="right-map" onLoad={handleRightMapLoad} className="absolute inset-0" />

                {/* Right Election Selector - Hidden in presentation mode */}
                {!isPresentationMode && (
                <div className="absolute top-4 right-4 bg-green-600 px-3 py-1 rounded-lg shadow-lg z-10">
                  <select
                    value={rightElection || ''}
                    onChange={(e) => handleRightElectionChange(parseInt(e.target.value))}
                    className="bg-transparent text-white text-sm font-medium focus:outline-none cursor-pointer"
                  >
                    {elections.map((election) => (
                      <option key={election.id} value={election.id} className="text-gray-900">
                        {election.name}
                      </option>
                    ))}
                  </select>
                </div>
                )}

                {/* Right Breadcrumb Navigation - Hidden in presentation mode */}
                {rightElection && !isPresentationMode && (
                  <div className="absolute top-4 left-4 bg-gray-800/95 backdrop-blur-sm px-4 py-2 rounded-lg shadow-lg z-10 max-w-[70%]">
                    <div className="flex items-center gap-2 text-sm flex-wrap">
                      {rightDrillDown.breadcrumb.map((item, index) => (
                        <span key={item.id} className="flex items-center">
                          {index > 0 && <span className="mx-1 text-gray-500">›</span>}
                          <button
                            onClick={() => handleRightBreadcrumbClick(item)}
                            className={`hover:text-blue-400 transition-colors ${
                              index === rightDrillDown.breadcrumb.length - 1
                                ? 'text-white font-medium'
                                : 'text-gray-400'
                            }`}
                          >
                            {item.name}
                          </button>
                        </span>
                      ))}
                      {rightDrillDown.currentLevel <= 5 && (
                        <span className="flex items-center">
                          <span className="mx-1 text-gray-500">›</span>
                          <span className="text-green-400 font-medium">
                            {LEVEL_NAMES[rightDrillDown.currentLevel]}s
                          </span>
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Right Map Legend - Hidden in presentation mode */}
                {rightElection && !isPresentationMode && (
                  <div className="absolute bottom-6 left-6 bg-gray-800 p-2 rounded-lg shadow-lg text-xs">
                    <h3 className="font-bold mb-1 text-sm">
                      {LEVEL_NAMES[rightDrillDown.currentLevel]} Map
                    </h3>
                    <p className="text-gray-400">
                      Colored by winner
                    </p>
                  </div>
                )}
              </div>
            )}
            </div>
          </>
        ) : (
          <>
            {selectedElection ? (
              <div className="h-full overflow-auto">
                <NationalDashboard electionId={selectedElection} />
              </div>
            ) : (
              <div className="flex justify-center items-center h-full">
                <p className="text-gray-400 text-lg">
                  Please select an election to view the dashboard
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Touch Gesture Components - Map specific */}
      {viewMode === 'map' && (
        <>
          {/* Gesture Tutorial Overlay */}
          <GestureTutorial isVisible={showTutorial} onDismiss={dismissTutorial} />

          {/* Gesture Visual Indicator */}
          <GestureIndicator
            containerRef={mapContainerRef}
            enabled={!showTutorial}
          />

          {/* Swipe Navigation Indicator */}
          <SwipeIndicator
            direction={swipeState.direction}
            progress={swipeState.progress}
            isEdgeSwipe={swipeState.isEdgeSwipe}
            labels={{
              left: 'Drill Down',
              right: 'Go Back',
              up: 'Next Election',
              down: 'Previous Election'
            }}
          />
        </>
      )}

      {/* Presentation Mode Touch Controls - works in both map and dashboard */}
      <PresentationControls
        isPresentationMode={isPresentationMode}
        onExitPresentation={() => setIsPresentationMode(false)}
        onPreviousLevel={viewMode === 'map' && drillDown.breadcrumb.length > 1 ? goBackOneLevel : undefined}
        onNextLevel={undefined}  // Drill-down is via tap, not button
        onPreviousElection={() => navigateElection('prev')}
        onNextElection={() => navigateElection('next')}
        onToggleDashboard={() => setViewMode(viewMode === 'map' ? 'dashboard' : 'map')}
        onShowHelp={openTutorial}
        currentLevel={viewMode === 'map' ? LEVEL_NAMES[drillDown.currentLevel] : 'Dashboard'}
        currentElection={elections.find(e => e.id === selectedElection)?.name}
        showDashboard={viewMode === 'dashboard'}
      />

      {/* Help Button - visible when not in presentation mode (touch devices) */}
      {!isPresentationMode && viewMode === 'map' && (
        <button
          onClick={openTutorial}
          className="fixed bottom-6 right-6 w-14 h-14 bg-gray-800 hover:bg-gray-700 rounded-full shadow-lg flex items-center justify-center text-white z-30 transition-colors md:hidden"
          title="Touch Gestures Help"
          style={{ display: 'ontouchstart' in window ? 'flex' : 'none' }}
        >
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
            <path d="M11 18h2v-2h-2v2zm1-16C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-14c-2.21 0-4 1.79-4 4h2c0-1.1.9-2 2-2s2 .9 2 2c0 2-3 1.75-3 5h2c0-2.25 3-2.5 3-5 0-2.21-1.79-4-4-4z" />
          </svg>
        </button>
      )}
    </div>
  );
}
