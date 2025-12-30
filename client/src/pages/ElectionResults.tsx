import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import { PartySummaryWidget } from '../components/PartySummaryWidget';

interface Candidate {
  id: number;
  person: { fullName: string };
  party: { name: string; abbreviation: string; color: string } | null;
  electoralAreaId: number | null;
  isIndependent: boolean;
}

interface Result {
  id: number;
  votes: number;
  status: string;
  candidateId: number;
  candidate: {
    id: number;
    person: { fullName: string };
    party: { name: string; abbreviation: string; color: string } | null;
  };
  adminUnit: {
    id: number;
    name: string;
    code: string | null;
    level: number;
  };
}

interface Election {
  id: number;
  name: string;
  electionDate: string;
  electionType: { name: string; code: string; electoralLevel: number };
  candidates: Candidate[];
  _count: { results: number };
}

interface AdminUnit {
  id: number;
  name: string;
  code: string | null;
  level: number;
  parentId: number | null;
}

export function ElectionResults() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuthStore();
  const [election, setElection] = useState<Election | null>(null);
  const [results, setResults] = useState<Result[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Electoral area selection state
  const [districts, setDistricts] = useState<AdminUnit[]>([]);
  const [constituencies, setConstituencies] = useState<AdminUnit[]>([]);
  const [selectedDistrictId, setSelectedDistrictId] = useState<number | null>(null);
  const [selectedConstituencyId, setSelectedConstituencyId] = useState<number | null>(null);

  useEffect(() => {
    loadData();
  }, [id]);

  // Load districts when election loads
  useEffect(() => {
    if (election && election.electionType.electoralLevel >= 2) {
      loadDistricts();
    }
  }, [election]);

  // Load constituencies when district changes
  useEffect(() => {
    if (selectedDistrictId && election?.electionType.electoralLevel === 3) {
      loadConstituencies(selectedDistrictId);
    } else {
      setConstituencies([]);
      setSelectedConstituencyId(null);
    }
  }, [selectedDistrictId, election]);

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
      console.error('Error loading election data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  const loadDistricts = async () => {
    try {
      const data = await api.getAdminUnits(2); // Level 2 = District
      setDistricts(data);
    } catch (err) {
      console.error('Failed to load districts:', err);
    }
  };

  const loadConstituencies = async (districtId: number) => {
    try {
      const data = await api.getAdminUnits(3, districtId); // Level 3 = Constituency
      setConstituencies(data);
    } catch (err) {
      console.error('Failed to load constituencies:', err);
    }
  };

  // Get the selected electoral area ID based on election type
  const getSelectedElectoralAreaId = (): number | null => {
    if (!election) return null;
    const level = election.electionType.electoralLevel;

    if (level === 2) return selectedDistrictId; // District level (Woman MP)
    if (level === 3) return selectedConstituencyId; // Constituency level (Const MP)
    return null; // National level
  };

  // Filter candidates by electoral area
  const filteredCandidates = (election?.candidates || []).filter(candidate => {
    const selectedAreaId = getSelectedElectoralAreaId();
    if (!selectedAreaId) return true; // Show all if no selection or national
    return candidate.electoralAreaId === selectedAreaId;
  });

  // Filter results by electoral area (admin unit)
  const filteredResults = results.filter(result => {
    if (!result.adminUnit) return false;
    const selectedAreaId = getSelectedElectoralAreaId();
    if (!selectedAreaId) return true; // Show all if no selection or national
    return result.adminUnit.id === selectedAreaId;
  });

  const calculateTotalsByCandidate = () => {
    const totals = new Map<number, number>();
    filteredResults.forEach((result) => {
      if (result.candidate) {
        const current = totals.get(result.candidateId) || 0;
        totals.set(result.candidateId, current + result.votes);
      }
    });
    return totals;
  };

  const candidateTotals = calculateTotalsByCandidate();
  const grandTotal = Array.from(candidateTotals.values()).reduce(
    (sum, votes) => sum + votes,
    0
  );

  // Get electoral level label
  const getElectoralLevelLabel = () => {
    if (!election) return '';
    const level = election.electionType.electoralLevel;
    if (level === 2) return 'District';
    if (level === 3) return 'Constituency';
    return '';
  };

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

  const electoralLevel = election.electionType.electoralLevel;
  const needsAreaSelection = electoralLevel >= 2;
  const selectedAreaId = getSelectedElectoralAreaId();

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
            {election.electionType?.name || election.electionType}
          </p>
        </div>

        {error && (
          <div className="bg-red-900/50 border border-red-700 rounded-md p-4 mb-6">
            <p className="text-red-200">{error}</p>
          </div>
        )}

        {/* Electoral Area Selector */}
        {needsAreaSelection && (
          <div className="bg-gray-800 rounded-lg p-4 mb-6">
            <h3 className="text-sm font-medium text-gray-300 mb-3">
              Select {getElectoralLevelLabel()} to view results
            </h3>
            <div className="flex flex-wrap gap-4">
              {/* District Selector */}
              <div className="flex-1 min-w-[200px]">
                <label className="block text-xs text-gray-400 mb-1">District</label>
                <select
                  value={selectedDistrictId || ''}
                  onChange={(e) => {
                    setSelectedDistrictId(e.target.value ? parseInt(e.target.value) : null);
                    setSelectedConstituencyId(null);
                  }}
                  className="w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                >
                  <option value="">-- Select District --</option>
                  {districts.map((district) => (
                    <option key={district.id} value={district.id}>
                      {district.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Constituency Selector (only for Constituency MP) */}
              {electoralLevel === 3 && selectedDistrictId && (
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-xs text-gray-400 mb-1">Constituency</label>
                  <select
                    value={selectedConstituencyId || ''}
                    onChange={(e) => setSelectedConstituencyId(e.target.value ? parseInt(e.target.value) : null)}
                    className="w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                  >
                    <option value="">-- Select Constituency --</option>
                    {constituencies.map((constituency) => (
                      <option key={constituency.id} value={constituency.id}>
                        {constituency.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {!selectedAreaId && (
              <p className="text-yellow-400 text-sm mt-3">
                Please select {electoralLevel === 3 ? 'a district and constituency' : 'a district'} to view candidate results for that race.
              </p>
            )}
          </div>
        )}

        {/* Party Summary Widget - Only for MP elections */}
        {electoralLevel >= 2 && (
          <div className="mb-8">
            <PartySummaryWidget electionId={election.id} />
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-gray-400 text-sm mb-2">
              {selectedAreaId ? 'Total Votes (Selected Area)' : 'Total Votes (All Areas)'}
            </h3>
            <p className="text-3xl font-bold">
              {grandTotal.toLocaleString()}
            </p>
          </div>
          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-gray-400 text-sm mb-2">
              {selectedAreaId ? 'Candidates (Selected Area)' : 'Total Candidates'}
            </h3>
            <p className="text-3xl font-bold">{filteredCandidates.length}</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-gray-400 text-sm mb-2">Locations Reporting</h3>
            <p className="text-3xl font-bold">
              {new Set(filteredResults.filter(r => r.adminUnit).map((r) => r.adminUnit.id)).size}
            </p>
          </div>
        </div>

        {/* Candidate Results Table */}
        {(selectedAreaId || !needsAreaSelection) && filteredCandidates.length > 0 && (
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
                {filteredCandidates
                  .sort(
                    (a, b) =>
                      (candidateTotals.get(b.id) || 0) -
                      (candidateTotals.get(a.id) || 0)
                  )
                  .map((candidate) => {
                    const votes = candidateTotals.get(candidate.id) || 0;
                    const percentage =
                      grandTotal > 0 ? (votes / grandTotal) * 100 : 0;
                    const partyColor = candidate.party?.color || null;

                    return (
                      <tr key={candidate.id}>
                        <td className="px-6 py-4">{candidate.person.fullName}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            {partyColor && (
                              <div
                                className="w-4 h-4 rounded mr-2"
                                style={{
                                  backgroundColor: partyColor,
                                }}
                              />
                            )}
                            {candidate.party?.abbreviation || 'Independent'}
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
                                backgroundColor: partyColor || '#3B82F6',
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
        )}

        {/* No selection message for area-based elections */}
        {needsAreaSelection && !selectedAreaId && (
          <div className="bg-gray-800 rounded-lg p-8 text-center mb-8">
            <p className="text-gray-400 text-lg">
              Select {electoralLevel === 3 ? 'a constituency' : 'a district'} above to view results for that race.
            </p>
            <p className="text-gray-500 text-sm mt-2">
              This election has {election.candidates?.length || 0} candidates across all {electoralLevel === 3 ? 'constituencies' : 'districts'}.
            </p>
          </div>
        )}

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

        {/* Detailed Results by Location - only show for national elections or when area selected */}
        {(!needsAreaSelection || selectedAreaId) && filteredResults.length > 0 && (
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
                  {filteredResults.filter(r => r.adminUnit && r.candidate).slice(0, 100).map((result) => (
                    <tr key={result.id}>
                      <td className="px-6 py-4">
                        {result.adminUnit.name}
                      </td>
                      <td className="px-6 py-4">{result.candidate.person.fullName}</td>
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
              {filteredResults.length > 100 && (
                <div className="px-6 py-3 text-center text-gray-400 text-sm">
                  Showing first 100 of {filteredResults.length} results
                </div>
              )}
            </div>
          </div>
        )}

        {(!needsAreaSelection || selectedAreaId) && filteredResults.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-400 text-lg">
              No results submitted yet for this {selectedAreaId ? 'area' : 'election'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
