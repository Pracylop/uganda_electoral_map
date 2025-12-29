import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

interface Election {
  id: number;
  name: string;
  year: number;
  electionDate: string;
  electionType: { name: string; code: string; electoralLevel: number };
  electionTypeName?: string;
  electionTypeCode?: string;
  isActive: boolean;
  createdAt: string;
  _count: { candidates: number; results: number };
}

interface ElectionType {
  id: number;
  name: string;
  code: string;
  electoralLevel: number;
  description: string | null;
}

// Election type color mapping
const TYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  PRES: { bg: 'bg-yellow-900/50', text: 'text-yellow-200', border: 'border-yellow-600' },
  CONST_MP: { bg: 'bg-blue-900/50', text: 'text-blue-200', border: 'border-blue-600' },
  WOMAN_MP: { bg: 'bg-pink-900/50', text: 'text-pink-200', border: 'border-pink-600' },
  LC5_CHAIR: { bg: 'bg-green-900/50', text: 'text-green-200', border: 'border-green-600' },
  YOUTH_MP: { bg: 'bg-purple-900/50', text: 'text-purple-200', border: 'border-purple-600' },
  WORKER_MP: { bg: 'bg-orange-900/50', text: 'text-orange-200', border: 'border-orange-600' },
  ARMY_MP: { bg: 'bg-red-900/50', text: 'text-red-200', border: 'border-red-600' },
  PWD_MP: { bg: 'bg-teal-900/50', text: 'text-teal-200', border: 'border-teal-600' },
  ELDERLY_MP: { bg: 'bg-indigo-900/50', text: 'text-indigo-200', border: 'border-indigo-600' },
};

const getTypeColors = (code: string) => TYPE_COLORS[code] || { bg: 'bg-gray-700', text: 'text-gray-200', border: 'border-gray-500' };

export function Elections() {
  const navigate = useNavigate();
  const [elections, setElections] = useState<Election[]>([]);
  const [electionTypes, setElectionTypes] = useState<ElectionType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedYear, setSelectedYear] = useState<number | 'all'>('all');
  const [selectedType, setSelectedType] = useState<string | 'all'>('all');

  // Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newElection, setNewElection] = useState({
    name: '',
    year: new Date().getFullYear(),
    electionDate: '',
    electionTypeId: 0,
    isActive: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [electionsData, typesData] = await Promise.all([
        api.getElections(),
        api.getElectionTypes(),
      ]);
      setElections(electionsData);
      setElectionTypes(typesData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  // Get unique years from elections
  const years = [...new Set(elections.map(e => new Date(e.electionDate).getFullYear()))].sort((a, b) => b - a);

  // Filter elections
  const filteredElections = elections.filter(election => {
    const electionYear = new Date(election.electionDate).getFullYear();
    const typeCode = election.electionTypeCode || election.electionType?.code;

    if (selectedYear !== 'all' && electionYear !== selectedYear) return false;
    if (selectedType !== 'all' && typeCode !== selectedType) return false;
    return true;
  });

  // Group elections by year for display
  const electionsByYear = filteredElections.reduce((acc, election) => {
    const year = new Date(election.electionDate).getFullYear();
    if (!acc[year]) acc[year] = [];
    acc[year].push(election);
    return acc;
  }, {} as Record<number, Election[]>);

  const handleCreateElection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newElection.name || !newElection.electionTypeId || !newElection.electionDate) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      setIsSubmitting(true);
      await api.createElection(newElection);
      setShowAddModal(false);
      setNewElection({
        name: '',
        year: new Date().getFullYear(),
        electionDate: '',
        electionTypeId: 0,
        isActive: false,
      });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create election');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Auto-generate election name based on type and year
  const handleTypeChange = (typeId: number) => {
    const type = electionTypes.find(t => t.id === typeId);
    if (type && newElection.year) {
      setNewElection({
        ...newElection,
        electionTypeId: typeId,
        name: `${newElection.year} ${type.name}`,
      });
    } else {
      setNewElection({ ...newElection, electionTypeId: typeId });
    }
  };

  const handleYearChange = (year: number) => {
    const type = electionTypes.find(t => t.id === newElection.electionTypeId);
    setNewElection({
      ...newElection,
      year,
      name: type ? `${year} ${type.name}` : newElection.name,
    });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-white text-xl">Loading elections...</div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-gray-900 text-white p-8 overflow-auto">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Elections</h1>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Election
          </button>
        </div>

        {error && (
          <div className="bg-red-900/50 border border-red-700 rounded-md p-4 mb-6">
            <p className="text-red-200">{error}</p>
            <button onClick={() => setError(null)} className="text-red-400 text-sm underline mt-1">Dismiss</button>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-6">
          {/* Year Filter */}
          <div className="flex items-center gap-2">
            <span className="text-gray-400 text-sm">Year:</span>
            <div className="flex gap-1">
              <button
                onClick={() => setSelectedYear('all')}
                className={`px-3 py-1 rounded text-sm ${
                  selectedYear === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                All
              </button>
              {years.map(year => (
                <button
                  key={year}
                  onClick={() => setSelectedYear(year)}
                  className={`px-3 py-1 rounded text-sm ${
                    selectedYear === year ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {year}
                </button>
              ))}
            </div>
          </div>

          {/* Type Filter */}
          <div className="flex items-center gap-2">
            <span className="text-gray-400 text-sm">Type:</span>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="bg-gray-700 text-white px-3 py-1 rounded text-sm border border-gray-600"
            >
              <option value="all">All Types</option>
              {electionTypes.map(type => (
                <option key={type.id} value={type.code}>{type.name}</option>
              ))}
            </select>
          </div>

          {/* Results count */}
          <div className="ml-auto text-gray-400 text-sm">
            Showing {filteredElections.length} of {elections.length} elections
          </div>
        </div>

        {/* Elections Grid - Grouped by Year */}
        {Object.keys(electionsByYear).length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-400 text-lg">No elections found</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="mt-4 text-blue-400 hover:text-blue-300"
            >
              Create your first election
            </button>
          </div>
        ) : (
          Object.entries(electionsByYear)
            .sort(([a], [b]) => parseInt(b) - parseInt(a))
            .map(([year, yearElections]) => (
              <div key={year} className="mb-8">
                <h2 className="text-xl font-semibold mb-4 text-gray-300 border-b border-gray-700 pb-2">
                  {year} Elections
                  <span className="text-sm font-normal text-gray-500 ml-2">
                    ({yearElections.length} {yearElections.length === 1 ? 'election' : 'elections'})
                  </span>
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {yearElections.map((election) => {
                    const typeCode = election.electionTypeCode || election.electionType?.code || '';
                    const colors = getTypeColors(typeCode);

                    return (
                      <div
                        key={election.id}
                        className={`bg-gray-800 rounded-lg p-5 border-l-4 ${colors.border} hover:bg-gray-750 transition-colors`}
                      >
                        {/* Header */}
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h3 className="font-bold text-lg">{election.name}</h3>
                            <span className={`inline-block px-2 py-0.5 rounded text-xs mt-1 ${colors.bg} ${colors.text}`}>
                              {election.electionTypeName || election.electionType?.name}
                            </span>
                          </div>
                          {election.isActive && (
                            <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-900 text-green-200">
                              Active
                            </span>
                          )}
                        </div>

                        {/* Stats */}
                        <div className="grid grid-cols-2 gap-2 text-sm mb-4">
                          <div className="bg-gray-700/50 rounded p-2">
                            <div className="text-gray-400 text-xs">Candidates</div>
                            <div className="font-semibold">{election._count.candidates}</div>
                          </div>
                          <div className="bg-gray-700/50 rounded p-2">
                            <div className="text-gray-400 text-xs">Results</div>
                            <div className="font-semibold">{election._count.results.toLocaleString()}</div>
                          </div>
                        </div>

                        {/* Date */}
                        <div className="text-sm text-gray-400 mb-4">
                          <span className="font-medium">Date:</span>{' '}
                          {new Date(election.electionDate).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2">
                          <Link
                            to={`/elections/${election.id}`}
                            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-3 rounded text-sm text-center"
                          >
                            View Results
                          </Link>
                          <Link
                            to={`/elections/${election.id}/candidates`}
                            className="flex-1 bg-gray-600 hover:bg-gray-500 text-white py-2 px-3 rounded text-sm text-center"
                          >
                            Candidates
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
        )}
      </div>

      {/* Add Election Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
            <h2 className="text-xl font-bold mb-4">Add New Election</h2>

            <form onSubmit={handleCreateElection} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Election Type *
                </label>
                <select
                  value={newElection.electionTypeId}
                  onChange={(e) => handleTypeChange(parseInt(e.target.value))}
                  className="w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                  required
                >
                  <option value={0}>Select type...</option>
                  {electionTypes.map(type => (
                    <option key={type.id} value={type.id}>{type.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Year *
                </label>
                <input
                  type="number"
                  value={newElection.year}
                  onChange={(e) => handleYearChange(parseInt(e.target.value))}
                  min={1962}
                  max={2100}
                  className="w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Election Name *
                </label>
                <input
                  type="text"
                  value={newElection.name}
                  onChange={(e) => setNewElection({ ...newElection, name: e.target.value })}
                  placeholder="e.g., 2026 Presidential Election"
                  className="w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Election Date *
                </label>
                <input
                  type="date"
                  value={newElection.electionDate}
                  onChange={(e) => setNewElection({ ...newElection, electionDate: e.target.value })}
                  className="w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                  required
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={newElection.isActive}
                  onChange={(e) => setNewElection({ ...newElection, isActive: e.target.checked })}
                  className="w-4 h-4 rounded"
                />
                <label htmlFor="isActive" className="text-sm text-gray-300">
                  Set as active election
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 bg-gray-600 hover:bg-gray-500 text-white py-2 px-4 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded disabled:opacity-50"
                >
                  {isSubmitting ? 'Creating...' : 'Create Election'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
