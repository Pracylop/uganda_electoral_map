import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import maplibregl from 'maplibre-gl';
import { ArrowLeft, BarChart3 } from 'lucide-react';
import MapComponent from '../components/Map';
import { MapSettingsWidget } from '../components/MapSettingsWidget';
import { useEffectiveBasemap } from '../hooks/useOnlineStatus';
import { IncidentSlideOutPanel } from '../components/IncidentSlideOutPanel';
import { IncidentBreadcrumb } from '../components/IncidentBreadcrumb';
import { api } from '../lib/api';
import { boundaryService } from '../lib/boundaryService';
import 'maplibre-gl/dist/maplibre-gl.css';

interface IncidentCategory {
  id: number;
  name: string;
  code: string;
  color: string | null;
  severity: number;
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

const severityLabels: Record<number, string> = {
  1: 'Low',
  2: 'Medium-Low',
  3: 'Medium',
  4: 'High',
  5: 'Critical',
};

// Uganda bounding box
const UGANDA_BOUNDS: [[number, number], [number, number]] = [
  [29.5, -1.5],
  [35.0, 4.3]
];

// Helper to calculate centroid of a polygon
function calculateCentroid(coordinates: number[][][]): [number, number] {
  let totalX = 0;
  let totalY = 0;
  let totalPoints = 0;

  const ring = coordinates[0];
  for (const point of ring) {
    totalX += point[0];
    totalY += point[1];
    totalPoints++;
  }

  return [totalX / totalPoints, totalY / totalPoints];
}

function calculateMultiPolygonCentroid(coordinates: number[][][][]): [number, number] {
  let totalX = 0;
  let totalY = 0;
  let totalPoints = 0;

  for (const polygon of coordinates) {
    const ring = polygon[0];
    for (const point of ring) {
      totalX += point[0];
      totalY += point[1];
      totalPoints++;
    }
  }

  return [totalX / totalPoints, totalY / totalPoints];
}

// Point-in-polygon helpers
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

export function IncidentsMap() {
  const [searchParams] = useSearchParams();
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [categories, setCategories] = useState<IncidentCategory[]>([]);

  const effectiveBasemap = useEffectiveBasemap();
  const prevBasemapRef = useRef<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);

  // Get initial map type from URL query parameter
  const initialMapType = searchParams.get('type') as 'choropleth' | 'points' | 'heatmap' | null;
  const [mapType, setMapType] = useState<'choropleth' | 'points' | 'heatmap'>(
    initialMapType && ['choropleth', 'points', 'heatmap'].includes(initialMapType) ? initialMapType : 'choropleth'
  );
  const [heatmapIntensity, setHeatmapIntensity] = useState(1);
  const [heatmapRadius, setHeatmapRadius] = useState(20);

  const [heatmapSettingsPos, setHeatmapSettingsPos] = useState({ x: 0, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, posX: 0, posY: 0 });
  const [choroplethMetadata, setChoroplethMetadata] = useState<{ totalIssues: number; unitsWithIssues: number; maxIssuesPerUnit: number } | null>(null);

  const clickHandlerRef = useRef<((e: maplibregl.MapLayerMouseEvent) => void) | null>(null);
  const basemapClickHandlerRef = useRef<((e: maplibregl.MapMouseEvent) => void) | null>(null);
  const navigationPopupRef = useRef<maplibregl.Popup | null>(null);

  const [isLoading, setIsLoading] = useState(false);

  // Drill-down state
  const [drillDownStack, setDrillDownStack] = useState<DrillDownItem[]>([
    { level: 2, regionId: null, regionName: 'Uganda' }
  ]);
  const currentLevel = drillDownStack[drillDownStack.length - 1];

  const [interactionMode, setInteractionMode] = useState<'drill-down' | 'data'>('drill-down');

  // Panel state
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

  // Load total incident count
  useEffect(() => {
    api.getIssueStats({})
      .then((data: any) => {
        setTotalCount(data.total || 0);
      })
      .catch((err) => console.error('Failed to load incident count:', err));
  }, []);

  const handleMapLoad = useCallback((map: maplibregl.Map) => {
    mapRef.current = map;
    setMapLoaded(true);
    map.fitBounds(UGANDA_BOUNDS, { padding: 50, duration: 1000 });
  }, []);

  useEffect(() => {
    if (prevBasemapRef.current !== null && prevBasemapRef.current !== effectiveBasemap) {
      setMapLoaded(false);
    }
    prevBasemapRef.current = effectiveBasemap;
  }, [effectiveBasemap]);

  const navigateToDistrict = useCallback((districtId: number, districtName: string) => {
    setDrillDownStack([
      { level: 2, regionId: null, regionName: 'Uganda' },
      { level: 3, regionId: districtId, regionName: districtName }
    ]);
  }, []);

  const hasFilters = selectedCategory || selectedSeverity || dateRange.start || dateRange.end;

  // Load choropleth
  useEffect(() => {
    if (!mapRef.current || !mapLoaded || mapType !== 'choropleth') return;
    const map = mapRef.current;
    let aborted = false;

    const loadChoropleth = async () => {
      if (clickHandlerRef.current && map.getLayer('incidents-choropleth-fill')) {
        map.off('click', 'incidents-choropleth-fill', clickHandlerRef.current);
        clickHandlerRef.current = null;
      }

      try {
        ['incidents-choropleth-fill', 'incidents-choropleth-line', 'incidents-clusters', 'incidents-cluster-count', 'incidents-points', 'incidents-heatmap'].forEach(layerId => {
          if (map.getLayer(layerId)) map.removeLayer(layerId);
        });
        ['incidents-choropleth', 'incidents', 'incidents-heatmap'].forEach(sourceId => {
          if (map.getSource(sourceId)) map.removeSource(sourceId);
        });
      } catch (e) {}

      try {
        let displayData: GeoJSON.FeatureCollection;
        let metadata: { totalIssues: number; unitsWithIssues: number; maxIssuesPerUnit: number };

        setIsLoading(true);
        await boundaryService.loadStaticBoundaries();

        const params: any = { level: currentLevel.level };
        if (currentLevel.regionId) params.parentId = currentLevel.regionId;

        if (hasFilters) {
          if (selectedCategory) params.categoryId = selectedCategory;
          if (selectedSeverity) params.severity = selectedSeverity;
          if (dateRange.start) params.startDate = dateRange.start;
          if (dateRange.end) params.endDate = dateRange.end;

          const choroplethData = await api.getIssuesChoropleth(params);
          displayData = choroplethData as GeoJSON.FeatureCollection;
          metadata = choroplethData.metadata;
        } else {
          const incidentsData = await api.getIssuesData({
            level: currentLevel.level,
            parentId: currentLevel.regionId ?? undefined
          });

          const parentFilter = currentLevel.regionId
            ? { level: currentLevel.level - 1, name: currentLevel.regionName }
            : null;

          displayData = boundaryService.createGeoJSON(currentLevel.level, incidentsData.data, parentFilter);
          metadata = incidentsData.metadata;
        }

        if (aborted) return;

        setChoroplethMetadata(metadata);

        if (!displayData || displayData.features.length === 0) {
          setIsLoading(false);
          return;
        }

        if (aborted) return;

        map.addSource('incidents-choropleth', { type: 'geojson', data: displayData });

        map.addLayer({
          id: 'incidents-choropleth-fill',
          type: 'fill',
          source: 'incidents-choropleth',
          paint: { 'fill-color': ['get', 'fillColor'], 'fill-opacity': 0.85 },
        });

        map.addLayer({
          id: 'incidents-choropleth-line',
          type: 'line',
          source: 'incidents-choropleth',
          paint: { 'line-color': '#1f2937', 'line-width': 1 },
        });

        if (displayData.features.length > 0 && currentLevel.regionId) {
          const bounds = new maplibregl.LngLatBounds();
          displayData.features.forEach(feature => {
            const coords = (feature.geometry as any).coordinates;
            const addCoords = (c: any) => {
              if (typeof c[0] === 'number') bounds.extend(c as [number, number]);
              else c.forEach(addCoords);
            };
            addCoords(coords);
          });
          map.fitBounds(bounds, { padding: 50, duration: 500 });
        }

        const handleClick = (e: maplibregl.MapLayerMouseEvent) => {
          if (!e.features || e.features.length === 0) return;
          const props = e.features[0].properties;
          if (!props) return;

          let topCategories: { name: string; count: number }[] = [];
          if (props.topCategories) {
            try { topCategories = JSON.parse(props.topCategories); } catch (err) {}
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
              setDrillDownStack(prev => [...prev, {
                level: props.level + 1,
                regionId: props.unitId,
                regionName: props.unitName
              }]);
            } else {
              setPanelData(featureData);
              setPanelOpen(true);
            }
          } else {
            setPanelData(featureData);
            setPanelOpen(true);
          }
        };
        clickHandlerRef.current = handleClick;
        map.on('click', 'incidents-choropleth-fill', handleClick);

        map.on('mouseenter', 'incidents-choropleth-fill', () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', 'incidents-choropleth-fill', () => { map.getCanvas().style.cursor = ''; });

        setIsLoading(false);

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
        console.error('[Incidents Choropleth] Failed to load:', error);
        setIsLoading(false);
      }
    };

    loadChoropleth();

    return () => {
      aborted = true;
      if (clickHandlerRef.current && map.getLayer('incidents-choropleth-fill')) {
        map.off('click', 'incidents-choropleth-fill', clickHandlerRef.current);
      }
    };
  }, [mapLoaded, mapType, currentLevel, selectedCategory, selectedSeverity, dateRange, interactionMode, hasFilters]);

  // Basemap click handler
  useEffect(() => {
    if (!mapRef.current || !mapLoaded || mapType !== 'choropleth') return;
    const map = mapRef.current;

    if (basemapClickHandlerRef.current) {
      map.off('click', basemapClickHandlerRef.current);
      basemapClickHandlerRef.current = null;
    }

    const handleBasemapClick = (e: maplibregl.MapMouseEvent) => {
      const hasChoroplethLayer = map.getLayer('incidents-choropleth-fill');
      let features: maplibregl.MapGeoJSONFeature[] = [];

      try {
        if (hasChoroplethLayer) {
          features = map.queryRenderedFeatures(e.point, { layers: ['incidents-choropleth-fill'] });
        }
      } catch (err) {}

      if (features && features.length > 0) return;

      const { lng, lat } = e.lngLat;
      if (!boundaryService.hasLevel(2)) return;

      const districtGeoJSON = boundaryService.getBoundariesGeoJSON(2);
      const clickedDistrict = districtGeoJSON.features.find(feature => {
        if (!feature.geometry) return false;
        return pointInPolygon([lng, lat], feature.geometry);
      });

      if (clickedDistrict && clickedDistrict.properties) {
        const { unitId, unitName } = clickedDistrict.properties as { unitId: number; unitName: string };

        if (navigationPopupRef.current) navigationPopupRef.current.remove();

        navigationPopupRef.current = new maplibregl.Popup({ closeOnClick: true, closeButton: false })
          .setLngLat(e.lngLat)
          .setHTML(`<div style="padding: 8px; font-family: system-ui; color: #333;"><strong>Navigating to ${unitName}</strong></div>`)
          .addTo(map);

        navigateToDistrict(unitId, unitName);
      }
    };

    basemapClickHandlerRef.current = handleBasemapClick;
    map.on('click', handleBasemapClick);

    return () => {
      if (basemapClickHandlerRef.current) map.off('click', basemapClickHandlerRef.current);
      if (navigationPopupRef.current) navigationPopupRef.current.remove();
    };
  }, [mapLoaded, mapType, navigateToDistrict]);

  // Dot Map layer (Points mode)
  useEffect(() => {
    if (!mapRef.current || !mapLoaded || mapType !== 'points') return;
    const map = mapRef.current;
    let popup: maplibregl.Popup | null = null;

    const loadDotMap = async () => {
      try {
        ['incidents-clusters', 'incidents-cluster-count', 'incidents-points', 'incidents-heatmap', 'incidents-choropleth-fill', 'incidents-choropleth-line', 'dotmap-district-fill', 'dotmap-district-line', 'dotmap-dots'].forEach(layerId => {
          if (map.getLayer(layerId)) map.removeLayer(layerId);
        });
        ['incidents', 'incidents-choropleth', 'incidents-heatmap', 'dotmap-districts', 'dotmap-centroids'].forEach(sourceId => {
          if (map.getSource(sourceId)) map.removeSource(sourceId);
        });
      } catch (e) {}

      try {
        setIsLoading(true);

        // Load choropleth data (district level)
        const params: any = { level: 2 };
        if (selectedCategory) params.categoryIds = [selectedCategory];
        if (selectedSeverity) params.severity = selectedSeverity;
        if (dateRange.start) params.startDate = dateRange.start;
        if (dateRange.end) params.endDate = dateRange.end;

        const choroplethData = await api.getIssuesChoropleth(params);
        const mapData = choroplethData as unknown as GeoJSON.FeatureCollection;

        setChoroplethMetadata(choroplethData.metadata);

        // Add district boundaries source
        map.addSource('dotmap-districts', { type: 'geojson', data: mapData });

        // District fill (dark, subtle)
        map.addLayer({
          id: 'dotmap-district-fill',
          type: 'fill',
          source: 'dotmap-districts',
          paint: {
            'fill-color': '#1a1f2e',
            'fill-opacity': 0.9
          }
        });

        // District boundary lines
        map.addLayer({
          id: 'dotmap-district-line',
          type: 'line',
          source: 'dotmap-districts',
          paint: {
            'line-color': '#3b82f6',
            'line-width': 1,
            'line-opacity': 0.6
          }
        });

        // Create centroid points with incident counts
        const maxCount = Math.max(...mapData.features.map(f => (f.properties as any)?.issueCount || 0), 1);

        const centroidFeatures: any[] = [];
        for (const feature of mapData.features) {
          const props = feature.properties as any;
          if (!props?.issueCount || props.issueCount <= 0) continue;

          const geom = feature.geometry as any;
          let centroid: [number, number] | null = null;

          if (geom.type === 'Polygon') {
            centroid = calculateCentroid(geom.coordinates);
          } else if (geom.type === 'MultiPolygon') {
            centroid = calculateMultiPolygonCentroid(geom.coordinates);
          }

          if (centroid) {
            centroidFeatures.push({
              type: 'Feature',
              geometry: {
                type: 'Point',
                coordinates: centroid
              },
              properties: {
                unitId: props.unitId,
                name: props.unitName,
                count: props.issueCount,
                injuries: props.injuries || 0,
                deaths: props.deaths || 0,
                arrests: props.arrests || 0,
                normalizedSize: Math.sqrt(props.issueCount / maxCount)
              }
            });
          }
        }

        map.addSource('dotmap-centroids', {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: centroidFeatures
          }
        });

        // Add dots sized by incident count
        map.addLayer({
          id: 'dotmap-dots',
          type: 'circle',
          source: 'dotmap-centroids',
          paint: {
            'circle-radius': [
              'interpolate', ['linear'], ['get', 'normalizedSize'],
              0, 6,
              0.3, 12,
              0.6, 20,
              1, 30
            ],
            'circle-color': '#F59E0B',
            'circle-opacity': 0.85,
            'circle-stroke-color': '#ffffff',
            'circle-stroke-width': 2
          }
        });

        // Click handler for dots - show popup with stats
        map.on('click', 'dotmap-dots', (e) => {
          if (!e.features || e.features.length === 0) return;
          const props = e.features[0].properties;
          if (!props) return;

          const coordinates = (e.features[0].geometry as GeoJSON.Point).coordinates.slice() as [number, number];

          // Create popup content
          const popupContent = `
            <div style="padding: 12px; min-width: 200px; font-family: system-ui, -apple-system, sans-serif;">
              <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600; color: #fff;">${props.name}</h3>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                <div style="background: #374151; padding: 8px; border-radius: 6px; text-align: center;">
                  <div style="font-size: 20px; font-weight: bold; color: #F59E0B;">${props.count}</div>
                  <div style="font-size: 11px; color: #9ca3af;">Incidents</div>
                </div>
                <div style="background: #374151; padding: 8px; border-radius: 6px; text-align: center;">
                  <div style="font-size: 20px; font-weight: bold; color: #EF4444;">${props.deaths}</div>
                  <div style="font-size: 11px; color: #9ca3af;">Deaths</div>
                </div>
                <div style="background: #374151; padding: 8px; border-radius: 6px; text-align: center;">
                  <div style="font-size: 20px; font-weight: bold; color: #F97316;">${props.injuries}</div>
                  <div style="font-size: 11px; color: #9ca3af;">Injuries</div>
                </div>
                <div style="background: #374151; padding: 8px; border-radius: 6px; text-align: center;">
                  <div style="font-size: 20px; font-weight: bold; color: #3B82F6;">${props.arrests}</div>
                  <div style="font-size: 11px; color: #9ca3af;">Arrests</div>
                </div>
              </div>
            </div>
          `;

          // Remove existing popup
          if (popup) popup.remove();

          popup = new maplibregl.Popup({
            closeButton: true,
            closeOnClick: true,
            className: 'dotmap-popup',
            maxWidth: '300px'
          })
            .setLngLat(coordinates)
            .setHTML(popupContent)
            .addTo(map);
        });

        // Cursor changes
        map.on('mouseenter', 'dotmap-dots', () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', 'dotmap-dots', () => { map.getCanvas().style.cursor = ''; });

        setIsLoading(false);
      } catch (error) {
        console.error('Failed to load dot map:', error);
        setIsLoading(false);
      }
    };

    loadDotMap();

    return () => {
      if (popup) popup.remove();
    };
  }, [mapLoaded, mapType, selectedCategory, selectedSeverity, dateRange]);

  // Heatmap layer
  useEffect(() => {
    if (!mapRef.current || !mapLoaded || mapType !== 'heatmap') return;
    const map = mapRef.current;

    const loadHeatmap = async () => {
      try {
        ['incidents-clusters', 'incidents-cluster-count', 'incidents-points', 'incidents-heatmap', 'incidents-choropleth-fill', 'incidents-choropleth-line'].forEach(layerId => {
          if (map.getLayer(layerId)) map.removeLayer(layerId);
        });
        ['incidents', 'incidents-choropleth', 'incidents-heatmap'].forEach(sourceId => {
          if (map.getSource(sourceId)) map.removeSource(sourceId);
        });
      } catch (e) {}

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
          features: features.map(f => ({ ...f, properties: { ...f.properties, weight: f.properties.severity || 1 } })),
        };

        map.addSource('incidents-heatmap', { type: 'geojson', data: geojson });

        map.addLayer({
          id: 'incidents-heatmap',
          type: 'heatmap',
          source: 'incidents-heatmap',
          paint: {
            'heatmap-weight': ['interpolate', ['linear'], ['get', 'weight'], 1, 0.2, 3, 0.5, 5, 1],
            'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, heatmapIntensity * 0.5, 9, heatmapIntensity * 2],
            'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'], 0, 'rgba(0, 0, 0, 0)', 0.2, 'rgba(254, 240, 217, 0.6)', 0.4, 'rgba(253, 204, 138, 0.7)', 0.6, 'rgba(252, 141, 89, 0.8)', 0.8, 'rgba(227, 74, 51, 0.9)', 1, 'rgba(179, 0, 0, 1)'],
            'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, heatmapRadius * 0.5, 9, heatmapRadius * 3],
            'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 7, 1, 15, 0.5],
          },
        });
      } catch (error) {
        console.error('Failed to load heatmap:', error);
      }
    };

    loadHeatmap();
  }, [mapLoaded, mapType, selectedCategory, selectedSeverity, dateRange, heatmapIntensity, heatmapRadius]);

  const handleBreadcrumbNavigate = (index: number) => {
    setDrillDownStack(prev => prev.slice(0, index + 1));
    if (index === 0 && mapRef.current) {
      mapRef.current.fitBounds(UGANDA_BOUNDS, { padding: 50, duration: 1000 });
    }
  };

  // Drag handlers
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY, posX: heatmapSettingsPos.x, posY: heatmapSettingsPos.y };
  }, [heatmapSettingsPos]);

  useEffect(() => {
    if (!isDragging) return;
    const handleMouseMove = (e: MouseEvent) => {
      const dx = dragStartRef.current.x - e.clientX;
      const dy = e.clientY - dragStartRef.current.y;
      setHeatmapSettingsPos({ x: Math.max(0, dragStartRef.current.posX + dx), y: Math.max(0, dragStartRef.current.posY + dy) });
    };
    const handleMouseUp = () => setIsDragging(false);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  return (
    <div className="flex-1 flex flex-col bg-gray-900 min-h-0">
      {/* Header & Toolbar */}
      <div className="bg-gray-800 border-b border-gray-700 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              to="/incidents"
              className="p-2 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-lg font-bold text-white">Incidents Map</h1>

            {/* Map Type Toggle */}
            <div className="flex items-center gap-2 border-l border-gray-700 pl-4">
              <button
                onClick={() => setMapType('choropleth')}
                className={`px-3 py-1.5 rounded text-xs font-medium ${
                  mapType === 'choropleth' ? 'bg-[#F59E0B] text-gray-900' : 'bg-gray-700 text-gray-300'
                }`}
              >
                Choropleth
              </button>
              <button
                onClick={() => setMapType('points')}
                className={`px-3 py-1.5 rounded text-xs font-medium ${
                  mapType === 'points' ? 'bg-[#F59E0B] text-gray-900' : 'bg-gray-700 text-gray-300'
                }`}
              >
                Dot Map
              </button>
              <button
                onClick={() => setMapType('heatmap')}
                className={`px-3 py-1.5 rounded text-xs font-medium ${
                  mapType === 'heatmap' ? 'bg-[#F59E0B] text-gray-900' : 'bg-gray-700 text-gray-300'
                }`}
              >
                Heatmap
              </button>
            </div>

            {/* Mode Toggle (choropleth only) */}
            {mapType === 'choropleth' && (
              <div className="flex items-center gap-2 border-l border-gray-700 pl-4">
                <span className="text-xs text-gray-400">Mode:</span>
                <button
                  onClick={() => setInteractionMode('drill-down')}
                  className={`px-3 py-1.5 rounded text-xs font-medium ${
                    interactionMode === 'drill-down' ? 'bg-emerald-600 text-white' : 'bg-gray-700 text-gray-300'
                  }`}
                >
                  Drill-down
                </button>
                <button
                  onClick={() => setInteractionMode('data')}
                  className={`px-3 py-1.5 rounded text-xs font-medium ${
                    interactionMode === 'data' ? 'bg-emerald-600 text-white' : 'bg-gray-700 text-gray-300'
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
                  onClick={() => { setSelectedCategory(null); setSelectedSeverity(null); setDateRange({ start: '', end: '' }); }}
                  className="text-xs text-gray-400 hover:text-white"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-sm text-gray-400">
              {mapType === 'choropleth' && choroplethMetadata
                ? `${choroplethMetadata.totalIssues} incidents in ${choroplethMetadata.unitsWithIssues} regions`
                : `${totalCount} incidents`
              }
            </div>
            <Link
              to="/incidents/stats"
              className="px-3 py-1.5 bg-[#F59E0B]/20 hover:bg-[#F59E0B]/30 border border-[#F59E0B]/40 rounded text-sm font-medium text-[#F59E0B] flex items-center gap-1"
            >
              <BarChart3 className="w-4 h-4" />
              Stats
            </Link>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 relative">
        <MapComponent onLoad={handleMapLoad} className="absolute inset-0" />
        <MapSettingsWidget position="bottom-left" />

        {/* Breadcrumb */}
        <IncidentBreadcrumb stack={drillDownStack} onNavigate={handleBreadcrumbNavigate} />

        {/* Loading indicator */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
            <div className="flex items-center gap-4 bg-gray-900 px-8 py-5 rounded-xl shadow-2xl">
              <div className="w-10 h-10 border-3 border-[#F59E0B] border-t-transparent rounded-full animate-spin" />
              <span className="text-white text-lg font-medium">Loading incidents data...</span>
            </div>
          </div>
        )}

        {/* Legend */}
        {(mapType === 'choropleth' || mapType === 'points') && (
          <div className="absolute bottom-4 right-4 bg-gray-800/95 backdrop-blur-sm rounded-lg p-3 z-10">
            {mapType === 'choropleth' && (
              <>
                <div className="text-xs text-gray-400 mb-2">Incident Density</div>
                <div className="space-y-1">
                  {[{ color: '#dc2626', label: 'Critical' }, { color: '#ea580c', label: 'High' }, { color: '#f59e0b', label: 'Moderate' }, { color: '#fde047', label: 'Low' }, { color: '#d1d5db', label: 'None' }].map(item => (
                    <div key={item.label} className="flex items-center gap-2 text-xs">
                      <span className="w-3 h-3 rounded" style={{ backgroundColor: item.color }} />
                      <span className="text-gray-300">{item.label}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
            {mapType === 'points' && (
              <>
                <div className="text-xs text-gray-400 mb-2">Incident Count</div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="w-6 h-6 rounded-full bg-[#F59E0B] border-2 border-white" style={{ opacity: 0.85 }} />
                    <span className="text-gray-300">High</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="w-4 h-4 rounded-full bg-[#F59E0B] border-2 border-white" style={{ opacity: 0.85 }} />
                    <span className="text-gray-300">Medium</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#F59E0B] border border-white" style={{ opacity: 0.85 }} />
                    <span className="text-gray-300">Low</span>
                  </div>
                </div>
                <div className="text-xs text-gray-500 mt-2 pt-2 border-t border-gray-700">
                  Click dot for details
                </div>
              </>
            )}
          </div>
        )}

        {/* Heatmap Settings */}
        {mapType === 'heatmap' && (
          <div
            className="absolute bg-gray-800/95 backdrop-blur-sm rounded-lg shadow-lg z-20 select-none"
            style={{ right: heatmapSettingsPos.x + 16, top: heatmapSettingsPos.y, cursor: isDragging ? 'grabbing' : 'default' }}
          >
            <div
              className="flex items-center justify-between px-3 py-2 border-b border-gray-700 cursor-grab active:cursor-grabbing"
              onMouseDown={handleDragStart}
            >
              <span className="text-xs font-medium text-gray-300">Heatmap Settings</span>
            </div>
            <div className="p-3">
              <div className="text-xs text-gray-400 mb-2">Incident Density</div>
              <div className="w-28 h-3 rounded mb-2" style={{ background: 'linear-gradient(to right, rgba(254,240,217,0.6), rgba(253,204,138,0.7), rgba(252,141,89,0.8), rgba(227,74,51,0.9), rgba(179,0,0,1))' }} />
              <div className="flex justify-between text-xs text-gray-400 mb-3">
                <span>Low</span><span>High</span>
              </div>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>Intensity</span><span className="text-gray-500">{heatmapIntensity.toFixed(1)}</span>
                  </div>
                  <input type="range" min="0.5" max="2" step="0.1" value={heatmapIntensity} onChange={(e) => setHeatmapIntensity(parseFloat(e.target.value))} className="w-full h-1.5 bg-gray-600 rounded appearance-none cursor-pointer accent-orange-500" />
                </div>
                <div>
                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>Radius</span><span className="text-gray-500">{heatmapRadius}px</span>
                  </div>
                  <input type="range" min="10" max="50" step="5" value={heatmapRadius} onChange={(e) => setHeatmapRadius(parseInt(e.target.value))} className="w-full h-1.5 bg-gray-600 rounded appearance-none cursor-pointer accent-orange-500" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Slide-out Panel */}
        <IncidentSlideOutPanel isOpen={panelOpen} onClose={() => setPanelOpen(false)} data={panelData} />
      </div>
    </div>
  );
}

export default IncidentsMap;
