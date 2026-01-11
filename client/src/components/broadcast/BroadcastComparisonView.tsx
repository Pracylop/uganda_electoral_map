import { useState, useEffect } from 'react';
import { Map, BarChart3, TrendingUp, Play } from 'lucide-react';
import { BroadcastMap } from './BroadcastMap';
import { ComparisonCharts } from './ComparisonCharts';
import { SwingMap } from './SwingMap';
import { ReplayMode } from './ReplayMode';
import { useBroadcastStore } from '../../stores/broadcastStore';
import { useElections } from '../../hooks/useElectionData';

export function BroadcastComparisonView() {
  const { selectedElectionId, comparisonElectionId, selectElection, setComparisonElection } = useBroadcastStore();
  const { data: elections } = useElections();

  // Local state for showing selectors
  const [showLeftSelector, setShowLeftSelector] = useState(false);
  const [showRightSelector, setShowRightSelector] = useState(false);
  const [comparisonMode, setComparisonMode] = useState<'maps' | 'charts' | 'swing' | 'replay'>('maps');

  // Get election details
  const leftElection = elections?.find(e => e.id === selectedElectionId);
  const rightElection = elections?.find(e => e.id === comparisonElectionId);

  // Auto-select comparison election if not set
  useEffect(() => {
    if (selectedElectionId && !comparisonElectionId && elections && elections.length > 1) {
      // Pick a different election for comparison
      const otherElection = elections.find(e => e.id !== selectedElectionId);
      if (otherElection) {
        setComparisonElection(otherElection.id);
      }
    }
  }, [selectedElectionId, comparisonElectionId, elections, setComparisonElection]);

  // No elections selected
  if (!selectedElectionId) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-center text-gray-400">
          <p className="text-2xl mb-4">Election Comparison</p>
          <p>Please select an election first (press E)</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col">
      {/* Mode Toggle */}
      <div className="flex items-center justify-center gap-2 py-3 bg-gray-800 border-b border-gray-700">
        <button
          onClick={() => setComparisonMode('maps')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
            comparisonMode === 'maps'
              ? 'bg-yellow-500 text-gray-900'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          <Map size={18} />
          <span className="font-medium">Maps</span>
        </button>
        <button
          onClick={() => setComparisonMode('charts')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
            comparisonMode === 'charts'
              ? 'bg-yellow-500 text-gray-900'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          <BarChart3 size={18} />
          <span className="font-medium">Charts</span>
        </button>
        <button
          onClick={() => setComparisonMode('swing')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
            comparisonMode === 'swing'
              ? 'bg-orange-500 text-gray-900'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          <TrendingUp size={18} />
          <span className="font-medium">Swing</span>
        </button>
        <button
          onClick={() => setComparisonMode('replay')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
            comparisonMode === 'replay'
              ? 'bg-purple-500 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          <Play size={18} />
          <span className="font-medium">Replay</span>
        </button>
      </div>

      {/* Charts View */}
      {comparisonMode === 'charts' && (
        <div className="flex-1">
          <ComparisonCharts
            leftElectionId={selectedElectionId}
            rightElectionId={comparisonElectionId}
            leftElectionName={leftElection?.name}
            rightElectionName={rightElection?.name}
          />
        </div>
      )}

      {/* Swing View */}
      {comparisonMode === 'swing' && (
        <div className="flex-1">
          <SwingMap
            election1Id={selectedElectionId}
            election2Id={comparisonElectionId}
            election1Name={leftElection?.name}
            election2Name={rightElection?.name}
          />
        </div>
      )}

      {/* Replay View */}
      {comparisonMode === 'replay' && (
        <div className="flex-1">
          <ReplayMode
            electionId={selectedElectionId}
            electionName={leftElection?.name}
          />
        </div>
      )}

      {/* Maps View */}
      {comparisonMode === 'maps' && (
        <div className="flex-1 flex">
          {/* Left Map */}
          <div className="relative w-1/2 h-full border-r border-gray-600">
        <BroadcastMap
          electionId={selectedElectionId}
          label={leftElection?.name || 'Left Election'}
          labelColor="bg-yellow-500"
        />

        {/* Left Election Selector Toggle */}
        <button
          onClick={() => setShowLeftSelector(!showLeftSelector)}
          className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-gray-800/90 hover:bg-gray-700 text-white px-4 py-2 rounded-lg shadow-lg z-10 text-sm font-medium"
        >
          Change Election
        </button>

        {/* Left Election Dropdown */}
        {showLeftSelector && (
          <div className="absolute bottom-16 left-1/2 -translate-x-1/2 bg-gray-800 rounded-lg shadow-xl z-20 max-h-64 overflow-y-auto min-w-[200px]">
            {elections?.map(election => (
              <button
                key={election.id}
                onClick={() => {
                  selectElection(election.id, election.electionType?.electoralLevel);
                  setShowLeftSelector(false);
                }}
                className={`block w-full text-left px-4 py-3 hover:bg-gray-700 transition-colors ${
                  election.id === selectedElectionId ? 'bg-yellow-500/20 text-yellow-400' : 'text-white'
                }`}
              >
                <div className="font-medium">{election.name}</div>
                <div className="text-xs text-gray-400">{election.electionTypeName}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Right Map */}
      <div className="relative w-1/2 h-full">
        <BroadcastMap
          electionId={comparisonElectionId}
          label={rightElection?.name || 'Right Election'}
          labelColor="bg-green-500"
          disableBasemapNavigation
        />

        {/* Right Election Selector Toggle */}
        <button
          onClick={() => setShowRightSelector(!showRightSelector)}
          className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-gray-800/90 hover:bg-gray-700 text-white px-4 py-2 rounded-lg shadow-lg z-10 text-sm font-medium"
        >
          Change Election
        </button>

        {/* Right Election Dropdown */}
        {showRightSelector && (
          <div className="absolute bottom-16 left-1/2 -translate-x-1/2 bg-gray-800 rounded-lg shadow-xl z-20 max-h-64 overflow-y-auto min-w-[200px]">
            {elections?.map(election => (
              <button
                key={election.id}
                onClick={() => {
                  setComparisonElection(election.id);
                  setShowRightSelector(false);
                }}
                className={`block w-full text-left px-4 py-3 hover:bg-gray-700 transition-colors ${
                  election.id === comparisonElectionId ? 'bg-green-500/20 text-green-400' : 'text-white'
                }`}
              >
                <div className="font-medium">{election.name}</div>
                <div className="text-xs text-gray-400">{election.electionTypeName}</div>
              </button>
            ))}
          </div>
        )}

        {/* No comparison election message */}
        {!comparisonElectionId && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80 z-10">
            <div className="text-center">
              <p className="text-xl text-white mb-4">Select Comparison Election</p>
              <button
                onClick={() => setShowRightSelector(true)}
                className="px-6 py-3 bg-green-500 text-gray-900 font-semibold rounded-lg hover:bg-green-400 transition-colors"
              >
                Choose Election
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Click outside to close selectors */}
      {(showLeftSelector || showRightSelector) && (
        <div
          className="fixed inset-0 z-10"
          onClick={() => {
            setShowLeftSelector(false);
            setShowRightSelector(false);
          }}
        />
      )}
        </div>
      )}
    </div>
  );
}
