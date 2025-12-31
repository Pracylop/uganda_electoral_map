import { useState, useEffect, useRef, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import Map from '../components/Map';
import { api } from '../lib/api';
import 'maplibre-gl/dist/maplibre-gl.css';

interface IssueCategory {
  id: number;
  name: string;
  code: string;
  color: string | null;
  severity: number;
}

interface Issue {
  id: number;
  date: string;
  time: string | null;
  summary: string;
  fullText: string | null;
  location: string | null;
  village: string | null;
  status: string;
  issueCategory: { id: number; name: string; code: string; color: string | null; severity: number };
  district: { id: number; name: string } | null;
  constituency: { id: number; name: string } | null;
}

interface DistrictIssueCount {
  districtId: number;
  districtName: string;
  count: number;
}

const severityColors: Record<number, string> = {
  1: '#10B981', // Green - Low
  2: '#3B82F6', // Blue - Medium-Low
  3: '#F59E0B', // Yellow - Medium
  4: '#F97316', // Orange - High
  5: '#EF4444', // Red - Critical
};

const severityLabels: Record<number, string> = {
  1: 'Low',
  2: 'Medium-Low',
  3: 'Medium',
  4: 'High',
  5: 'Critical',
};

export function IssuesDashboard() {
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [categories, setCategories] = useState<IssueCategory[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [districtCounts, setDistrictCounts] = useState<DistrictIssueCount[]>([]);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');
  const [mapType, setMapType] = useState<'choropleth' | 'points'>('choropleth');
  const [choroplethMetadata, setChoroplethMetadata] = useState<{ totalIssues: number; districtsWithIssues: number; maxIssuesPerDistrict: number } | null>(null);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [selectedSeverity, setSelectedSeverity] = useState<number | null>(null);
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: '', end: '' });

  // Load categories
  useEffect(() => {
    api.getIssueCategories()
      .then(setCategories)
      .catch((err) => console.error('Failed to load categories:', err));
  }, []);

  // Load issues with filters
  useEffect(() => {
    const params: any = { limit: 500 };
    if (selectedCategory) params.categoryId = selectedCategory;
    if (dateRange.start) params.startDate = dateRange.start;
    if (dateRange.end) params.endDate = dateRange.end;

    api.getIssues(params)
      .then((data) => {
        let filtered = data.issues as Issue[];
        if (selectedSeverity) {
          filtered = filtered.filter(i => i.issueCategory.severity === selectedSeverity);
        }
        setIssues(filtered);
        setTotalCount(data.total);
      })
      .catch((err) => console.error('Failed to load issues:', err));
  }, [selectedCategory, selectedSeverity, dateRange]);

  // Calculate district counts
  useEffect(() => {
    const counts: Record<number, { name: string; count: number }> = {};
    issues.forEach(issue => {
      if (issue.district) {
        if (counts[issue.district.id]) {
          counts[issue.district.id].count++;
        } else {
          counts[issue.district.id] = { name: issue.district.name, count: 1 };
        }
      }
    });
    const sorted = Object.entries(counts)
      .map(([id, data]) => ({ districtId: parseInt(id), districtName: data.name, count: data.count }))
      .sort((a, b) => b.count - a.count);
    setDistrictCounts(sorted);
  }, [issues]);

  // Calculate category stats
  const categoryStats = categories.map(cat => ({
    ...cat,
    count: issues.filter(i => i.issueCategory.id === cat.id).length,
  })).sort((a, b) => b.count - a.count);

  // Calculate severity stats
  const severityStats = [1, 2, 3, 4, 5].map(sev => ({
    severity: sev,
    count: issues.filter(i => i.issueCategory.severity === sev).length,
  }));

  // Handle map load
  const handleMapLoad = useCallback((map: maplibregl.Map) => {
    mapRef.current = map;
    setMapLoaded(true);
  }, []);

  // Load choropleth on map
  useEffect(() => {
    if (!mapRef.current || !mapLoaded || mapType !== 'choropleth') return;
    const map = mapRef.current;

    const loadChoropleth = async () => {
      // Remove existing layers first
      try {
        ['issues-choropleth-fill', 'issues-choropleth-line', 'issues-choropleth-labels',
         'issues-clusters', 'issues-cluster-count', 'issues-points'].forEach(layerId => {
          if (map.getLayer(layerId)) map.removeLayer(layerId);
        });
        ['issues-choropleth', 'issues'].forEach(sourceId => {
          if (map.getSource(sourceId)) map.removeSource(sourceId);
        });
      } catch (e) {
        // Layers may not exist yet
      }

      try {
        const params: any = {};
        if (selectedCategory) params.categoryId = selectedCategory;
        if (selectedSeverity) params.severity = selectedSeverity;
        if (dateRange.start) params.startDate = dateRange.start;
        if (dateRange.end) params.endDate = dateRange.end;

        const choroplethData = await api.getIssuesChoropleth(params);
        setChoroplethMetadata(choroplethData.metadata);

        // Add source
        map.addSource('issues-choropleth', {
          type: 'geojson',
          data: choroplethData as unknown as GeoJSON.FeatureCollection,
        });

        // Fill layer
        map.addLayer({
          id: 'issues-choropleth-fill',
          type: 'fill',
          source: 'issues-choropleth',
          paint: {
            'fill-color': ['get', 'fillColor'],
            'fill-opacity': 0.85,
          },
        });

        // Outline layer
        map.addLayer({
          id: 'issues-choropleth-line',
          type: 'line',
          source: 'issues-choropleth',
          paint: {
            'line-color': '#1f2937',
            'line-width': 1,
          },
        });

        // Click handler for districts
        map.on('click', 'issues-choropleth-fill', (e) => {
          if (!e.features || e.features.length === 0) return;
          const props = e.features[0].properties;
          if (!props) return;

          new maplibregl.Popup()
            .setLngLat(e.lngLat)
            .setHTML(`
              <div style="padding: 8px; color: #000;">
                <h3 style="font-weight: bold; margin-bottom: 4px;">${props.unitName}</h3>
                <p style="margin: 0;"><strong>${props.issueCount}</strong> issue${props.issueCount !== 1 ? 's' : ''} reported</p>
              </div>
            `)
            .addTo(map);
        });

        // Hover effect
        map.on('mouseenter', 'issues-choropleth-fill', () => {
          map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', 'issues-choropleth-fill', () => {
          map.getCanvas().style.cursor = '';
        });
      } catch (error) {
        console.error('[Issues Choropleth] Failed to load:', error);
      }
    };

    loadChoropleth();
  }, [mapLoaded, mapType, selectedCategory, selectedSeverity, dateRange]);

  // Load point markers on map
  useEffect(() => {
    if (!mapRef.current || !mapLoaded || mapType !== 'points') return;
    const map = mapRef.current;

    const loadMapData = async () => {
      // Remove existing layers
      try {
        if (map.getLayer('issues-clusters')) map.removeLayer('issues-clusters');
        if (map.getLayer('issues-cluster-count')) map.removeLayer('issues-cluster-count');
        if (map.getLayer('issues-points')) map.removeLayer('issues-points');
        if (map.getSource('issues')) map.removeSource('issues');
        // Also remove choropleth layers if they exist
        if (map.getLayer('issues-choropleth-fill')) map.removeLayer('issues-choropleth-fill');
        if (map.getLayer('issues-choropleth-line')) map.removeLayer('issues-choropleth-line');
        if (map.getLayer('issues-choropleth-labels')) map.removeLayer('issues-choropleth-labels');
        if (map.getSource('issues-choropleth')) map.removeSource('issues-choropleth');
      } catch (e) {
        // Layers may not exist
      }

      try {
        // Fetch GeoJSON from API
        const params: any = {};
        if (selectedCategory) params.categoryId = selectedCategory;
        if (dateRange.start) params.startDate = dateRange.start;
        if (dateRange.end) params.endDate = dateRange.end;

        const geojsonData = await api.getIssuesGeoJSON(params);

        // Filter by severity if needed
        let features = geojsonData.features;
        if (selectedSeverity) {
          features = features.filter(f => f.properties.severity === selectedSeverity);
        }

        const geojson: GeoJSON.FeatureCollection = {
          type: 'FeatureCollection',
          features: features.map(f => ({
            ...f,
            properties: {
              ...f.properties,
              color: f.properties.categoryColor || severityColors[f.properties.severity],
            },
          })),
        };

        // Add source with clustering
        map.addSource('issues', {
          type: 'geojson',
          data: geojson,
          cluster: true,
          clusterMaxZoom: 12,
          clusterRadius: 50,
        });

        // Cluster circles
        map.addLayer({
          id: 'issues-clusters',
          type: 'circle',
          source: 'issues',
          filter: ['has', 'point_count'],
          paint: {
            'circle-color': [
              'step',
              ['get', 'point_count'],
              '#F59E0B', // < 10
              10, '#F97316', // 10-25
              25, '#EF4444', // 25+
            ],
            'circle-radius': [
              'step',
              ['get', 'point_count'],
              20, 10,
              25, 25,
              50, 30,
            ],
            'circle-stroke-width': 2,
            'circle-stroke-color': '#fff',
          },
        });

        // Cluster count
        map.addLayer({
          id: 'issues-cluster-count',
          type: 'symbol',
          source: 'issues',
          filter: ['has', 'point_count'],
          layout: {
            'text-field': '{point_count_abbreviated}',
            'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
            'text-size': 12,
          },
          paint: {
            'text-color': '#fff',
          },
        });

        // Individual points
        map.addLayer({
          id: 'issues-points',
          type: 'circle',
          source: 'issues',
          filter: ['!', ['has', 'point_count']],
          paint: {
            'circle-color': ['get', 'color'],
            'circle-radius': 8,
            'circle-stroke-width': 2,
            'circle-stroke-color': '#fff',
          },
        });

        // Click handlers
        map.on('click', 'issues-clusters', async (e) => {
          const features = map.queryRenderedFeatures(e.point, { layers: ['issues-clusters'] });
          if (!features.length) return;
          const clusterId = features[0].properties?.cluster_id;
          const source = map.getSource('issues') as maplibregl.GeoJSONSource;
          try {
            const zoom = await source.getClusterExpansionZoom(clusterId);
            const geometry = features[0].geometry;
            if (geometry.type === 'Point') {
              map.easeTo({ center: geometry.coordinates as [number, number], zoom: zoom ?? 10 });
            }
          } catch (err) {
            console.error('Cluster expansion error:', err);
          }
        });

        map.on('click', 'issues-points', (e) => {
          if (!e.features || e.features.length === 0) return;
          const props = e.features[0].properties;
          if (!props) return;
          const issue = issues.find(i => i.id === props.id);
          if (issue) setSelectedIssue(issue);
        });

        // Hover cursors
        map.on('mouseenter', 'issues-points', () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', 'issues-points', () => { map.getCanvas().style.cursor = ''; });
        map.on('mouseenter', 'issues-clusters', () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', 'issues-clusters', () => { map.getCanvas().style.cursor = ''; });
      } catch (error) {
        console.error('Failed to load issues on map:', error);
      }
    };

    loadMapData();
  }, [mapLoaded, mapType, issues, selectedCategory, selectedSeverity, dateRange]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-UG', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  return (
    <div className="h-screen flex bg-gray-900">
      {/* Left Sidebar */}
      <div className="w-80 bg-gray-800 border-r border-gray-700 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-gray-700">
          <h1 className="text-xl font-bold text-white">Electoral Issues</h1>
          <p className="text-sm text-gray-400">{totalCount} reported incidents</p>
        </div>

        {/* Filters */}
        <div className="p-4 border-b border-gray-700 space-y-3">
          <div>
            <label className="text-xs text-gray-400 block mb-1">Category</label>
            <select
              value={selectedCategory || ''}
              onChange={(e) => setSelectedCategory(e.target.value ? parseInt(e.target.value) : null)}
              className="w-full bg-gray-700 text-white rounded px-2 py-1.5 text-sm border border-gray-600"
            >
              <option value="">All Categories</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Severity</label>
            <select
              value={selectedSeverity || ''}
              onChange={(e) => setSelectedSeverity(e.target.value ? parseInt(e.target.value) : null)}
              className="w-full bg-gray-700 text-white rounded px-2 py-1.5 text-sm border border-gray-600"
            >
              <option value="">All Severities</option>
              {[5, 4, 3, 2, 1].map(sev => (
                <option key={sev} value={sev}>{severityLabels[sev]}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-400 block mb-1">From</label>
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                className="w-full bg-gray-700 text-white rounded px-2 py-1.5 text-sm border border-gray-600"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">To</label>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                className="w-full bg-gray-700 text-white rounded px-2 py-1.5 text-sm border border-gray-600"
              />
            </div>
          </div>
          {(selectedCategory || selectedSeverity || dateRange.start || dateRange.end) && (
            <button
              onClick={() => {
                setSelectedCategory(null);
                setSelectedSeverity(null);
                setDateRange({ start: '', end: '' });
              }}
              className="w-full py-1.5 text-sm text-gray-400 hover:text-white"
            >
              Clear Filters
            </button>
          )}
        </div>

        {/* Stats */}
        <div className="p-4 border-b border-gray-700">
          <h3 className="text-sm font-semibold text-gray-300 mb-2">By Severity</h3>
          <div className="space-y-1">
            {severityStats.filter(s => s.count > 0).map(stat => (
              <div key={stat.severity} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: severityColors[stat.severity] }}
                  />
                  <span className="text-gray-400">{severityLabels[stat.severity]}</span>
                </div>
                <span className="text-white font-medium">{stat.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Category breakdown */}
        <div className="p-4 border-b border-gray-700">
          <h3 className="text-sm font-semibold text-gray-300 mb-2">By Category</h3>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {categoryStats.filter(c => c.count > 0).map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className="w-full flex items-center justify-between text-sm hover:bg-gray-700/50 px-1 py-0.5 rounded"
              >
                <span className="text-gray-400 truncate">{cat.name}</span>
                <span className="text-white font-medium ml-2">{cat.count}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Top Districts */}
        <div className="flex-1 overflow-y-auto p-4">
          <h3 className="text-sm font-semibold text-gray-300 mb-2">Top Districts</h3>
          <div className="space-y-1">
            {districtCounts.slice(0, 15).map(dist => (
              <div key={dist.districtId} className="flex items-center justify-between text-sm">
                <span className="text-gray-400 truncate">{dist.districtName}</span>
                <span className="text-white font-medium">{dist.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Toolbar */}
        <div className="bg-gray-800 border-b border-gray-700 px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setViewMode('map')}
                className={`px-4 py-2 rounded text-sm font-medium ${
                  viewMode === 'map' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'
                }`}
              >
                Map View
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-4 py-2 rounded text-sm font-medium ${
                  viewMode === 'list' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'
                }`}
              >
                List View
              </button>
            </div>
            {viewMode === 'map' && (
              <div className="flex items-center gap-2 border-l border-gray-700 pl-4">
                <span className="text-xs text-gray-400">Map Type:</span>
                <button
                  onClick={() => setMapType('choropleth')}
                  className={`px-3 py-1.5 rounded text-xs font-medium ${
                    mapType === 'choropleth' ? 'bg-yellow-500 text-gray-900' : 'bg-gray-700 text-gray-300'
                  }`}
                >
                  Choropleth
                </button>
                <button
                  onClick={() => setMapType('points')}
                  className={`px-3 py-1.5 rounded text-xs font-medium ${
                    mapType === 'points' ? 'bg-yellow-500 text-gray-900' : 'bg-gray-700 text-gray-300'
                  }`}
                >
                  Points
                </button>
              </div>
            )}
          </div>
          <div className="text-sm text-gray-400">
            {mapType === 'choropleth' && choroplethMetadata
              ? `${choroplethMetadata.totalIssues} issues in ${choroplethMetadata.districtsWithIssues} districts`
              : `Showing ${issues.length} issues`
            }
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 relative">
          {viewMode === 'map' ? (
            <>
              <Map onLoad={handleMapLoad} className="absolute inset-0" />

              {/* Issue Detail Panel */}
              {selectedIssue && (
                <div className="absolute top-4 right-4 w-96 bg-gray-800/95 backdrop-blur-sm rounded-lg shadow-lg border border-gray-700 z-10 max-h-[80vh] overflow-y-auto">
                  <div className="p-4 border-b border-gray-700 flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className="px-2 py-0.5 rounded text-xs font-medium"
                          style={{
                            backgroundColor: selectedIssue.issueCategory.color || severityColors[selectedIssue.issueCategory.severity],
                            color: '#fff',
                          }}
                        >
                          {selectedIssue.issueCategory.name}
                        </span>
                        <span className="text-xs text-gray-400">
                          {severityLabels[selectedIssue.issueCategory.severity]}
                        </span>
                      </div>
                      <div className="text-xs text-gray-400">{formatDate(selectedIssue.date)}</div>
                    </div>
                    <button
                      onClick={() => setSelectedIssue(null)}
                      className="text-gray-400 hover:text-white"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="p-4">
                    <h3 className="font-medium text-white mb-2">{selectedIssue.summary}</h3>
                    {selectedIssue.fullText && (
                      <p className="text-sm text-gray-300 mb-3">{selectedIssue.fullText}</p>
                    )}
                    <div className="text-sm text-gray-400 space-y-1">
                      {selectedIssue.location && (
                        <div>Location: {selectedIssue.location}</div>
                      )}
                      {selectedIssue.district && (
                        <div>District: {selectedIssue.district.name}</div>
                      )}
                      {selectedIssue.constituency && (
                        <div>Constituency: {selectedIssue.constituency.name}</div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Legend */}
              <div className="absolute bottom-4 left-4 bg-gray-800/95 backdrop-blur-sm rounded-lg p-3 z-10">
                {mapType === 'choropleth' ? (
                  <>
                    <div className="text-xs text-gray-400 mb-2">Issue Density</div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="w-3 h-3 rounded" style={{ backgroundColor: '#dc2626' }} />
                        <span className="text-gray-300">Critical (Most)</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="w-3 h-3 rounded" style={{ backgroundColor: '#ea580c' }} />
                        <span className="text-gray-300">High</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="w-3 h-3 rounded" style={{ backgroundColor: '#f59e0b' }} />
                        <span className="text-gray-300">Moderate</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="w-3 h-3 rounded" style={{ backgroundColor: '#fde047' }} />
                        <span className="text-gray-300">Low</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="w-3 h-3 rounded" style={{ backgroundColor: '#fef3c7' }} />
                        <span className="text-gray-300">Minimal</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="w-3 h-3 rounded" style={{ backgroundColor: '#d1d5db' }} />
                        <span className="text-gray-300">None</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-xs text-gray-400 mb-2">Severity</div>
                    <div className="space-y-1">
                      {[5, 4, 3, 2, 1].map(sev => (
                        <div key={sev} className="flex items-center gap-2 text-xs">
                          <span
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: severityColors[sev] }}
                          />
                          <span className="text-gray-300">{severityLabels[sev]}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </>
          ) : (
            /* List View */
            <div className="p-4 overflow-y-auto h-full">
              <div className="space-y-2">
                {issues.map(issue => (
                  <div
                    key={issue.id}
                    onClick={() => setSelectedIssue(issue)}
                    className="bg-gray-800 rounded-lg p-4 hover:bg-gray-700/50 cursor-pointer border border-gray-700"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className="px-2 py-0.5 rounded text-xs font-medium"
                            style={{
                              backgroundColor: issue.issueCategory.color || severityColors[issue.issueCategory.severity],
                              color: '#fff',
                            }}
                          >
                            {issue.issueCategory.name}
                          </span>
                          <span className="text-xs text-gray-400">{formatDate(issue.date)}</span>
                        </div>
                        <h4 className="text-white font-medium">{issue.summary}</h4>
                        <div className="text-sm text-gray-400 mt-1">
                          {issue.district?.name}
                          {issue.constituency && ` > ${issue.constituency.name}`}
                        </div>
                      </div>
                      <span
                        className="w-3 h-3 rounded-full flex-shrink-0 ml-4"
                        style={{ backgroundColor: severityColors[issue.issueCategory.severity] }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default IssuesDashboard;
