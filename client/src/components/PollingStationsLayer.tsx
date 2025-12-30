import { useEffect, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import { api } from '../lib/api';

interface PollingStationsLayerProps {
  map: maplibregl.Map | null;
  visible: boolean;
  electionId?: number;
  districtId?: number;
}

export function PollingStationsLayer({ map, visible, electionId, districtId }: PollingStationsLayerProps) {
  const loadStations = useCallback(async () => {
    if (!map || !visible) return;

    try {
      const data = await api.getPollingStationsGeoJSON({ electionId, districtId });

      // Remove existing layers if present
      try {
        if (map.getLayer('stations-clusters')) map.removeLayer('stations-clusters');
        if (map.getLayer('stations-cluster-count')) map.removeLayer('stations-cluster-count');
        if (map.getLayer('stations-circles')) map.removeLayer('stations-circles');
        if (map.getSource('stations')) map.removeSource('stations');
      } catch (e) {
        // Layers may not exist yet
      }

      // Add GeoJSON source with clustering
      map.addSource('stations', {
        type: 'geojson',
        data: data as GeoJSON.FeatureCollection,
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 50,
        clusterProperties: {
          totalStations: ['+', ['get', 'stationCount']],
          totalVoters: ['+', ['get', 'totalVoters']]
        }
      });

      // Clustered circles - size based on number of stations
      map.addLayer({
        id: 'stations-clusters',
        type: 'circle',
        source: 'stations',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': [
            'step',
            ['get', 'totalStations'],
            '#51bbd6', // < 50 stations
            50,
            '#2196F3', // 50-200 stations
            200,
            '#1565C0', // 200+ stations
          ],
          'circle-radius': [
            'step',
            ['get', 'point_count'],
            20,
            10, 25,
            50, 30,
            100, 35,
          ],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        },
      });

      // Cluster count labels
      map.addLayer({
        id: 'stations-cluster-count',
        type: 'symbol',
        source: 'stations',
        filter: ['has', 'point_count'],
        layout: {
          'text-field': [
            'format',
            ['get', 'totalStations'], {},
          ],
          'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
          'text-size': 11,
        },
        paint: {
          'text-color': '#ffffff',
        },
      });

      // Unclustered point circles (parish-level)
      map.addLayer({
        id: 'stations-circles',
        type: 'circle',
        source: 'stations',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': '#2196F3',
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['get', 'stationCount'],
            1, 6,
            5, 10,
            20, 14,
          ],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
          'circle-opacity': 0.85,
        },
      });

      // Click handler for clusters - zoom in
      map.on('click', 'stations-clusters', async (e) => {
        const features = map.queryRenderedFeatures(e.point, {
          layers: ['stations-clusters'],
        });
        if (!features.length) return;

        const clusterId = features[0].properties?.cluster_id;
        const source = map.getSource('stations') as maplibregl.GeoJSONSource;

        try {
          const zoom = await source.getClusterExpansionZoom(clusterId);
          const geometry = features[0].geometry;
          if (geometry.type === 'Point') {
            map.easeTo({
              center: geometry.coordinates as [number, number],
              zoom: zoom ?? 10,
            });
          }
        } catch (err) {
          console.error('Error getting cluster expansion zoom:', err);
        }
      });

      // Click handler for individual parish points
      map.on('click', 'stations-circles', (e) => {
        if (!e.features || e.features.length === 0) return;
        const feature = e.features[0];
        const props = feature.properties;
        if (!props) return;

        const geometry = feature.geometry;
        if (geometry.type !== 'Point') return;

        // Parse stations array from string
        let stations: Array<{ name: string; code: string }> = [];
        try {
          stations = JSON.parse(props.stations || '[]');
        } catch (e) {
          // Ignore parse errors
        }

        const popupContent = createStationPopupHTML(props, stations);

        new maplibregl.Popup({ closeOnClick: true, maxWidth: '350px' })
          .setLngLat(geometry.coordinates as [number, number])
          .setHTML(popupContent)
          .addTo(map);
      });

      // Hover effects
      map.on('mouseenter', 'stations-circles', () => {
        map.getCanvas().style.cursor = 'pointer';
      });

      map.on('mouseleave', 'stations-circles', () => {
        map.getCanvas().style.cursor = '';
      });

      map.on('mouseenter', 'stations-clusters', () => {
        map.getCanvas().style.cursor = 'pointer';
      });

      map.on('mouseleave', 'stations-clusters', () => {
        map.getCanvas().style.cursor = '';
      });
    } catch (err) {
      console.error('Error loading polling stations:', err);
    }
  }, [map, visible, electionId, districtId]);

  // Load stations when map or filters change
  useEffect(() => {
    if (map && visible) {
      loadStations();
    } else if (map && !visible) {
      // Hide layers when not visible
      try {
        if (map.getLayer('stations-circles')) {
          map.setLayoutProperty('stations-circles', 'visibility', 'none');
        }
        if (map.getLayer('stations-clusters')) {
          map.setLayoutProperty('stations-clusters', 'visibility', 'none');
        }
        if (map.getLayer('stations-cluster-count')) {
          map.setLayoutProperty('stations-cluster-count', 'visibility', 'none');
        }
      } catch (e) {
        // Layers may not exist
      }
    }
  }, [map, visible, loadStations]);

  // Show layers when visibility changes to true
  useEffect(() => {
    if (map && visible) {
      try {
        if (map.getLayer('stations-circles')) {
          map.setLayoutProperty('stations-circles', 'visibility', 'visible');
        }
        if (map.getLayer('stations-clusters')) {
          map.setLayoutProperty('stations-clusters', 'visibility', 'visible');
        }
        if (map.getLayer('stations-cluster-count')) {
          map.setLayoutProperty('stations-cluster-count', 'visibility', 'visible');
        }
      } catch (e) {
        // Layers may not exist yet
      }
    }
  }, [map, visible]);

  return null;
}

// Helper function to create popup HTML
function createStationPopupHTML(
  props: Record<string, any>,
  stations: Array<{ name: string; code: string }>
): string {
  const votersFormatted = props.totalVoters?.toLocaleString() || '0';

  return `
    <div class="station-popup" style="font-family: system-ui, sans-serif;">
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
        <span style="
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background-color: #2196F3;
          color: white;
          font-size: 12px;
          font-weight: bold;
        ">${props.stationCount || 0}</span>
        <strong style="color: #1a1a1a;">${props.parishName || 'Unknown Parish'}</strong>
      </div>

      <div style="font-size: 12px; color: #666; margin-bottom: 8px;">
        ${props.district || ''} > ${props.constituency || ''} > ${props.subcounty || ''}
      </div>

      <div style="font-size: 13px; color: #333; margin-bottom: 8px;">
        <strong>${votersFormatted}</strong> registered voters
      </div>

      ${stations.length > 0 ? `
        <div style="border-top: 1px solid #eee; padding-top: 8px; max-height: 150px; overflow-y: auto;">
          <div style="font-size: 11px; color: #666; margin-bottom: 4px;">Polling Stations:</div>
          ${stations.slice(0, 10).map(s => `
            <div style="font-size: 12px; color: #333; padding: 2px 0;">
              <span style="color: #888;">${s.code}.</span> ${s.name}
            </div>
          `).join('')}
          ${stations.length > 10 ? `
            <div style="font-size: 11px; color: #888; padding-top: 4px;">
              ... and ${stations.length - 10} more
            </div>
          ` : ''}
        </div>
      ` : ''}
    </div>
  `;
}

// Export filter panel component
export function PollingStationsFilterPanel({
  visible,
  onVisibilityChange,
  stationCount,
}: {
  visible: boolean;
  onVisibilityChange: (visible: boolean) => void;
  stationCount?: number;
}) {
  return (
    <div className="bg-gray-800/95 backdrop-blur-sm px-4 py-3 rounded-lg shadow-lg">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-white text-sm">Polling Stations</h3>
          {stationCount !== undefined && (
            <p className="text-gray-400 text-xs">{stationCount.toLocaleString()} stations</p>
          )}
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={visible}
            onChange={(e) => onVisibilityChange(e.target.checked)}
            className="w-4 h-4 rounded border-gray-600 text-blue-500 focus:ring-blue-500"
          />
          <span className="text-gray-300 text-xs">Show</span>
        </label>
      </div>

      {visible && (
        <div className="mt-2 flex items-center gap-2 text-xs text-gray-400">
          <span
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: '#2196F3' }}
          />
          <span>Parish locations (grouped)</span>
        </div>
      )}
    </div>
  );
}
