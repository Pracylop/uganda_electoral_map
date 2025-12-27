import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';

interface Election {
  id: number;
  name: string;
  electionDate: string;
  electionType: string;
  isActive: boolean;
  createdAt: string;
  _count: { candidates: number; results: number };
}

export function Elections() {
  const [elections, setElections] = useState<Election[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadElections();
  }, []);

  const loadElections = async () => {
    try {
      setIsLoading(true);
      const data = await api.getElections();
      setElections(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load elections');
    } finally {
      setIsLoading(false);
    }
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
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Elections</h1>
        </div>

        {error && (
          <div className="bg-red-900/50 border border-red-700 rounded-md p-4 mb-6">
            <p className="text-red-200">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {elections.map((election) => (
            <Link
              key={election.id}
              to={`/elections/${election.id}`}
              className="bg-gray-800 rounded-lg p-6 hover:bg-gray-700 transition-colors border-2 border-transparent hover:border-blue-500"
            >
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-xl font-bold">{election.name}</h2>
                {election.isActive && (
                  <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-900 text-green-200">
                    Active
                  </span>
                )}
              </div>

              <div className="space-y-2 text-sm text-gray-400">
                <div className="flex items-center">
                  <span className="font-medium w-24">Date:</span>
                  <span>
                    {new Date(election.electionDate).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex items-center">
                  <span className="font-medium w-24">Type:</span>
                  <span>{election.electionType}</span>
                </div>
                <div className="flex items-center">
                  <span className="font-medium w-24">Candidates:</span>
                  <span>{election._count.candidates}</span>
                </div>
                <div className="flex items-center">
                  <span className="font-medium w-24">Results:</span>
                  <span>{election._count.results}</span>
                </div>
              </div>

              <div className="mt-6">
                <button className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md transition-colors">
                  View Results
                </button>
              </div>
            </Link>
          ))}
        </div>

        {elections.length === 0 && !isLoading && (
          <div className="text-center py-12">
            <p className="text-gray-400 text-lg">No elections found</p>
          </div>
        )}
      </div>
    </div>
  );
}
