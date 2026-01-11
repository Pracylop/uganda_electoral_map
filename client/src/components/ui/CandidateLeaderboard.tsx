import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../lib/api';

interface CandidateResult {
  candidateId: number;
  candidateName: string;
  party: string;
  partyColor: string | null;
  totalVotes: number;
  percentage: number;
}

interface NationalResults {
  candidateResults: CandidateResult[];
  election?: { name: string };
}

interface Election {
  id: number;
  name: string;
}

interface LeaderboardProps {
  electionId?: number | null;
  maxCandidates?: number;
}

// Fallback party colors
const PARTY_COLORS: Record<string, string> = {
  'NRM': '#FFFF00',
  'NUP': '#FF0000',
  'FDC': '#0000FF',
  'DP': '#008000',
  'UPC': '#DC2626',
  'ANT': '#7C3AED',
  'IND': '#6B7280',
};

export function CandidateLeaderboard({ electionId: propElectionId, maxCandidates = 5 }: LeaderboardProps) {
  const queryClient = useQueryClient();

  // Get elections to find default if not provided
  const { data: elections = [] } = useQuery({
    queryKey: ['elections'],
    queryFn: () => apiRequest<Election[]>('/api/elections'),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    enabled: !propElectionId, // Only fetch if no electionId provided
  });

  // Determine the election ID to use
  const cachedLatestId = queryClient.getQueryData<number | null>(['dashboardLatestElection']);
  const defaultElectionId = cachedLatestId || elections.find(e =>
    e.name.toLowerCase().includes('presidential')
  )?.id || elections[0]?.id;

  const electionId = propElectionId ?? defaultElectionId;

  // Fetch national results with useQuery - cache or API fallback
  const { data: nationalResults, isLoading } = useQuery({
    queryKey: ['nationalResults', electionId],
    queryFn: () => apiRequest<NationalResults>(`/api/results/national/${electionId}`),
    enabled: !!electionId,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const candidates = nationalResults?.candidateResults?.slice(0, maxCandidates) || [];
  const electionName = nationalResults?.election?.name || '';

  const getPartyColor = (party: string, color: string | null): string => {
    if (color) return color;
    return PARTY_COLORS[party] || PARTY_COLORS['IND'];
  };

  const formatVotes = (num: number): string => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(2) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(0) + 'K';
    }
    return num.toLocaleString();
  };

  // Generate initials for avatar placeholder
  const getInitials = (name: string): string => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  };

  if (isLoading) {
    return (
      <div className="bg-surface/90 rounded-xl border border-gray-700/50 p-5">
        <h3 className="text-lg font-headline font-semibold text-white mb-4">
          Leading Candidates
        </h3>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse flex items-center gap-3">
              <div className="w-6 h-6 bg-gray-700 rounded-full" />
              <div className="w-12 h-12 bg-gray-700 rounded-full" />
              <div className="flex-1">
                <div className="h-4 bg-gray-700 rounded w-3/4 mb-2" />
                <div className="h-2 bg-gray-700 rounded w-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (candidates.length === 0) {
    return (
      <div className="bg-surface/90 rounded-xl border border-gray-700/50 p-5">
        <h3 className="text-lg font-headline font-semibold text-white mb-4">
          Leading Candidates
        </h3>
        <p className="text-gray-500 text-center py-8">No data available</p>
      </div>
    );
  }

  return (
    <div className="bg-surface/90 rounded-xl border border-gray-700/50 p-5 backdrop-blur">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-headline font-semibold text-white">
          Leading Candidates
        </h3>
        <span className="text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded">
          {electionName || 'Election'}
        </span>
      </div>

      {/* Candidate List */}
      <div className="space-y-4">
        {candidates.map((candidate, index) => {
          const partyColor = getPartyColor(candidate.party, candidate.partyColor);
          const isLeader = index === 0;

          return (
            <div
              key={candidate.candidateId}
              className={`
                relative rounded-lg p-3 transition-all
                ${isLeader ? 'bg-gray-800/80 ring-1 ring-accent-gold/30' : 'bg-gray-800/40'}
              `}
            >
              <div className="flex items-center gap-3">
                {/* Rank Badge */}
                <div className={`
                  w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
                  ${isLeader ? 'bg-accent-gold text-black' : 'bg-gray-700 text-gray-300'}
                `}>
                  {index + 1}
                </div>

                {/* Avatar */}
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-sm"
                  style={{
                    backgroundColor: partyColor + '40',
                    boxShadow: `0 0 0 2px ${partyColor}`,
                  }}
                >
                  {getInitials(candidate.candidateName)}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-white font-medium truncate">
                      {candidate.candidateName}
                    </span>
                    <span
                      className="px-1.5 py-0.5 text-[10px] font-bold rounded"
                      style={{
                        backgroundColor: partyColor + '30',
                        color: partyColor === '#FFFF00' ? '#FCD34D' : partyColor,
                      }}
                    >
                      {candidate.party}
                    </span>
                  </div>

                  {/* Vote Bar */}
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${candidate.percentage}%`,
                          backgroundColor: partyColor,
                          boxShadow: `0 0 10px ${partyColor}50`,
                        }}
                      />
                    </div>
                    <span className="text-sm font-mono text-white min-w-[50px] text-right">
                      {candidate.percentage.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Vote Count */}
              <div className="mt-2 pl-[76px]">
                <span className="text-xs text-gray-400">
                  {formatVotes(candidate.totalVotes)} votes
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
