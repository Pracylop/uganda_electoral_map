import { useEffect, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import { api } from '../lib/api';

interface IssueCategory {
  id: number;
  name: string;
  code: string;
  color: string | null;
  severity: number;
}

interface IncidentsLayerProps {
  map: maplibregl.Map | null;
  visible: boolean;
  filters?: {
    categoryId?: number;
    districtId?: number;
    startDate?: string;
    endDate?: string;
  };
  onIssueClick?: (issueId: number) => void;
}

// Default colors for issue categories
const DEFAULT_COLORS: Record<string, string> = {
  campaign_blockage: '#FFA500',
  violence: '#FF0000',
  court_case: '#4169E1',
  voter_intimidation: '#8B0000',
  ballot_tampering: '#800080',
  media_interference: '#20B2AA',
  registration_issue: '#DAA520',
  arrest_detention: '#DC143C',
  property_damage: '#8B4513',
  bribery: '#228B22',
  hate_speech: '#FF6347',
  other: '#808080',
};

export function IncidentsLayer({ map, visible, filters, onIssueClick }: IncidentsLayerProps) {
  const loadIncidents = useCallback(async () => {
    if (!map || !visible) return;

    try {
      const data = await api.getIssuesGeoJSON(filters);

      // Remove existing layers if present
      try {
        if (map.getLayer('incidents-circles')) map.removeLayer('incidents-circles');
        if (map.getLayer('incidents-labels')) map.removeLayer('incidents-labels');
        if (map.getSource('incidents')) map.removeSource('incidents');
      } catch (e) {
        // Layers may not exist yet
      }

      // Add GeoJSON source
      map.addSource('incidents', {
        type: 'geojson',
        data: data as GeoJSON.FeatureCollection,
        cluster: true,
        clusterMaxZoom: 12,
        clusterRadius: 50,
      });

      // Clustered circles layer
      map.addLayer({
        id: 'incidents-clusters',
        type: 'circle',
        source: 'incidents',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': [
            'step',
            ['get', 'point_count'],
            '#FFA500', // < 10: orange
            10,
            '#FF6347', // 10-25: tomato
            25,
            '#FF0000', // 25+: red
          ],
          'circle-radius': [
            'step',
            ['get', 'point_count'],
            20,
            10, 25,
            25, 30,
          ],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        },
      });

      // Cluster count labels
      map.addLayer({
        id: 'incidents-cluster-count',
        type: 'symbol',
        source: 'incidents',
        filter: ['has', 'point_count'],
        layout: {
          'text-field': '{point_count_abbreviated}',
          'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
          'text-size': 12,
        },
        paint: {
          'text-color': '#ffffff',
        },
      });

      // Unclustered point circles with category colors
      // Size based on both severity and casualties
      map.addLayer({
        id: 'incidents-circles',
        type: 'circle',
        source: 'incidents',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': ['coalesce', ['get', 'categoryColor'], '#808080'],
          'circle-radius': [
            '+',
            // Base size from severity
            [
              'interpolate',
              ['linear'],
              ['coalesce', ['get', 'severity'], 1],
              1, 6,
              3, 9,
              5, 12,
            ],
            // Additional size from casualties (capped at 8px extra)
            [
              'min',
              8,
              ['*', 2, ['coalesce', ['get', 'totalCasualties'], 0]]
            ]
          ],
          'circle-stroke-width': [
            'case',
            ['>', ['coalesce', ['get', 'deathCount'], 0], 0],
            3, // Thicker stroke for incidents with deaths
            2
          ],
          'circle-stroke-color': [
            'case',
            ['>', ['coalesce', ['get', 'deathCount'], 0], 0],
            '#dc2626', // Red stroke for incidents with deaths
            '#ffffff'
          ],
          'circle-opacity': 0.85,
        },
      });

      // Click handler for clusters - zoom in
      map.on('click', 'incidents-clusters', async (e) => {
        const features = map.queryRenderedFeatures(e.point, {
          layers: ['incidents-clusters'],
        });
        if (!features.length) return;

        const clusterId = features[0].properties?.cluster_id;
        const source = map.getSource('incidents') as maplibregl.GeoJSONSource;

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

      // Click handler for individual incidents
      map.on('click', 'incidents-circles', (e) => {
        if (!e.features || e.features.length === 0) return;
        const feature = e.features[0];
        const props = feature.properties;
        if (!props) return;

        const geometry = feature.geometry;
        if (geometry.type !== 'Point') return;

        // Create popup content
        const popupContent = createIncidentPopupHTML(props);

        new maplibregl.Popup({ closeOnClick: true, maxWidth: '320px' })
          .setLngLat(geometry.coordinates as [number, number])
          .setHTML(popupContent)
          .addTo(map);

        // Notify parent component
        if (onIssueClick && props.id) {
          onIssueClick(props.id);
        }
      });

      // Hover effects
      map.on('mouseenter', 'incidents-circles', () => {
        map.getCanvas().style.cursor = 'pointer';
      });

      map.on('mouseleave', 'incidents-circles', () => {
        map.getCanvas().style.cursor = '';
      });

      map.on('mouseenter', 'incidents-clusters', () => {
        map.getCanvas().style.cursor = 'pointer';
      });

      map.on('mouseleave', 'incidents-clusters', () => {
        map.getCanvas().style.cursor = '';
      });
    } catch (err) {
      console.error('Error loading incidents:', err);
    }
  }, [map, visible, filters, onIssueClick]);

  // Load incidents when map or filters change
  useEffect(() => {
    if (map && visible) {
      loadIncidents();
    } else if (map && !visible) {
      // Hide layers when not visible
      try {
        if (map.getLayer('incidents-circles')) {
          map.setLayoutProperty('incidents-circles', 'visibility', 'none');
        }
        if (map.getLayer('incidents-clusters')) {
          map.setLayoutProperty('incidents-clusters', 'visibility', 'none');
        }
        if (map.getLayer('incidents-cluster-count')) {
          map.setLayoutProperty('incidents-cluster-count', 'visibility', 'none');
        }
      } catch (e) {
        // Layers may not exist
      }
    }
  }, [map, visible, loadIncidents]);

  // Show layers when visibility changes to true
  useEffect(() => {
    if (map && visible) {
      try {
        if (map.getLayer('incidents-circles')) {
          map.setLayoutProperty('incidents-circles', 'visibility', 'visible');
        }
        if (map.getLayer('incidents-clusters')) {
          map.setLayoutProperty('incidents-clusters', 'visibility', 'visible');
        }
        if (map.getLayer('incidents-cluster-count')) {
          map.setLayoutProperty('incidents-cluster-count', 'visibility', 'visible');
        }
      } catch (e) {
        // Layers may not exist yet - load will happen via other effect
      }
    }
  }, [map, visible]);

  return null; // This component only adds layers to the map
}

// Helper function to create popup HTML for incidents
function createIncidentPopupHTML(props: Record<string, any>): string {
  const date = props.date ? new Date(props.date).toLocaleDateString() : 'Unknown date';
  const severityStars = '★'.repeat(props.severity || 1) + '☆'.repeat(5 - (props.severity || 1));
  const color = props.categoryColor || DEFAULT_COLORS[props.categoryCode] || '#808080';

  // Build casualties section if any
  const casualties: string[] = [];
  if (props.deathCount > 0) casualties.push(`💀 ${props.deathCount} death${props.deathCount > 1 ? 's' : ''}`);
  if (props.injuryCount > 0) casualties.push(`🩹 ${props.injuryCount} injur${props.injuryCount > 1 ? 'ies' : 'y'}`);
  if (props.arrestCount > 0) casualties.push(`🚔 ${props.arrestCount} arrest${props.arrestCount > 1 ? 's' : ''}`);
  const casualtiesHtml = casualties.length > 0
    ? `<div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 8px; padding: 6px; background: #fef2f2; border-radius: 4px;">${casualties.join(' ')}</div>`
    : '';

  // Build protagonist/target section
  let actorsHtml = '';
  if (props.protagonist || props.targetName) {
    const parts: string[] = [];
    if (props.protagonist) parts.push(`<strong>By:</strong> ${props.protagonist}`);
    if (props.targetName) parts.push(`<strong>Target:</strong> ${props.targetName}${props.targetCategory ? ` (${props.targetCategory})` : ''}`);
    actorsHtml = `<div style="font-size: 11px; color: #555; margin-bottom: 8px; padding: 6px; background: #f3f4f6; border-radius: 4px;">${parts.join('<br/>')}</div>`;
  }

  return `
    <div class="incident-popup" style="font-family: system-ui, sans-serif; max-width: 320px;">
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
        <span style="
          display: inline-block;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background-color: ${color};
        "></span>
        <strong style="color: #1a1a1a;">${props.category || 'Unknown'}</strong>
        ${props.caseId ? `<span style="font-size: 10px; color: #999; margin-left: auto;">#${props.caseId}</span>` : ''}
      </div>

      <div style="font-size: 12px; color: #666; margin-bottom: 8px;">
        <span>${date}</span>
        ${props.time ? ` at ${props.time}` : ''}
        ${props.source ? ` • <em>${props.source}</em>` : ''}
      </div>

      ${casualtiesHtml}

      <div style="font-size: 13px; color: #333; margin-bottom: 8px; line-height: 1.4;">
        ${props.summary || 'No details available'}
      </div>

      ${actorsHtml}

      <div style="font-size: 11px; color: #666; border-top: 1px solid #eee; padding-top: 8px;">
        ${props.location ? `<div>📍 ${props.location}</div>` : ''}
        ${props.district ? `<div>🏛️ ${props.district}${props.constituency ? ` > ${props.constituency}` : ''}</div>` : ''}
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px;">
          <span style="color: #ff6600;">Severity: ${severityStars}</span>
          <span style="
            display: inline-block;
            padding: 2px 8px;
            background: ${props.status === 'resolved' ? '#10B981' : '#F59E0B'};
            color: white;
            border-radius: 4px;
            font-size: 10px;
          ">${(props.status || 'reported').toUpperCase()}</span>
        </div>
      </div>
    </div>
  `;
}

// Export a control panel component for filtering incidents
export function IncidentsFilterPanel({
  categories,
  selectedCategory,
  onCategoryChange,
  visible,
  onVisibilityChange,
  isLoading,
}: {
  categories: IssueCategory[];
  selectedCategory: number | null;
  onCategoryChange: (categoryId: number | null) => void;
  visible: boolean;
  onVisibilityChange: (visible: boolean) => void;
  isLoading?: boolean;
}) {
  return (
    <div className="bg-gray-800/95 backdrop-blur-sm px-4 py-3 rounded-lg shadow-lg">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-bold text-white text-sm">Electoral Issues</h3>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={visible}
            onChange={(e) => onVisibilityChange(e.target.checked)}
            className="w-4 h-4 rounded border-gray-600 text-orange-500 focus:ring-orange-500"
          />
          <span className="text-gray-300 text-xs">Show</span>
        </label>
      </div>

      {visible && (
        <div className="space-y-2">
          <select
            value={selectedCategory ?? ''}
            onChange={(e) => onCategoryChange(e.target.value ? parseInt(e.target.value) : null)}
            className="w-full px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-orange-500"
            disabled={isLoading}
          >
            <option value="">All Categories</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>

          {/* Category legend */}
          <div className="grid grid-cols-2 gap-1 text-xs">
            {categories.slice(0, 6).map((cat) => (
              <div key={cat.id} className="flex items-center gap-1">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: cat.color || DEFAULT_COLORS[cat.code] || '#808080' }}
                />
                <span className="text-gray-400 truncate">{cat.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
