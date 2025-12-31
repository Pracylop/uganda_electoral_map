import { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Filter } from 'lucide-react';
import { useBroadcastStore } from '../../stores/broadcastStore';
import { api } from '../../lib/api';

interface BroadcastIssuesMapProps {
  className?: string;
  interactionsDisabled?: boolean;
}

const UGANDA_CENTER: [number, number] = [32.5825, 1.3733];
const INITIAL_ZOOM = 6.5;

export function BroadcastIssuesMap({ className, interactionsDisabled }: BroadcastIssuesMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [metadata, setMetadata] = useState<{
    totalIssues: number;
    districtsWithIssues: number;
    maxIssuesPerDistrict: number;
  } | null>(null);

  const { basemapOpacity, selectedCategoryIds, toggleIssuesPanel, issuesPanelOpen } = useBroadcastStore();

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

  // Load choropleth data function
  const loadChoropleth = useCallback(async (categoryIds: number[]) => {
    const mapInstance = map.current;
    if (!mapInstance || !isLoaded) return;

    setIsDataLoading(true);

    // Remove existing layers
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
      // Pass category filter if any categories are selected
      const params: { categoryId?: number } = {};
      if (categoryIds.length === 1) {
        // API only supports single category filter for now
        params.categoryId = categoryIds[0];
      }
      // Note: For multiple categories, we'd need to update the API
      // For now, if multiple are selected, we load all and filter client-side would be needed

      const choroplethData = await api.getIssuesChoropleth(params);
      setMetadata(choroplethData.metadata);

      // Add source
      mapInstance.addSource('issues-choropleth', {
        type: 'geojson',
        data: choroplethData as unknown as GeoJSON.FeatureCollection,
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

      // Click handler for districts
      mapInstance.on('click', 'issues-choropleth-fill', (e) => {
        if (!e.features || e.features.length === 0) return;
        const props = e.features[0].properties;
        if (!props) return;

        new maplibregl.Popup()
          .setLngLat(e.lngLat)
          .setHTML(`
            <div style="padding: 12px; font-family: system-ui; min-width: 180px;">
              <h3 style="font-weight: bold; margin: 0 0 8px 0; font-size: 16px;">${props.unitName}</h3>
              <div style="font-size: 24px; font-weight: bold; color: ${props.fillColor};">
                ${props.issueCount}
              </div>
              <div style="color: #666; font-size: 14px;">
                issue${props.issueCount !== 1 ? 's' : ''} reported
              </div>
            </div>
          `)
          .addTo(mapInstance);
      });

      // Hover effect
      mapInstance.on('mouseenter', 'issues-choropleth-fill', () => {
        mapInstance.getCanvas().style.cursor = 'pointer';
      });
      mapInstance.on('mouseleave', 'issues-choropleth-fill', () => {
        mapInstance.getCanvas().style.cursor = '';
      });

      // Fit bounds to Uganda (only on initial load)
      if (categoryIds.length === 0) {
        const bounds = new maplibregl.LngLatBounds();
        choroplethData.features.forEach((feature: any) => {
          if (feature.geometry?.coordinates) {
            const processCoords = (coords: any) => {
              if (typeof coords[0] === 'number') {
                bounds.extend(coords as [number, number]);
              } else {
                coords.forEach(processCoords);
              }
            };
            processCoords(feature.geometry.coordinates);
          }
        });

        if (!bounds.isEmpty()) {
          mapInstance.fitBounds(bounds, {
            padding: { top: 80, bottom: 80, left: 80, right: 80 },
            duration: 1500,
          });
        }
      }
    } catch (error) {
      console.error('Failed to load issues choropleth:', error);
    }

    setIsDataLoading(false);
  }, [isLoaded]);

  // Load issues choropleth data when map is ready or filters change
  useEffect(() => {
    if (!map.current || !isLoaded) return;
    loadChoropleth(selectedCategoryIds);
  }, [isLoaded, selectedCategoryIds, loadChoropleth]);

  return (
    <div className="relative w-full h-full">
      <div
        ref={mapContainer}
        className={`w-full h-full ${className || ''}`}
      />

      {/* Title */}
      <div className="absolute top-4 left-4 bg-gray-900/90 backdrop-blur-sm rounded-lg px-4 py-3 z-10">
        <h2 className="text-white font-bold text-lg">Electoral Issues</h2>
        {metadata && (
          <p className="text-gray-400 text-sm">
            {metadata.totalIssues} issues in {metadata.districtsWithIssues} districts
          </p>
        )}
        {selectedCategoryIds.length > 0 && (
          <p className="text-yellow-500 text-xs mt-1">
            Filtered by {selectedCategoryIds.length} category{selectedCategoryIds.length > 1 ? 'ies' : ''}
          </p>
        )}
      </div>

      {/* Filter Button */}
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
          ${selectedCategoryIds.length > 0 ? 'ring-2 ring-yellow-500' : ''}
        `}
        title="Filter & Statistics (F)"
      >
        <Filter size={24} />
        {selectedCategoryIds.length > 0 && !issuesPanelOpen && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-yellow-500 text-gray-900 text-xs font-bold rounded-full flex items-center justify-center">
            {selectedCategoryIds.length}
          </span>
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
