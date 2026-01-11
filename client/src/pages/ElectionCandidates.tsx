import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Eye, Pencil, Trash2, X, Upload, User } from 'lucide-react';
import { api } from '../lib/api';

interface Candidate {
  id: number;
  personId: number;
  partyId: number | null;
  electoralAreaId: number | null;
  ballotOrder: number | null;
  photoUrl: string | null;
  isIndependent: boolean;
  person: { fullName: string; imageUrl?: string | null };
  party: { name: string; abbreviation: string; color: string } | null;
  electoralArea: { name: string; code: string | null } | null;
  _count: { results: number };
}

// Helper to generate initials from name
const getInitials = (name: string): string => {
  return name
    .split(' ')
    .filter(n => n.length > 0)
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
};

// Avatar component with image or initials fallback
function CandidateAvatar({
  name,
  photoUrl,
  partyColor,
  size = 'md'
}: {
  name: string;
  photoUrl?: string | null;
  partyColor?: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const [imageError, setImageError] = useState(false);
  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-16 h-16 text-xl',
  };

  if (photoUrl && !imageError) {
    return (
      <img
        src={photoUrl}
        alt={name}
        className={`${sizeClasses[size]} rounded-full object-cover border-2`}
        style={{ borderColor: partyColor || '#4B5563' }}
        onError={() => setImageError(true)}
      />
    );
  }

  return (
    <div
      className={`${sizeClasses[size]} rounded-full flex items-center justify-center font-bold text-white border-2`}
      style={{
        backgroundColor: partyColor ? `${partyColor}40` : '#374151',
        borderColor: partyColor || '#4B5563',
      }}
    >
      {getInitials(name)}
    </div>
  );
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
  const navigate = useNavigate();

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

  // View modal state
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewCandidate, setViewCandidate] = useState<Candidate | null>(null);

  // Edit modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editCandidate, setEditCandidate] = useState<Candidate | null>(null);
  const [editForm, setEditForm] = useState({
    partyId: 0,
    electoralAreaId: 0,
    ballotOrder: '',
    photoUrl: '',
    isIndependent: false,
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleViewCandidate = (candidate: Candidate) => {
    setViewCandidate(candidate);
    setShowViewModal(true);
  };

  const handleEditCandidate = async (candidate: Candidate) => {
    setEditCandidate(candidate);
    setEditForm({
      partyId: candidate.partyId || 0,
      electoralAreaId: candidate.electoralAreaId || 0,
      ballotOrder: candidate.ballotOrder?.toString() || '',
      photoUrl: candidate.photoUrl || '',
      isIndependent: candidate.isIndependent,
    });
    // Load reference data if not already loaded
    if (parties.length === 0) {
      await loadReferenceData();
    }
    setShowEditModal(true);
  };

  const handleUpdateCandidate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editCandidate) return;

    try {
      setIsSubmitting(true);
      await api.updateCandidate(editCandidate.id, {
        partyId: editForm.partyId || undefined,
        electoralAreaId: editForm.electoralAreaId || undefined,
        ballotOrder: editForm.ballotOrder ? parseInt(editForm.ballotOrder) : undefined,
        photoUrl: editForm.photoUrl || undefined,
        isIndependent: editForm.isIndependent,
      });
      setShowEditModal(false);
      setEditCandidate(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update candidate');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePhotoUrlChange = (url: string) => {
    setEditForm({ ...editForm, photoUrl: url });
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
    <div className="flex-1 bg-gray-900 text-white p-6 overflow-auto">
      <div className="w-full">
        {/* Header */}
        <div className="mb-6">
          <Link to="/elections" className="text-cyan-400 hover:text-cyan-300 text-sm mb-2 inline-block">
            &larr; Back to Elections
          </Link>
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold">{election.name}</h1>
              <p className="text-gray-400 mt-1 text-sm">
                {election.electionType.name} &bull; {candidates.length} candidates
              </p>
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md flex items-center gap-2 text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
          <div className="text-center py-12 bg-gray-800/50 rounded-lg border border-gray-700/50">
            <p className="text-gray-400 text-lg mb-4">No candidates added yet</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="text-cyan-400 hover:text-cyan-300"
            >
              Add the first candidate
            </button>
          </div>
        ) : (
          <div className="bg-gray-800/50 rounded-lg overflow-hidden border border-gray-700/50">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700/50">
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">#</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Candidate</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Party</th>
                  {election.electionType.electoralLevel > 0 && (
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Electoral Area</th>
                  )}
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Results</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700/30">
                {candidates.map((candidate, index) => (
                  <tr key={candidate.id} className="hover:bg-gray-700/30 transition-colors">
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {candidate.ballotOrder || index + 1}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <CandidateAvatar
                          name={candidate.person.fullName}
                          photoUrl={candidate.photoUrl || candidate.person.imageUrl}
                          partyColor={candidate.party?.color}
                          size="md"
                        />
                        <div>
                          <div className="font-medium text-sm">{candidate.person.fullName}</div>
                          {candidate.isIndependent && (
                            <span className="text-xs text-gray-500">Independent</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {candidate.party ? (
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: candidate.party.color }}
                          />
                          <span className="text-sm font-medium">{candidate.party.abbreviation}</span>
                          <span className="text-gray-500 text-xs">({candidate.party.name})</span>
                        </div>
                      ) : (
                        <span className="text-gray-500 text-sm">Independent</span>
                      )}
                    </td>
                    {election.electionType.electoralLevel > 0 && (
                      <td className="px-4 py-3 text-sm">
                        {candidate.electoralArea?.name || '-'}
                      </td>
                    )}
                    <td className="px-4 py-3 text-sm text-gray-400">
                      {candidate._count.results.toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => navigate(`/elections/${electionId}/candidates/${candidate.id}`)}
                          className="px-3 py-1 text-xs font-medium rounded-full bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 transition-colors"
                        >
                          View Profile
                        </button>
                        <button
                          onClick={() => navigate(`/elections/${electionId}/candidates/${candidate.id}?edit=true`)}
                          className="px-3 py-1 text-xs font-medium rounded-full bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteCandidate(candidate.id, candidate.person.fullName)}
                          className="px-3 py-1 text-xs font-medium rounded-full bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          disabled={candidate._count.results > 0}
                          title={candidate._count.results > 0 ? 'Cannot remove candidate with results' : 'Remove candidate'}
                        >
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Quick Actions */}
        <div className="mt-6 flex gap-3">
          <Link
            to={`/elections/${electionId}`}
            className="px-5 py-2 text-sm font-medium rounded-md bg-cyan-600 hover:bg-cyan-700 text-white transition-colors"
          >
            View All Results
          </Link>
          <Link
            to={`/elections/${electionId}/enter-results`}
            className="px-5 py-2 text-sm font-medium rounded-md bg-green-600 hover:bg-green-700 text-white transition-colors"
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

      {/* View Candidate Modal */}
      {showViewModal && viewCandidate && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg w-full max-w-md mx-4">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <h2 className="text-xl font-bold">Candidate Details</h2>
              <button
                onClick={() => setShowViewModal(false)}
                className="p-1 text-gray-400 hover:text-white hover:bg-gray-700 rounded"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              {/* Avatar and Name */}
              <div className="flex items-center gap-4 mb-6">
                <CandidateAvatar
                  name={viewCandidate.person.fullName}
                  photoUrl={viewCandidate.photoUrl || viewCandidate.person.imageUrl}
                  partyColor={viewCandidate.party?.color}
                  size="lg"
                />
                <div>
                  <h3 className="text-xl font-bold">{viewCandidate.person.fullName}</h3>
                  {viewCandidate.party ? (
                    <div className="flex items-center gap-2 mt-1">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: viewCandidate.party.color }}
                      />
                      <span className="text-gray-300">{viewCandidate.party.name}</span>
                    </div>
                  ) : (
                    <span className="text-gray-400">Independent</span>
                  )}
                </div>
              </div>

              {/* Details */}
              <div className="space-y-3">
                <div className="flex justify-between py-2 border-b border-gray-700">
                  <span className="text-gray-400">Ballot Position</span>
                  <span className="font-medium">{viewCandidate.ballotOrder || 'Not set'}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-700">
                  <span className="text-gray-400">Party</span>
                  <span className="font-medium">{viewCandidate.party?.abbreviation || 'Independent'}</span>
                </div>
                {viewCandidate.electoralArea && (
                  <div className="flex justify-between py-2 border-b border-gray-700">
                    <span className="text-gray-400">Electoral Area</span>
                    <span className="font-medium">{viewCandidate.electoralArea.name}</span>
                  </div>
                )}
                <div className="flex justify-between py-2 border-b border-gray-700">
                  <span className="text-gray-400">Results Recorded</span>
                  <span className="font-medium">{viewCandidate._count.results.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex gap-3 p-4 border-t border-gray-700">
              <button
                onClick={() => setShowViewModal(false)}
                className="flex-1 bg-gray-600 hover:bg-gray-500 text-white py-2 px-4 rounded"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setShowViewModal(false);
                  handleEditCandidate(viewCandidate);
                }}
                className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white py-2 px-4 rounded flex items-center justify-center gap-2"
              >
                <Pencil size={16} />
                Edit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Candidate Modal */}
      {showEditModal && editCandidate && election && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <h2 className="text-xl font-bold">Edit Candidate</h2>
              <button
                onClick={() => setShowEditModal(false)}
                className="p-1 text-gray-400 hover:text-white hover:bg-gray-700 rounded"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleUpdateCandidate} className="p-6 space-y-4">
              {/* Candidate Info (read-only) */}
              <div className="flex items-center gap-4 p-4 bg-gray-700/50 rounded-lg">
                <CandidateAvatar
                  name={editCandidate.person.fullName}
                  photoUrl={editForm.photoUrl || editCandidate.person.imageUrl}
                  partyColor={parties.find(p => p.id === editForm.partyId)?.color}
                  size="lg"
                />
                <div>
                  <h3 className="text-lg font-bold">{editCandidate.person.fullName}</h3>
                  <p className="text-sm text-gray-400">Person ID: {editCandidate.personId}</p>
                </div>
              </div>

              {/* Photo URL */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Photo URL
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={editForm.photoUrl}
                    onChange={(e) => handlePhotoUrlChange(e.target.value)}
                    placeholder="https://example.com/photo.jpg"
                    className="flex-1 bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Enter a URL to the candidate's photo image
                </p>
              </div>

              {/* Party Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Political Party
                </label>
                <select
                  value={editForm.partyId}
                  onChange={(e) => {
                    const partyId = parseInt(e.target.value);
                    setEditForm({
                      ...editForm,
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
                    value={editForm.electoralAreaId}
                    onChange={(e) => setEditForm({ ...editForm, electoralAreaId: parseInt(e.target.value) })}
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
                  Ballot Order
                </label>
                <input
                  type="number"
                  value={editForm.ballotOrder}
                  onChange={(e) => setEditForm({ ...editForm, ballotOrder: e.target.value })}
                  min={1}
                  placeholder="Position on ballot..."
                  className="w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 bg-gray-600 hover:bg-gray-500 text-white py-2 px-4 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
