import { usePartySummary } from '../../hooks/useElectionData';

interface ComparisonChartsProps {
  leftElectionId: number | null;
  rightElectionId: number | null;
  leftElectionName?: string;
  rightElectionName?: string;
}

interface PartyData {
  partyId: number | null;
  partyName: string;
  abbreviation: string;
  color: string;
  seatsWon: number;
  percentage: number;
}

export function ComparisonCharts({
  leftElectionId,
  rightElectionId,
  leftElectionName,
  rightElectionName,
}: ComparisonChartsProps) {
  const { data: leftData, isLoading: leftLoading } = usePartySummary(leftElectionId);
  const { data: rightData, isLoading: rightLoading } = usePartySummary(rightElectionId);

  if (leftLoading || rightLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-400">Loading chart data...</div>
      </div>
    );
  }

  const leftParties = leftData?.partySummary || [];
  const rightParties = rightData?.partySummary || [];

  // Get top 5 parties from each election
  const topLeftParties = leftParties.slice(0, 5);
  const topRightParties = rightParties.slice(0, 5);

  return (
    <div className="h-full flex flex-col bg-gray-900 p-6 overflow-auto">
      {/* Header */}
      <h2 className="text-xl font-bold text-white mb-6 text-center">Party Comparison</h2>

      <div className="flex-1 flex gap-8">
        {/* Left Election Chart */}
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-yellow-400 mb-4 text-center">
            {leftElectionName || 'Election 1'}
          </h3>

          {/* Pie Chart */}
          <div className="flex justify-center mb-6">
            <PieChart parties={topLeftParties} size={180} />
          </div>

          {/* Bar Chart */}
          <div className="space-y-3">
            {topLeftParties.map((party: PartyData) => (
              <PartyBar key={party.partyId ?? 'ind'} party={party} />
            ))}
          </div>

          {/* Total Seats */}
          <div className="mt-4 pt-4 border-t border-gray-700 text-center">
            <span className="text-gray-400">Total Seats: </span>
            <span className="text-white font-bold">{leftData?.totalSeats || 0}</span>
          </div>
        </div>

        {/* Divider */}
        <div className="w-px bg-gray-700" />

        {/* Right Election Chart */}
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-green-400 mb-4 text-center">
            {rightElectionName || 'Election 2'}
          </h3>

          {/* Pie Chart */}
          <div className="flex justify-center mb-6">
            <PieChart parties={topRightParties} size={180} />
          </div>

          {/* Bar Chart */}
          <div className="space-y-3">
            {topRightParties.map((party: PartyData) => (
              <PartyBar key={party.partyId ?? 'ind'} party={party} />
            ))}
          </div>

          {/* Total Seats */}
          <div className="mt-4 pt-4 border-t border-gray-700 text-center">
            <span className="text-gray-400">Total Seats: </span>
            <span className="text-white font-bold">{rightData?.totalSeats || 0}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Horizontal bar for party votes
function PartyBar({ party }: { party: PartyData }) {
  return (
    <div className="flex items-center gap-3">
      {/* Party abbreviation */}
      <div
        className="w-12 h-8 flex items-center justify-center rounded text-xs font-bold text-gray-900"
        style={{ backgroundColor: party.color || '#666' }}
      >
        {party.abbreviation || 'IND'}
      </div>

      {/* Bar container */}
      <div className="flex-1 h-8 bg-gray-800 rounded overflow-hidden relative">
        {/* Fill bar */}
        <div
          className="h-full transition-all duration-500"
          style={{
            width: `${Math.min(party.percentage, 100)}%`,
            backgroundColor: party.color || '#666',
          }}
        />
        {/* Percentage text */}
        <div className="absolute inset-0 flex items-center justify-end pr-2">
          <span className="text-white text-sm font-semibold drop-shadow-lg">
            {party.percentage.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Seats count */}
      <div className="w-12 text-right text-white font-bold">
        {party.seatsWon}
      </div>
    </div>
  );
}

// SVG Pie chart
function PieChart({ parties, size = 200 }: { parties: PartyData[]; size?: number }) {
  const total = parties.reduce((sum, p) => sum + p.seatsWon, 0);
  if (total === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-full bg-gray-800 text-gray-500"
        style={{ width: size, height: size }}
      >
        No data
      </div>
    );
  }

  const radius = size / 2;
  const innerRadius = radius * 0.6; // Donut hole
  let currentAngle = -90; // Start at top

  const segments = parties.map((party) => {
    const percentage = (party.seatsWon / total) * 100;
    const angle = (percentage / 100) * 360;
    const startAngle = currentAngle;
    const endAngle = currentAngle + angle;
    currentAngle = endAngle;

    return {
      ...party,
      startAngle,
      endAngle,
      percentage,
    };
  });

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {segments.map((segment, index) => (
        <PieSegment
          key={segment.partyId ?? `ind-${index}`}
          cx={radius}
          cy={radius}
          radius={radius - 5}
          innerRadius={innerRadius}
          startAngle={segment.startAngle}
          endAngle={segment.endAngle}
          color={segment.color || '#666'}
        />
      ))}
      {/* Center text */}
      <text
        x={radius}
        y={radius - 10}
        textAnchor="middle"
        className="fill-white text-2xl font-bold"
      >
        {total}
      </text>
      <text
        x={radius}
        y={radius + 15}
        textAnchor="middle"
        className="fill-gray-400 text-sm"
      >
        seats
      </text>
    </svg>
  );
}

// Single pie segment
function PieSegment({
  cx,
  cy,
  radius,
  innerRadius,
  startAngle,
  endAngle,
  color,
}: {
  cx: number;
  cy: number;
  radius: number;
  innerRadius: number;
  startAngle: number;
  endAngle: number;
  color: string;
}) {
  // Convert angles to radians
  const startRad = (startAngle * Math.PI) / 180;
  const endRad = (endAngle * Math.PI) / 180;

  // Calculate points
  const x1 = cx + radius * Math.cos(startRad);
  const y1 = cy + radius * Math.sin(startRad);
  const x2 = cx + radius * Math.cos(endRad);
  const y2 = cy + radius * Math.sin(endRad);
  const x3 = cx + innerRadius * Math.cos(endRad);
  const y3 = cy + innerRadius * Math.sin(endRad);
  const x4 = cx + innerRadius * Math.cos(startRad);
  const y4 = cy + innerRadius * Math.sin(startRad);

  // Large arc flag
  const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0;

  // Path for donut segment
  const path = [
    `M ${x1} ${y1}`,
    `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
    `L ${x3} ${y3}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${x4} ${y4}`,
    'Z',
  ].join(' ');

  return <path d={path} fill={color} stroke="#1f2937" strokeWidth="2" />;
}
