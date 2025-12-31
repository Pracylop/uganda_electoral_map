import { useCallback, useRef, useEffect, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useBroadcastStore } from '../../stores/broadcastStore';

interface BroadcastMapProps {
  className?: string;
  onRegionClick?: (regionId: number, regionName: string, level: number) => void;
}

const UGANDA_CENTER: [number, number] = [32.5825, 1.3733];
const INITIAL_ZOOM = 6.0; // Slightly more zoomed out to fit Uganda

export function BroadcastMap({ className, onRegionClick }: BroadcastMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isDataLoading, setIsDataLoading] = useState(false);

  const {
    selectedElectionId,
    currentLevel,
    selectedRegionId,
    drillDown: storeDrillDown,
  } = useBroadcastStore();

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

  // Load election results when election or drill-down changes
  const loadElectionResults = useCallback(async (
    electionId: number,
    level: number,
    parentId: number | null
  ) => {
    const mapInstance = map.current;
    if (!mapInstance || !mapInstance.isStyleLoaded()) return;

    console.log('BroadcastMap: Loading election results', { electionId, level, parentId });
    setIsDataLoading(true);

    try {
      // Build API URL
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
      console.log('BroadcastMap: GeoJSON features count:', geojson.features?.length || 0);

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

      // Animate to bounds with generous padding for broadcast screens
      const animationOptions = {
        padding: { top: 100, bottom: 100, left: 100, right: 100 },
        duration: 1500,
        essential: true,
        curve: 1.2,
        easing: (t: number) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
      };

      if (data.bbox && data.bbox.length === 4) {
        mapInstance.fitBounds(
          [[data.bbox[0], data.bbox[1]], [data.bbox[2], data.bbox[3]]],
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
    } catch (err) {
      console.error('BroadcastMap: Error loading election results:', err);
      setIsDataLoading(false);
    }
  }, []);

  // Set up click handler for drill-down
  useEffect(() => {
    const mapInstance = map.current;
    if (!mapInstance || !isLoaded) return;

    const handleClick = (e: maplibregl.MapMouseEvent) => {
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

        console.log('BroadcastMap: Region clicked', { unitId, unitName, featureLevel });

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

    mapInstance.on('click', 'results-fill', handleClick);

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
      mapInstance.off('click', 'results-fill', handleClick);
      mapInstance.off('mousemove', 'results-fill', handleMouseMove);
      mapInstance.off('mouseleave', 'results-fill', handleMouseLeave);
    };
  }, [isLoaded, currentLevel, onRegionClick, storeDrillDown]);

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
