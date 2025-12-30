import { useState, useEffect } from 'react';
import { api } from '../lib/api';

interface PartySummary {
  partyId: number | null;
  partyName: string;
  abbreviation: string;
  color: string;
  seatsWon: number;
  percentage: number;
}

interface PartySummaryData {
  electionId: number;
  electionName: string;
  electoralLevel: number;
  totalSeats: number;
  partySummary: PartySummary[];
}

interface PartySummaryWidgetProps {
  electionId: number;
  compact?: boolean;
}

export function PartySummaryWidget({ electionId, compact = false }: PartySummaryWidgetProps) {
  const [data, setData] = useState<PartySummaryData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPartySummary();
  }, [electionId]);

  const loadPartySummary = async () => {
    try {
      setIsLoading(true);
      const result = await api.getPartySummary(electionId);
      setData(result);
      setError(null);
    } catch (err) {
      console.error('Failed to load party summary:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-gray-800 rounded-lg p-4">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-700 rounded w-1/2 mb-4"></div>
          <div className="space-y-2">
            <div className="h-8 bg-gray-700 rounded"></div>
            <div className="h-8 bg-gray-700 rounded"></div>
            <div className="h-8 bg-gray-700 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-800 rounded-lg p-4">
        <p className="text-red-400 text-sm">{error}</p>
      </div>
    );
  }

  if (!data || data.partySummary.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg p-4">
        <p className="text-gray-400 text-sm">No party summary available</p>
      </div>
    );
  }

  // For compact mode, show only top 5 parties
  const displayParties = compact ? data.partySummary.slice(0, 5) : data.partySummary;

  return (
    <div className="bg-gray-800 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gray-700 px-4 py-3">
        <h3 className="text-lg font-bold text-white">
          {compact ? 'Party Seats' : 'Seats Won by Party'}
        </h3>
        {!compact && (
          <p className="text-gray-400 text-sm">
            {data.totalSeats} total seats
          </p>
        )}
      </div>

      {/* Party List */}
      <div className="p-4 space-y-3">
        {displayParties.map((party, index) => (
          <div key={party.partyId ?? 'ind'} className="flex items-center gap-3">
            {/* Rank */}
            {!compact && (
              <span className="text-gray-500 text-sm w-6">{index + 1}.</span>
            )}

            {/* Party Color */}
            <div
              className="w-4 h-4 rounded-full flex-shrink-0"
              style={{ backgroundColor: party.color }}
            />

            {/* Party Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <span className="text-white font-medium truncate">
                  {compact ? party.abbreviation : party.partyName}
                </span>
                <span className="text-white font-bold ml-2">
                  {party.seatsWon}
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div
                  className="h-2 rounded-full transition-all duration-500"
                  style={{
                    width: `${party.percentage}%`,
                    backgroundColor: party.color
                  }}
                />
              </div>

              {/* Percentage */}
              <div className="text-gray-400 text-xs mt-1 text-right">
                {party.percentage.toFixed(1)}%
              </div>
            </div>
          </div>
        ))}

        {/* Show more indicator in compact mode */}
        {compact && data.partySummary.length > 5 && (
          <p className="text-gray-500 text-xs text-center pt-2">
            +{data.partySummary.length - 5} more parties
          </p>
        )}
      </div>

      {/* Footer with total */}
      {!compact && (
        <div className="bg-gray-700 px-4 py-3 flex justify-between items-center">
          <span className="text-gray-300">Total Seats</span>
          <span className="text-white font-bold text-lg">{data.totalSeats}</span>
        </div>
      )}
    </div>
  );
}
