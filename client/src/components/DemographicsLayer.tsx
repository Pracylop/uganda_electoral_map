import { useEffect, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import { api } from '../lib/api';

type DemographicMetric = 'population' | 'votingAge' | 'votingAgePercent';

interface DemographicsLayerProps {
  map: maplibregl.Map | null;
  visible: boolean;
  level?: number;
  metric?: DemographicMetric;
}

// Color scales for different metrics
const colorScales: Record<DemographicMetric, { stops: number[]; colors: string[] }> = {
  population: {
    stops: [0, 100000, 300000, 500000, 1000000, 2000000],
    colors: ['#f7fbff', '#c6dbef', '#6baed6', '#2171b5', '#08519c', '#08306b'],
  },
  votingAge: {
    stops: [0, 50000, 150000, 300000, 500000, 1000000],
    colors: ['#f7fcf5', '#c7e9c0', '#74c476', '#31a354', '#006d2c', '#00441b'],
  },
  votingAgePercent: {
    stops: [0, 40, 45, 50, 55, 60],
    colors: ['#ffffcc', '#d9f0a3', '#addd8e', '#78c679', '#31a354', '#006837'],
  },
};

export function DemographicsLayer({ map, visible, level = 2, metric = 'population' }: DemographicsLayerProps) {
  const loadDemographics = useCallback(async () => {
    if (!map || !visible) return;

    try {
      const data = await api.getDemographicsGeoJSON({ level });

      // Remove existing layers if present
      try {
        if (map.getLayer('demographics-fill')) map.removeLayer('demographics-fill');
        if (map.getLayer('demographics-line')) map.removeLayer('demographics-line');
        if (map.getLayer('demographics-labels')) map.removeLayer('demographics-labels');
        if (map.getSource('demographics')) map.removeSource('demographics');
      } catch (e) {
        // Layers may not exist yet
      }

      // Add GeoJSON source
      map.addSource('demographics', {
        type: 'geojson',
        data: data as GeoJSON.FeatureCollection,
      });

      // Get the property to color by
      const colorProperty = metric === 'votingAgePercent' ? 'votingAgePercent' :
                           metric === 'votingAge' ? 'votingAgePopulation' : 'totalPopulation';

      const scale = colorScales[metric];

      // Build color expression
      const colorExpr: any[] = [
        'interpolate',
        ['linear'],
        ['get', colorProperty],
      ];

      for (let i = 0; i < scale.stops.length; i++) {
        colorExpr.push(scale.stops[i], scale.colors[i]);
      }

      // Add fill layer
      map.addLayer({
        id: 'demographics-fill',
        type: 'fill',
        source: 'demographics',
        paint: {
          'fill-color': colorExpr as any,
          'fill-opacity': 0.7,
        },
      }, 'stations-circles'); // Insert below polling stations if they exist

      // Add border line
      map.addLayer({
        id: 'demographics-line',
        type: 'line',
        source: 'demographics',
        paint: {
          'line-color': '#333',
          'line-width': 1,
          'line-opacity': 0.5,
        },
      }, 'demographics-fill');

      // Click handler for popups
      map.on('click', 'demographics-fill', (e) => {
        if (!e.features || e.features.length === 0) return;
        const feature = e.features[0];
        const props = feature.properties;
        if (!props) return;

        const popupContent = createDemographicsPopupHTML(props);

        new maplibregl.Popup({ closeOnClick: true, maxWidth: '350px' })
          .setLngLat(e.lngLat)
          .setHTML(popupContent)
          .addTo(map);
      });

      // Hover effects
      map.on('mouseenter', 'demographics-fill', () => {
        map.getCanvas().style.cursor = 'pointer';
      });

      map.on('mouseleave', 'demographics-fill', () => {
        map.getCanvas().style.cursor = '';
      });
    } catch (err) {
      console.error('Error loading demographics:', err);
    }
  }, [map, visible, level, metric]);

  // Load demographics when map or settings change
  useEffect(() => {
    if (map && visible) {
      loadDemographics();
    } else if (map && !visible) {
      // Hide layers when not visible
      try {
        if (map.getLayer('demographics-fill')) {
          map.setLayoutProperty('demographics-fill', 'visibility', 'none');
        }
        if (map.getLayer('demographics-line')) {
          map.setLayoutProperty('demographics-line', 'visibility', 'none');
        }
      } catch (e) {
        // Layers may not exist
      }
    }
  }, [map, visible, level, metric, loadDemographics]);

  // Show layers when visibility changes to true
  useEffect(() => {
    if (map && visible) {
      try {
        if (map.getLayer('demographics-fill')) {
          map.setLayoutProperty('demographics-fill', 'visibility', 'visible');
        }
        if (map.getLayer('demographics-line')) {
          map.setLayoutProperty('demographics-line', 'visibility', 'visible');
        }
      } catch (e) {
        // Layers may not exist yet
      }
    }
  }, [map, visible]);

  return null;
}

// Helper function to create popup HTML
function createDemographicsPopupHTML(props: Record<string, any>): string {
  const totalPop = props.totalPopulation?.toLocaleString() || '0';
  const votingAge = props.votingAgePopulation?.toLocaleString() || '0';
  const votingPercent = props.votingAgePercent || 0;
  const malePercent = props.malePercent || 0;
  const households = props.numberOfHouseholds?.toLocaleString() || 'N/A';

  return `
    <div class="demographics-popup" style="font-family: system-ui, sans-serif;">
      <div style="font-weight: bold; font-size: 14px; color: #1a1a1a; margin-bottom: 8px; border-bottom: 1px solid #eee; padding-bottom: 6px;">
        ${props.name || 'Unknown'}
      </div>

      <div style="display: grid; gap: 6px; font-size: 13px;">
        <div style="display: flex; justify-content: space-between;">
          <span style="color: #666;">Total Population:</span>
          <strong style="color: #1a1a1a;">${totalPop}</strong>
        </div>

        <div style="display: flex; justify-content: space-between;">
          <span style="color: #666;">Voting Age (18+):</span>
          <strong style="color: #006d2c;">${votingAge}</strong>
          <span style="color: #888; font-size: 11px;">(${votingPercent}%)</span>
        </div>

        <div style="display: flex; justify-content: space-between;">
          <span style="color: #666;">Gender Split:</span>
          <span style="color: #1a1a1a;">${malePercent}% M / ${(100 - malePercent).toFixed(1)}% F</span>
        </div>

        <div style="display: flex; justify-content: space-between;">
          <span style="color: #666;">Households:</span>
          <strong style="color: #1a1a1a;">${households}</strong>
        </div>

        <div style="font-size: 11px; color: #888; margin-top: 4px; text-align: right;">
          2024 Census Data
        </div>
      </div>
    </div>
  `;
}

// Export filter panel component
export function DemographicsFilterPanel({
  visible,
  onVisibilityChange,
  metric,
  onMetricChange,
  nationalStats,
}: {
  visible: boolean;
  onVisibilityChange: (visible: boolean) => void;
  metric: DemographicMetric;
  onMetricChange: (metric: DemographicMetric) => void;
  nationalStats?: {
    totalPopulation: number;
    votingAgePopulation: number;
  };
}) {
  const scale = colorScales[metric];

  return (
    <div className="bg-gray-800/95 backdrop-blur-sm px-4 py-3 rounded-lg shadow-lg">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="font-bold text-white text-sm">Demographics</h3>
          <p className="text-gray-400 text-xs">2024 Census</p>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={visible}
            onChange={(e) => onVisibilityChange(e.target.checked)}
            className="w-4 h-4 rounded border-gray-600 text-green-500 focus:ring-green-500"
          />
          <span className="text-gray-300 text-xs">Show</span>
        </label>
      </div>

      {visible && (
        <>
          <div className="mb-3">
            <label className="text-gray-400 text-xs block mb-1">Metric:</label>
            <select
              value={metric}
              onChange={(e) => onMetricChange(e.target.value as DemographicMetric)}
              className="w-full bg-gray-700 text-white text-xs rounded px-2 py-1 border border-gray-600"
            >
              <option value="population">Total Population</option>
              <option value="votingAge">Voting Age (18+)</option>
              <option value="votingAgePercent">Voting Age %</option>
            </select>
          </div>

          {/* Color scale legend */}
          <div className="mb-2">
            <div className="flex h-2 rounded overflow-hidden">
              {scale.colors.map((color, i) => (
                <div
                  key={i}
                  className="flex-1"
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>{metric === 'votingAgePercent' ? '0%' : '0'}</span>
              <span>
                {metric === 'votingAgePercent'
                  ? `${scale.stops[scale.stops.length - 1]}%`
                  : `${(scale.stops[scale.stops.length - 1] / 1000000).toFixed(1)}M`}
              </span>
            </div>
          </div>

          {/* National stats */}
          {nationalStats && (
            <div className="pt-2 border-t border-gray-700 text-xs">
              <div className="flex justify-between text-gray-400">
                <span>National Population:</span>
                <span className="text-white font-medium">
                  {(nationalStats.totalPopulation / 1000000).toFixed(1)}M
                </span>
              </div>
              <div className="flex justify-between text-gray-400 mt-1">
                <span>Voting Age:</span>
                <span className="text-green-400 font-medium">
                  {(nationalStats.votingAgePopulation / 1000000).toFixed(1)}M
                  ({((nationalStats.votingAgePopulation / nationalStats.totalPopulation) * 100).toFixed(1)}%)
                </span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
