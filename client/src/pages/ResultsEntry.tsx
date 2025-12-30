import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../lib/api';

interface Candidate {
  id: number;
  person: { fullName: string };
  party: { name: string; abbreviation: string; color: string } | null;
  electoralAreaId: number | null;
  isIndependent: boolean;
}

interface Election {
  id: number;
  name: string;
  electionDate: string;
  electionType: { id: number; name: string; code: string; electoralLevel: number };
  isActive: boolean;
  candidates: Candidate[];
  _count: { results: number };
}

export function ResultsEntry() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [election, setElection] = useState<Election | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state - simplified for now
  const [administrativeUnitId, setAdministrativeUnitId] = useState('');
  const [candidateVotes, setCandidateVotes] = useState<
    Map<number, number>
  >(new Map());

  useEffect(() => {
    loadElection();
  }, [id]);

  const loadElection = async () => {
    if (!id) return;

    try {
      setIsLoading(true);
      const data = await api.getElectionById(parseInt(id));
      setElection(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load election');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVoteChange = (candidateId: number, votes: string) => {
    const voteCount = parseInt(votes) || 0;
    const newVotes = new Map(candidateVotes);
    newVotes.set(candidateId, voteCount);
    setCandidateVotes(newVotes);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!election || !administrativeUnitId) return;

    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      // Submit a result for each candidate
      for (const candidate of election.candidates) {
        const votes = candidateVotes.get(candidate.id) || 0;

        await api.createResult({
          electionId: election.id,
          candidateId: candidate.id,
          administrativeUnitId: parseInt(administrativeUnitId),
          votes,
        });
      }

      setSuccess('Results submitted successfully!');
      setCandidateVotes(new Map());
      setAdministrativeUnitId('');

      // Redirect after 2 seconds
      setTimeout(() => {
        navigate(`/elections/${id}`);
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit results');
    } finally {
      setIsSaving(false);
    }
  };

  const totalVotes = Array.from(candidateVotes.values()).reduce(
    (sum, votes) => sum + votes,
    0
  );

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  if (!election) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-white text-xl">Election not found</div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-gray-900 text-white p-8 overflow-auto">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <Link
            to={`/elections/${id}`}
            className="text-blue-400 hover:text-blue-300 mb-4 inline-block"
          >
            ← Back to Results
          </Link>
          <h1 className="text-3xl font-bold mb-2">Enter Results</h1>
          <p className="text-gray-400">{election.name}</p>
        </div>

        {error && (
          <div className="bg-red-900/50 border border-red-700 rounded-md p-4 mb-6">
            <p className="text-red-200">{error}</p>
          </div>
        )}

        {success && (
          <div className="bg-green-900/50 border border-green-700 rounded-md p-4 mb-6">
            <p className="text-green-200">{success}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-gray-800 rounded-lg p-6">
          {/* Location Selection - Simplified */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">
              Location/Polling Station ID
            </label>
            <input
              type="number"
              required
              value={administrativeUnitId}
              onChange={(e) => setAdministrativeUnitId(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter administrative unit ID (e.g., 2 for Kampala)"
            />
            <p className="text-xs text-gray-400 mt-1">
              Tip: Use ID 2 for Kampala, 3 for Wakiso, etc.
            </p>
          </div>

          {/* Candidate Votes */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-4">Votes per Candidate</h3>
            <div className="space-y-4">
              {election.candidates.map((candidate) => (
                <div
                  key={candidate.id}
                  className="flex items-center justify-between p-4 bg-gray-700 rounded-md"
                >
                  <div className="flex items-center flex-1">
                    {candidate.party?.color && (
                      <div
                        className="w-6 h-6 rounded mr-3"
                        style={{
                          backgroundColor: candidate.party.color,
                        }}
                      />
                    )}
                    <div>
                      <p className="font-semibold">{candidate.person.fullName}</p>
                      <p className="text-sm text-gray-400">{candidate.party?.name || 'Independent'}</p>
                    </div>
                  </div>
                  <div className="w-32">
                    <input
                      type="number"
                      min="0"
                      required
                      value={candidateVotes.get(candidate.id) || ''}
                      onChange={(e) =>
                        handleVoteChange(candidate.id, e.target.value)
                      }
                      className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-md text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="0"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Total Votes */}
          <div className="mb-6 p-4 bg-gray-700 rounded-md">
            <div className="flex justify-between items-center">
              <span className="font-semibold">Total Votes:</span>
              <span className="text-2xl font-bold">
                {totalVotes.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex gap-4">
            <button
              type="submit"
              disabled={isSaving || !administrativeUnitId}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed px-6 py-3 rounded-md transition-colors font-semibold"
            >
              {isSaving ? 'Submitting...' : 'Submit Results'}
            </button>
            <Link
              to={`/elections/${id}`}
              className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-md transition-colors"
            >
              Cancel
            </Link>
          </div>

          <p className="text-xs text-gray-400 mt-4">
            * Results will be saved as draft and require approval before being
            published.
          </p>
        </form>
      </div>
    </div>
  );
}
