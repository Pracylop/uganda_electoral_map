import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import maplibregl from 'maplibre-gl';
import Map from '../components/Map';
import NationalDashboard from '../components/NationalDashboard';
import { api } from '../lib/api';
import { useWebSocket } from '../hooks/useWebSocket';
import 'maplibre-gl/dist/maplibre-gl.css';

interface Election {
  id: number;
  name: string;
  electionDate: string;
  electionType: string;
}

export function MapDashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [elections, setElections] = useState<Election[]>([]);
  const [selectedElection, setSelectedElection] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'map' | 'dashboard'>('map');
  const mapRef = useRef<maplibregl.Map | null>(null);

  // WebSocket connection for real-time updates
  useWebSocket((message) => {
    if (message.type === 'RESULT_APPROVED' && selectedElection) {
      const payload = message.payload as { electionId: number };
      // Refresh map if approved result is for current election
      if (payload.electionId === selectedElection) {
        loadElectionResults(selectedElection);
      }
    }
  });

  useEffect(() => {
    loadElections();
  }, []);

  useEffect(() => {
    const electionId = searchParams.get('election');
    if (electionId) {
      setSelectedElection(parseInt(electionId));
    } else if (elections.length > 0) {
      // Select first active election by default
      const activeElection = elections.find(e => e.electionDate);
      if (activeElection) {
        setSelectedElection(activeElection.id);
        setSearchParams({ election: activeElection.id.toString() });
      }
    }
  }, [elections, searchParams]);

  useEffect(() => {
    if (selectedElection && mapRef.current) {
      loadElectionResults(selectedElection);
    }
  }, [selectedElection]);

  const loadElections = async () => {
    try {
      setIsLoading(true);
      const data = await api.getElections();
      setElections(data);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load elections'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const loadElectionResults = async (electionId: number) => {
    if (!mapRef.current) return;

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/map/results/${electionId}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('auth_token')}`
          }
        }
      );

      if (!response.ok) throw new Error('Failed to load map data');

      const geojson = await response.json();

      // Remove existing results layer if present
      if (mapRef.current.getLayer('results-fill')) {
        mapRef.current.removeLayer('results-fill');
      }
      if (mapRef.current.getLayer('results-outline')) {
        mapRef.current.removeLayer('results-outline');
      }
      if (mapRef.current.getSource('results')) {
        mapRef.current.removeSource('results');
      }

      // Add GeoJSON source
      mapRef.current.addSource('results', {
        type: 'geojson',
        data: geojson
      });

      // Add fill layer colored by winning party
      mapRef.current.addLayer({
        id: 'results-fill',
        type: 'fill',
        source: 'results',
        paint: {
          'fill-color': [
            'case',
            ['has', 'winner'],
            ['get', 'partyColor', ['get', 'winner']],
            '#cccccc'
          ],
          'fill-opacity': 0.6
        }
      });

      // Add outline layer
      mapRef.current.addLayer({
        id: 'results-outline',
        type: 'line',
        source: 'results',
        paint: {
          'line-color': '#000000',
          'line-width': 1
        }
      });

      // Add click handler for popups
      mapRef.current.on('click', 'results-fill', (e) => {
        if (!e.features || e.features.length === 0) return;

        const feature = e.features[0];
        const props = feature.properties;

        if (!props) return;

        const winner = props.winner ? JSON.parse(props.winner) : null;
        const candidates = props.candidates ? JSON.parse(props.candidates) : [];

        let popupHTML = `
          <div class="p-3">
            <h3 class="font-bold text-lg mb-2">${props.unitName}</h3>
            <p class="text-sm text-gray-600 mb-2">Total Votes: ${props.totalVotes.toLocaleString()}</p>
        `;

        if (props.turnout) {
          popupHTML += `<p class="text-sm text-gray-600 mb-2">Turnout: ${props.turnout}%</p>`;
        }

        if (winner) {
          popupHTML += `
            <div class="bg-green-100 p-2 rounded mb-2">
              <p class="font-semibold">Winner: ${winner.name}</p>
              <p class="text-sm">${winner.party} - ${winner.votes.toLocaleString()} votes</p>
            </div>
          `;
        }

        if (candidates.length > 0) {
          popupHTML += `<div class="mt-2"><p class="text-sm font-semibold mb-1">All Candidates:</p>`;
          candidates
            .sort((a: any, b: any) => b.votes - a.votes)
            .forEach((c: any) => {
              popupHTML += `
                <p class="text-sm">
                  ${c.name} (${c.party}): ${c.votes.toLocaleString()}
                </p>
              `;
            });
          popupHTML += `</div>`;
        }

        popupHTML += `</div>`;

        new maplibregl.Popup()
          .setLngLat(e.lngLat)
          .setHTML(popupHTML)
          .addTo(mapRef.current!);
      });

      // Change cursor on hover
      mapRef.current.on('mouseenter', 'results-fill', () => {
        if (mapRef.current) {
          mapRef.current.getCanvas().style.cursor = 'pointer';
        }
      });

      mapRef.current.on('mouseleave', 'results-fill', () => {
        if (mapRef.current) {
          mapRef.current.getCanvas().style.cursor = '';
        }
      });

      // Fit map to results bounds
      if (geojson.features.length > 0) {
        const bounds = new maplibregl.LngLatBounds();
        geojson.features.forEach((feature: any) => {
          if (feature.geometry.type === 'Polygon') {
            feature.geometry.coordinates[0].forEach((coord: [number, number]) => {
              bounds.extend(coord);
            });
          }
        });
        mapRef.current.fitBounds(bounds, { padding: 50 });
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load election results'
      );
    }
  };

  const handleElectionChange = (electionId: number) => {
    setSelectedElection(electionId);
    setSearchParams({ election: electionId.toString() });
  };

  const handleMapLoad = (map: maplibregl.Map) => {
    mapRef.current = map;
    if (selectedElection) {
      loadElectionResults(selectedElection);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-gray-900 text-white overflow-hidden">
      {/* Header */}
      <div className="bg-gray-800 px-6 py-4 border-b border-gray-700">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">
              {viewMode === 'map' ? 'Electoral Map' : 'National Results Dashboard'}
            </h1>
            <p className="text-gray-400 mt-1">
              {viewMode === 'map'
                ? 'Interactive visualization of election results'
                : 'Live national election results'}
            </p>
          </div>
          <div className="flex gap-4 items-end">
            {/* View Mode Toggle */}
            <div>
              <label className="block text-sm font-medium mb-2">View Mode</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setViewMode('map')}
                  className={`px-4 py-2 rounded-md transition-colors ${
                    viewMode === 'map'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  Map
                </button>
                <button
                  onClick={() => setViewMode('dashboard')}
                  className={`px-4 py-2 rounded-md transition-colors ${
                    viewMode === 'dashboard'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                  disabled={!selectedElection}
                >
                  Dashboard
                </button>
              </div>
            </div>
            {/* Election Selector */}
            <div className="w-64">
              <label className="block text-sm font-medium mb-2">
                Select Election
              </label>
              <select
                value={selectedElection || ''}
                onChange={(e) => handleElectionChange(parseInt(e.target.value))}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Choose an election...</option>
                {elections.map((election) => (
                  <option key={election.id} value={election.id}>
                    {election.name} ({new Date(election.electionDate).toLocaleDateString()})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-900/50 border border-red-700 rounded-md p-4 m-6">
          <p className="text-red-200">{error}</p>
        </div>
      )}

      {/* Content Container */}
      <div className="flex-1 relative">
        {viewMode === 'map' ? (
          <>
            <Map onLoad={handleMapLoad} className="absolute inset-0" />

            {/* Legend */}
            {selectedElection && (
              <div className="absolute bottom-6 left-6 bg-gray-800 p-4 rounded-lg shadow-lg max-w-xs">
                <h3 className="font-bold mb-2">Map Legend</h3>
                <p className="text-sm text-gray-400 mb-2">
                  Regions are colored by winning party
                </p>
                <p className="text-xs text-gray-500">
                  Click on any region to see detailed results
                </p>
              </div>
            )}
          </>
        ) : (
          <>
            {selectedElection ? (
              <div className="h-full overflow-auto">
                <NationalDashboard electionId={selectedElection} />
              </div>
            ) : (
              <div className="flex justify-center items-center h-full">
                <p className="text-gray-400 text-lg">
                  Please select an election to view the dashboard
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
