import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

interface MapProps {
  onLoad?: (map: maplibregl.Map) => void;
  className?: string;
  touchOptimized?: boolean; // Enable larger touch targets and gestures
}

const Map = ({ onLoad, className, touchOptimized = true }: MapProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);

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

    // Call onLoad callback when map style is fully loaded
    if (onLoad && map.current) {
      const mapInstance = map.current;

      // Wait for both load and style to be ready
      const checkAndCallback = () => {
        if (mapInstance && mapInstance.isStyleLoaded()) {
          onLoad(mapInstance);
        } else {
          // If style not ready yet, wait a bit more
          mapInstance.once('styledata', () => {
            onLoad(mapInstance);
          });
        }
      };

      mapInstance.on('load', checkAndCallback);
    }

    // Cleanup on unmount
    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [onLoad]);

  return (
    <div className={`relative w-full h-full ${className || ''}`}>
      <div
        ref={mapContainer}
        className="absolute inset-0"
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
};

export default Map;
