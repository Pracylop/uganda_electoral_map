import { useState, useEffect } from 'react';
import { api } from '../lib/api';

interface PendingResult {
  id: number;
  electionId: number;
  candidateId: number;
  adminUnitId: number;
  votes: number;
  status: string;
  updatedAt: string;
  election: { name: string };
  candidate: { name: string; party: string };
  administrativeUnit: { name: string };
}

export function ApprovalQueue() {
  const [pendingResults, setPendingResults] = useState<PendingResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<number | null>(null);

  useEffect(() => {
    loadPendingResults();
  }, []);

  const loadPendingResults = async () => {
    try {
      setIsLoading(true);
      const data = await api.getPendingResults();
      setPendingResults(data);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load pending results'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async (id: number) => {
    try {
      setProcessingId(id);
      await api.approveResult(id);
      await loadPendingResults();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to approve result'
      );
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (id: number) => {
    const reason = prompt('Please enter rejection reason:');
    if (!reason) return;

    try {
      setProcessingId(id);
      await api.rejectResult(id, reason);
      await loadPendingResults();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject result');
    } finally {
      setProcessingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-white text-xl">Loading pending results...</div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-gray-900 text-white p-8 overflow-auto">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">Approval Queue</h1>
            <p className="text-gray-400 mt-2">
              Review and approve pending election results
            </p>
          </div>
          <div className="bg-gray-800 px-6 py-3 rounded-lg">
            <p className="text-sm text-gray-400">Pending Results</p>
            <p className="text-3xl font-bold">{pendingResults.length}</p>
          </div>
        </div>

        {error && (
          <div className="bg-red-900/50 border border-red-700 rounded-md p-4 mb-6">
            <p className="text-red-200">{error}</p>
          </div>
        )}

        {pendingResults.length === 0 ? (
          <div className="bg-gray-800 rounded-lg p-12 text-center">
            <div className="text-6xl mb-4">✓</div>
            <h2 className="text-2xl font-bold mb-2">All Caught Up!</h2>
            <p className="text-gray-400">
              No pending results waiting for approval
            </p>
          </div>
        ) : (
          <div className="bg-gray-800 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">
                    Election
                  </th>
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
                    Submitted
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {pendingResults.map((result) => (
                  <tr key={result.id} className="hover:bg-gray-700/50">
                    <td className="px-6 py-4">
                      <p className="font-medium">{result.election.name}</p>
                    </td>
                    <td className="px-6 py-4">
                      {result.administrativeUnit.name}
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium">{result.candidate.name}</p>
                        <p className="text-sm text-gray-400">
                          {result.candidate.party}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right font-semibold">
                      {result.votes.toLocaleString()}
                    </td>
                    <td className="px-6 py-4">
                      {new Date(result.updatedAt).toLocaleString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleApprove(result.id)}
                          disabled={processingId === result.id}
                          className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 px-4 py-2 rounded-md text-sm transition-colors"
                        >
                          {processingId === result.id
                            ? 'Processing...'
                            : 'Approve'}
                        </button>
                        <button
                          onClick={() => handleReject(result.id)}
                          disabled={processingId === result.id}
                          className="bg-red-600 hover:bg-red-700 disabled:bg-gray-600 px-4 py-2 rounded-md text-sm transition-colors"
                        >
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
