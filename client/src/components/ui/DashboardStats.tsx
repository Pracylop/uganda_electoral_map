import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Vote, AlertTriangle, Users, CheckCircle, XCircle, Skull, Siren } from 'lucide-react';
import { StatsCard } from './StatsCard';
import { apiRequest } from '../../lib/api';

type StatsMode = 'election' | 'issues';

interface Election {
  id: number;
  name: string;
  electionDate: string;
}

interface NationalResults {
  turnoutPercentage: number;
  totalRegisteredVoters: number;
  totalVotesCast: number;
  totalInvalidVotes: number;
  election?: { name: string };
}

interface IssuesStats {
  total: number;
  casualties: {
    deaths: number;
    injuries: number;
    arrests: number;
  };
}

export function DashboardStats() {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<StatsMode>('election');
  const [selectedElectionId, setSelectedElectionId] = useState<number | null>(null);

  // Fetch elections with useQuery - will use cache if available, otherwise fetch from API
  const { data: elections = [], isLoading: electionsLoading } = useQuery({
    queryKey: ['elections'],
    queryFn: () => apiRequest<Election[]>('/api/elections'),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes (formerly cacheTime)
  });

  // Initialize selected election when elections load
  useEffect(() => {
    if (selectedElectionId || elections.length === 0) return;

    // Try to get the latest election with data from cache
    const latestId = queryClient.getQueryData<number | null>(['dashboardLatestElection']);
    if (latestId) {
      setSelectedElectionId(latestId);
    } else {
      // Fallback to first presidential election
      const presidential = elections.find(e =>
        e.name.toLowerCase().includes('presidential')
      );
      setSelectedElectionId(presidential?.id || elections[0].id);
    }
  }, [elections, selectedElectionId, queryClient]);

  // Fetch national results with useQuery - cache or API fallback
  const { data: nationalResults, isLoading: resultsLoading } = useQuery({
    queryKey: ['nationalResults', selectedElectionId],
    queryFn: () => apiRequest<NationalResults>(`/api/results/national/${selectedElectionId}`),
    enabled: !!selectedElectionId,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const electionStats = nationalResults ? {
    turnoutPercentage: nationalResults.turnoutPercentage || 0,
    totalRegisteredVoters: nationalResults.totalRegisteredVoters || 0,
    totalVotesCast: nationalResults.totalVotesCast || 0,
    totalInvalidVotes: nationalResults.totalInvalidVotes || 0,
    electionName: nationalResults.election?.name || 'Election',
  } : null;

  // Fetch issues stats with useQuery
  const { data: issuesStats, isLoading: issuesLoading } = useQuery({
    queryKey: ['issuesStats'],
    queryFn: () => apiRequest<IssuesStats>('/api/issues/stats'),
    enabled: mode === 'issues',
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toLocaleString();
  };

  const showLoading = (mode === 'election' && (electionsLoading || resultsLoading)) || (mode === 'issues' && issuesLoading);

  return (
    <div className="space-y-4">
      {/* Toggle Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-headline font-semibold text-white">Statistics</h2>
        <div className="flex items-center gap-2">
          {/* Mode Toggle */}
          <div className="flex bg-gray-800 rounded-lg p-1">
            <button
              onClick={() => setMode('election')}
              className={`
                px-3 py-1.5 text-sm font-medium rounded-md transition-all
                ${mode === 'election'
                  ? 'bg-accent-cyan text-black'
                  : 'text-gray-400 hover:text-white'
                }
              `}
            >
              Election
            </button>
            <button
              onClick={() => setMode('issues')}
              className={`
                px-3 py-1.5 text-sm font-medium rounded-md transition-all
                ${mode === 'issues'
                  ? 'bg-accent-cyan text-black'
                  : 'text-gray-400 hover:text-white'
                }
              `}
            >
              Issues
            </button>
          </div>

          {/* Election Selector (only shown in election mode) */}
          {mode === 'election' && elections.length > 0 && (
            <select
              value={selectedElectionId || ''}
              onChange={(e) => setSelectedElectionId(Number(e.target.value))}
              className="
                bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5
                text-sm text-white focus:outline-none focus:border-accent-cyan
              "
            >
              {elections.map((election) => (
                <option key={election.id} value={election.id}>
                  {election.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      {showLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-surface/85 rounded-lg p-4 animate-pulse">
              <div className="h-4 bg-gray-700 rounded w-20 mb-2" />
              <div className="h-8 bg-gray-700 rounded w-16" />
            </div>
          ))}
        </div>
      ) : mode === 'election' && electionStats ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatsCard
            label="Turnout"
            value={`${electionStats.turnoutPercentage.toFixed(1)}%`}
            subtext={electionStats.electionName}
            icon={<Vote size={20} />}
            showProgress
            progressValue={electionStats.turnoutPercentage}
          />
          <StatsCard
            label="Registered Voters"
            value={formatNumber(electionStats.totalRegisteredVoters)}
            subtext="Total eligible"
            icon={<Users size={20} />}
          />
          <StatsCard
            label="Valid Votes"
            value={formatNumber(electionStats.totalVotesCast - electionStats.totalInvalidVotes)}
            subtext="Counted"
            icon={<CheckCircle size={20} />}
            variant="success"
          />
          <StatsCard
            label="Invalid Votes"
            value={formatNumber(electionStats.totalInvalidVotes)}
            subtext={`${((electionStats.totalInvalidVotes / electionStats.totalVotesCast) * 100 || 0).toFixed(1)}% of total`}
            icon={<XCircle size={20} />}
            variant={electionStats.totalInvalidVotes > 0 ? 'danger' : 'default'}
          />
        </div>
      ) : mode === 'issues' && issuesStats ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatsCard
            label="Total Incidents"
            value={formatNumber(issuesStats.total)}
            subtext="Documented cases"
            icon={<AlertTriangle size={20} />}
            variant="highlight"
          />
          <StatsCard
            label="Deaths"
            value={issuesStats.casualties.deaths}
            subtext="Fatalities"
            icon={<Skull size={20} />}
            variant="danger"
          />
          <StatsCard
            label="Injuries"
            value={issuesStats.casualties.injuries}
            subtext="Reported"
            icon={<AlertTriangle size={20} />}
            variant="danger"
          />
          <StatsCard
            label="Arrests"
            value={formatNumber(issuesStats.casualties.arrests)}
            subtext="Detained"
            icon={<Siren size={20} />}
            variant="default"
          />
        </div>
      ) : (
        <div className="text-center text-gray-500 py-8">
          No data available
        </div>
      )}
    </div>
  );
}
