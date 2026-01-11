import { useQuery } from '@tanstack/react-query';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface TurnoutData {
  year: number;
  turnout: number;
  name: string;
}

// Fallback data if cache is empty
const FALLBACK_DATA: TurnoutData[] = [
  { year: 2006, turnout: 69.2, name: '2006' },
  { year: 2011, turnout: 59.3, name: '2011' },
  { year: 2016, turnout: 67.6, name: '2016' },
  { year: 2021, turnout: 57.2, name: '2021' },
];

export function TurnoutTrendChart() {
  // Use useQuery to subscribe to cache updates from preloader
  // Returns fallback data if cache is empty, but will re-render when preloader populates cache
  const { data: turnoutData } = useQuery({
    queryKey: ['dashboardTurnoutData'],
    queryFn: () => Promise.resolve(FALLBACK_DATA), // Return fallback if no cache
    staleTime: Infinity, // Don't refetch automatically (preloader handles this)
    gcTime: Infinity, // Keep in cache forever
  });

  // Use fetched/cached data or fallback
  const data = turnoutData && turnoutData.length > 0 ? turnoutData : FALLBACK_DATA;

  return (
    <div className="bg-surface/90 rounded-xl border border-gray-700/50 p-5 backdrop-blur">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-headline font-semibold text-white">
          Turnout Trends
        </h3>
        <span className="text-xs text-gray-500">Presidential Elections</span>
      </div>

      <div className="h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
          >
            <defs>
              <linearGradient id="turnoutGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#00E5FF" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#00E5FF" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#374151"
              vertical={false}
            />
            <XAxis
              dataKey="name"
              stroke="#6B7280"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="#6B7280"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `${value}%`}
              domain={[0, 100]}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1F2937',
                border: '1px solid #374151',
                borderRadius: '8px',
                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)',
              }}
              labelStyle={{ color: '#9CA3AF' }}
              itemStyle={{ color: '#00E5FF' }}
              formatter={(value) => [`${(value as number).toFixed(1)}%`, 'Turnout']}
            />
            <Area
              type="monotone"
              dataKey="turnout"
              stroke="#00E5FF"
              strokeWidth={2}
              fill="url(#turnoutGradient)"
              dot={{
                fill: '#00E5FF',
                stroke: '#0A0E14',
                strokeWidth: 2,
                r: 4,
              }}
              activeDot={{
                fill: '#FFD700',
                stroke: '#0A0E14',
                strokeWidth: 2,
                r: 6,
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-3 text-xs text-gray-500">
        <div className="flex items-center gap-1">
          <div className="w-3 h-0.5 bg-accent-cyan rounded" />
          <span>Voter Turnout %</span>
        </div>
      </div>
    </div>
  );
}
