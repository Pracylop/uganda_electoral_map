import { Link } from 'react-router-dom';
import {
  Users,
  AlertTriangle,
  Vote,
  ChevronRight,
  Zap,
} from 'lucide-react';
import { DashboardStats } from '../components/ui/DashboardStats';
import { CandidateLeaderboard } from '../components/ui/CandidateLeaderboard';
import { TurnoutTrendChart } from '../components/ui/TurnoutTrendChart';
import { useAuthStore } from '../stores/authStore';

export function Dashboard() {
  const { user } = useAuthStore();

  return (
    <div className="flex-1 bg-base">
      {/* Hero Section with animated gradient */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-accent-cyan/10 via-transparent to-accent-gold/5" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-accent-cyan/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent-gold/5 rounded-full blur-3xl" />

        <div className="relative px-6 py-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-accent-cyan/20 rounded-lg">
              <Zap className="w-6 h-6 text-accent-cyan" />
            </div>
            <span className="text-accent-cyan text-sm font-mono uppercase tracking-wider">
              Live Dashboard
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-headline font-bold text-white mb-2">
            Uganda Electoral Map
          </h1>
          <p className="text-gray-400 text-lg">
            Welcome back, <span className="text-white">{user?.fullName?.split(' ')[0] || 'User'}</span>
          </p>
        </div>
      </div>

      <div className="px-6 pb-8">
        {/* Statistics Section */}
        <div className="mb-8">
          <DashboardStats />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Left Column - Leaderboard */}
          <div className="lg:col-span-1">
            <CandidateLeaderboard maxCandidates={5} />
          </div>

          {/* Right Column - Chart + Quick Actions */}
          <div className="lg:col-span-2 space-y-6">
            {/* Turnout Chart */}
            <TurnoutTrendChart />

            {/* Quick Actions Grid */}
            <div className="grid grid-cols-2 gap-4">
              <QuickNavCard
                title="2026 Elections"
                subtitle="Current Election Data"
                icon={<Zap className="w-6 h-6" />}
                to="/elections/2026"
                color="gold"
              />
              <QuickNavCard
                title="Past Elections"
                subtitle="Historical Analysis"
                icon={<Vote className="w-6 h-6" />}
                to="/elections/past"
                color="cyan"
              />
              <QuickNavCard
                title="Demographics"
                subtitle="Population & Voters"
                icon={<Users className="w-6 h-6" />}
                to="/demographics"
                color="cyan"
              />
              <QuickNavCard
                title="Incidents"
                subtitle="Electoral Irregularities"
                icon={<AlertTriangle className="w-6 h-6" />}
                to="/incidents"
                color="gold"
              />
            </div>
          </div>
        </div>

        {/* Attribution Footer */}
        <div className="text-center py-6 border-t border-gray-800/50">
          <p className="text-gray-600 text-sm">
            Data sources: Uganda Electoral Commission, Uganda Bureau of Statistics
          </p>
        </div>
      </div>
    </div>
  );
}

// Quick Navigation Card Component
interface QuickNavCardProps {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  to: string;
  color: 'cyan' | 'gold';
}

function QuickNavCard({ title, subtitle, icon, to, color }: QuickNavCardProps) {
  const styles = {
    cyan: {
      iconColor: '#00E5FF',
      bg: 'bg-[#00E5FF]/15 hover:bg-[#00E5FF]/25',
      border: 'border-[#00E5FF]/40 hover:border-[#00E5FF]/60',
      iconBg: 'bg-[#00E5FF]/20',
      glow: 'hover:shadow-[0_0_25px_rgba(0,229,255,0.2)]',
    },
    gold: {
      iconColor: '#FFD700',
      bg: 'bg-[#FFD700]/15 hover:bg-[#FFD700]/25',
      border: 'border-[#FFD700]/40 hover:border-[#FFD700]/60',
      iconBg: 'bg-[#FFD700]/20',
      glow: 'hover:shadow-[0_0_25px_rgba(255,215,0,0.2)]',
    },
  };

  const s = styles[color];

  return (
    <Link
      to={to}
      className={`
        group relative p-5 rounded-xl border transition-all duration-300
        ${s.bg} ${s.border} ${s.glow}
      `}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-xl ${s.iconBg}`} style={{ color: s.iconColor }}>
            {icon}
          </div>
          <div>
            <h3 className="text-white font-semibold text-lg">{title}</h3>
            <p className="text-gray-400 text-sm">{subtitle}</p>
          </div>
        </div>
        <ChevronRight
          className="w-5 h-5 opacity-50 group-hover:opacity-100 transition-opacity"
          style={{ color: s.iconColor }}
        />
      </div>
    </Link>
  );
}

