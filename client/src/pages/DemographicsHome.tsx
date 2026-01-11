import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Map,
  BarChart3,
  ChevronRight,
  Users,
  UserCheck,
  Home,
  TrendingUp,
} from 'lucide-react';
import { api } from '../lib/api';

interface NationalStats {
  totalPopulation: number;
  malePopulation: number;
  femalePopulation: number;
  votingAgePopulation: number;
  youthPopulation: number;
  elderlyPopulation: number;
  numberOfHouseholds: number;
  parishCount: number;
}

interface DistrictSummary {
  districtId: number;
  districtName: string;
  totalPopulation: number;
  votingAgePopulation: number;
}

export function DemographicsHome() {
  const [nationalStats, setNationalStats] = useState<NationalStats | null>(null);
  const [topDistricts, setTopDistricts] = useState<DistrictSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const data = await api.getDemographicsStats();
        setNationalStats(data.national);

        // Sort districts by population and take top 10
        const sorted = [...data.districts]
          .sort((a: DistrictSummary, b: DistrictSummary) => b.totalPopulation - a.totalPopulation)
          .slice(0, 10);
        setTopDistricts(sorted);
      } catch (err) {
        console.error('Failed to load demographics:', err);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  const formatNumber = (n: number) => n.toLocaleString();
  const formatMillions = (n: number) => `${(n / 1000000).toFixed(1)}M`;
  const formatPercent = (n: number, total: number) =>
    total > 0 ? ((n / total) * 100).toFixed(1) + '%' : '0%';

  return (
    <div className="flex-1 bg-base">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#00E5FF]/10 via-transparent to-[#FFD700]/5" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#00E5FF]/5 rounded-full blur-3xl" />

        <div className="relative px-6 py-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-[#00E5FF]/20 rounded-lg">
              <Users className="w-6 h-6" style={{ color: '#00E5FF' }} />
            </div>
            <span className="text-sm font-mono uppercase tracking-wider" style={{ color: '#00E5FF' }}>
              Census Data
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-headline font-bold text-white mb-2">
            Demographics
          </h1>
          <p className="text-gray-400 text-lg">
            Population statistics and voter demographics from the 2024 Census
          </p>
        </div>
      </div>

      <div className="px-6 pb-8">
        {/* National Statistics Cards */}
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-surface/90 rounded-xl border border-gray-700/50 p-5 animate-pulse">
                <div className="h-4 bg-gray-700 rounded w-24 mb-3" />
                <div className="h-8 bg-gray-700 rounded w-16" />
              </div>
            ))}
          </div>
        ) : nationalStats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <StatCard
              icon={<Users className="w-5 h-5" />}
              iconColor="#00E5FF"
              label="Total Population"
              value={formatMillions(nationalStats.totalPopulation)}
              subtext={formatNumber(nationalStats.totalPopulation)}
            />
            <StatCard
              icon={<UserCheck className="w-5 h-5" />}
              iconColor="#10B981"
              label="Voting Age (18+)"
              value={formatMillions(nationalStats.votingAgePopulation)}
              subtext={formatPercent(nationalStats.votingAgePopulation, nationalStats.totalPopulation) + ' of total'}
            />
            <StatCard
              icon={<Home className="w-5 h-5" />}
              iconColor="#A855F7"
              label="Households"
              value={formatMillions(nationalStats.numberOfHouseholds)}
              subtext={formatNumber(nationalStats.numberOfHouseholds)}
            />
            <StatCard
              icon={<TrendingUp className="w-5 h-5" />}
              iconColor="#F59E0B"
              label="Gender Ratio"
              value={`${formatPercent(nationalStats.malePopulation, nationalStats.totalPopulation)} M`}
              subtext={`${formatPercent(nationalStats.femalePopulation, nationalStats.totalPopulation)} Female`}
            />
          </div>
        )}

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Left Column - Top Districts */}
          <div className="lg:col-span-1">
            <div className="bg-surface/90 rounded-xl border border-gray-700/50 p-5">
              <h2 className="text-lg font-headline font-semibold text-white mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-gray-400" />
                Top 10 Districts
              </h2>
              <div className="space-y-3">
                {topDistricts.map((district, index) => {
                  const maxPop = topDistricts[0]?.totalPopulation || 1;
                  const barWidth = (district.totalPopulation / maxPop) * 100;

                  return (
                    <div key={district.districtId} className="group">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500 w-4">{index + 1}</span>
                          <span className="text-sm text-white font-medium">{district.districtName}</span>
                        </div>
                        <span className="text-xs text-gray-400">
                          {formatNumber(district.totalPopulation)}
                        </span>
                      </div>
                      <div className="w-full bg-gray-700/50 rounded-full h-1.5">
                        <div
                          className="h-1.5 rounded-full bg-gradient-to-r from-[#00E5FF] to-[#00E5FF]/60"
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              <Link
                to="/demographics/stats"
                className="mt-4 block text-center text-sm text-[#00E5FF] hover:text-[#00E5FF]/80 transition-colors"
              >
                View all districts →
              </Link>
            </div>
          </div>

          {/* Right Column - Navigation + Quick Stats */}
          <div className="lg:col-span-2 space-y-6">
            {/* Navigation Cards */}
            <div className="grid grid-cols-2 gap-4">
              <Link
                to="/demographics/map"
                className="group relative p-5 rounded-xl border transition-all duration-300
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
                  <ChevronRight
                    className="w-5 h-5 opacity-50 group-hover:opacity-100 transition-opacity"
                    style={{ color: '#00E5FF' }}
                  />
                </div>
              </Link>

              <Link
                to="/demographics/stats"
                className="group relative p-5 rounded-xl border transition-all duration-300
                         bg-[#FFD700]/15 border-[#FFD700]/40 hover:bg-[#FFD700]/25 hover:border-[#FFD700]/60
                         hover:shadow-[0_0_25px_rgba(255,215,0,0.2)]"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-[#FFD700]/20" style={{ color: '#FFD700' }}>
                      <BarChart3 className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-white font-semibold text-lg">Statistics</h3>
                      <p className="text-gray-400 text-sm">Detailed data & rankings</p>
                    </div>
                  </div>
                  <ChevronRight
                    className="w-5 h-5 opacity-50 group-hover:opacity-100 transition-opacity"
                    style={{ color: '#FFD700' }}
                  />
                </div>
              </Link>
            </div>

            {/* Age Distribution Summary */}
            {nationalStats && (
              <div className="bg-surface/90 rounded-xl border border-gray-700/50 p-5">
                <h2 className="text-lg font-headline font-semibold text-white mb-4">
                  Age Distribution
                </h2>
                <div className="grid grid-cols-3 gap-4">
                  <AgeGroupCard
                    label="Youth (0-17)"
                    value={nationalStats.youthPopulation}
                    total={nationalStats.totalPopulation}
                    color="#3B82F6"
                  />
                  <AgeGroupCard
                    label="Voting Age (18-59)"
                    value={nationalStats.votingAgePopulation - nationalStats.elderlyPopulation}
                    total={nationalStats.totalPopulation}
                    color="#10B981"
                  />
                  <AgeGroupCard
                    label="Elderly (60+)"
                    value={nationalStats.elderlyPopulation}
                    total={nationalStats.totalPopulation}
                    color="#F59E0B"
                  />
                </div>

                {/* Visual Bar */}
                <div className="mt-4 flex h-4 rounded-full overflow-hidden">
                  <div
                    className="bg-blue-500"
                    style={{ width: `${(nationalStats.youthPopulation / nationalStats.totalPopulation) * 100}%` }}
                  />
                  <div
                    className="bg-emerald-500"
                    style={{ width: `${((nationalStats.votingAgePopulation - nationalStats.elderlyPopulation) / nationalStats.totalPopulation) * 100}%` }}
                  />
                  <div
                    className="bg-amber-500"
                    style={{ width: `${(nationalStats.elderlyPopulation / nationalStats.totalPopulation) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Attribution Footer */}
        <div className="text-center py-6 border-t border-gray-800/50">
          <p className="text-gray-600 text-sm">
            Data source: Uganda Bureau of Statistics - 2024 National Census
          </p>
        </div>
      </div>
    </div>
  );
}

// Stat Card Component
interface StatCardProps {
  icon: React.ReactNode;
  iconColor: string;
  label: string;
  value: string;
  subtext: string;
}

function StatCard({ icon, iconColor, label, value, subtext }: StatCardProps) {
  return (
    <div className="bg-surface/90 rounded-xl border border-gray-700/50 p-5">
      <div className="flex items-center gap-3 mb-2">
        <div style={{ color: iconColor }}>{icon}</div>
        <span className="text-gray-400 text-sm">{label}</span>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-xs text-gray-500">{subtext}</p>
    </div>
  );
}

// Age Group Card Component
interface AgeGroupCardProps {
  label: string;
  value: number;
  total: number;
  color: string;
}

function AgeGroupCard({ label, value, total, color }: AgeGroupCardProps) {
  const percent = total > 0 ? ((value / total) * 100).toFixed(1) : '0';
  const millions = (value / 1000000).toFixed(1);

  return (
    <div className="text-center">
      <div className="text-2xl font-bold text-white">{percent}%</div>
      <div className="text-sm text-gray-400">{label}</div>
      <div className="text-xs mt-1" style={{ color }}>{millions}M</div>
    </div>
  );
}

export default DemographicsHome;
