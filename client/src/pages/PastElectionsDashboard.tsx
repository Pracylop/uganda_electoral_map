import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Map,
  BarChart3,
  ChevronRight,
  Calendar,
  TrendingUp,
  Award,
} from 'lucide-react';
import { CandidateLeaderboard } from '../components/ui/CandidateLeaderboard';
import { TurnoutTrendChart } from '../components/ui/TurnoutTrendChart';
import { apiRequest } from '../lib/api';

interface Election {
  id: number;
  name: string;
  electionDate: string;
}

export function PastElectionsDashboard() {
  const queryClient = useQueryClient();

  // Fetch elections with useQuery - will use cache if available, otherwise fetch from API
  const { data: elections = [], isLoading: electionsLoading } = useQuery({
    queryKey: ['elections'],
    queryFn: () => apiRequest<Election[]>('/api/elections'),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  // Filter past presidential elections (exclude 2026)
  const pastPresidentialElections = elections
    .filter(e => {
      const year = new Date(e.electionDate).getFullYear();
      return e.name.toLowerCase().includes('presidential') && year < 2026;
    })
    .sort((a, b) => new Date(b.electionDate).getTime() - new Date(a.electionDate).getTime());

  // Get the latest presidential election with data from cache (if available)
  const cachedLatestId = queryClient.getQueryData<number | null>(['dashboardLatestElection']);

  // Election year selector - initialize to 2021 and update when data loads
  const [selectedYear, setSelectedYear] = useState<number>(2021);

  // Update selected year when data is available
  useEffect(() => {
    if (pastPresidentialElections.length > 0 && cachedLatestId) {
      const election = pastPresidentialElections.find(e => e.id === cachedLatestId);
      if (election) {
        const year = new Date(election.electionDate).getFullYear();
        setSelectedYear(year);
      }
    }
  }, [pastPresidentialElections, cachedLatestId]);

  const years = [...new Set(pastPresidentialElections.map(e => new Date(e.electionDate).getFullYear()))];

  return (
    <div className="flex-1 bg-base">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#00E5FF]/10 via-transparent to-[#FFD700]/5" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#00E5FF]/5 rounded-full blur-3xl" />

        <div className="relative px-6 py-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-[#00E5FF]/20 rounded-lg">
              <Calendar className="w-6 h-6" style={{ color: '#00E5FF' }} />
            </div>
            <span className="text-sm font-mono uppercase tracking-wider" style={{ color: '#00E5FF' }}>
              Historical Data
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-headline font-bold text-white mb-2">
            Past Elections
          </h1>
          <p className="text-gray-400 text-lg">
            Explore results, trends, and analysis from previous Ugandan elections
          </p>
        </div>
      </div>

      <div className="px-6 pb-8">
        {/* Year Selector */}
        <div className="flex items-center gap-4 mb-6">
          <span className="text-gray-400">Select Year:</span>
          <div className="flex gap-2">
            {electionsLoading ? (
              // Loading skeleton for year buttons
              <>
                <div className="w-16 h-10 bg-gray-700 rounded-lg animate-pulse" />
                <div className="w-16 h-10 bg-gray-700 rounded-lg animate-pulse" />
                <div className="w-16 h-10 bg-gray-700 rounded-lg animate-pulse" />
              </>
            ) : years.length > 0 ? (
              years.map(year => (
                <button
                  key={year}
                  onClick={() => setSelectedYear(year)}
                  className={`
                    px-4 py-2 rounded-lg font-medium transition-all
                    ${selectedYear === year
                      ? 'bg-[#00E5FF] text-black'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    }
                  `}
                >
                  {year}
                </button>
              ))
            ) : (
              <span className="text-gray-500">No elections available</span>
            )}
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Left Column - Leaderboard */}
          <div className="lg:col-span-1">
            <CandidateLeaderboard maxCandidates={5} />
          </div>

          {/* Right Column - Chart + Navigation */}
          <div className="lg:col-span-2 space-y-6">
            {/* Turnout Chart */}
            <TurnoutTrendChart />

            {/* Navigation Cards */}
            <div className="grid grid-cols-2 gap-4">
              <Link
                to="/elections/browse"
                className="group relative p-5 rounded-xl border transition-all duration-300
                         bg-[#00E5FF]/15 border-[#00E5FF]/40 hover:bg-[#00E5FF]/25 hover:border-[#00E5FF]/60
                         hover:shadow-[0_0_25px_rgba(0,229,255,0.2)]"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-[#00E5FF]/20" style={{ color: '#00E5FF' }}>
                      <BarChart3 className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-white font-semibold text-lg">View Results</h3>
                      <p className="text-gray-400 text-sm">Detailed statistics & tables</p>
                    </div>
                  </div>
                  <ChevronRight
                    className="w-5 h-5 opacity-50 group-hover:opacity-100 transition-opacity"
                    style={{ color: '#00E5FF' }}
                  />
                </div>
              </Link>

              <Link
                to="/elections/map"
                className="group relative p-5 rounded-xl border transition-all duration-300
                         bg-[#FFD700]/15 border-[#FFD700]/40 hover:bg-[#FFD700]/25 hover:border-[#FFD700]/60
                         hover:shadow-[0_0_25px_rgba(255,215,0,0.2)]"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-[#FFD700]/20" style={{ color: '#FFD700' }}>
                      <Map className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-white font-semibold text-lg">Interactive Map</h3>
                      <p className="text-gray-400 text-sm">Geographic visualization</p>
                    </div>
                  </div>
                  <ChevronRight
                    className="w-5 h-5 opacity-50 group-hover:opacity-100 transition-opacity"
                    style={{ color: '#FFD700' }}
                  />
                </div>
              </Link>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-surface/90 rounded-xl border border-gray-700/50 p-5">
            <div className="flex items-center gap-3 mb-2">
              <Calendar className="w-5 h-5 text-gray-500" />
              <span className="text-gray-400 text-sm">Elections</span>
            </div>
            {electionsLoading ? (
              <div className="h-8 w-12 bg-gray-700 rounded animate-pulse" />
            ) : (
              <p className="text-2xl font-bold text-white">{pastPresidentialElections.length}</p>
            )}
            <p className="text-xs text-gray-500">Presidential races</p>
          </div>

          <div className="bg-surface/90 rounded-xl border border-gray-700/50 p-5">
            <div className="flex items-center gap-3 mb-2">
              <TrendingUp className="w-5 h-5 text-gray-500" />
              <span className="text-gray-400 text-sm">Year Range</span>
            </div>
            {electionsLoading ? (
              <div className="h-8 w-24 bg-gray-700 rounded animate-pulse" />
            ) : (
              <p className="text-2xl font-bold text-white">
                {years.length > 0 ? `${Math.min(...years)}-${Math.max(...years)}` : 'N/A'}
              </p>
            )}
            <p className="text-xs text-gray-500">Coverage period</p>
          </div>

          <div className="bg-surface/90 rounded-xl border border-gray-700/50 p-5">
            <div className="flex items-center gap-3 mb-2">
              <Award className="w-5 h-5 text-gray-500" />
              <span className="text-gray-400 text-sm">Latest</span>
            </div>
            {electionsLoading ? (
              <div className="h-8 w-16 bg-gray-700 rounded animate-pulse" />
            ) : (
              <p className="text-2xl font-bold text-white">{years[0] || 'N/A'}</p>
            )}
            <p className="text-xs text-gray-500">Most recent election</p>
          </div>

          <div className="bg-surface/90 rounded-xl border border-gray-700/50 p-5">
            <div className="flex items-center gap-3 mb-2">
              <BarChart3 className="w-5 h-5 text-gray-500" />
              <span className="text-gray-400 text-sm">Data Points</span>
            </div>
            <p className="text-2xl font-bold text-white">146</p>
            <p className="text-xs text-gray-500">Districts covered</p>
          </div>
        </div>

        {/* Attribution Footer */}
        <div className="text-center py-6 border-t border-gray-800/50">
          <p className="text-gray-600 text-sm">
            Data sources: Uganda Electoral Commission
          </p>
        </div>
      </div>
    </div>
  );
}
