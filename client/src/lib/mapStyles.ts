/**
 * Shared Map Styles for Online/Offline Mode
 * Used by all map components for consistent basemap rendering
 */

import maplibregl from 'maplibre-gl';
import { Protocol } from 'pmtiles';

// Register PMTiles protocol globally (only once)
let protocolRegistered = false;

export function registerPMTilesProtocol() {
  if (!protocolRegistered) {
    const pmtilesProtocol = new Protocol();
    maplibregl.addProtocol('pmtiles', pmtilesProtocol.tile);
    protocolRegistered = true;
  }
}

// Offline vector tile style with full basemap layers
export const OFFLINE_STYLE: maplibregl.StyleSpecification = {
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
    // Background
    {
      id: 'background',
      type: 'background',
      paint: { 'background-color': '#1a1a2e' } // Dark theme for broadcast
    },
    // Water
    {
      id: 'water',
      type: 'fill',
      source: 'basemap',
      'source-layer': 'water',
      paint: { 'fill-color': '#193d5a' }
    },
    // Landuse - parks
    {
      id: 'landuse-park',
      type: 'fill',
      source: 'basemap',
      'source-layer': 'landuse',
      filter: ['in', 'class', 'park', 'cemetery', 'grass'],
      paint: { 'fill-color': '#1e3d2e', 'fill-opacity': 0.5 }
    },
    // Roads - major
    {
      id: 'road-major',
      type: 'line',
      source: 'basemap',
      'source-layer': 'transportation',
      filter: ['in', 'class', 'motorway', 'trunk', 'primary'],
      paint: {
        'line-color': '#4a4a6a',
        'line-width': ['interpolate', ['linear'], ['zoom'], 5, 0.5, 12, 2]
      }
    },
    // Roads - secondary
    {
      id: 'road-secondary',
      type: 'line',
      source: 'basemap',
      'source-layer': 'transportation',
      filter: ['in', 'class', 'secondary', 'tertiary'],
      minzoom: 8,
      paint: {
        'line-color': '#3a3a5a',
        'line-width': ['interpolate', ['linear'], ['zoom'], 8, 0.3, 14, 1.5]
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
        'text-color': '#ffffff',
        'text-halo-color': '#000000',
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
        'text-color': '#cccccc',
        'text-halo-color': '#000000',
        'text-halo-width': 1
      }
    }
  ],
  glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf'
};

// Online raster tile style (OSM)
export const ONLINE_STYLE: maplibregl.StyleSpecification = {
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

// Simple dark background style (no basemap, for minimal views)
export const DARK_BACKGROUND_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {},
  layers: [
    {
      id: 'background',
      type: 'background',
      paint: { 'background-color': '#1a1a2e' }
    }
  ]
};

/**
 * Get the appropriate map style based on basemap mode
 */
export function getMapStyle(mode: 'online' | 'offline' | 'auto', isOnline: boolean): maplibregl.StyleSpecification {
  // Register PMTiles protocol if needed
  registerPMTilesProtocol();

  if (mode === 'offline') {
    return OFFLINE_STYLE;
  }
  if (mode === 'online') {
    return ONLINE_STYLE;
  }
  // Auto mode: use offline if not online
  return isOnline ? ONLINE_STYLE : OFFLINE_STYLE;
}

// Uganda map constants
export const UGANDA_CENTER: [number, number] = [32.5825, 1.3733];
export const UGANDA_BOUNDS: [[number, number], [number, number]] = [[29.5, -1.5], [35.5, 4.5]];
export const INITIAL_ZOOM = 6.5;
