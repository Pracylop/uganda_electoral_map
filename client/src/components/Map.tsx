import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import { Protocol } from 'pmtiles';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffectiveBasemap } from '../hooks/useOnlineStatus';

// Register PMTiles protocol globally (only once)
const pmtilesProtocol = new Protocol();
maplibregl.addProtocol('pmtiles', pmtilesProtocol.tile);

interface MapProps {
  onLoad?: (map: maplibregl.Map) => void;
  className?: string;
  touchOptimized?: boolean; // Enable larger touch targets and gestures
}

const Map = ({ onLoad, className, touchOptimized: _touchOptimized = true }: MapProps) => {
  // Get effective basemap based on user preference and online status
  const effectiveBasemap = useEffectiveBasemap();
  const useOfflineTiles = effectiveBasemap === 'offline';
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const onLoadRef = useRef(onLoad);
  const prevBasemapRef = useRef<string | null>(null);

  // Keep onLoad ref updated without triggering effect
  useEffect(() => {
    onLoadRef.current = onLoad;
  }, [onLoad]);

  useEffect(() => {
    // If basemap changed and map exists, destroy old map to recreate with new style
    if (prevBasemapRef.current !== null && prevBasemapRef.current !== effectiveBasemap && map.current) {
      map.current.remove();
      map.current = null;
    }
    prevBasemapRef.current = effectiveBasemap;

    if (map.current || !mapContainer.current) return;

    // Choose between offline PMTiles or online OSM tiles
    const style: maplibregl.StyleSpecification = useOfflineTiles
      ? {
          version: 8,
          sources: {
            'basemap': {
              type: 'vector',
              url: 'pmtiles:///tiles/uganda_basemap.pmtiles',
              attribution: '&copy; OpenMapTiles &copy; OpenStreetMap contributors'
            },
            'admin': {
              type: 'vector',
              url: 'pmtiles:///tiles/uganda_admin.pmtiles',
              attribution: 'Uganda Admin Boundaries'
            }
          },
          layers: [
            // Water
            {
              id: 'water',
              type: 'fill',
              source: 'basemap',
              'source-layer': 'water',
              paint: { 'fill-color': '#a0c4e4' }
            },
            // Land background
            {
              id: 'background',
              type: 'background',
              paint: { 'background-color': '#f8f4f0' }
            },
            // Landuse
            {
              id: 'landuse-residential',
              type: 'fill',
              source: 'basemap',
              'source-layer': 'landuse',
              filter: ['==', 'class', 'residential'],
              paint: { 'fill-color': '#e8e0d8' }
            },
            {
              id: 'landuse-commercial',
              type: 'fill',
              source: 'basemap',
              'source-layer': 'landuse',
              filter: ['==', 'class', 'commercial'],
              paint: { 'fill-color': '#f5dce8' }
            },
            {
              id: 'landuse-park',
              type: 'fill',
              source: 'basemap',
              'source-layer': 'landuse',
              filter: ['in', 'class', 'park', 'cemetery', 'grass'],
              paint: { 'fill-color': '#c8e6c8' }
            },
            // Buildings
            {
              id: 'buildings',
              type: 'fill',
              source: 'basemap',
              'source-layer': 'building',
              minzoom: 13,
              paint: {
                'fill-color': '#d9d0c9',
                'fill-outline-color': '#bfb8b0'
              }
            },
            // Roads - minor
            {
              id: 'roads-minor',
              type: 'line',
              source: 'basemap',
              'source-layer': 'transportation',
              filter: ['in', 'class', 'minor', 'service', 'track'],
              paint: {
                'line-color': '#ffffff',
                'line-width': ['interpolate', ['linear'], ['zoom'], 10, 0.5, 14, 2]
              }
            },
            // Roads - tertiary
            {
              id: 'roads-tertiary',
              type: 'line',
              source: 'basemap',
              'source-layer': 'transportation',
              filter: ['==', 'class', 'tertiary'],
              paint: {
                'line-color': '#ffffff',
                'line-width': ['interpolate', ['linear'], ['zoom'], 8, 0.5, 14, 4]
              }
            },
            // Roads - secondary
            {
              id: 'roads-secondary',
              type: 'line',
              source: 'basemap',
              'source-layer': 'transportation',
              filter: ['==', 'class', 'secondary'],
              paint: {
                'line-color': '#ffd700',
                'line-width': ['interpolate', ['linear'], ['zoom'], 8, 1, 14, 5]
              }
            },
            // Roads - primary
            {
              id: 'roads-primary',
              type: 'line',
              source: 'basemap',
              'source-layer': 'transportation',
              filter: ['==', 'class', 'primary'],
              paint: {
                'line-color': '#ffaa00',
                'line-width': ['interpolate', ['linear'], ['zoom'], 6, 0.5, 14, 6]
              }
            },
            // Roads - trunk
            {
              id: 'roads-trunk',
              type: 'line',
              source: 'basemap',
              'source-layer': 'transportation',
              filter: ['==', 'class', 'trunk'],
              paint: {
                'line-color': '#ff6600',
                'line-width': ['interpolate', ['linear'], ['zoom'], 6, 1, 14, 7]
              }
            },
            // Roads - motorway
            {
              id: 'roads-motorway',
              type: 'line',
              source: 'basemap',
              'source-layer': 'transportation',
              filter: ['==', 'class', 'motorway'],
              paint: {
                'line-color': '#e55e5e',
                'line-width': ['interpolate', ['linear'], ['zoom'], 6, 1, 14, 8]
              }
            },
            // Admin boundaries (clickable - invisible fill for hit detection)
            {
              id: 'admin-boundaries-fill',
              type: 'fill',
              source: 'admin',
              'source-layer': 'admin',
              paint: {
                'fill-color': 'transparent',
                'fill-opacity': 0
              }
            },
            // Admin boundary lines
            {
              id: 'admin-boundaries-line',
              type: 'line',
              source: 'admin',
              'source-layer': 'admin',
              paint: {
                'line-color': '#8b8b8b',
                'line-width': 0.5,
                'line-opacity': 0.5
              }
            },
            // Place labels - cities
            {
              id: 'place-city',
              type: 'symbol',
              source: 'basemap',
              'source-layer': 'place',
              filter: ['==', 'class', 'city'],
              layout: {
                'text-field': ['get', 'name'],
                'text-size': 14,
                'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold']
              },
              paint: {
                'text-color': '#333333',
                'text-halo-color': '#ffffff',
                'text-halo-width': 1.5
              }
            },
            // Place labels - towns
            {
              id: 'place-town',
              type: 'symbol',
              source: 'basemap',
              'source-layer': 'place',
              filter: ['==', 'class', 'town'],
              minzoom: 8,
              layout: {
                'text-field': ['get', 'name'],
                'text-size': 12,
                'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular']
              },
              paint: {
                'text-color': '#444444',
                'text-halo-color': '#ffffff',
                'text-halo-width': 1
              }
            },
            // Place labels - villages
            {
              id: 'place-village',
              type: 'symbol',
              source: 'basemap',
              'source-layer': 'place',
              filter: ['==', 'class', 'village'],
              minzoom: 10,
              layout: {
                'text-field': ['get', 'name'],
                'text-size': 10,
                'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular']
              },
              paint: {
                'text-color': '#555555',
                'text-halo-color': '#ffffff',
                'text-halo-width': 1
              }
            }
          ],
          glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf'
        }
      : {
          version: 8,
          sources: {
            'osm': {
              type: 'raster',
              tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
              tileSize: 256,
              attribution: '&copy; OpenStreetMap Contributors',
              maxzoom: 19
            }
          },
          layers: [
            {
              id: 'osm',
              type: 'raster',
              source: 'osm'
            }
          ]
        };

    // Initialize map centered on Uganda with touch gesture support
    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style,
      center: [32.5825, 1.3733], // Uganda coordinates (Kampala)
      zoom: 6.5,
      // Touch gesture configuration
      dragRotate: true,           // Enable drag to rotate
      touchZoomRotate: true,      // Enable pinch zoom and rotation
      touchPitch: true,           // Enable two-finger pitch/tilt
      doubleClickZoom: true       // Enable double-tap to zoom
    });

    // Add navigation controls with touch-friendly sizing
    map.current.addControl(
      new maplibregl.NavigationControl({
        showCompass: true,
        showZoom: true,
        visualizePitch: true  // Show pitch indicator
      }),
      'top-right'
    );

    const mapInstance = map.current;

    // Wait for both load and style to be ready
    const checkAndCallback = () => {
      if (mapInstance && mapInstance.isStyleLoaded() && onLoadRef.current) {
        onLoadRef.current(mapInstance);
      } else if (onLoadRef.current) {
        // If style not ready yet, wait a bit more
        mapInstance.once('styledata', () => {
          if (onLoadRef.current) {
            onLoadRef.current(mapInstance);
          }
        });
      }
    };

    mapInstance.on('load', checkAndCallback);

    // Handle container resize (for fullscreen transitions)
    const resizeObserver = new ResizeObserver(() => {
      if (map.current) {
        map.current.resize();
      }
    });
    if (mapContainer.current) {
      resizeObserver.observe(mapContainer.current);
    }

    // Also handle fullscreen changes with multiple resize attempts
    const handleFullscreenChange = () => {
      // Resize immediately
      if (map.current) {
        map.current.resize();
      }
      // Resize again after layout settles
      setTimeout(() => {
        if (map.current) {
          map.current.resize();
        }
      }, 100);
      // One more resize after animations complete
      setTimeout(() => {
        if (map.current) {
          map.current.resize();
        }
      }, 300);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    // Cleanup on unmount
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      resizeObserver.disconnect();
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [effectiveBasemap, useOfflineTiles]); // Recreate map when basemap source changes

  return (
    <div
      ref={mapContainer}
      className={`w-full h-full ${className || ''}`}
      style={{ minHeight: '400px' }}
    />
  );
};

export default Map;
