/**
 * Compact Reporting Progress Overlay
 * Shows % of polling stations/admin units that have reported
 * Designed to be displayed on top of the map
 */

import { useNationalTotals } from '../../hooks/useElectionData';

interface ReportingProgressProps {
  electionId: number | null;
}

export function ReportingProgress({ electionId }: ReportingProgressProps) {
  const { data, isLoading } = useNationalTotals(electionId ?? 0);

  if (!electionId || isLoading || !data) {
    return null;
  }

  const { reportingAreas, totalAreas, reportingPercentage } = data;

  // Determine color based on percentage
  const getProgressColor = (pct: number) => {
    if (pct >= 90) return 'bg-green-500';
    if (pct >= 50) return 'bg-yellow-500';
    if (pct >= 25) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const progressColor = getProgressColor(reportingPercentage);

  return (
    <div className="absolute bottom-4 left-4 z-10">
      <div className="bg-gray-900/90 backdrop-blur-sm rounded-lg px-4 py-3 shadow-xl border border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 mb-2">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Reporting
          </span>
          <div className="flex items-center gap-1">
            <div className={`w-2 h-2 rounded-full ${progressColor} animate-pulse`} />
            <span className="text-lg font-bold text-white">
              {reportingPercentage.toFixed(1)}%
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-48 h-2 bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full ${progressColor} transition-all duration-1000 ease-out`}
            style={{ width: `${reportingPercentage}%` }}
          />
        </div>

        {/* Stats */}
        <div className="mt-2 flex items-center justify-between text-xs">
          <span className="text-gray-400">
            {reportingAreas.toLocaleString()} / {totalAreas.toLocaleString()}
          </span>
          <span className="text-gray-500">
            {totalAreas - reportingAreas > 0
              ? `${(totalAreas - reportingAreas).toLocaleString()} pending`
              : 'Complete'}
          </span>
        </div>
      </div>
    </div>
  );
}
