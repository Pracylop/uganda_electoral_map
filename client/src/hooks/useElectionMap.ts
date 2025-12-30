import { useRef, useCallback } from 'react';
import maplibregl from 'maplibre-gl';

export interface DrillDownState {
  currentLevel: number;
  currentParentId: number | null;
  breadcrumb: BreadcrumbItem[];
}

export interface BreadcrumbItem {
  id: number;
  name: string;
  level: number;
}

interface UseElectionMapOptions {
  onDrillDown?: (unitId: number, unitName: string, level: number) => void;
  onPopup?: (props: any, lngLat: maplibregl.LngLat) => void;
  isProgrammaticMoveRef?: React.MutableRefObject<boolean>;
}

export function useElectionMap(options: UseElectionMapOptions = {}) {
  const mapRef = useRef<maplibregl.Map | null>(null);
  const { onDrillDown, onPopup, isProgrammaticMoveRef } = options;

  const loadResults = useCallback(async (
    electionId: number,
    level: number = 2,
    parentId: number | null = null
  ) => {
    const map = mapRef.current;
    if (!map) return;

    try {
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

      // Remove existing layers
      try {
        if (map.getLayer('results-fill')) map.removeLayer('results-fill');
        if (map.getLayer('results-outline')) map.removeLayer('results-outline');
        if (map.getSource('results')) map.removeSource('results');
      } catch (e) {
        console.warn('Error removing existing layers:', e);
      }

      // Add GeoJSON source
      map.addSource('results', {
        type: 'geojson',
        data: geojson
      });

      // Add fill layer colored by winning party
      map.addLayer({
        id: 'results-fill',
        type: 'fill',
        source: 'results',
        paint: {
          'fill-color': ['coalesce', ['get', 'winnerColor'], '#cccccc'],
          'fill-opacity': 0.7
        }
      });

      // Add outline layer
      map.addLayer({
        id: 'results-outline',
        type: 'line',
        source: 'results',
        paint: {
          'line-color': '#333333',
          'line-width': 0.3
        }
      });

      // Add click handler for drill-down and popups
      map.on('click', 'results-fill', (e) => {
        if (!e.features || e.features.length === 0) return;

        const feature = e.features[0];
        const props = feature.properties;

        if (!props) return;

        const unitId = props.unitId;
        const unitName = props.unitName;
        const featureLevel = props.level || level;

        // If not at parish level (5), drill down
        if (featureLevel < 5 && onDrillDown) {
          onDrillDown(unitId, unitName, featureLevel);
          return;
        }

        // At parish level, show popup
        if (onPopup) {
          onPopup(props, e.lngLat);
        }
      });

      // Change cursor on hover
      map.on('mouseenter', 'results-fill', () => {
        map.getCanvas().style.cursor = 'pointer';
      });

      map.on('mouseleave', 'results-fill', () => {
        map.getCanvas().style.cursor = '';
      });

      // Fit bounds
      if (isProgrammaticMoveRef) {
        isProgrammaticMoveRef.current = true;
      }

      if (data.bbox && data.bbox.length === 4) {
        map.fitBounds(
          [[data.bbox[0], data.bbox[1]], [data.bbox[2], data.bbox[3]]],
          { padding: 50 }
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
          map.fitBounds(bounds, { padding: 50 });
        }
      }

      if (isProgrammaticMoveRef) {
        setTimeout(() => { isProgrammaticMoveRef.current = false; }, 500);
      }

      return { success: true, featuresCount: geojson.features?.length || 0 };
    } catch (err) {
      console.error('Error loading map data:', err);
      return { success: false, error: err };
    }
  }, [onDrillDown, onPopup, isProgrammaticMoveRef]);

  const setMap = useCallback((map: maplibregl.Map) => {
    mapRef.current = map;
  }, []);

  const getMap = useCallback(() => mapRef.current, []);

  return {
    mapRef,
    setMap,
    getMap,
    loadResults
  };
}

// Helper to create popup HTML for parish results
export function createResultsPopupHTML(props: any): string {
  const winner = props.winner ? JSON.parse(props.winner) : null;
  const candidates = props.candidates ? JSON.parse(props.candidates) : [];

  let popupHTML = `
    <div class="p-3">
      <h3 class="font-bold text-lg mb-2">${props.unitName}</h3>
      <p class="text-sm text-gray-600 mb-2">Total Votes: ${(props.totalVotes || 0).toLocaleString()}</p>
  `;

  if (props.turnout) {
    popupHTML += `<p class="text-sm text-gray-600 mb-2">Turnout: ${props.turnout}%</p>`;
  }

  if (winner) {
    popupHTML += `
      <div class="bg-green-100 p-2 rounded mb-2">
        <p class="font-semibold">Winner: ${winner.name}</p>
        <p class="text-sm">${winner.party} - ${(winner.votes || 0).toLocaleString()} votes</p>
      </div>
    `;
  }

  if (candidates.length > 0) {
    popupHTML += `<div class="mt-2"><p class="text-sm font-semibold mb-1">All Candidates:</p>`;
    candidates
      .sort((a: any, b: any) => (b.votes || 0) - (a.votes || 0))
      .forEach((c: any) => {
        popupHTML += `
          <p class="text-sm">
            ${c.name} (${c.party}): ${(c.votes || 0).toLocaleString()}
          </p>
        `;
      });
    popupHTML += `</div>`;
  }

  popupHTML += `</div>`;
  return popupHTML;
}

// Admin level names
export const LEVEL_NAMES: Record<number, string> = {
  1: 'Subregion',
  2: 'District',
  3: 'Constituency',
  4: 'Subcounty',
  5: 'Parish'
};

// Initial drill-down state
export const INITIAL_DRILL_DOWN: DrillDownState = {
  currentLevel: 2,
  currentParentId: null,
  breadcrumb: [{ id: 0, name: 'Uganda', level: 0 }]
};

// Get initial level based on election type
// Presidential: start at district (2)
// Constituency MP: start at constituency (3)
// District Woman MP: start at district (2)
export function getInitialLevelForElectionType(electionTypeCode?: string): number {
  switch (electionTypeCode) {
    case 'CONST_MP':
      return 3; // Constituency
    case 'WOMAN_MP':
    case 'PRES':
    default:
      return 2; // District
  }
}

// Create initial drill-down state for a specific election type
export function createInitialDrillDown(electionTypeCode?: string): DrillDownState {
  return {
    currentLevel: getInitialLevelForElectionType(electionTypeCode),
    currentParentId: null,
    breadcrumb: [{ id: 0, name: 'Uganda', level: 0 }]
  };
}
