import { useState, useEffect } from 'react';
import { BroadcastMap } from './BroadcastMap';
import { useBroadcastStore } from '../../stores/broadcastStore';
import { useElections } from '../../hooks/useElectionData';

export function BroadcastComparisonView() {
  const { selectedElectionId, comparisonElectionId, selectElection, setComparisonElection } = useBroadcastStore();
  const { data: elections } = useElections();

  // Local state for showing selectors
  const [showLeftSelector, setShowLeftSelector] = useState(false);
  const [showRightSelector, setShowRightSelector] = useState(false);

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
    <div className="w-full h-full flex">
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
  );
}
