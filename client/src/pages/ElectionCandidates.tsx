import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../lib/api';

interface Candidate {
  id: number;
  personId: number;
  partyId: number | null;
  electoralAreaId: number | null;
  ballotOrder: number | null;
  isIndependent: boolean;
  person: { fullName: string };
  party: { name: string; abbreviation: string; color: string } | null;
  electoralArea: { name: string; code: string | null } | null;
  _count: { results: number };
}

interface Election {
  id: number;
  name: string;
  year: number;
  electionType: { name: string; code: string; electoralLevel: number };
}

interface Person {
  id: number;
  fullName: string;
}

interface Party {
  id: number;
  name: string;
  abbreviation: string;
  color: string;
}

interface AdminUnit {
  id: number;
  name: string;
  code: string | null;
  level: number;
}

export function ElectionCandidates() {
  const { id } = useParams<{ id: string }>();
  const electionId = parseInt(id || '0');

  const [election, setElection] = useState<Election | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [persons, setPersons] = useState<Person[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [adminUnits, setAdminUnits] = useState<AdminUnit[]>([]);
  const [personSearch, setPersonSearch] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New candidate form
  const [newCandidate, setNewCandidate] = useState({
    personId: 0,
    partyId: 0,
    electoralAreaId: 0,
    ballotOrder: '',
    isIndependent: false,
  });

  // New person form (inline creation)
  const [showNewPersonForm, setShowNewPersonForm] = useState(false);
  const [newPersonName, setNewPersonName] = useState('');

  useEffect(() => {
    loadData();
  }, [electionId]);

  useEffect(() => {
    if (showAddModal) {
      loadReferenceData();
    }
  }, [showAddModal]);

  useEffect(() => {
    // Debounced person search
    const timer = setTimeout(() => {
      if (personSearch.length >= 2) {
        searchPersons(personSearch);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [personSearch]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [electionData, candidatesData] = await Promise.all([
        api.getElectionById(electionId),
        api.getCandidatesByElection(electionId),
      ]);
      setElection(electionData as unknown as Election);
      setCandidates(candidatesData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  const loadReferenceData = async () => {
    try {
      const [partiesData, personsData] = await Promise.all([
        api.getParties(),
        api.getPersons(),
      ]);
      setParties(partiesData);
      setPersons(personsData);

      // Load admin units based on election type
      if (election?.electionType.electoralLevel) {
        const unitsData = await api.getAdminUnits(election.electionType.electoralLevel);
        setAdminUnits(unitsData);
      }
    } catch (err) {
      console.error('Failed to load reference data:', err);
    }
  };

  const searchPersons = async (search: string) => {
    try {
      const data = await api.getPersons(search);
      setPersons(data);
    } catch (err) {
      console.error('Failed to search persons:', err);
    }
  };

  const handleCreatePerson = async () => {
    if (!newPersonName.trim()) return;

    try {
      const result = await api.createPerson({ fullName: newPersonName.trim() });
      setPersons([result.person, ...persons]);
      setNewCandidate({ ...newCandidate, personId: result.person.id });
      setShowNewPersonForm(false);
      setNewPersonName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create person');
    }
  };

  const handleCreateCandidate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCandidate.personId) {
      setError('Please select a person');
      return;
    }

    try {
      setIsSubmitting(true);
      await api.createCandidate({
        electionId,
        personId: newCandidate.personId,
        partyId: newCandidate.partyId || undefined,
        electoralAreaId: newCandidate.electoralAreaId || undefined,
        ballotOrder: newCandidate.ballotOrder ? parseInt(newCandidate.ballotOrder) : undefined,
        isIndependent: newCandidate.isIndependent,
      });
      setShowAddModal(false);
      setNewCandidate({
        personId: 0,
        partyId: 0,
        electoralAreaId: 0,
        ballotOrder: '',
        isIndependent: false,
      });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add candidate');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCandidate = async (candidateId: number, candidateName: string) => {
    if (!confirm(`Are you sure you want to remove ${candidateName} from this election?`)) {
      return;
    }

    try {
      await api.deleteCandidate(candidateId);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete candidate');
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-white text-xl">Loading candidates...</div>
      </div>
    );
  }

  if (!election) {
    return (
      <div className="flex-1 bg-gray-900 text-white p-8">
        <div className="text-center py-12">
          <p className="text-gray-400 text-lg">Election not found</p>
          <Link to="/elections" className="text-blue-400 hover:text-blue-300 mt-4 inline-block">
            Back to Elections
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-gray-900 text-white p-8 overflow-auto">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link to="/elections" className="text-blue-400 hover:text-blue-300 text-sm mb-2 inline-block">
            &larr; Back to Elections
          </Link>
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold">{election.name}</h1>
              <p className="text-gray-400 mt-1">
                {election.electionType.name} &bull; {candidates.length} candidates
              </p>
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Candidate
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-900/50 border border-red-700 rounded-md p-4 mb-6">
            <p className="text-red-200">{error}</p>
            <button onClick={() => setError(null)} className="text-red-400 text-sm underline mt-1">
              Dismiss
            </button>
          </div>
        )}

        {/* Candidates Table */}
        {candidates.length === 0 ? (
          <div className="text-center py-12 bg-gray-800 rounded-lg">
            <p className="text-gray-400 text-lg mb-4">No candidates added yet</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="text-blue-400 hover:text-blue-300"
            >
              Add the first candidate
            </button>
          </div>
        ) : (
          <div className="bg-gray-800 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-700">
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-300">#</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-300">Candidate</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-300">Party</th>
                  {election.electionType.electoralLevel > 0 && (
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-300">Electoral Area</th>
                  )}
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-300">Results</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-gray-300">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {candidates.map((candidate, index) => (
                  <tr key={candidate.id} className="hover:bg-gray-750">
                    <td className="px-4 py-3 text-sm text-gray-400">
                      {candidate.ballotOrder || index + 1}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{candidate.person.fullName}</div>
                      {candidate.isIndependent && (
                        <span className="text-xs text-gray-500">Independent</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {candidate.party ? (
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: candidate.party.color }}
                          />
                          <span>{candidate.party.abbreviation}</span>
                          <span className="text-gray-500 text-sm">({candidate.party.name})</span>
                        </div>
                      ) : (
                        <span className="text-gray-500">Independent</span>
                      )}
                    </td>
                    {election.electionType.electoralLevel > 0 && (
                      <td className="px-4 py-3 text-sm">
                        {candidate.electoralArea?.name || '-'}
                      </td>
                    )}
                    <td className="px-4 py-3 text-sm">
                      {candidate._count.results.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDeleteCandidate(candidate.id, candidate.person.fullName)}
                        className="text-red-400 hover:text-red-300 text-sm"
                        disabled={candidate._count.results > 0}
                        title={candidate._count.results > 0 ? 'Cannot delete candidate with results' : 'Delete candidate'}
                      >
                        {candidate._count.results > 0 ? (
                          <span className="text-gray-500 cursor-not-allowed">Has results</span>
                        ) : (
                          'Remove'
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Quick Actions */}
        <div className="mt-6 flex gap-4">
          <Link
            to={`/elections/${electionId}`}
            className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded"
          >
            View Results
          </Link>
          <Link
            to={`/elections/${electionId}/enter-results`}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
          >
            Enter Results
          </Link>
        </div>
      </div>

      {/* Add Candidate Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Add Candidate to {election.name}</h2>

            <form onSubmit={handleCreateCandidate} className="space-y-4">
              {/* Person Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Person *
                </label>
                {!showNewPersonForm ? (
                  <>
                    <input
                      type="text"
                      value={personSearch}
                      onChange={(e) => setPersonSearch(e.target.value)}
                      placeholder="Search by name..."
                      className="w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none mb-2"
                    />
                    <select
                      value={newCandidate.personId}
                      onChange={(e) => setNewCandidate({ ...newCandidate, personId: parseInt(e.target.value) })}
                      className="w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                      size={5}
                    >
                      <option value={0}>Select a person...</option>
                      {persons.map(person => (
                        <option key={person.id} value={person.id}>{person.fullName}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setShowNewPersonForm(true)}
                      className="mt-2 text-blue-400 hover:text-blue-300 text-sm"
                    >
                      + Create new person
                    </button>
                  </>
                ) : (
                  <div className="bg-gray-700 p-3 rounded">
                    <input
                      type="text"
                      value={newPersonName}
                      onChange={(e) => setNewPersonName(e.target.value)}
                      placeholder="Full name..."
                      className="w-full bg-gray-600 text-white px-3 py-2 rounded border border-gray-500 focus:border-blue-500 focus:outline-none mb-2"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleCreatePerson}
                        className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm"
                      >
                        Create Person
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowNewPersonForm(false);
                          setNewPersonName('');
                        }}
                        className="bg-gray-600 hover:bg-gray-500 text-white px-3 py-1 rounded text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Party Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Political Party
                </label>
                <select
                  value={newCandidate.partyId}
                  onChange={(e) => {
                    const partyId = parseInt(e.target.value);
                    setNewCandidate({
                      ...newCandidate,
                      partyId,
                      isIndependent: partyId === 0,
                    });
                  }}
                  className="w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                >
                  <option value={0}>Independent</option>
                  {parties.map(party => (
                    <option key={party.id} value={party.id}>
                      {party.name} ({party.abbreviation})
                    </option>
                  ))}
                </select>
              </div>

              {/* Electoral Area (for non-presidential) */}
              {election.electionType.electoralLevel > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Electoral Area
                  </label>
                  <select
                    value={newCandidate.electoralAreaId}
                    onChange={(e) => setNewCandidate({ ...newCandidate, electoralAreaId: parseInt(e.target.value) })}
                    className="w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                  >
                    <option value={0}>Select area...</option>
                    {adminUnits.map(unit => (
                      <option key={unit.id} value={unit.id}>{unit.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Ballot Order */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Ballot Order (optional)
                </label>
                <input
                  type="number"
                  value={newCandidate.ballotOrder}
                  onChange={(e) => setNewCandidate({ ...newCandidate, ballotOrder: e.target.value })}
                  min={1}
                  placeholder="Position on ballot..."
                  className="w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                />
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
                  disabled={isSubmitting || !newCandidate.personId}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded disabled:opacity-50"
                >
                  {isSubmitting ? 'Adding...' : 'Add Candidate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
