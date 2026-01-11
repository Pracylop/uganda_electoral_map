import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  Map,
  BarChart3,
  ChevronRight,
  Zap,
  Users,
  FileEdit,
  ClipboardCheck,
  Vote,
  Calendar,
  AlertCircle,
  Plus,
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { apiRequest } from '../lib/api';

interface Election {
  id: number;
  name: string;
  electionDate: string;
  isActive: boolean;
  _count?: { candidates: number; results: number };
}

export function CurrentElectionDashboard() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [pendingCount, setPendingCount] = useState(0);
  const [elections2026, setElections2026] = useState<Election[]>([]);
  const [selectedElection, setSelectedElection] = useState<Election | null>(null);

  const isOperator = user?.role === 'operator' || user?.role === 'editor' || user?.role === 'admin';
  const isEditor = user?.role === 'editor' || user?.role === 'admin';

  // Get 2026 elections from cache or fetch
  useEffect(() => {
    const allElections = queryClient.getQueryData<Election[]>(['elections']) || [];
    const filtered = allElections.filter(e => {
      const year = new Date(e.electionDate).getFullYear();
      return year === 2026;
    });
    setElections2026(filtered);

    // Select presidential by default
    const presidential = filtered.find(e => e.name.toLowerCase().includes('presidential'));
    setSelectedElection(presidential || filtered[0] || null);
  }, [queryClient]);

  // Fetch pending count for editors
  useEffect(() => {
    if (isEditor) {
      const fetchPending = async () => {
        try {
          const data = await apiRequest<{ total: number }>('/api/results/pending');
          setPendingCount(data.total || 0);
        } catch {
          // ignore
        }
      };
      fetchPending();
    }
  }, [isEditor]);

  return (
    <div className="flex-1 bg-base">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#FFD700]/15 via-transparent to-[#00E5FF]/5" />
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#FFD700]/10 rounded-full blur-3xl" />

        <div className="relative px-6 py-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-[#FFD700]/20 rounded-lg">
              <Zap className="w-6 h-6" style={{ color: '#FFD700' }} />
            </div>
            <span className="text-sm font-mono uppercase tracking-wider" style={{ color: '#FFD700' }}>
              Current Election
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-headline font-bold text-white mb-2">
            2026 Elections
          </h1>
          <p className="text-gray-400 text-lg">
            Track progress, enter data, and monitor the upcoming elections
          </p>
        </div>
      </div>

      <div className="px-6 pb-8">
        {/* Election Type Selector */}
        {elections2026.length > 0 && (
          <div className="flex items-center gap-4 mb-6">
            <span className="text-gray-400">Election Type:</span>
            <div className="flex gap-2 flex-wrap">
              {elections2026.map(election => (
                <button
                  key={election.id}
                  onClick={() => setSelectedElection(election)}
                  className={`
                    px-4 py-2 rounded-lg font-medium transition-all text-sm
                    ${selectedElection?.id === election.id
                      ? 'bg-[#FFD700] text-black'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    }
                  `}
                >
                  {election.name.replace('2026 ', '')}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Status Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-surface/90 rounded-xl border border-gray-700/50 p-5">
            <div className="flex items-center gap-3 mb-2">
              <Calendar className="w-5 h-5" style={{ color: '#FFD700' }} />
              <span className="text-gray-400 text-sm">Election Date</span>
            </div>
            <p className="text-xl font-bold text-white">
              {selectedElection
                ? new Date(selectedElection.electionDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                : 'TBD'
              }
            </p>
          </div>

          <div className="bg-surface/90 rounded-xl border border-gray-700/50 p-5">
            <div className="flex items-center gap-3 mb-2">
              <Users className="w-5 h-5" style={{ color: '#00E5FF' }} />
              <span className="text-gray-400 text-sm">Candidates</span>
            </div>
            <p className="text-2xl font-bold text-white">
              {selectedElection?._count?.candidates || 0}
            </p>
            <p className="text-xs text-gray-500">Registered</p>
          </div>

          <div className="bg-surface/90 rounded-xl border border-gray-700/50 p-5">
            <div className="flex items-center gap-3 mb-2">
              <Vote className="w-5 h-5" style={{ color: '#00E5FF' }} />
              <span className="text-gray-400 text-sm">Results</span>
            </div>
            <p className="text-2xl font-bold text-white">
              {selectedElection?._count?.results?.toLocaleString() || 0}
            </p>
            <p className="text-xs text-gray-500">Entries recorded</p>
          </div>

          <div className="bg-surface/90 rounded-xl border border-gray-700/50 p-5">
            <div className="flex items-center gap-3 mb-2">
              <AlertCircle className="w-5 h-5" style={{ color: pendingCount > 0 ? '#FFD700' : '#6B7280' }} />
              <span className="text-gray-400 text-sm">Pending</span>
            </div>
            <p className="text-2xl font-bold text-white">{pendingCount}</p>
            <p className="text-xs text-gray-500">Awaiting approval</p>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* View Data Section */}
          <div>
            <h2 className="text-lg font-headline font-semibold text-white mb-4 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-gray-400" />
              View Data
            </h2>
            <div className="space-y-4">
              <Link
                to={selectedElection ? `/elections/${selectedElection.id}` : '#'}
                className={`group block p-5 rounded-xl border transition-all duration-300
                         bg-[#00E5FF]/15 border-[#00E5FF]/40 hover:bg-[#00E5FF]/25 hover:border-[#00E5FF]/60
                         hover:shadow-[0_0_25px_rgba(0,229,255,0.2)]
                         ${!selectedElection ? 'opacity-50 pointer-events-none' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-[#00E5FF]/20" style={{ color: '#00E5FF' }}>
                      <BarChart3 className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-white font-semibold text-lg">View Results</h3>
                      <p className="text-gray-400 text-sm">Statistics & detailed breakdown</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 opacity-50 group-hover:opacity-100 transition-opacity" style={{ color: '#00E5FF' }} />
                </div>
              </Link>

              <Link
                to="/elections/map?year=2026"
                className="group block p-5 rounded-xl border transition-all duration-300
                         bg-[#00E5FF]/15 border-[#00E5FF]/40 hover:bg-[#00E5FF]/25 hover:border-[#00E5FF]/60
                         hover:shadow-[0_0_25px_rgba(0,229,255,0.2)]"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-[#00E5FF]/20" style={{ color: '#00E5FF' }}>
                      <Map className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-white font-semibold text-lg">Interactive Map</h3>
                      <p className="text-gray-400 text-sm">Geographic visualization</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 opacity-50 group-hover:opacity-100 transition-opacity" style={{ color: '#00E5FF' }} />
                </div>
              </Link>
            </div>
          </div>

          {/* Data Entry Section (for operators/editors) */}
          {isOperator && (
            <div>
              <h2 className="text-lg font-headline font-semibold text-white mb-4 flex items-center gap-2">
                <FileEdit className="w-5 h-5 text-gray-400" />
                Data Entry
              </h2>
              <div className="space-y-4">
                {isEditor && (
                  <Link
                    to={selectedElection ? `/elections/${selectedElection.id}/candidates` : '#'}
                    className={`group block p-5 rounded-xl border transition-all duration-300
                             bg-[#FFD700]/15 border-[#FFD700]/40 hover:bg-[#FFD700]/25 hover:border-[#FFD700]/60
                             hover:shadow-[0_0_25px_rgba(255,215,0,0.2)]
                             ${!selectedElection ? 'opacity-50 pointer-events-none' : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="p-3 rounded-xl bg-[#FFD700]/20" style={{ color: '#FFD700' }}>
                          <Plus className="w-6 h-6" />
                        </div>
                        <div>
                          <h3 className="text-white font-semibold text-lg">Manage Candidates</h3>
                          <p className="text-gray-400 text-sm">Add or edit candidates</p>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 opacity-50 group-hover:opacity-100 transition-opacity" style={{ color: '#FFD700' }} />
                    </div>
                  </Link>
                )}

                <Link
                  to={selectedElection ? `/elections/${selectedElection.id}/enter-results` : '#'}
                  className={`group block p-5 rounded-xl border transition-all duration-300
                           bg-[#FFD700]/15 border-[#FFD700]/40 hover:bg-[#FFD700]/25 hover:border-[#FFD700]/60
                           hover:shadow-[0_0_25px_rgba(255,215,0,0.2)]
                           ${!selectedElection ? 'opacity-50 pointer-events-none' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-xl bg-[#FFD700]/20" style={{ color: '#FFD700' }}>
                        <FileEdit className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="text-white font-semibold text-lg">Enter Results</h3>
                        <p className="text-gray-400 text-sm">Submit election results</p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 opacity-50 group-hover:opacity-100 transition-opacity" style={{ color: '#FFD700' }} />
                  </div>
                </Link>

                {isEditor && (
                  <Link
                    to="/approval-queue"
                    className="group block p-5 rounded-xl border transition-all duration-300
                             bg-[#FFD700]/15 border-[#FFD700]/40 hover:bg-[#FFD700]/25 hover:border-[#FFD700]/60
                             hover:shadow-[0_0_25px_rgba(255,215,0,0.2)]"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="p-3 rounded-xl bg-[#FFD700]/20" style={{ color: '#FFD700' }}>
                          <ClipboardCheck className="w-6 h-6" />
                        </div>
                        <div>
                          <h3 className="text-white font-semibold text-lg flex items-center gap-2">
                            Approval Queue
                            {pendingCount > 0 && (
                              <span className="px-2 py-0.5 text-xs font-bold bg-amber-500/30 text-amber-400 rounded-full animate-pulse">
                                {pendingCount}
                              </span>
                            )}
                          </h3>
                          <p className="text-gray-400 text-sm">Review pending results</p>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 opacity-50 group-hover:opacity-100 transition-opacity" style={{ color: '#FFD700' }} />
                    </div>
                  </Link>
                )}
              </div>
            </div>
          )}

          {/* For non-operators, show a placeholder */}
          {!isOperator && (
            <div className="bg-surface/50 rounded-xl border border-gray-700/50 p-8 flex items-center justify-center">
              <div className="text-center">
                <AlertCircle className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-400 mb-2">Data Entry Restricted</h3>
                <p className="text-gray-500 text-sm">
                  Contact an administrator for access to data entry features
                </p>
              </div>
            </div>
          )}
        </div>

        {/* No Elections Message */}
        {elections2026.length === 0 && (
          <div className="bg-surface/50 rounded-xl border border-gray-700/50 p-12 text-center mb-8">
            <Calendar className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-300 mb-2">No 2026 Elections Found</h3>
            <p className="text-gray-500 mb-4">
              2026 election data has not been set up yet.
            </p>
            {isEditor && (
              <Link
                to="/elections/browse"
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#FFD700] text-black rounded-lg font-medium hover:bg-[#FFD700]/90 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Create Election
              </Link>
            )}
          </div>
        )}

        {/* Attribution Footer */}
        <div className="text-center py-6 border-t border-gray-800/50">
          <p className="text-gray-600 text-sm">
            Uganda Electoral Commission - 2026 General Elections
          </p>
        </div>
      </div>
    </div>
  );
}
