/**
 * Replay Mode Component
 * Animates election results revealing progressively with playback controls
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Play, Pause, RotateCcw, FastForward, ChevronRight } from 'lucide-react';
import maplibregl from 'maplibre-gl';
import { useAuthStore } from '../../stores/authStore';
import { useEffectiveBasemap } from '../../hooks/useOnlineStatus';
import { getMapStyle, registerPMTilesProtocol } from '../../lib/mapStyles';

interface ReplayModeProps {
  electionId: number | null;
  electionName?: string;
}

interface DistrictResult {
  unitId: number;
  unitName: string;
  winnerId: number;
  winnerName: string;
  winnerParty: string;
  winnerColor: string;
  totalVotes: number;
  winnerVotes: number;
  percentage: number;
}

interface RunningTotals {
  [candidateId: number]: {
    name: string;
    party: string;
    color: string;
    votes: number;
    districts: number;
  };
}

export function ReplayMode({ electionId, electionName }: ReplayModeProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [currentStep, setCurrentStep] = useState(0);
  const [results, setResults] = useState<DistrictResult[]>([]);
  const [runningTotals, setRunningTotals] = useState<RunningTotals>({});
  const [isLoading, setIsLoading] = useState(true);
  const [revealedDistricts, setRevealedDistricts] = useState<Set<number>>(new Set());
  const token = useAuthStore(s => s.token);
  const intervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Get effective basemap mode (online/offline)
  const effectiveBasemap = useEffectiveBasemap();
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

  // Fetch and prepare results for replay
  useEffect(() => {
    if (!electionId || !token) return;

    const fetchResults = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(
          `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/results/election/${electionId}?includeAll=true`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const data = await response.json();

        // Group by district and determine winner
        const districtMap = new Map<number, DistrictResult>();

        for (const result of data.results || []) {
          const unitId = result.adminUnit?.id;
          const unitName = result.adminUnit?.name;
          if (!unitId || !unitName) continue;

          // Only process district-level results (level 2)
          if (result.adminUnit?.level !== 2) continue;

          const existing = districtMap.get(unitId);
          const votes = result.votes || 0;

          if (!existing) {
            districtMap.set(unitId, {
              unitId,
              unitName,
              winnerId: result.candidate?.id,
              winnerName: result.candidate?.person?.fullName || 'Unknown',
              winnerParty: result.candidate?.party?.abbreviation || 'IND',
              winnerColor: result.candidate?.party?.color || '#888888',
              totalVotes: votes,
              winnerVotes: votes,
              percentage: 0,
            });
          } else {
            existing.totalVotes += votes;
            if (votes > existing.winnerVotes) {
              existing.winnerId = result.candidate?.id;
              existing.winnerName = result.candidate?.person?.fullName || 'Unknown';
              existing.winnerParty = result.candidate?.party?.abbreviation || 'IND';
              existing.winnerColor = result.candidate?.party?.color || '#888888';
              existing.winnerVotes = votes;
            }
          }
        }

        // Calculate percentages and convert to array
        const resultsArray = Array.from(districtMap.values()).map(r => ({
          ...r,
          percentage: r.totalVotes > 0 ? (r.winnerVotes / r.totalVotes) * 100 : 0,
        }));

        // Shuffle for random reveal order (simulates unpredictable reporting)
        const shuffled = [...resultsArray].sort(() => Math.random() - 0.5);
        setResults(shuffled);
        setIsLoading(false);
      } catch (err) {
        console.error('Failed to fetch results:', err);
        setIsLoading(false);
      }
    };

    fetchResults();
  }, [electionId, token]);

  // Initialize map with dynamic basemap (online/offline)
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    // Register PMTiles protocol
    registerPMTilesProtocol();

    // Get base style and extend with replay-specific layers
    const baseStyle = getMapStyle(effectiveBasemap, isOnline);

    // Create extended style with replay-specific layers
    const replayStyle: maplibregl.StyleSpecification = {
      ...baseStyle,
      sources: {
        ...baseStyle.sources,
        'admin-units': {
          type: 'vector',
          url: 'pmtiles:///tiles/uganda_admin.pmtiles',
        },
      },
      layers: [
        ...baseStyle.layers,
        // District fill layer for coloring revealed results
        {
          id: 'districts-base',
          type: 'fill',
          source: 'admin-units',
          'source-layer': 'administrative_units',
          filter: ['==', ['get', 'level'], 2],
          paint: {
            'fill-color': '#2d2d44',
            'fill-opacity': 0.8,
          },
        },
        // District outline layer
        {
          id: 'districts-outline',
          type: 'line',
          source: 'admin-units',
          'source-layer': 'administrative_units',
          filter: ['==', ['get', 'level'], 2],
          paint: {
            'line-color': '#4a4a6a',
            'line-width': 1,
          },
        },
      ],
    };

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: replayStyle,
      center: [32.5, 1.5],
      zoom: 6,
      maxBounds: [[29, -2], [36, 5]],
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [effectiveBasemap, isOnline]);

  // Update map colors when districts are revealed
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    // Build color expression based on revealed districts
    // Use a case expression for better type handling
    const cases: (string | number | string[])[] = [];

    for (const result of results) {
      if (revealedDistricts.has(result.unitId)) {
        cases.push(['==', ['get', 'id'], result.unitId] as unknown as string);
        cases.push(result.winnerColor);
      }
    }

    // If no revealed districts, use default color
    if (cases.length === 0) {
      map.setPaintProperty('districts-base', 'fill-color', '#2d2d44');
    } else {
      // Build case expression: ['case', condition1, value1, condition2, value2, ..., default]
      const colorExpression = ['case', ...cases, '#2d2d44'];
      map.setPaintProperty('districts-base', 'fill-color', colorExpression as unknown as string);
    }
  }, [revealedDistricts, results]);

  // Calculate running totals
  useEffect(() => {
    const totals: RunningTotals = {};

    for (const result of results) {
      if (revealedDistricts.has(result.unitId)) {
        if (!totals[result.winnerId]) {
          totals[result.winnerId] = {
            name: result.winnerName,
            party: result.winnerParty,
            color: result.winnerColor,
            votes: 0,
            districts: 0,
          };
        }
        totals[result.winnerId].votes += result.winnerVotes;
        totals[result.winnerId].districts += 1;
      }
    }

    setRunningTotals(totals);
  }, [revealedDistricts, results]);

  // Playback timer
  useEffect(() => {
    if (isPlaying && currentStep < results.length) {
      const interval = 2000 / speed; // Base 2 seconds per step
      intervalRef.current = setTimeout(() => {
        revealNext();
      }, interval);
    }

    return () => {
      if (intervalRef.current) {
        clearTimeout(intervalRef.current);
      }
    };
  }, [isPlaying, currentStep, speed, results.length]);

  const revealNext = useCallback(() => {
    if (currentStep < results.length) {
      const nextResult = results[currentStep];
      setRevealedDistricts(prev => new Set([...prev, nextResult.unitId]));
      setCurrentStep(prev => prev + 1);

      // Auto-pause at end
      if (currentStep + 1 >= results.length) {
        setIsPlaying(false);
      }
    }
  }, [currentStep, results]);

  const handlePlay = () => {
    if (currentStep >= results.length) {
      // Reset if at end
      handleReset();
    }
    setIsPlaying(true);
  };

  const handlePause = () => {
    setIsPlaying(false);
  };

  const handleReset = () => {
    setIsPlaying(false);
    setCurrentStep(0);
    setRevealedDistricts(new Set());
  };

  const handleSpeedChange = () => {
    const speeds = [0.5, 1, 2, 5];
    const currentIndex = speeds.indexOf(speed);
    const nextIndex = (currentIndex + 1) % speeds.length;
    setSpeed(speeds[nextIndex]);
  };

  const handleStepForward = () => {
    if (!isPlaying && currentStep < results.length) {
      revealNext();
    }
  };

  // Sort totals by votes for display
  const sortedTotals = Object.entries(runningTotals)
    .sort(([, a], [, b]) => b.votes - a.votes)
    .slice(0, 6); // Top 6 candidates

  const totalVotesRevealed = Object.values(runningTotals).reduce((sum, t) => sum + t.votes, 0);
  const totalDistrictsRevealed = revealedDistricts.size;
  const progress = results.length > 0 ? (currentStep / results.length) * 100 : 0;

  if (!electionId) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-900">
        <div className="text-center text-gray-400">
          <p className="text-2xl mb-4">Replay Mode</p>
          <p>Please select an election first (press E)</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex bg-gray-900">
      {/* Map Section */}
      <div className="flex-1 relative">
        <div ref={mapContainer} className="w-full h-full" />

        {/* Election Label */}
        <div className="absolute top-4 left-4 bg-purple-600 text-white px-4 py-2 rounded-lg font-bold shadow-lg z-10">
          {electionName || 'Replay Mode'}
        </div>

        {/* Loading Overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-gray-900/80 flex items-center justify-center z-20">
            <div className="text-white text-xl">Loading results...</div>
          </div>
        )}

        {/* Progress Bar */}
        <div className="absolute bottom-20 left-4 right-4 z-10">
          <div className="bg-gray-800/90 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2 text-sm text-gray-300">
              <span>{totalDistrictsRevealed} / {results.length} districts</span>
              <span>{progress.toFixed(0)}% reported</span>
            </div>
            <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-purple-500 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>

        {/* Playback Controls */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
          <div className="flex items-center gap-2 bg-gray-800/90 rounded-lg px-4 py-2">
            {/* Reset */}
            <button
              onClick={handleReset}
              className="p-2 rounded hover:bg-gray-700 text-gray-300 hover:text-white transition-colors"
              title="Reset"
            >
              <RotateCcw size={20} />
            </button>

            {/* Play/Pause */}
            <button
              onClick={isPlaying ? handlePause : handlePlay}
              className="p-3 rounded-full bg-purple-600 hover:bg-purple-500 text-white transition-colors"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause size={24} /> : <Play size={24} />}
            </button>

            {/* Step Forward */}
            <button
              onClick={handleStepForward}
              disabled={isPlaying || currentStep >= results.length}
              className="p-2 rounded hover:bg-gray-700 text-gray-300 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Step Forward"
            >
              <ChevronRight size={20} />
            </button>

            {/* Speed */}
            <button
              onClick={handleSpeedChange}
              className="flex items-center gap-1 px-3 py-2 rounded hover:bg-gray-700 text-gray-300 hover:text-white transition-colors"
              title="Change Speed"
            >
              <FastForward size={16} />
              <span className="text-sm font-medium">{speed}x</span>
            </button>
          </div>
        </div>

        {/* Last Revealed District */}
        {currentStep > 0 && results[currentStep - 1] && (
          <div className="absolute top-4 right-4 z-10 bg-gray-800/90 rounded-lg p-3 max-w-xs">
            <div className="text-sm text-gray-400 mb-1">Just reported:</div>
            <div className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded"
                style={{ backgroundColor: results[currentStep - 1].winnerColor }}
              />
              <div>
                <div className="font-semibold text-white">
                  {results[currentStep - 1].unitName}
                </div>
                <div className="text-sm text-gray-300">
                  {results[currentStep - 1].winnerName} ({results[currentStep - 1].winnerParty})
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Running Totals Sidebar */}
      <div className="w-80 bg-gray-800 border-l border-gray-700 p-4 overflow-y-auto">
        <h3 className="text-lg font-bold text-white mb-4">Running Totals</h3>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="bg-gray-700 rounded p-3 text-center">
            <div className="text-2xl font-bold text-purple-400">
              {totalDistrictsRevealed}
            </div>
            <div className="text-xs text-gray-400">Districts</div>
          </div>
          <div className="bg-gray-700 rounded p-3 text-center">
            <div className="text-2xl font-bold text-purple-400">
              {(totalVotesRevealed / 1000000).toFixed(2)}M
            </div>
            <div className="text-xs text-gray-400">Votes</div>
          </div>
        </div>

        {/* Candidate Standings */}
        <div className="space-y-3">
          {sortedTotals.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              Press play to start
            </div>
          ) : (
            sortedTotals.map(([id, candidate], index) => (
              <div
                key={id}
                className="bg-gray-700 rounded-lg p-3"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="text-lg font-bold text-gray-400">#{index + 1}</div>
                  <div
                    className="w-4 h-4 rounded"
                    style={{ backgroundColor: candidate.color }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-white truncate">
                      {candidate.name}
                    </div>
                    <div className="text-xs text-gray-400">{candidate.party}</div>
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-300">
                    {candidate.votes.toLocaleString()} votes
                  </span>
                  <span className="text-purple-400 font-medium">
                    {candidate.districts} districts
                  </span>
                </div>
                {/* Vote bar */}
                <div className="mt-2 h-1.5 bg-gray-600 rounded-full overflow-hidden">
                  <div
                    className="h-full transition-all duration-500"
                    style={{
                      width: `${totalVotesRevealed > 0 ? (candidate.votes / totalVotesRevealed) * 100 : 0}%`,
                      backgroundColor: candidate.color,
                    }}
                  />
                </div>
              </div>
            ))
          )}
        </div>

        {/* Completion message */}
        {currentStep >= results.length && results.length > 0 && (
          <div className="mt-4 p-3 bg-green-900/50 border border-green-700 rounded-lg text-center">
            <div className="text-green-400 font-semibold">All results in!</div>
            <button
              onClick={handleReset}
              className="mt-2 px-4 py-1 bg-green-600 hover:bg-green-500 text-white rounded text-sm"
            >
              Replay
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
