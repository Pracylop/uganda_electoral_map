// ============================================================================
// BROADCAST HOME - Main Dashboard View
// Layout: 12-column, 3-row grid (see BroadcastHome.layout.md)
// ============================================================================

import { useRef, useEffect, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useBroadcastStore } from '../../stores/broadcastStore';
import { UGANDA_CENTER } from '../../lib/mapStyles';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

// ============================================================================
// API HELPER
// ============================================================================
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

async function fetchApi(endpoint: string) {
  const response = await fetch(`${API_URL}${endpoint}`, {
    headers: {
      Authorization: `Bearer ${localStorage.getItem('auth_token')}`
    }
  });
  if (!response.ok) throw new Error(`API error: ${response.status}`);
  return response.json();
}

// ============================================================================
// TYPES
// ============================================================================
interface Election {
  id: number;
  name: string;
  year: number;
  electionTypeName: string;
}

interface NationalTotals {
  election: {
    id: number;
    name: string;
    year: number;
    type: string;
  };
  summary: {
    registeredVoters: number;
    totalVotes: number;
    validVotes: number;
    invalidVotes: number;
    reportingUnits: number;
    turnout: string | null;
  };
  candidates: {
    candidateId: number;
    name: string;
    party: string;
    partyName: string;
    partyColor: string;
    photoUrl: string | null;
    votes: number;
    percentage: string;
  }[];
  leader: {
    candidateId: number;
    name: string;
    party: string;
    partyName: string;
    partyColor: string;
    photoUrl: string | null;
    votes: number;
    percentage: string;
  } | null;
}

// ============================================================================
// DESIGN TOKENS
// ============================================================================
const COLORS = {
  background: '#0A0E14',
  card: 'rgba(22, 27, 34, 0.85)',
  cardBorder: 'rgba(0, 229, 255, 0.1)',
  cyan: '#00E5FF',
  gold: '#FFD700',
  red: '#EF4444',
  green: '#10B981',
  textPrimary: '#FFFFFF',
  textSecondary: '#8B949E',
  textMuted: '#484F58',
};

// ============================================================================
// GRID CELL COMPONENT
// ============================================================================
interface GridCellProps {
  id: string;
  label: string;
  isNavigation?: boolean;
  children?: React.ReactNode;
  noPadding?: boolean;
}

function GridCell({ id, label, isNavigation, children, noPadding }: GridCellProps) {
  return (
    <div
      className={`
        rounded-lg border overflow-hidden flex flex-col
        ${isNavigation ? 'cursor-pointer hover:brightness-110 transition-all duration-300' : ''}
      `}
      style={{
        backgroundColor: COLORS.card,
        borderColor: isNavigation ? `${COLORS.cyan}30` : COLORS.cardBorder,
      }}
    >
      {/* Cell Header */}
      <div
        className="px-3 py-2 border-b text-xs uppercase tracking-wider flex items-center justify-between"
        style={{
          borderColor: COLORS.cardBorder,
          color: COLORS.textMuted,
        }}
      >
        <span>{id}: {label}</span>
        {isNavigation && (
          <span style={{ color: COLORS.cyan, fontSize: '10px' }}>View →</span>
        )}
      </div>

      {/* Cell Content */}
      <div className={`flex-1 ${noPadding ? '' : 'p-3'} flex items-center justify-center`}>
        {children || (
          <span style={{ color: COLORS.textMuted }}>Content</span>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// A1: LEADING CANDIDATE CELL
// ============================================================================
interface LeadingCandidateCellProps {
  data: NationalTotals | null;
  loading: boolean;
  candidatePhoto?: string | null;
}

function LeadingCandidateCell({ data, loading, candidatePhoto }: LeadingCandidateCellProps) {
  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const leader = data?.leader;

  if (!leader) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center text-center p-3">
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center mb-3"
          style={{ backgroundColor: `${COLORS.cyan}15`, border: `3px dashed ${COLORS.cyan}40` }}
        >
          <span className="text-3xl" style={{ color: COLORS.cyan }}>?</span>
        </div>
        <div className="text-sm font-medium" style={{ color: COLORS.textSecondary }}>
          No Results
        </div>
      </div>
    );
  }

  // Get initials from name
  const initials = leader.name.split(' ').map(n => n[0]).join('').slice(0, 2);

  return (
    <div className="w-full h-full flex flex-col items-center p-3 overflow-hidden">
      {/* Photo container - 40% height */}
      <div className="flex items-center justify-center" style={{ height: '40%' }}>
        <div
          className="rounded-full flex items-center justify-center overflow-hidden aspect-square h-full"
          style={{
            backgroundColor: `${leader.partyColor || COLORS.gold}30`,
            border: `3px solid ${leader.partyColor || COLORS.gold}`,
          }}
        >
          {candidatePhoto ? (
            <img
              src={candidatePhoto}
              alt={leader.name}
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.nextElementSibling?.classList.remove('hidden');
              }}
            />
          ) : null}
          <span
            className={`text-3xl font-bold ${candidatePhoto ? 'hidden' : ''}`}
            style={{ color: leader.partyColor || COLORS.gold }}
          >
            {initials}
          </span>
        </div>
      </div>

      {/* Spacer - 15% between photo and name */}
      <div style={{ height: '15%' }} />

      {/* Name - part of 40% text area */}
      <div className="text-sm font-semibold text-white text-center leading-tight uppercase">
        {leader.name}
      </div>

      {/* Spacer - 5% between name and party */}
      <div style={{ height: '5%' }} />

      {/* Party - part of 40% text area */}
      <div
        className="text-xs text-center leading-tight uppercase"
        style={{ color: leader.partyColor || COLORS.textSecondary }}
      >
        {leader.partyName}
      </div>
    </div>
  );
}

// ============================================================================
// B1: CANDIDATE DETAILS CELL
// ============================================================================
interface CandidateDetailsCellProps {
  data: NationalTotals | null;
  loading: boolean;
  onShowCandidates?: () => void;
  source?: string;
}

function CandidateDetailsCell({ data, loading, onShowCandidates, source }: CandidateDetailsCellProps) {
  const { setViewMode, selectedElectionId } = useBroadcastStore();

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const leader = data?.leader;
  const election = data?.election;
  const summary = data?.summary;

  if (!leader) {
    return (
      <div className="w-full h-full flex flex-col justify-center p-4">
        <div className="text-lg font-semibold text-white mb-1">
          {election?.name || 'Election'}
        </div>
        <div className="text-sm mb-3" style={{ color: COLORS.textSecondary }}>
          No results available yet
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex p-4">
      {/* Left side - Info */}
      <div className="flex-1 flex flex-col justify-center">
        {/* Election Name */}
        <div className="text-base font-semibold text-white mb-0.5">
          {election?.name || 'Election'}
        </div>

        {/* Election Type & Winner Info */}
        <div className="text-xs mb-2" style={{ color: COLORS.textSecondary }}>
          <span>{election?.type}</span>
          <br />
          <span>Winner: {leader.name}</span>
          <br />
          <span>Votes: {leader.votes.toLocaleString()}</span>
        </div>

        {/* Large Percentage */}
        <div
          className="text-4xl font-bold font-mono mb-2"
          style={{ color: leader.partyColor || COLORS.gold }}
        >
          {leader.percentage}%
        </div>

        {/* Polling Stations */}
        <div className="text-xs" style={{ color: COLORS.textMuted }}>
          <span style={{ color: COLORS.textSecondary }}>Reported</span>
          <br />
          <span className="font-mono" style={{ color: COLORS.cyan }}>
            {summary?.reportingUnits?.toLocaleString() || 0} polling stations
          </span>
        </div>

        {/* Source attribution */}
        {source && (
          <div className="mt-1">
            <span className="text-[9px]" style={{ color: COLORS.textMuted }}>
              {source}
            </span>
          </div>
        )}
      </div>

      {/* Right side - Button */}
      <div className="flex flex-col justify-end">
        <button
          onClick={() => setViewMode('dashboard')}
          className="px-4 py-2 rounded text-sm font-medium transition-all hover:brightness-110 uppercase tracking-wide"
          style={{
            backgroundColor: `${COLORS.cyan}20`,
            color: COLORS.cyan,
            border: `1px solid ${COLORS.cyan}50`,
          }}
        >
          Details
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// C1: PARTY TOTALS CELL
// ============================================================================
interface PartyTotalsCellProps {
  data: NationalTotals | null;
  loading: boolean;
}

function PartyTotalsCell({ data, loading }: PartyTotalsCellProps) {
  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Get top 4 candidates (or fewer if not available)
  const candidates = data?.candidates?.slice(0, 4) || [];

  if (candidates.length === 0) {
    return (
      <div className="w-full h-full flex flex-col justify-center p-3">
        <div className="text-sm text-center" style={{ color: COLORS.textMuted }}>
          No party data available
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col justify-center p-3">
      <div className="space-y-2">
        {candidates.map((candidate) => (
          <div key={candidate.candidateId} className="flex items-center gap-2">
            <div
              className="w-12 text-xs font-medium truncate"
              style={{ color: candidate.partyColor || COLORS.textSecondary }}
              title={candidate.partyName}
            >
              {candidate.party || '?'}
            </div>
            <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ backgroundColor: `${COLORS.textMuted}30` }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${parseFloat(candidate.percentage)}%`,
                  backgroundColor: candidate.partyColor || COLORS.textMuted
                }}
              />
            </div>
            <div className="w-14 text-right text-xs font-mono" style={{ color: COLORS.textPrimary }}>
              {candidate.percentage}%
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// C2: PARLIAMENTARY PARTY TOTALS CELL - Uses Published Stats
// ============================================================================
interface PartySeats {
  abbreviation: string;
  name: string;
  color: string;
  logoUrl: string | null;
  seats: number;
}

function ParliamentaryTotalsCell() {
  const [partySeats, setPartySeats] = useState<PartySeats[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalSeats, setTotalSeats] = useState(0);
  const [source, setSource] = useState<string>('');

  // Party color mapping
  const partyColors: Record<string, string> = {
    'NRM': '#FFD700',
    'NUP': '#E50000',
    'FDC': '#003DA5',
    'DP': '#228B22',
    'UPC': '#FF6600',
    'ANT': '#800080',
    'JEEMA': '#006400',
    'PPP': '#4169E1',
    'UPDF': '#556B2F',
    'Independents': '#808080',
    'IND': '#808080',
    'Other': '#999999'
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        // Fetch published parliamentary data for 2021 (11th Parliament)
        const response = await fetchApi('/api/published/parliament/2021');

        if (!response || !response.partySeats) {
          setLoading(false);
          return;
        }

        // Transform party seats data
        const seats: PartySeats[] = response.partySeats
          .filter((p: { seats: number }) => p.seats > 0)
          .map((p: { partyAbbreviation: string; seats: number }) => ({
            abbreviation: p.partyAbbreviation,
            name: p.partyAbbreviation === 'Independents' ? 'Independent' : p.partyAbbreviation,
            color: partyColors[p.partyAbbreviation] || '#808080',
            logoUrl: null,
            seats: p.seats
          }))
          .sort((a: PartySeats, b: PartySeats) => b.seats - a.seats)
          .slice(0, 6); // Show top 6 parties

        setPartySeats(seats);
        setTotalSeats(response.totalSeats || seats.reduce((sum: number, p: PartySeats) => sum + p.seats, 0));
        setSource(response.source || 'Uganda Electoral Commission');
      } catch (err) {
        console.error('Error loading parliamentary data:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (partySeats.length === 0) {
    return (
      <div className="w-full h-full flex flex-col justify-center p-3">
        <div className="text-sm text-center" style={{ color: COLORS.textMuted }}>
          No parliamentary data available
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col justify-center p-3">
      <div className="space-y-2">
        {partySeats.map((party) => {
          const percentage = totalSeats > 0 ? (party.seats / totalSeats) * 100 : 0;

          return (
            <div key={party.abbreviation} className="flex items-center gap-2">
              {/* Party Logo/Color Circle */}
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden"
                style={{
                  backgroundColor: party.logoUrl ? 'transparent' : party.color,
                  border: `2px solid ${party.color}`,
                }}
              >
                {party.logoUrl ? (
                  <img
                    src={party.logoUrl}
                    alt={party.abbreviation}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-xs font-bold text-white">
                    {party.abbreviation.charAt(0)}
                  </span>
                )}
              </div>

              {/* Party Name */}
              <div
                className="w-12 text-xs font-medium truncate"
                style={{ color: party.color }}
                title={party.name}
              >
                {party.abbreviation}
              </div>

              {/* Progress Bar */}
              <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ backgroundColor: `${COLORS.textMuted}30` }}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${percentage}%`,
                    backgroundColor: party.color
                  }}
                />
              </div>

              {/* Seats Count */}
              <div className="w-10 text-right text-xs font-mono" style={{ color: COLORS.textPrimary }}>
                {party.seats}
              </div>
            </div>
          );
        })}
      </div>

      {/* Total, Source, and Details Button */}
      <div className="mt-2 pt-2 border-t" style={{ borderColor: COLORS.cardBorder }}>
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs" style={{ color: COLORS.textMuted }}>
              Total: {totalSeats} seats
            </span>
            {source && (
              <div className="text-[9px]" style={{ color: COLORS.textMuted }}>
                {source}
              </div>
            )}
          </div>
          <button
            className="px-3 py-1 text-xs font-medium rounded transition-colors"
            style={{
              backgroundColor: `${COLORS.cyan}20`,
              color: COLORS.cyan,
              border: `1px solid ${COLORS.cyan}40`
            }}
            onClick={() => {/* Navigate to parliamentary details */}}
          >
            DETAILS
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// D1: TURNOUT STATS CELL
// ============================================================================
interface TurnoutStatsCellProps {
  data: NationalTotals | null;
  loading: boolean;
}

function TurnoutStatsCell({ data, loading }: TurnoutStatsCellProps) {
  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const summary = data?.summary;
  const turnout = summary?.turnout ? parseFloat(summary.turnout) : 0;
  const totalVotes = summary?.totalVotes || 0;
  const registeredVoters = summary?.registeredVoters || 0;
  const reportingUnits = summary?.reportingUnits || 0;

  return (
    <div className="w-full h-full flex flex-col justify-center p-2">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs" style={{ color: COLORS.textSecondary }}>Turnout</span>
          <span className="text-sm font-mono font-bold" style={{ color: COLORS.cyan }}>
            {turnout.toFixed(1)}%
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs" style={{ color: COLORS.textSecondary }}>Total Votes</span>
          <span className="text-sm font-mono font-medium" style={{ color: COLORS.green }}>
            {totalVotes.toLocaleString()}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs" style={{ color: COLORS.textSecondary }}>Registered</span>
          <span className="text-sm font-mono" style={{ color: COLORS.textPrimary }}>
            {registeredVoters.toLocaleString()}
          </span>
        </div>
      </div>
      <div className="mt-2 pt-2 border-t" style={{ borderColor: COLORS.cardBorder }}>
        <div className="text-xs text-center" style={{ color: COLORS.textMuted }}>
          {reportingUnits.toLocaleString()} units reported
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// A2: DISTRICT STATISTICS CELL
// ============================================================================
interface DistrictStatsCellProps {
  data: NationalTotals | null;
  loading: boolean;
}

function DistrictStatsCell({ data, loading }: DistrictStatsCellProps) {
  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Mock district data - in real implementation, fetch top districts
  const districts = [
    { name: 'Kampala', votes: 456789, turnout: 72.3 },
    { name: 'Wakiso', votes: 389234, turnout: 68.5 },
    { name: 'Mukono', votes: 234567, turnout: 71.2 },
  ];

  return (
    <div className="w-full h-full flex flex-col justify-center p-2">
      <div className="space-y-3">
        {districts.map((district) => (
          <div key={district.name}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-white">{district.name}</span>
              <span className="text-xs font-mono" style={{ color: COLORS.cyan }}>
                {district.turnout}%
              </span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: `${COLORS.textMuted}30` }}>
              <div
                className="h-full rounded-full"
                style={{ width: `${district.turnout}%`, backgroundColor: COLORS.cyan }}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 pt-2 border-t text-center" style={{ borderColor: COLORS.cardBorder }}>
        <span className="text-xs" style={{ color: COLORS.textMuted }}>Top 3 Districts</span>
      </div>
    </div>
  );
}

// ============================================================================
// C2: ELECTION STATISTICS CELL (Donut Chart)
// ============================================================================
interface ElectionStatsCellProps {
  data: NationalTotals | null;
  loading: boolean;
}

function ElectionStatsCell({ data, loading }: ElectionStatsCellProps) {
  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const summary = data?.summary;
  const validVotes = summary?.validVotes || 0;
  const invalidVotes = summary?.invalidVotes || 0;
  const totalVotes = summary?.totalVotes || 0;

  const validPercent = totalVotes > 0 ? (validVotes / totalVotes) * 100 : 0;
  const invalidPercent = totalVotes > 0 ? (invalidVotes / totalVotes) * 100 : 0;

  return (
    <div className="w-full h-full flex items-center justify-center p-3">
      <div className="flex items-center gap-4">
        {/* Simple Donut representation */}
        <div className="relative w-20 h-20">
          <svg viewBox="0 0 36 36" className="w-full h-full">
            {/* Background circle */}
            <circle
              cx="18" cy="18" r="15.5"
              fill="none"
              stroke={COLORS.textMuted}
              strokeWidth="3"
              opacity="0.3"
            />
            {/* Valid votes arc */}
            <circle
              cx="18" cy="18" r="15.5"
              fill="none"
              stroke={COLORS.cyan}
              strokeWidth="3"
              strokeDasharray={`${validPercent} ${100 - validPercent}`}
              strokeDashoffset="25"
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs font-mono font-bold" style={{ color: COLORS.cyan }}>
              {validPercent.toFixed(0)}%
            </span>
          </div>
        </div>

        {/* Legend */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS.cyan }} />
            <span className="text-xs" style={{ color: COLORS.textSecondary }}>Valid</span>
            <span className="text-xs font-mono" style={{ color: COLORS.textPrimary }}>
              {validVotes.toLocaleString()}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS.red }} />
            <span className="text-xs" style={{ color: COLORS.textSecondary }}>Invalid</span>
            <span className="text-xs font-mono" style={{ color: COLORS.textPrimary }}>
              {invalidVotes.toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// D2: PAST ELECTIONS CELL - Historical Turnout Bar Graph (Uses Published Stats)
// ============================================================================
interface TurnoutData {
  year: number;
  turnout: number;
}

function PastElectionsCell() {
  const { setViewMode } = useBroadcastStore();
  const [turnoutData, setTurnoutData] = useState<TurnoutData[]>([]);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<string>('');

  useEffect(() => {
    const loadHistoricalTurnout = async () => {
      try {
        // Fetch all published elections (official turnout data)
        const response = await fetchApi('/api/published/elections');

        if (!response || response.length === 0) {
          setLoading(false);
          return;
        }

        // Extract turnout data from published elections
        const results: TurnoutData[] = response
          .filter((e: { electionType: string; turnoutPercentage: string }) =>
            e.electionType === 'Presidential' && e.turnoutPercentage
          )
          .map((e: { year: number; turnoutPercentage: string }) => ({
            year: e.year,
            turnout: parseFloat(e.turnoutPercentage) || 0
          }))
          .sort((a: TurnoutData, b: TurnoutData) => a.year - b.year);

        setTurnoutData(results);
        setSource('Uganda Electoral Commission');
      } catch (err) {
        console.error('Error loading historical turnout:', err);
      } finally {
        setLoading(false);
      }
    };

    loadHistoricalTurnout();
  }, []);

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Use truncated Y-axis scale (55-75%) to make differences visible
  const minScale = 55;
  const maxScale = 75;
  const scaleRange = maxScale - minScale;

  return (
    <div
      className="w-full h-full flex flex-col p-2 cursor-pointer group"
      onClick={() => setViewMode('comparison')}
    >
      {/* Title */}
      <div className="text-xs font-medium mb-1 text-center" style={{ color: COLORS.textSecondary }}>
        Voter Turnout (%)
      </div>

      {/* Bar Graph Container */}
      <div className="flex-1 flex items-end justify-center gap-3 pb-1">
        {turnoutData.map((data) => {
          // Calculate height using truncated scale (55-75%)
          const normalizedValue = Math.max(0, data.turnout - minScale);
          const barHeightPercent = (normalizedValue / scaleRange) * 18; // 18vh max
          return (
            <div key={data.year} className="flex flex-col items-center">
              {/* Turnout value above bar */}
              <span className="text-[10px] font-mono font-bold mb-1" style={{ color: COLORS.cyan }}>
                {data.turnout.toFixed(0)}%
              </span>
              {/* Bar */}
              <div
                className="w-8 rounded-t transition-all duration-500"
                style={{
                  height: `${barHeightPercent}vh`,
                  backgroundColor: COLORS.cyan,
                  opacity: data.year === 2021 ? 1 : 0.6
                }}
              />
              {/* Year label below bar */}
              <span className="text-[10px] mt-1 font-medium" style={{ color: COLORS.textMuted }}>
                {String(data.year).slice(-2)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Source attribution */}
      {source && (
        <div className="text-center">
          <span className="text-[8px]" style={{ color: COLORS.textMuted }}>
            {source}
          </span>
        </div>
      )}

      {/* Compare link */}
      <div className="text-center opacity-0 group-hover:opacity-100 transition-opacity">
        <span className="text-xs" style={{ color: COLORS.cyan }}>Compare →</span>
      </div>
    </div>
  );
}

// ============================================================================
// A3: ELECTION INCIDENTS CELL (Navigation) - Uses Published Stats
// ============================================================================
function ElectionIncidentsCell() {
  const { setViewMode } = useBroadcastStore();
  const [incidents, setIncidents] = useState<{
    deaths: number;
    injuries: number;
    arrests: number;
    source: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadIncidents = async () => {
      try {
        // Fetch 2021 published incident data
        const response = await fetchApi('/api/published/incidents/2021');
        setIncidents({
          deaths: response.deathsReported || 0,
          injuries: response.injuriesReported || 0,
          arrests: response.arrestsReported || 0,
          source: response.source || 'Human Rights Watch',
        });
      } catch (err) {
        console.error('Error loading incident data:', err);
        // Fallback to empty data
        setIncidents({ deaths: 0, injuries: 0, arrests: 0, source: '' });
      } finally {
        setLoading(false);
      }
    };

    loadIncidents();
  }, []);

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const totalCasualties = (incidents?.deaths || 0) + (incidents?.injuries || 0) + (incidents?.arrests || 0);

  return (
    <div
      className="w-full h-full flex flex-col justify-center p-2 cursor-pointer group"
      onClick={() => setViewMode('issues')}
    >
      <div className="text-center mb-2">
        <div className="text-2xl font-bold font-mono" style={{ color: COLORS.red }}>
          {totalCasualties > 0 ? `${totalCasualties}+` : '—'}
        </div>
        <div className="text-xs" style={{ color: COLORS.textSecondary }}>
          Casualties (2021)
        </div>
      </div>

      {/* Casualty breakdown */}
      <div className="flex gap-2 justify-center">
        <div className="flex flex-col items-center" title="Deaths">
          <div className="w-6 h-8 rounded flex items-center justify-center text-xs font-bold" style={{ backgroundColor: '#DC2626', color: 'white' }}>
            💀
          </div>
          <span className="text-xs mt-1 font-mono" style={{ color: COLORS.textMuted }}>{incidents?.deaths || 0}+</span>
        </div>
        <div className="flex flex-col items-center" title="Injuries">
          <div className="w-6 h-6 rounded flex items-center justify-center text-xs font-bold" style={{ backgroundColor: '#F59E0B', color: 'white' }}>
            🩹
          </div>
          <span className="text-xs mt-1 font-mono" style={{ color: COLORS.textMuted }}>{incidents?.injuries || 0}+</span>
        </div>
        <div className="flex flex-col items-center" title="Arrests">
          <div className="w-6 h-5 rounded flex items-center justify-center text-xs font-bold" style={{ backgroundColor: '#3B82F6', color: 'white' }}>
            🚔
          </div>
          <span className="text-xs mt-1 font-mono" style={{ color: COLORS.textMuted }}>{incidents?.arrests || 0}+</span>
        </div>
      </div>

      {/* Source attribution */}
      {incidents?.source && (
        <div className="mt-1 text-center">
          <span className="text-[9px]" style={{ color: COLORS.textMuted }}>
            Source: {incidents.source}
          </span>
        </div>
      )}

      <div className="mt-1 text-center opacity-0 group-hover:opacity-100 transition-opacity">
        <span className="text-xs" style={{ color: COLORS.cyan }}>View Map →</span>
      </div>
    </div>
  );
}

// ============================================================================
// B3: CANDIDATE CARDS CELL
// ============================================================================
interface CandidateCardsCellProps {
  data: NationalTotals | null;
  loading: boolean;
}

function CandidateCardsCell({ data, loading }: CandidateCardsCellProps) {
  const { setViewMode } = useBroadcastStore();

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Get top 3 candidates
  const candidates = data?.candidates?.slice(0, 3) || [];

  if (candidates.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <span className="text-sm" style={{ color: COLORS.textMuted }}>No candidates</span>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col p-2 overflow-hidden">
      {/* Cards Row - 80% of container */}
      <div className="flex items-center justify-center gap-3" style={{ height: '80%' }}>
        {candidates.map((candidate, index) => {
          const initials = candidate.name.split(' ').map(n => n[0]).join('').slice(0, 2);
          const isLeader = index === 0;

          return (
            <div
              key={candidate.candidateId}
              className="h-full flex flex-col items-center justify-between py-2 px-2 rounded-lg overflow-hidden"
              style={{
                backgroundColor: isLeader ? `${candidate.partyColor}15` : `${COLORS.textMuted}08`,
                border: `2px solid ${isLeader ? candidate.partyColor : COLORS.cardBorder}`,
                width: '28%',
              }}
            >
              {/* Photo container - 50% of card */}
              <div className="flex items-center justify-center" style={{ height: '50%' }}>
                <div
                  className="rounded-full flex items-center justify-center overflow-hidden aspect-square h-full"
                  style={{
                    backgroundColor: `${candidate.partyColor}30`,
                    border: `2px solid ${candidate.partyColor}`,
                  }}
                >
                  {candidate.photoUrl ? (
                    <img
                      src={candidate.photoUrl}
                      alt={candidate.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        e.currentTarget.nextElementSibling?.classList.remove('hidden');
                      }}
                    />
                  ) : null}
                  <span
                    className={`text-base font-bold ${candidate.photoUrl ? 'hidden' : ''}`}
                    style={{ color: candidate.partyColor }}
                  >
                    {initials}
                  </span>
                </div>
              </div>

              {/* Text container - 50% of card */}
              <div className="flex flex-col items-center justify-center" style={{ height: '50%' }}>
                {/* Name */}
                <div className="text-xs font-medium text-white text-center leading-tight uppercase">
                  {candidate.name.split(' ').slice(-1)[0]}
                </div>

                {/* Percentage */}
                <div
                  className="text-base font-bold font-mono"
                  style={{ color: candidate.partyColor }}
                >
                  {candidate.percentage}%
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Details Button Row - 20% of container */}
      <div className="flex justify-end items-center" style={{ height: '20%' }}>
        <button
          onClick={() => setViewMode('dashboard')}
          className="px-4 py-1.5 rounded text-sm font-medium transition-all hover:brightness-110 uppercase tracking-wide"
          style={{
            backgroundColor: `${COLORS.cyan}20`,
            color: COLORS.cyan,
            border: `1px solid ${COLORS.cyan}50`,
          }}
        >
          Details
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// C3: HISTORICAL RESULTS TREND CELL (using Recharts like TurnoutTrendChart)
// Uses Published Stats - Official EC Data
// ============================================================================
interface ChartDataPoint {
  year: string;
  winner: number;
  runnerUp: number;
  winnerName: string;
  runnerUpName: string;
}

function TrendChartCell() {
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<string>('');

  useEffect(() => {
    const loadHistoricalResults = async () => {
      try {
        // Fetch all published elections (official data)
        const response = await fetchApi('/api/published/elections');

        if (!response || response.length === 0) {
          setLoading(false);
          return;
        }

        // Filter presidential elections and extract winner/runner-up
        const results: ChartDataPoint[] = response
          .filter((e: { electionType: string; candidateResults?: unknown[] }) =>
            e.electionType === 'Presidential' && e.candidateResults && e.candidateResults.length >= 2
          )
          .map((e: {
            year: number;
            source: string;
            candidateResults: Array<{
              candidateName: string;
              percentage: string;
              position: number;
            }>;
          }) => {
            // Candidates are already sorted by position (1st, 2nd, etc.)
            const winner = e.candidateResults.find(c => c.position === 1);
            const runnerUp = e.candidateResults.find(c => c.position === 2);

            return {
              year: `'${String(e.year).slice(-2)}`,
              winner: winner ? parseFloat(winner.percentage) : 0,
              runnerUp: runnerUp ? parseFloat(runnerUp.percentage) : 0,
              winnerName: winner?.candidateName || '',
              runnerUpName: runnerUp?.candidateName || ''
            };
          })
          .sort((a: ChartDataPoint, b: ChartDataPoint) =>
            parseInt(a.year.replace("'", "")) - parseInt(b.year.replace("'", ""))
          );

        setChartData(results);
        setSource('Uganda Electoral Commission');
      } catch (err) {
        console.error('Error loading historical results:', err);
      } finally {
        setLoading(false);
      }
    };

    loadHistoricalResults();
  }, []);

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <span className="text-sm" style={{ color: COLORS.textMuted }}>No historical data</span>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col p-2">
      {/* Title */}
      <div className="text-xs mb-1" style={{ color: COLORS.textMuted }}>
        Presidential Results Trend
      </div>

      {/* Chart */}
      <div className="flex-1" style={{ minHeight: '120px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 10, right: 10, left: -15, bottom: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#374151"
              vertical={false}
            />
            <XAxis
              dataKey="year"
              stroke="#6B7280"
              fontSize={11}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="#6B7280"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `${value}%`}
              domain={[0, 100]}
              ticks={[0, 25, 50, 75, 100]}
            />
            <ReferenceLine
              y={50.1}
              stroke={COLORS.textMuted}
              strokeDasharray="5 5"
              strokeWidth={1}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1F2937',
                border: '1px solid #374151',
                borderRadius: '8px',
                fontSize: '11px',
              }}
              labelStyle={{ color: '#9CA3AF' }}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="winner"
              name="Winner"
              stroke={COLORS.gold}
              strokeWidth={2}
              isAnimationActive={false}
              dot={{
                fill: COLORS.gold,
                stroke: '#0A0E14',
                strokeWidth: 2,
                r: 4,
              }}
              activeDot={false}
            />
            <Line
              type="monotone"
              dataKey="runnerUp"
              name="2nd Place"
              stroke={COLORS.red}
              strokeWidth={2}
              isAnimationActive={false}
              dot={{
                fill: COLORS.red,
                stroke: '#0A0E14',
                strokeWidth: 2,
                r: 4,
              }}
              activeDot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Legend and Source */}
      <div className="flex justify-between items-center mt-1">
        <div className="flex gap-3">
          <div className="flex items-center gap-1">
            <div className="w-3 h-0.5 rounded" style={{ backgroundColor: COLORS.gold }} />
            <span className="text-xs" style={{ color: COLORS.textSecondary }}>Winner</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-0.5 rounded" style={{ backgroundColor: COLORS.red }} />
            <span className="text-xs" style={{ color: COLORS.textSecondary }}>2nd</span>
          </div>
        </div>
        {source && (
          <span className="text-[8px]" style={{ color: COLORS.textMuted }}>
            {source}
          </span>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// D3: DEMOGRAPHICS CELL (Navigation) - Uses Published Stats
// ============================================================================
function DemographicsCell() {
  const { setViewMode } = useBroadcastStore();
  const [demographics, setDemographics] = useState<{
    registeredVoters: number;
    turnout: number;
    source: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDemographics = async () => {
      try {
        // Fetch 2021 published election data for registered voters
        const response = await fetchApi('/api/published/elections/2021');
        setDemographics({
          registeredVoters: response.registeredVoters || 0,
          turnout: parseFloat(response.turnoutPercentage) || 0,
          source: response.source || 'Uganda Electoral Commission',
        });
      } catch (err) {
        console.error('Error loading demographics data:', err);
        setDemographics({ registeredVoters: 0, turnout: 0, source: '' });
      } finally {
        setLoading(false);
      }
    };

    loadDemographics();
  }, []);

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const registeredMillions = demographics?.registeredVoters ? (demographics.registeredVoters / 1000000).toFixed(1) : '—';

  return (
    <div
      className="w-full h-full flex flex-col justify-center p-2 cursor-pointer group"
      onClick={() => setViewMode('demographics')}
    >
      <div className="space-y-2">
        <div className="text-center">
          <div className="text-lg font-bold font-mono" style={{ color: COLORS.green }}>
            {registeredMillions}M
          </div>
          <div className="text-xs" style={{ color: COLORS.textSecondary }}>
            Registered Voters
          </div>
        </div>

        <div className="flex justify-between items-center px-1">
          <span className="text-xs" style={{ color: COLORS.textMuted }}>Turnout 2021</span>
          <span className="text-xs font-mono" style={{ color: COLORS.cyan }}>
            {demographics?.turnout ? `${demographics.turnout.toFixed(1)}%` : '—'}
          </span>
        </div>

        {/* Turnout bar */}
        <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: `${COLORS.textMuted}30` }}>
          <div
            className="h-full rounded-full"
            style={{
              width: `${demographics?.turnout || 0}%`,
              backgroundColor: COLORS.green
            }}
          />
        </div>

        {/* Source attribution */}
        {demographics?.source && (
          <div className="text-center">
            <span className="text-[9px]" style={{ color: COLORS.textMuted }}>
              {demographics.source}
            </span>
          </div>
        )}
      </div>

      <div className="mt-1 text-center opacity-0 group-hover:opacity-100 transition-opacity">
        <span className="text-xs" style={{ color: COLORS.cyan }}>Explore →</span>
      </div>
    </div>
  );
}

// ============================================================================
// HOME MAP COMPONENT (2026 Election Preview - No Basemap)
// ============================================================================

// Beautiful blue color for "no results" districts (from design mockup)
const MAP_BLUE = '#1E5F8A';

// Simple dark style without basemap tiles
const EMPTY_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {},
  layers: [
    {
      id: 'background',
      type: 'background',
      paint: {
        'background-color': COLORS.background,
      },
    },
  ],
};

function HomeMap() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isDataLoading, setIsDataLoading] = useState(false);

  const { setViewMode, setSelectedElectionId } = useBroadcastStore();

  // Initialize map with empty style (no basemap)
  useEffect(() => {
    if (map.current || !mapContainer.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: EMPTY_STYLE,
      center: UGANDA_CENTER,
      zoom: 5.5, // Zoomed out to show entire country
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
      dragPan: false,
      scrollZoom: false,
      doubleClickZoom: false,
      touchZoomRotate: false,
    });

    map.current.on('load', () => {
      setIsLoaded(true);
    });

    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
      map.current?.resize();
    });
    resizeObserver.observe(mapContainer.current);

    return () => {
      resizeObserver.disconnect();
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Load district boundaries (demographics GeoJSON for 2026 - no results yet)
  useEffect(() => {
    const mapInstance = map.current;
    if (!mapInstance || !isLoaded) return;

    const loadData = async () => {
      setIsDataLoading(true);

      try {
        // Fetch district boundaries from demographics endpoint
        const url = `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/demographics/geojson?level=2`;
        const response = await fetch(url, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('auth_token')}`
          }
        });

        if (!response.ok) throw new Error('Failed to load map data');

        const geojson = await response.json();

        // Remove existing layers
        try {
          if (mapInstance.getLayer('home-districts-fill')) mapInstance.removeLayer('home-districts-fill');
          if (mapInstance.getLayer('home-districts-outline')) mapInstance.removeLayer('home-districts-outline');
          if (mapInstance.getSource('home-districts')) mapInstance.removeSource('home-districts');
        } catch (e) {
          // Layers may not exist
        }

        // Add source
        mapInstance.addSource('home-districts', {
          type: 'geojson',
          data: geojson
        });

        // Add fill layer with beautiful blue color
        mapInstance.addLayer({
          id: 'home-districts-fill',
          type: 'fill',
          source: 'home-districts',
          paint: {
            'fill-color': MAP_BLUE,
            'fill-opacity': 0.85,
          }
        });

        // Add outline with lighter blue/cyan
        mapInstance.addLayer({
          id: 'home-districts-outline',
          type: 'line',
          source: 'home-districts',
          paint: {
            'line-color': COLORS.cyan,
            'line-width': 0.5,
            'line-opacity': 0.7,
          }
        });

        // Fit to Uganda bounds with generous padding to show entire country
        if (geojson.bbox) {
          mapInstance.fitBounds(
            [[geojson.bbox[0], geojson.bbox[1]], [geojson.bbox[2], geojson.bbox[3]]],
            { padding: { top: 50, bottom: 20, left: 20, right: 20 }, duration: 500 }
          );
        }
      } catch (err) {
        console.error('HomeMap: Error loading data:', err);
      } finally {
        setIsDataLoading(false);
      }
    };

    loadData();
  }, [isLoaded]);

  // Handle click - navigate to 2026 electoral map
  const handleMapClick = () => {
    // Find and set 2026 election, then switch to map view
    // For now, we'll fetch elections and find 2026
    const openElectoralMap = async () => {
      try {
        const response = await fetch(
          `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/elections`,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem('auth_token')}`
            }
          }
        );
        const elections = await response.json();

        // Find 2026 Presidential election
        const election2026 = elections.find(
          (e: { name: string }) => e.name.includes('2026')
        );

        if (election2026) {
          setSelectedElectionId(election2026.id);
        }

        // Switch to map view
        setViewMode('map');
      } catch (err) {
        console.error('Error opening electoral map:', err);
        // Still switch to map view even if election fetch fails
        setViewMode('map');
      }
    };

    openElectoralMap();
  };

  return (
    <div
      className="relative w-full h-full cursor-pointer group"
      onClick={handleMapClick}
    >
      <div ref={mapContainer} className="w-full h-full" />

      {/* Hover overlay */}
      <div className="absolute inset-0 bg-cyan-500/0 group-hover:bg-cyan-500/10 transition-colors duration-300 pointer-events-none" />

      {/* Click hint */}
      <div className="absolute bottom-2 right-2 px-2 py-1 rounded text-xs bg-black/50 text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        Click to open 2026 Electoral Map
      </div>

      {/* Loading indicator */}
      {isDataLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 pointer-events-none">
          <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

// Party color mapping for published stats
const PARTY_COLORS: Record<string, string> = {
  'NRM': '#FFD700',
  'NUP': '#E50000',
  'FDC': '#003DA5',
  'DP': '#228B22',
  'UPC': '#FF6600',
  'ANT': '#800080',
  'JEEMA': '#006400',
  'PPP': '#4169E1',
  'IND': '#808080',
};

export function BroadcastHome() {
  const [nationalData, setNationalData] = useState<NationalTotals | null>(null);
  const [loading, setLoading] = useState(true);
  const [dataSource, setDataSource] = useState<string>('');

  // Fetch 2021 Presidential Election data - merge published stats with candidate photos
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);

        // First, get elections and find 2021 Presidential for candidate photos
        const elections = await fetchApi('/api/elections');
        const election2021 = elections.find(
          (e: Election) => e.name.includes('2021') && e.electionTypeName === 'Presidential'
        );

        // Fetch candidate data for photos and party details
        interface CandidatePhotoData {
          photoUrl: string | null;
          partyColor: string;
          partyName: string;
          allNameParts: string[];
        }
        const candidatePhotosList: CandidatePhotoData[] = [];

        if (election2021) {
          try {
            const calculatedData = await fetchApi(`/api/map/national/${election2021.id}`);
            if (calculatedData?.candidates) {
              // Store all candidates with their name parts for flexible matching
              calculatedData.candidates.forEach((c: {
                name: string;
                photoUrl: string | null;
                partyColor: string;
                partyName: string;
              }) => {
                // Split name into parts for flexible matching
                const nameParts = c.name.toUpperCase().split(' ').filter(p => p.length > 2);
                candidatePhotosList.push({
                  photoUrl: c.photoUrl,
                  partyColor: c.partyColor,
                  partyName: c.partyName,
                  allNameParts: nameParts,
                });
              });
            }
          } catch (err) {
            console.warn('Could not fetch candidate photos:', err);
          }
        }

        // Helper function to find matching candidate by name parts
        const findCandidatePhoto = (publishedName: string): CandidatePhotoData | null => {
          const searchParts = publishedName.toUpperCase().split(' ').filter(p => p.length > 2);

          // Find candidate with most matching name parts
          let bestMatch: CandidatePhotoData | null = null;
          let bestMatchCount = 0;

          for (const candidate of candidatePhotosList) {
            const matchCount = searchParts.filter(part =>
              candidate.allNameParts.includes(part)
            ).length;

            if (matchCount > bestMatchCount && matchCount >= 2) {
              bestMatchCount = matchCount;
              bestMatch = candidate;
            }
          }

          return bestMatch;
        };

        // Try published stats for official numbers
        try {
          const published = await fetchApi('/api/published/elections/2021');

          if (published && published.candidateResults && published.candidateResults.length > 0) {
            // Transform published data, merging with candidate photos
            const candidates = published.candidateResults.map((c: {
              candidateName: string;
              partyAbbreviation: string | null;
              votes: number;
              percentage: string;
              position: number;
            }) => {
              // Find matching candidate by name parts (handles different name orders)
              const photoData = findCandidatePhoto(c.candidateName);

              return {
                candidateId: c.position,
                name: c.candidateName,
                party: c.partyAbbreviation || 'IND',
                partyName: photoData?.partyName || c.partyAbbreviation || 'Independent',
                partyColor: photoData?.partyColor || PARTY_COLORS[c.partyAbbreviation || 'IND'] || '#808080',
                photoUrl: photoData?.photoUrl || null,
                votes: c.votes,
                percentage: c.percentage,
              };
            });

            const leader = candidates.find((c: { candidateId: number }) => c.candidateId === 1) || candidates[0];

            const nationalTotals: NationalTotals = {
              election: {
                id: election2021?.id || 0,
                name: `${published.year} Presidential Election`,
                year: published.year,
                type: published.electionType,
              },
              summary: {
                registeredVoters: published.registeredVoters,
                totalVotes: published.totalVotesCast,
                validVotes: published.validVotes,
                invalidVotes: published.invalidVotes,
                reportingUnits: published.pollingStations || 0,
                turnout: published.turnoutPercentage,
              },
              candidates,
              leader,
            };

            setNationalData(nationalTotals);
            setDataSource(published.source || 'Uganda Electoral Commission');
            return;
          }
        } catch (pubErr) {
          console.warn('Published stats not available, falling back to calculated:', pubErr);
        }

        // Fallback to calculated data only
        if (!election2021) {
          console.warn('2021 Presidential election not found');
          setLoading(false);
          return;
        }

        const data = await fetchApi(`/api/map/national/${election2021.id}`);
        setNationalData(data);
        setDataSource('Calculated from records');
      } catch (err) {
        console.error('Error loading election data:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  return (
    <div
      className="w-full h-full overflow-y-auto p-4"
      style={{ backgroundColor: COLORS.background }}
    >
      {/* 12-Column, 3-Row Grid */}
      <div
        className="w-full grid gap-4"
        style={{
          gridTemplateColumns: '2fr 4fr 4fr 2fr',
          gridTemplateRows: '30vh 40vh 30vh',
        }}
      >
        {/* ============================================================ */}
        {/* ROW 1 (TOP) - 30% height - Header Section */}
        {/* ============================================================ */}

        {/* A1: Leading Candidate - Photo, name, party */}
        <GridCell id="A1" label="Leading Candidate">
          <LeadingCandidateCell
            data={nationalData}
            loading={loading}
            candidatePhoto={nationalData?.leader?.photoUrl}
          />
        </GridCell>

        {/* B1: Election Details - Election info, percentage, reporting */}
        <GridCell id="B1" label="Election Details">
          <CandidateDetailsCell data={nationalData} loading={loading} source={dataSource} />
        </GridCell>

        {/* C1: Candidate Cards - Top 3 candidates (moved from B3) */}
        <GridCell id="C1" label="Candidate Cards">
          <CandidateCardsCell data={nationalData} loading={loading} />
        </GridCell>

        {/* D1: Election Incidents - Issues overview (moved from A3) */}
        <GridCell id="D1" label="Election Incidents" isNavigation>
          <ElectionIncidentsCell />
        </GridCell>

        {/* ============================================================ */}
        {/* ROW 2 (MIDDLE) - 40% height - Main Content */}
        {/* ============================================================ */}

        {/* A2: District Statistics - Vote counts for key regions */}
        <GridCell id="A2" label="District Statistics">
          <DistrictStatsCell data={nationalData} loading={loading} />
        </GridCell>

        {/* B2: Map - Interactive Uganda map */}
        <GridCell id="B2" label="Map" noPadding>
          <HomeMap />
        </GridCell>

        {/* C2: Parliamentary Party Totals - Seats by party */}
        <GridCell id="C2" label="Parliamentary Seats">
          <ParliamentaryTotalsCell />
        </GridCell>

        {/* D2: Past Elections - Historical comparison (NAVIGATION) */}
        <GridCell id="D2" label="Past Elections" isNavigation>
          <PastElectionsCell />
        </GridCell>

        {/* ============================================================ */}
        {/* ROW 3 (BOTTOM) - 30% height - Secondary Content */}
        {/* ============================================================ */}

        {/* A3: Turnout Stats - Key percentages (moved from D1) */}
        <GridCell id="A3" label="Turnout Stats">
          <TurnoutStatsCell data={nationalData} loading={loading} />
        </GridCell>

        {/* B3: Election Statistics - Pie/donut charts (moved from C2) */}
        <GridCell id="B3" label="Election Statistics">
          <ElectionStatsCell data={nationalData} loading={loading} />
        </GridCell>

        {/* C3: Trend Chart - Results over time */}
        <GridCell id="C3" label="Trend Chart">
          <TrendChartCell />
        </GridCell>

        {/* D3: Demographics - Population overview (NAVIGATION) */}
        <GridCell id="D3" label="Demographics" isNavigation>
          <DemographicsCell />
        </GridCell>
      </div>
    </div>
  );
}

export default BroadcastHome;
