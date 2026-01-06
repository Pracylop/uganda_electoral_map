import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import maplibregl from 'maplibre-gl';
import MapComponent from '../components/Map';
import { MapSettingsWidget } from '../components/MapSettingsWidget';
import { useEffectiveBasemap } from '../hooks/useOnlineStatus';
import { IssueSlideOutPanel } from '../components/IssueSlideOutPanel';
import { IssueBreadcrumb } from '../components/IssueBreadcrumb';
import { api } from '../lib/api';
import 'maplibre-gl/dist/maplibre-gl.css';

interface IssueCategory {
  id: number;
  name: string;
  code: string;
  color: string | null;
  severity: number;
}

interface Issue {
  id: number;
  date: string;
  time: string | null;
  summary: string;
  fullText: string | null;
  location: string | null;
  village: string | null;
  status: string;
  issueCategory: { id: number; name: string; code: string; color: string | null; severity: number };
  district: { id: number; name: string } | null;
  constituency: { id: number; name: string } | null;
}

interface DrillDownItem {
  level: number;
  regionId: number | null;
  regionName: string;
}

interface PanelData {
  unitId: number;
  unitName: string;
  level: number;
  issueCount: number;
  injuries: number;
  deaths: number;
  arrests: number;
  topCategories: { name: string; count: number }[];
}

const severityColors: Record<number, string> = {
  1: '#10B981',
  2: '#3B82F6',
  3: '#F59E0B',
  4: '#F97316',
  5: '#EF4444',
};

const severityLabels: Record<number, string> = {
  1: 'Low',
  2: 'Medium-Low',
  3: 'Medium',
  4: 'High',
  5: 'Critical',
};

// Uganda bounding box [west, south, east, north]
const UGANDA_BOUNDS: [[number, number], [number, number]] = [
  [29.5, -1.5],  // Southwest corner
  [35.0, 4.3]    // Northeast corner
];

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

export function IssuesDashboard() {
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [categories, setCategories] = useState<IssueCategory[]>([]);

  // Track basemap changes to reload map data when basemap changes
  const effectiveBasemap = useEffectiveBasemap();
  const prevBasemapRef = useRef<string | null>(null);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');
  const [mapType, setMapType] = useState<'choropleth' | 'points'>('choropleth');
  const [choroplethMetadata, setChoroplethMetadata] = useState<{ totalIssues: number; unitsWithIssues: number; maxIssuesPerUnit: number } | null>(null);

  // In-memory cache for choropleth data
  const dataCache = useRef(new Map<string, CachedIssueData>());

  // Click handler ref for proper cleanup
  const clickHandlerRef = useRef<((e: maplibregl.MapLayerMouseEvent) => void) | null>(null);

  // Basemap click handler ref for proper cleanup
  const basemapClickHandlerRef = useRef<((e: maplibregl.MapMouseEvent) => void) | null>(null);

  // Navigation popup ref for basemap click feedback
  const navigationPopupRef = useRef<maplibregl.Popup | null>(null);

  // Loading state
  const [isLoading, setIsLoading] = useState(false);

  // Drill-down state
  const [drillDownStack, setDrillDownStack] = useState<DrillDownItem[]>([
    { level: 2, regionId: null, regionName: 'Uganda' }
  ]);
  const currentLevel = drillDownStack[drillDownStack.length - 1];

  // Interaction mode
  const [interactionMode, setInteractionMode] = useState<'drill-down' | 'data'>('drill-down');

  // Slide-out panel state
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelData, setPanelData] = useState<PanelData | null>(null);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [selectedSeverity, setSelectedSeverity] = useState<number | null>(null);
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: '', end: '' });

  // Load categories
  useEffect(() => {
    api.getIssueCategories()
      .then(setCategories)
      .catch((err) => console.error('Failed to load categories:', err));
  }, []);

  // Load issues for list view
  useEffect(() => {
    const params: any = { limit: 500 };
    if (selectedCategory) params.categoryId = selectedCategory;
    if (dateRange.start) params.startDate = dateRange.start;
    if (dateRange.end) params.endDate = dateRange.end;

    api.getIssues(params)
      .then((data) => {
        let filtered = data.issues as Issue[];
        if (selectedSeverity) {
          filtered = filtered.filter(i => i.issueCategory.severity === selectedSeverity);
        }
        setIssues(filtered);
        setTotalCount(data.total);
      })
      .catch((err) => console.error('Failed to load issues:', err));
  }, [selectedCategory, selectedSeverity, dateRange]);

  // Handle map load
  const handleMapLoad = useCallback((map: maplibregl.Map) => {
    mapRef.current = map;
    setMapLoaded(true);
    // Zoom to show entire Uganda on initial load
    map.fitBounds(UGANDA_BOUNDS, { padding: 50, duration: 1000 });
  }, []);

  // Detect basemap changes and reset map loaded state to trigger reload
  useEffect(() => {
    if (prevBasemapRef.current !== null && prevBasemapRef.current !== effectiveBasemap) {
      // Basemap changed - reset loaded state to trigger reload when map recreates
      setMapLoaded(false);
    }
    prevBasemapRef.current = effectiveBasemap;
  }, [effectiveBasemap]);

  // Navigate directly to a district (from basemap click)
  const navigateToDistrict = useCallback((districtId: number, districtName: string) => {
    // Reset stack to: Uganda > District (showing constituencies at level 3)
    setDrillDownStack([
      { level: 2, regionId: null, regionName: 'Uganda' },
      { level: 3, regionId: districtId, regionName: districtName }
    ]);
  }, []);

  // Check if filters are applied (need fresh API calls when filters active)
  const hasFilters = selectedCategory || selectedSeverity || dateRange.start || dateRange.end;

  // Load choropleth on map
  useEffect(() => {
    if (!mapRef.current || !mapLoaded || mapType !== 'choropleth') return;
    const map = mapRef.current;
    let aborted = false;

    const loadChoropleth = async () => {
      // Remove existing click handler first (using stored ref)
      if (clickHandlerRef.current && map.getLayer('issues-choropleth-fill')) {
        map.off('click', 'issues-choropleth-fill', clickHandlerRef.current);
        clickHandlerRef.current = null;
      }

      // Remove existing layers (event handlers are cleaned up with layer removal)
      try {
        ['issues-choropleth-fill', 'issues-choropleth-line', 'issues-choropleth-labels',
         'issues-clusters', 'issues-cluster-count', 'issues-points'].forEach(layerId => {
          if (map.getLayer(layerId)) map.removeLayer(layerId);
        });
        ['issues-choropleth', 'issues'].forEach(sourceId => {
          if (map.getSource(sourceId)) map.removeSource(sourceId);
        });
      } catch (e) {
        // Layers may not exist yet
      }

      try {
        let displayData: GeoJSON.FeatureCollection;
        let metadata: { totalIssues: number; unitsWithIssues: number; maxIssuesPerUnit: number };

        // If filters are active, always fetch fresh data (no caching with filters)
        if (hasFilters) {
          setIsLoading(true);
          const params: any = { level: currentLevel.level };
          if (currentLevel.regionId) params.parentId = currentLevel.regionId;
          if (selectedCategory) params.categoryId = selectedCategory;
          if (selectedSeverity) params.severity = selectedSeverity;
          if (dateRange.start) params.startDate = dateRange.start;
          if (dateRange.end) params.endDate = dateRange.end;

          const choroplethData = await api.getIssuesChoropleth(params);
          displayData = choroplethData as GeoJSON.FeatureCollection;
          metadata = choroplethData.metadata;
        } else {
          // No filters - use caching with client-side filtering
          const cacheKey = getLevelCacheKey(currentLevel.level);
          let levelData = dataCache.current.get(cacheKey);

          // If level not cached, fetch ALL data for this level
          if (!levelData) {
            setIsLoading(true);
            console.log(`Issues: Fetching level ${currentLevel.level} data...`);
            const data = await api.getIssuesChoropleth({ level: currentLevel.level });
            if (data?.features?.length > 0) {
              levelData = { geojson: data as GeoJSON.FeatureCollection, metadata: data.metadata };
              dataCache.current.set(cacheKey, levelData);
              console.log(`Issues: Cached level ${currentLevel.level} - ${levelData.geojson.features.length} features`);
            }
          } else {
            console.log(`Issues: Using cached level ${currentLevel.level} data`);
          }

          if (!levelData) {
            console.error('No data for this level');
            return;
          }

          // Filter by parentId if needed (client-side, instant!)
          if (currentLevel.regionId !== null) {
            displayData = filterFeaturesByParent(levelData.geojson, currentLevel.regionId);
            metadata = recalculateMetadata(displayData.features);
            console.log(`Issues: Filtered to ${displayData.features.length} features for parent ${currentLevel.regionId}`);
          } else {
            displayData = levelData.geojson;
            metadata = levelData.metadata;
          }
        }

        // Check if aborted before continuing
        if (aborted) return;

        setChoroplethMetadata(metadata);

        if (!displayData || displayData.features.length === 0) {
          console.warn('No features to display');
          return;
        }

        // Check again after potential async operations
        if (aborted) return;

        // Add source
        map.addSource('issues-choropleth', {
          type: 'geojson',
          data: displayData,
        });

        // Fill layer
        map.addLayer({
          id: 'issues-choropleth-fill',
          type: 'fill',
          source: 'issues-choropleth',
          paint: {
            'fill-color': ['get', 'fillColor'],
            'fill-opacity': 0.85,
          },
        });

        // Outline layer
        map.addLayer({
          id: 'issues-choropleth-line',
          type: 'line',
          source: 'issues-choropleth',
          paint: {
            'line-color': '#1f2937',
            'line-width': 1,
          },
        });

        // Fit bounds to features if drilling down
        if (displayData.features.length > 0 && currentLevel.regionId) {
          const bounds = new maplibregl.LngLatBounds();
          displayData.features.forEach(feature => {
            const coords = (feature.geometry as any).coordinates;
            const addCoords = (c: any) => {
              if (typeof c[0] === 'number') {
                bounds.extend(c as [number, number]);
              } else {
                c.forEach(addCoords);
              }
            };
            addCoords(coords);
          });
          map.fitBounds(bounds, { padding: 50, duration: 500 });
        }

        // Click handler for regions - store in ref for proper cleanup
        const handleClick = (e: maplibregl.MapLayerMouseEvent) => {
          if (!e.features || e.features.length === 0) return;
          const props = e.features[0].properties;
          if (!props) return;

          // Parse top categories
          let topCategories: { name: string; count: number }[] = [];
          if (props.topCategories) {
            try {
              topCategories = JSON.parse(props.topCategories);
            } catch (err) {
              // Ignore parse errors
            }
          }

          const featureData: PanelData = {
            unitId: props.unitId,
            unitName: props.unitName,
            level: props.level,
            issueCount: props.issueCount,
            injuries: props.injuries || 0,
            deaths: props.deaths || 0,
            arrests: props.arrests || 0,
            topCategories,
          };

          if (interactionMode === 'drill-down') {
            if (props.level < 5 && props.issueCount > 0) {
              // Drill down to children
              setDrillDownStack(prev => [...prev, {
                level: props.level + 1,
                regionId: props.unitId,
                regionName: props.unitName
              }]);
            } else {
              // At parish level or no issues - show panel
              setPanelData(featureData);
              setPanelOpen(true);
            }
          } else {
            // Data mode - always show panel
            setPanelData(featureData);
            setPanelOpen(true);
          }
        };
        clickHandlerRef.current = handleClick;
        map.on('click', 'issues-choropleth-fill', handleClick);

        // Hover effect
        map.on('mouseenter', 'issues-choropleth-fill', () => {
          map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', 'issues-choropleth-fill', () => {
          map.getCanvas().style.cursor = '';
        });

        setIsLoading(false);

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
      } catch (error) {
        console.error('[Issues Choropleth] Failed to load:', error);
        setIsLoading(false);
      }
    };

    loadChoropleth();

    // Cleanup function to abort pending operations and remove handlers
    return () => {
      aborted = true;
      if (clickHandlerRef.current && map.getLayer('issues-choropleth-fill')) {
        map.off('click', 'issues-choropleth-fill', clickHandlerRef.current);
      }
    };
  }, [mapLoaded, mapType, currentLevel, selectedCategory, selectedSeverity, dateRange, interactionMode, hasFilters]);

  // Basemap click handler - navigate to district when clicking outside choropleth
  useEffect(() => {
    if (!mapRef.current || !mapLoaded || mapType !== 'choropleth') return;
    const map = mapRef.current;

    // Remove existing basemap handler
    if (basemapClickHandlerRef.current) {
      map.off('click', basemapClickHandlerRef.current);
      basemapClickHandlerRef.current = null;
    }

    const handleBasemapClick = (e: maplibregl.MapMouseEvent) => {
      // Check if click was on the choropleth layer
      const hasChoroplethLayer = map.getLayer('issues-choropleth-fill');
      let features: maplibregl.MapGeoJSONFeature[] = [];

      try {
        if (hasChoroplethLayer) {
          features = map.queryRenderedFeatures(e.point, {
            layers: ['issues-choropleth-fill']
          });
        }
      } catch (err) {
        console.log('Issues: Error querying features:', err);
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
        console.log('Issues: No cached national data for basemap navigation');
        return;
      }

      // Find which district contains the clicked point
      const clickedDistrict = nationalData.geojson.features.find(feature => {
        if (!feature.geometry) return false;
        return pointInPolygon([lng, lat], feature.geometry);
      });

      if (clickedDistrict && clickedDistrict.properties) {
        const { unitId, unitName } = clickedDistrict.properties as { unitId: number; unitName: string };
        console.log('Issues: Navigating to district:', { unitId, unitName });

        // Close any existing navigation popup
        if (navigationPopupRef.current) {
          navigationPopupRef.current.remove();
        }

        // Show a brief popup indicating navigation
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
  }, [mapLoaded, mapType, navigateToDistrict]);

  // Load point markers on map
  useEffect(() => {
    if (!mapRef.current || !mapLoaded || mapType !== 'points') return;
    const map = mapRef.current;

    const loadMapData = async () => {
      // Remove existing layers
      try {
        if (map.getLayer('issues-clusters')) map.removeLayer('issues-clusters');
        if (map.getLayer('issues-cluster-count')) map.removeLayer('issues-cluster-count');
        if (map.getLayer('issues-points')) map.removeLayer('issues-points');
        if (map.getSource('issues')) map.removeSource('issues');
        if (map.getLayer('issues-choropleth-fill')) map.removeLayer('issues-choropleth-fill');
        if (map.getLayer('issues-choropleth-line')) map.removeLayer('issues-choropleth-line');
        if (map.getLayer('issues-choropleth-labels')) map.removeLayer('issues-choropleth-labels');
        if (map.getSource('issues-choropleth')) map.removeSource('issues-choropleth');
      } catch (e) {
        // Layers may not exist
      }

      try {
        const params: any = {};
        if (selectedCategory) params.categoryId = selectedCategory;
        if (dateRange.start) params.startDate = dateRange.start;
        if (dateRange.end) params.endDate = dateRange.end;

        const geojsonData = await api.getIssuesGeoJSON(params);

        let features = geojsonData.features;
        if (selectedSeverity) {
          features = features.filter(f => f.properties.severity === selectedSeverity);
        }

        const geojson: GeoJSON.FeatureCollection = {
          type: 'FeatureCollection',
          features: features.map(f => ({
            ...f,
            properties: {
              ...f.properties,
              color: f.properties.categoryColor || severityColors[f.properties.severity],
            },
          })),
        };

        map.addSource('issues', {
          type: 'geojson',
          data: geojson,
          cluster: true,
          clusterMaxZoom: 12,
          clusterRadius: 50,
        });

        map.addLayer({
          id: 'issues-clusters',
          type: 'circle',
          source: 'issues',
          filter: ['has', 'point_count'],
          paint: {
            'circle-color': [
              'step',
              ['get', 'point_count'],
              '#F59E0B',
              10, '#F97316',
              25, '#EF4444',
            ],
            'circle-radius': [
              'step',
              ['get', 'point_count'],
              20, 10,
              25, 25,
              50, 30,
            ],
            'circle-stroke-width': 2,
            'circle-stroke-color': '#fff',
          },
        });

        map.addLayer({
          id: 'issues-cluster-count',
          type: 'symbol',
          source: 'issues',
          filter: ['has', 'point_count'],
          layout: {
            'text-field': '{point_count_abbreviated}',
            'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
            'text-size': 12,
          },
          paint: {
            'text-color': '#fff',
          },
        });

        map.addLayer({
          id: 'issues-points',
          type: 'circle',
          source: 'issues',
          filter: ['!', ['has', 'point_count']],
          paint: {
            'circle-color': ['get', 'color'],
            'circle-radius': 8,
            'circle-stroke-width': 2,
            'circle-stroke-color': '#fff',
          },
        });

        map.on('click', 'issues-clusters', async (e) => {
          const features = map.queryRenderedFeatures(e.point, { layers: ['issues-clusters'] });
          if (!features.length) return;
          const clusterId = features[0].properties?.cluster_id;
          const source = map.getSource('issues') as maplibregl.GeoJSONSource;
          try {
            const zoom = await source.getClusterExpansionZoom(clusterId);
            const geometry = features[0].geometry;
            if (geometry.type === 'Point') {
              map.easeTo({ center: geometry.coordinates as [number, number], zoom: zoom ?? 10 });
            }
          } catch (err) {
            console.error('Cluster expansion error:', err);
          }
        });

        map.on('click', 'issues-points', (e) => {
          if (!e.features || e.features.length === 0) return;
          const props = e.features[0].properties;
          if (!props) return;
          const issue = issues.find(i => i.id === props.id);
          if (issue) setSelectedIssue(issue);
        });

        map.on('mouseenter', 'issues-points', () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', 'issues-points', () => { map.getCanvas().style.cursor = ''; });
        map.on('mouseenter', 'issues-clusters', () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', 'issues-clusters', () => { map.getCanvas().style.cursor = ''; });
      } catch (error) {
        console.error('Failed to load issues on map:', error);
      }
    };

    loadMapData();
  }, [mapLoaded, mapType, issues, selectedCategory, selectedSeverity, dateRange]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-UG', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const handleBreadcrumbNavigate = (index: number) => {
    setDrillDownStack(prev => prev.slice(0, index + 1));
    // Zoom out to show entire Uganda when navigating to home
    if (index === 0 && mapRef.current) {
      mapRef.current.fitBounds(UGANDA_BOUNDS, { padding: 50, duration: 1000 });
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gray-900">
      {/* Header & Toolbar */}
      <div className="bg-gray-800 border-b border-gray-700 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-bold text-white">Electoral Issues</h1>

            {/* View Toggle */}
            <div className="flex items-center gap-2 border-l border-gray-700 pl-4">
              <button
                onClick={() => setViewMode('map')}
                className={`px-3 py-1.5 rounded text-sm font-medium ${
                  viewMode === 'map' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'
                }`}
              >
                Map
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-1.5 rounded text-sm font-medium ${
                  viewMode === 'list' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'
                }`}
              >
                List
              </button>
            </div>

            {/* Map Type Toggle (only in map view) */}
            {viewMode === 'map' && (
              <div className="flex items-center gap-2 border-l border-gray-700 pl-4">
                <button
                  onClick={() => setMapType('choropleth')}
                  className={`px-3 py-1.5 rounded text-xs font-medium ${
                    mapType === 'choropleth' ? 'bg-yellow-500 text-gray-900' : 'bg-gray-700 text-gray-300'
                  }`}
                >
                  Choropleth
                </button>
                <button
                  onClick={() => setMapType('points')}
                  className={`px-3 py-1.5 rounded text-xs font-medium ${
                    mapType === 'points' ? 'bg-yellow-500 text-gray-900' : 'bg-gray-700 text-gray-300'
                  }`}
                >
                  Points
                </button>
              </div>
            )}

            {/* Mode Toggle (only for choropleth) */}
            {viewMode === 'map' && mapType === 'choropleth' && (
              <div className="flex items-center gap-2 border-l border-gray-700 pl-4">
                <span className="text-xs text-gray-400">Mode:</span>
                <button
                  onClick={() => setInteractionMode('drill-down')}
                  className={`px-3 py-1.5 rounded text-xs font-medium ${
                    interactionMode === 'drill-down' ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-300'
                  }`}
                >
                  Drill-down
                </button>
                <button
                  onClick={() => setInteractionMode('data')}
                  className={`px-3 py-1.5 rounded text-xs font-medium ${
                    interactionMode === 'data' ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-300'
                  }`}
                >
                  Data
                </button>
              </div>
            )}

            {/* Quick Filters */}
            <div className="flex items-center gap-2 border-l border-gray-700 pl-4">
              <select
                value={selectedCategory || ''}
                onChange={(e) => setSelectedCategory(e.target.value ? parseInt(e.target.value) : null)}
                className="bg-gray-700 text-white rounded px-2 py-1.5 text-xs border border-gray-600"
              >
                <option value="">All Categories</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
              <select
                value={selectedSeverity || ''}
                onChange={(e) => setSelectedSeverity(e.target.value ? parseInt(e.target.value) : null)}
                className="bg-gray-700 text-white rounded px-2 py-1.5 text-xs border border-gray-600"
              >
                <option value="">All Severities</option>
                {[5, 4, 3, 2, 1].map(sev => (
                  <option key={sev} value={sev}>{severityLabels[sev]}</option>
                ))}
              </select>
              {hasFilters && (
                <button
                  onClick={() => {
                    setSelectedCategory(null);
                    setSelectedSeverity(null);
                    setDateRange({ start: '', end: '' });
                  }}
                  className="text-xs text-gray-400 hover:text-white"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-4">
            <div className="text-sm text-gray-400">
              {mapType === 'choropleth' && choroplethMetadata
                ? `${choroplethMetadata.totalIssues} issues in ${choroplethMetadata.unitsWithIssues} regions`
                : `${totalCount} issues`
              }
            </div>
            <Link
              to="/issues/stats"
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-sm font-medium flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Stats
            </Link>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 relative">
        {viewMode === 'map' ? (
          <>
            <MapComponent onLoad={handleMapLoad} className="absolute inset-0" />

            {/* Map Settings Widget */}
            <MapSettingsWidget position="bottom-left" />

            {/* Breadcrumb (floating, top-left) */}
            <IssueBreadcrumb
              stack={drillDownStack}
              onNavigate={handleBreadcrumbNavigate}
            />

            {/* Loading indicator */}
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
                <div className="flex items-center gap-4 bg-gray-900 px-8 py-5 rounded-xl shadow-2xl">
                  <svg className="animate-spin h-10 w-10 text-blue-400" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span className="text-white text-lg font-medium">Loading issues data...</span>
                </div>
              </div>
            )}

            {/* Issue Detail Panel (for points mode) */}
            {selectedIssue && (
              <div className="absolute top-4 right-4 w-96 bg-gray-800/95 backdrop-blur-sm rounded-lg shadow-lg border border-gray-700 z-10 max-h-[80vh] overflow-y-auto">
                <div className="p-4 border-b border-gray-700 flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className="px-2 py-0.5 rounded text-xs font-medium"
                        style={{
                          backgroundColor: selectedIssue.issueCategory.color || severityColors[selectedIssue.issueCategory.severity],
                          color: '#fff',
                        }}
                      >
                        {selectedIssue.issueCategory.name}
                      </span>
                      <span className="text-xs text-gray-400">
                        {severityLabels[selectedIssue.issueCategory.severity]}
                      </span>
                    </div>
                    <div className="text-xs text-gray-400">{formatDate(selectedIssue.date)}</div>
                  </div>
                  <button
                    onClick={() => setSelectedIssue(null)}
                    className="text-gray-400 hover:text-white"
                  >
                    ✕
                  </button>
                </div>
                <div className="p-4">
                  <h3 className="font-medium text-white mb-2">{selectedIssue.summary}</h3>
                  {selectedIssue.fullText && (
                    <p className="text-sm text-gray-300 mb-3">{selectedIssue.fullText}</p>
                  )}
                  <div className="text-sm text-gray-400 space-y-1">
                    {selectedIssue.location && <div>Location: {selectedIssue.location}</div>}
                    {selectedIssue.district && <div>District: {selectedIssue.district.name}</div>}
                    {selectedIssue.constituency && <div>Constituency: {selectedIssue.constituency.name}</div>}
                  </div>
                </div>
              </div>
            )}

            {/* Legend */}
            <div className="absolute bottom-4 left-4 bg-gray-800/95 backdrop-blur-sm rounded-lg p-3 z-10">
              {mapType === 'choropleth' ? (
                <>
                  <div className="text-xs text-gray-400 mb-2">Issue Density</div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="w-3 h-3 rounded" style={{ backgroundColor: '#dc2626' }} />
                      <span className="text-gray-300">Critical</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="w-3 h-3 rounded" style={{ backgroundColor: '#ea580c' }} />
                      <span className="text-gray-300">High</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="w-3 h-3 rounded" style={{ backgroundColor: '#f59e0b' }} />
                      <span className="text-gray-300">Moderate</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="w-3 h-3 rounded" style={{ backgroundColor: '#fde047' }} />
                      <span className="text-gray-300">Low</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="w-3 h-3 rounded" style={{ backgroundColor: '#d1d5db' }} />
                      <span className="text-gray-300">None</span>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="text-xs text-gray-400 mb-2">Severity</div>
                  <div className="space-y-1">
                    {[5, 4, 3, 2, 1].map(sev => (
                      <div key={sev} className="flex items-center gap-2 text-xs">
                        <span
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: severityColors[sev] }}
                        />
                        <span className="text-gray-300">{severityLabels[sev]}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Slide-out Panel */}
            <IssueSlideOutPanel
              isOpen={panelOpen}
              onClose={() => setPanelOpen(false)}
              data={panelData}
            />
          </>
        ) : (
          /* List View */
          <div className="p-4 overflow-y-auto h-full">
            <div className="space-y-2">
              {issues.map(issue => (
                <div
                  key={issue.id}
                  onClick={() => setSelectedIssue(issue)}
                  className="bg-gray-800 rounded-lg p-4 hover:bg-gray-700/50 cursor-pointer border border-gray-700"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className="px-2 py-0.5 rounded text-xs font-medium"
                          style={{
                            backgroundColor: issue.issueCategory.color || severityColors[issue.issueCategory.severity],
                            color: '#fff',
                          }}
                        >
                          {issue.issueCategory.name}
                        </span>
                        <span className="text-xs text-gray-400">{formatDate(issue.date)}</span>
                      </div>
                      <h4 className="text-white font-medium">{issue.summary}</h4>
                      <div className="text-sm text-gray-400 mt-1">
                        {issue.district?.name}
                        {issue.constituency && ` > ${issue.constituency.name}`}
                      </div>
                    </div>
                    <span
                      className="w-3 h-3 rounded-full flex-shrink-0 ml-4"
                      style={{ backgroundColor: severityColors[issue.issueCategory.severity] }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default IssuesDashboard;
