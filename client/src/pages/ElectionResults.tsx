import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuthStore } from '../stores/authStore';

interface Candidate {
  id: number;
  name: string;
  party: string;
  partyColor: string | null;
}

interface Result {
  id: number;
  votes: number;
  status: string;
  candidate: Candidate;
  administrativeUnit: {
    id: number;
    name: string;
    level: number;
  };
}

interface Election {
  id: number;
  name: string;
  electionDate: string;
  electionType: string;
  candidates: Candidate[];
  _count: { results: number };
}

export function ElectionResults() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuthStore();
  const [election, setElection] = useState<Election | null>(null);
  const [results, setResults] = useState<Result[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    if (!id) return;

    try {
      setIsLoading(true);
      const [electionData, resultsData] = await Promise.all([
        api.getElectionById(parseInt(id)),
        api.getResultsByElection(parseInt(id)),
      ]);
      setElection(electionData);
      setResults(resultsData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  const calculateTotalsByCandidate = () => {
    const totals = new Map<number, number>();
    results.forEach((result) => {
      const current = totals.get(result.candidate.id) || 0;
      totals.set(result.candidate.id, current + result.votes);
    });
    return totals;
  };

  const candidateTotals = calculateTotalsByCandidate();
  const grandTotal = Array.from(candidateTotals.values()).reduce(
    (sum, votes) => sum + votes,
    0
  );

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-white text-xl">Loading results...</div>
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
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <Link
            to="/elections"
            className="text-blue-400 hover:text-blue-300 mb-4 inline-block"
          >
            ← Back to Elections
          </Link>
          <h1 className="text-3xl font-bold mb-2">{election.name}</h1>
          <p className="text-gray-400">
            {new Date(election.electionDate).toLocaleDateString()} •{' '}
            {election.electionType}
          </p>
        </div>

        {error && (
          <div className="bg-red-900/50 border border-red-700 rounded-md p-4 mb-6">
            <p className="text-red-200">{error}</p>
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-gray-400 text-sm mb-2">Total Votes</h3>
            <p className="text-3xl font-bold">
              {grandTotal.toLocaleString()}
            </p>
          </div>
          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-gray-400 text-sm mb-2">Candidates</h3>
            <p className="text-3xl font-bold">{election.candidates.length}</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-gray-400 text-sm mb-2">Locations Reporting</h3>
            <p className="text-3xl font-bold">
              {new Set(results.map((r) => r.administrativeUnit.id)).size}
            </p>
          </div>
        </div>

        {/* Candidate Results Table */}
        <div className="bg-gray-800 rounded-lg overflow-hidden mb-8">
          <div className="px-6 py-4 bg-gray-700">
            <h2 className="text-xl font-bold">Results by Candidate</h2>
          </div>
          <table className="w-full">
            <thead className="bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">
                  Candidate
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">
                  Party
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase">
                  Votes
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase">
                  Percentage
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase">
                  Share
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {election.candidates
                .sort(
                  (a, b) =>
                    (candidateTotals.get(b.id) || 0) -
                    (candidateTotals.get(a.id) || 0)
                )
                .map((candidate) => {
                  const votes = candidateTotals.get(candidate.id) || 0;
                  const percentage =
                    grandTotal > 0 ? (votes / grandTotal) * 100 : 0;

                  return (
                    <tr key={candidate.id}>
                      <td className="px-6 py-4">{candidate.name}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          {candidate.partyColor && (
                            <div
                              className="w-4 h-4 rounded mr-2"
                              style={{
                                backgroundColor: candidate.partyColor,
                              }}
                            />
                          )}
                          {candidate.party}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right font-semibold">
                        {votes.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {percentage.toFixed(2)}%
                      </td>
                      <td className="px-6 py-4">
                        <div className="w-full bg-gray-700 rounded-full h-2">
                          <div
                            className="h-2 rounded-full"
                            style={{
                              width: `${percentage}%`,
                              backgroundColor:
                                candidate.partyColor || '#3B82F6',
                            }}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>

        {/* Action Buttons */}
        {(user?.role === 'operator' ||
          user?.role === 'editor' ||
          user?.role === 'admin') && (
          <div className="flex gap-4 mb-8">
            <Link
              to={`/elections/${id}/enter-results`}
              className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-md transition-colors"
            >
              Enter Results
            </Link>
          </div>
        )}

        {/* Detailed Results by Location */}
        {results.length > 0 && (
          <div className="bg-gray-800 rounded-lg overflow-hidden">
            <div className="px-6 py-4 bg-gray-700">
              <h2 className="text-xl font-bold">Results by Location</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">
                      Location
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">
                      Candidate
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase">
                      Votes
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {results.map((result) => (
                    <tr key={result.id}>
                      <td className="px-6 py-4">
                        {result.administrativeUnit.name}
                      </td>
                      <td className="px-6 py-4">{result.candidate.name}</td>
                      <td className="px-6 py-4 text-right">
                        {result.votes.toLocaleString()}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-2 py-1 text-xs font-semibold rounded-full ${
                            result.status === 'approved'
                              ? 'bg-green-900 text-green-200'
                              : result.status === 'pending'
                              ? 'bg-yellow-900 text-yellow-200'
                              : result.status === 'rejected'
                              ? 'bg-red-900 text-red-200'
                              : 'bg-gray-700 text-gray-300'
                          }`}
                        >
                          {result.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {results.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-400 text-lg">
              No results submitted yet for this election
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
