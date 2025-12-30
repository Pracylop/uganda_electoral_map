import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import maplibregl from 'maplibre-gl';
import Map from '../components/Map';
import NationalDashboard from '../components/NationalDashboard';
import { api } from '../lib/api';
import { useWebSocket } from '../hooks/useWebSocket';
import type { DrillDownState, BreadcrumbItem } from '../hooks/useElectionMap';
import {
  LEVEL_NAMES,
  INITIAL_DRILL_DOWN,
  createResultsPopupHTML
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

  return { isPresentationMode, setIsPresentationMode, togglePresentationMode };
}

interface Election {
  id: number;
  name: string;
  electionDate: string;
  electionType: { name: string; code: string };
  electionTypeName?: string;
}

export function MapDashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [elections, setElections] = useState<Election[]>([]);
  const [selectedElection, setSelectedElection] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'map' | 'dashboard'>('map');
  const mapRef = useRef<maplibregl.Map | null>(null);

  // Presentation mode for TV broadcast
  const { isPresentationMode, togglePresentationMode } = usePresentationMode();

  // Drill-down state (left map / single map)
  const [drillDown, setDrillDown] = useState<DrillDownState>(INITIAL_DRILL_DOWN);

  // Comparison mode state
  const [isComparisonMode, setIsComparisonMode] = useState(false);
  const [rightElection, setRightElection] = useState<number | null>(null);
  const [rightDrillDown, setRightDrillDown] = useState<DrillDownState>(INITIAL_DRILL_DOWN);
  const [isSyncEnabled, setIsSyncEnabled] = useState(true);
  const [isSwingMode, setIsSwingMode] = useState(false); // Swing visualization toggle
  const rightMapRef = useRef<maplibregl.Map | null>(null);
  const isSyncingRef = useRef(false); // Prevent infinite sync loops
  const isSyncEnabledRef = useRef(true); // Ref for closure access
  const isProgrammaticMoveRef = useRef(false); // Disable sync during fitBounds

  // WebSocket connection for real-time updates
  useWebSocket((message) => {
    if (message.type === 'RESULT_APPROVED' && selectedElection) {
      const payload = message.payload as { electionId: number };
      // Refresh map if approved result is for current election
      if (payload.electionId === selectedElection) {
        loadElectionResults(selectedElection, drillDown.currentLevel, drillDown.currentParentId);
      }
    }
  });

  useEffect(() => {
    loadElections();
  }, []);

  useEffect(() => {
    const electionId = searchParams.get('election');
    if (electionId) {
      setSelectedElection(parseInt(electionId));
    } else if (elections.length > 0) {
      // Select first active election by default
      const activeElection = elections.find(e => e.electionDate);
      if (activeElection) {
        setSelectedElection(activeElection.id);
        setSearchParams({ election: activeElection.id.toString() });
      }
    }
  }, [elections, searchParams]);

  useEffect(() => {
    if (selectedElection && mapRef.current) {
      loadElectionResults(selectedElection, drillDown.currentLevel, drillDown.currentParentId);
    }
  }, [selectedElection, drillDown.currentLevel, drillDown.currentParentId]);

  // Keep sync ref in sync with state (for closure access)
  useEffect(() => {
    isSyncEnabledRef.current = isSyncEnabled;
  }, [isSyncEnabled]);

  const loadElections = async () => {
    try {
      setIsLoading(true);
      const data = await api.getElections();
      setElections(data);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load elections'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const loadElectionResults = async (
    electionId: number,
    level: number = 2,
    parentId: number | null = null
  ) => {
    const map = mapRef.current;
    if (!map) return;

    console.log('Loading election results for election:', electionId, 'level:', level, 'parentId:', parentId);

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

      // Add click handler for drill-down and popups
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
      });

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
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load election results'
      );
    }
  };

  const handleElectionChange = (electionId: number) => {
    setSelectedElection(electionId);
    setSearchParams({ election: electionId.toString() });
    // Reset drill-down state when election changes
    setDrillDown(INITIAL_DRILL_DOWN);
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

  const handleMapLoad = (map: maplibregl.Map) => {
    mapRef.current = map;
    if (selectedElection) {
      loadElectionResults(selectedElection, drillDown.currentLevel, drillDown.currentParentId);
    }

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
  };

  // Right map handlers for comparison mode
  const handleRightMapLoad = (map: maplibregl.Map) => {
    rightMapRef.current = map;
    if (rightElection) {
      loadElectionResultsForMap(map, rightElection, rightDrillDown.currentLevel, rightDrillDown.currentParentId, true);
    }

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
  };

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
    if (rightElection && rightMapRef.current && isComparisonMode) {
      loadElectionResultsForMap(rightMapRef.current, rightElection, rightDrillDown.currentLevel, rightDrillDown.currentParentId, true);
    }
  }, [rightElection, rightDrillDown.currentLevel, rightDrillDown.currentParentId, isComparisonMode]);

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
            {/* Comparison Mode Toggle */}
            {viewMode === 'map' && (
              <div>
                <label className="block text-sm font-medium mb-2">Compare</label>
                <button
                  onClick={() => {
                    setIsComparisonMode(!isComparisonMode);
                    if (!isComparisonMode && selectedElection) {
                      // When entering comparison mode, set right election to something different
                      const otherElection = elections.find(e => e.id !== selectedElection);
                      if (otherElection) {
                        setRightElection(otherElection.id);
                      }
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

      {/* Content Container */}
      <div className="flex-1 relative">
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

            <div className={`flex h-full ${isComparisonMode ? 'gap-1' : ''}`}>
              {/* Left Map Panel */}
            <div className={`relative ${isComparisonMode ? 'w-1/2' : 'w-full'} h-full`}>
              <Map onLoad={handleMapLoad} className="absolute inset-0" />

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
              <div className="relative w-1/2 h-full border-l border-gray-600">
                <Map onLoad={handleRightMapLoad} className="absolute inset-0" />

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
    </div>
  );
}
