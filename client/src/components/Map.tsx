import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

interface MapProps {
  onLoad?: (map: maplibregl.Map) => void;
  className?: string;
  touchOptimized?: boolean; // Enable larger touch targets and gestures
}

const Map = ({ onLoad, className, touchOptimized: _touchOptimized = true }: MapProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const onLoadRef = useRef(onLoad);

  // Keep onLoad ref updated without triggering effect
  useEffect(() => {
    onLoadRef.current = onLoad;
  }, [onLoad]);

  useEffect(() => {
    if (map.current || !mapContainer.current) return;

    // Initialize map centered on Uganda with touch gesture support
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
      },
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
  }, []); // Empty dependency array - map only created once

  return (
    <div
      ref={mapContainer}
      className={`w-full h-full ${className || ''}`}
      style={{ minHeight: '400px' }}
    />
  );
};

export default Map;
