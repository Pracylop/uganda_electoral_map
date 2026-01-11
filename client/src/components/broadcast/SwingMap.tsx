import { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import { useBroadcastStore } from '../../stores/broadcastStore';
import { useEffectiveBasemap } from '../../hooks/useOnlineStatus';
import { getMapStyle } from '../../lib/mapStyles';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

async function fetchWithAuth<T>(endpoint: string): Promise<T> {
  const token = localStorage.getItem('auth_token');
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}

interface SwingMapProps {
  election1Id: number | null;
  election2Id: number | null;
  election1Name?: string;
  election2Name?: string;
}

interface SwingFeature {
  type: 'Feature';
  properties: {
    unitId: number;
    unitName: string;
    swingType: 'changed' | 'new' | 'gained' | 'lost' | 'stable' | 'no_data';
    swingValue: string;
    swingParty: string | null;
    swingColor: string;
    winner1Name: string | null;
    winner1Party: string | null;
    winner1Percent: string | null;
    winner2Name: string | null;
    winner2Party: string | null;
    winner2Percent: string | null;
  };
  geometry: GeoJSON.Geometry;
}

interface SwingData {
  type: 'FeatureCollection';
  features: SwingFeature[];
  bbox?: [number, number, number, number];
}

export function SwingMap({
  election1Id,
  election2Id,
  election1Name,
  election2Name,
}: SwingMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [swingStats, setSwingStats] = useState<{
    changed: number;
    gained: number;
    lost: number;
    stable: number;
    noData: number;
  }>({ changed: 0, gained: 0, lost: 0, stable: 0, noData: 0 });

  const { currentLevel, selectedRegionId } = useBroadcastStore();

  // Get effective basemap mode (online/offline)
  const effectiveBasemap = useEffectiveBasemap();
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

  // Load swing data
  const loadSwingData = useCallback(async () => {
    if (!election1Id || !election2Id) return;

    const map = mapRef.current;
    if (!map) return;

    setIsLoading(true);
    setError(null);

    try {
      let url = `/api/map/swing/${election1Id}/${election2Id}?level=${currentLevel}`;
      if (selectedRegionId !== null) {
        url += `&parentId=${selectedRegionId}`;
      }

      const data = await fetchWithAuth<SwingData>(url);

      // Calculate stats
      const stats = { changed: 0, gained: 0, lost: 0, stable: 0, noData: 0 };
      data.features.forEach((f: SwingFeature) => {
        switch (f.properties.swingType) {
          case 'changed': stats.changed++; break;
          case 'gained': stats.gained++; break;
          case 'lost': stats.lost++; break;
          case 'stable': stats.stable++; break;
          default: stats.noData++;
        }
      });
      setSwingStats(stats);

      // Remove existing layers and source
      try {
        if (map.getLayer('swing-fill')) map.removeLayer('swing-fill');
        if (map.getLayer('swing-outline')) map.removeLayer('swing-outline');
        if (map.getLayer('swing-highlight')) map.removeLayer('swing-highlight');
        if (map.getLayer('swing-labels')) map.removeLayer('swing-labels');
        if (map.getSource('swing-data')) map.removeSource('swing-data');
      } catch (e) {
        // Layers might not exist
      }

      // Add source
      map.addSource('swing-data', {
        type: 'geojson',
        data: data as GeoJSON.FeatureCollection,
      });

      // Add fill layer with swing colors
      map.addLayer({
        id: 'swing-fill',
        type: 'fill',
        source: 'swing-data',
        paint: {
          'fill-color': [
            'case',
            ['==', ['get', 'swingType'], 'changed'], ['get', 'swingColor'],
            ['==', ['get', 'swingType'], 'new'], ['get', 'swingColor'],
            ['==', ['get', 'swingType'], 'gained'], ['get', 'swingColor'],
            ['==', ['get', 'swingType'], 'lost'], ['get', 'swingColor'],
            '#808080' // no_data - gray
          ],
          'fill-opacity': [
            'case',
            ['==', ['get', 'swingType'], 'changed'], 0.9,
            ['==', ['get', 'swingType'], 'no_data'], 0.3,
            0.7
          ],
        },
      });

      // Add highlight layer for changed regions
      map.addLayer({
        id: 'swing-highlight',
        type: 'line',
        source: 'swing-data',
        paint: {
          'line-color': [
            'case',
            ['==', ['get', 'swingType'], 'changed'], '#ffff00', // Yellow for changed
            'transparent'
          ],
          'line-width': [
            'case',
            ['==', ['get', 'swingType'], 'changed'], 4,
            0
          ],
        },
      });

      // Add outline layer
      map.addLayer({
        id: 'swing-outline',
        type: 'line',
        source: 'swing-data',
        paint: {
          'line-color': '#333333',
          'line-width': 0.5,
        },
      });

      // Fit bounds if we have data
      if (data.bbox) {
        map.fitBounds(
          [
            [data.bbox[0], data.bbox[1]],
            [data.bbox[2], data.bbox[3]],
          ],
          { padding: 50, duration: 1000 }
        );
      }

      setIsLoading(false);
    } catch (err) {
      console.error('Error loading swing data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load swing data');
      setIsLoading(false);
    }
  }, [election1Id, election2Id, currentLevel, selectedRegionId]);

  // Initialize map with dynamic basemap (online/offline)
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    // Get appropriate style based on basemap mode
    const mapStyle = getMapStyle(effectiveBasemap, isOnline);

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: mapStyle,
      center: [32.5, 1.5], // Uganda center
      zoom: 6,
      attributionControl: false,
    });

    map.on('load', () => {
      mapRef.current = map;
      loadSwingData();
    });

    // Add popup for region info
    const popup = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
    });

    map.on('mouseenter', 'swing-fill', () => {
      map.getCanvas().style.cursor = 'pointer';
    });

    map.on('mouseleave', 'swing-fill', () => {
      map.getCanvas().style.cursor = '';
      popup.remove();
    });

    map.on('mousemove', 'swing-fill', (e) => {
      if (!e.features || e.features.length === 0) return;

      const feature = e.features[0];
      const props = feature.properties;

      let swingLabel = '';
      switch (props.swingType) {
        case 'changed':
          swingLabel = `<span class="text-yellow-400 font-bold">CHANGED</span> to ${props.swingParty}`;
          break;
        case 'new':
          swingLabel = `<span class="text-blue-400">NEW</span> - Won by ${props.swingParty}`;
          break;
        case 'gained':
          swingLabel = `<span class="text-green-400">+${props.swingValue}%</span> for ${props.swingParty}`;
          break;
        case 'lost':
          swingLabel = `<span class="text-red-400">${props.swingValue}%</span> for ${props.swingParty}`;
          break;
        case 'stable':
          swingLabel = `Stable (${props.swingParty})`;
          break;
        default:
          swingLabel = '<span class="text-gray-400">No data</span>';
      }

      const html = `
        <div class="bg-gray-900 text-white p-3 rounded-lg shadow-lg min-w-[200px]">
          <div class="font-bold text-lg mb-2">${props.unitName}</div>
          <div class="mb-2">${swingLabel}</div>
          <div class="border-t border-gray-700 pt-2 mt-2 text-sm">
            ${props.winner1Name ? `
              <div class="flex justify-between">
                <span class="text-gray-400">${election1Name || 'Previous'}:</span>
                <span>${props.winner1Name} (${props.winner1Percent}%)</span>
              </div>
            ` : ''}
            ${props.winner2Name ? `
              <div class="flex justify-between">
                <span class="text-gray-400">${election2Name || 'Current'}:</span>
                <span>${props.winner2Name} (${props.winner2Percent}%)</span>
              </div>
            ` : ''}
          </div>
        </div>
      `;

      popup.setLngLat(e.lngLat).setHTML(html).addTo(map);
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [effectiveBasemap, isOnline]);

  // Reload data when elections or level change
  useEffect(() => {
    if (mapRef.current) {
      loadSwingData();
    }
  }, [loadSwingData]);

  if (!election1Id || !election2Id) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-900">
        <div className="text-center text-gray-400">
          <p className="text-xl mb-2">Select Two Elections</p>
          <p>Choose elections to compare swing analysis</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      {/* Map Container */}
      <div ref={mapContainer} className="w-full h-full" />

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-gray-900/50 flex items-center justify-center">
          <div className="text-white text-lg">Loading swing data...</div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-600 text-white px-4 py-2 rounded-lg">
          {error}
        </div>
      )}

      {/* Header Label */}
      <div className="absolute top-4 left-4 bg-orange-500 text-gray-900 px-4 py-2 rounded-lg shadow-lg font-bold">
        Swing Analysis: {election1Name} → {election2Name}
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-gray-900/90 backdrop-blur-sm rounded-lg p-4 shadow-lg">
        <h4 className="text-white font-bold mb-3">Swing Legend</h4>
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded border-2 border-yellow-400 bg-yellow-400/50" />
            <span className="text-white">Changed Party ({swingStats.changed})</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-green-500/70" />
            <span className="text-white">Vote Gain ({swingStats.gained})</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-red-500/70" />
            <span className="text-white">Vote Loss ({swingStats.lost})</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-blue-400/70" />
            <span className="text-white">New Data ({swingStats.stable})</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-gray-500/50" />
            <span className="text-gray-400">No Data ({swingStats.noData})</span>
          </div>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="absolute bottom-4 right-4 bg-gray-900/90 backdrop-blur-sm rounded-lg p-4 shadow-lg">
        <h4 className="text-white font-bold mb-2">Summary</h4>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <span className="text-gray-400">Seats Changed:</span>
          <span className="text-yellow-400 font-bold text-right">{swingStats.changed}</span>
          <span className="text-gray-400">Total Regions:</span>
          <span className="text-white font-bold text-right">
            {swingStats.changed + swingStats.gained + swingStats.lost + swingStats.stable + swingStats.noData}
          </span>
        </div>
      </div>
    </div>
  );
}
