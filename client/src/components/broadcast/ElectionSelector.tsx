import { useState } from 'react';
import { X, Calendar, Vote, CheckCircle, Circle } from 'lucide-react';
import { useBroadcastStore } from '../../stores/broadcastStore';
import { useElections } from '../../hooks/useElectionData';

export function ElectionSelector() {
  const { electionSelectorOpen, toggleElectionSelector, selectElection, selectedElectionId, sidebarExpanded } = useBroadcastStore();
  const { data: elections, isLoading } = useElections();
  const [filterYear, setFilterYear] = useState<number | null>(null);

  if (!electionSelectorOpen) return null;

  // Get unique years from elections
  const years = elections
    ? [...new Set(elections.map((e) => new Date(e.electionDate).getFullYear()))]
        .sort((a, b) => b - a)
    : [];

  // Filter elections
  const filteredElections = elections?.filter((e) => {
    if (filterYear) {
      return new Date(e.electionDate).getFullYear() === filterYear;
    }
    return true;
  });

  const getElectionTypeIcon = (typeCode: string) => {
    switch (typeCode.toLowerCase()) {
      case 'presidential':
        return Vote;
      case 'parliamentary':
      case 'mp':
        return Calendar;
      default:
        return Vote;
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={toggleElectionSelector}
      />

      {/* Modal */}
      <div
        className={`
          fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
          w-full max-w-2xl
          max-h-[80vh]
          bg-gray-900
          rounded-2xl
          border border-gray-700
          shadow-2xl
          z-50
          animate-scaleIn
          overflow-hidden
          ${sidebarExpanded ? 'ml-10' : ''}
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <h2 className="text-xl font-semibold text-white">Select Election</h2>
          <button
            onClick={toggleElectionSelector}
            className="w-12 h-12 flex items-center justify-center rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
            aria-label="Close"
          >
            <X size={24} />
          </button>
        </div>

        {/* Year Filter */}
        <div className="px-6 py-3 border-b border-gray-800">
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            <button
              onClick={() => setFilterYear(null)}
              className={`
                px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap
                transition-colors
                ${!filterYear
                  ? 'bg-yellow-500 text-gray-900'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }
              `}
            >
              All Years
            </button>
            {years.map((year) => (
              <button
                key={year}
                onClick={() => setFilterYear(year)}
                className={`
                  px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap
                  transition-colors
                  ${filterYear === year
                    ? 'bg-yellow-500 text-gray-900'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  }
                `}
              >
                {year}
              </button>
            ))}
          </div>
        </div>

        {/* Elections List */}
        <div className="overflow-y-auto max-h-[50vh] p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500" />
            </div>
          ) : filteredElections?.length === 0 ? (
            <p className="text-center text-gray-400 py-12">
              No elections found
            </p>
          ) : (
            <div className="space-y-3">
              {filteredElections?.map((election) => {
                const Icon = getElectionTypeIcon(election.electionTypeCode);
                const isSelected = selectedElectionId === election.id;

                return (
                  <button
                    key={election.id}
                    onClick={() => selectElection(election.id, election.electionType?.electoralLevel)}
                    className={`
                      w-full
                      flex items-center gap-4
                      p-4
                      rounded-xl
                      text-left
                      transition-all
                      ${isSelected
                        ? 'bg-yellow-500/20 border-2 border-yellow-500'
                        : 'bg-gray-800 border-2 border-transparent hover:border-gray-600'
                      }
                    `}
                  >
                    {/* Icon */}
                    <div
                      className={`
                        w-14 h-14
                        flex items-center justify-center
                        rounded-xl
                        ${isSelected ? 'bg-yellow-500 text-gray-900' : 'bg-gray-700 text-gray-300'}
                      `}
                    >
                      <Icon size={28} />
                    </div>

                    {/* Info */}
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-white">
                        {election.name}
                      </h3>
                      <p className="text-gray-400">
                        {election.electionTypeName} &bull;{' '}
                        {new Date(election.electionDate).toLocaleDateString('en-UG', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </p>
                    </div>

                    {/* Active Status */}
                    <div className={`flex items-center gap-2 ${election.isActive ? 'text-green-400' : 'text-gray-500'}`}>
                      {election.isActive ? (
                        <CheckCircle size={20} />
                      ) : (
                        <Circle size={20} />
                      )}
                      <span className="text-sm font-medium">
                        {election.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>

                    {/* Selected Indicator */}
                    {isSelected && (
                      <div className="w-6 h-6 rounded-full bg-yellow-500 flex items-center justify-center">
                        <CheckCircle size={16} className="text-gray-900" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
