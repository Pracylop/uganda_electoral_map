// ============================================================================
// PAST ELECTIONS BROADCAST HOME - Historical Election Comparison
// Layout: 12-column, 3-row grid (see PastElectionsBroadcastHome.layout.md)
// ============================================================================

import { useEffect, useState, useRef } from 'react';
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

interface PresidentialElection {
  id: number;
  year: number;
  name: string;
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

// Presidential election mapping
const PRESIDENTIAL_ELECTIONS: PresidentialElection[] = [
  { id: 10, year: 2001, name: '2001 Presidential Election' },
  { id: 11, year: 2006, name: '2006 Presidential Election' },
  { id: 3, year: 2011, name: '2011 Presidential Election' },
  { id: 1, year: 2016, name: '2016 Presidential Election' },
  { id: 2, year: 2021, name: '2021 Presidential Election' },
];

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
      <div className={`flex-1 ${noPadding ? '' : 'p-3'} flex items-center justify-center overflow-hidden`}>
        {children || (
          <span style={{ color: COLORS.textMuted }}>Content</span>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// A1: YEAR SELECTOR CELL
// ============================================================================
interface YearSelectorCellProps {
  selectedYear: number;
  onYearChange: (year: number) => void;
}

function YearSelectorCell({ selectedYear, onYearChange }: YearSelectorCellProps) {
  const years = [2021, 2016, 2011, 2006, 2001];

  return (
    <div className="w-full h-full flex flex-col justify-center p-2">
      <div className="space-y-2">
        {years.map((year) => (
          <button
            key={year}
            onClick={() => onYearChange(year)}
            className={`
              w-full py-2 px-3 rounded text-sm font-medium transition-all
              ${selectedYear === year
                ? 'text-black'
                : 'hover:brightness-125'
              }
            `}
            style={{
              backgroundColor: selectedYear === year ? COLORS.cyan : `${COLORS.textMuted}20`,
              color: selectedYear === year ? '#000' : COLORS.textSecondary,
              border: `1px solid ${selectedYear === year ? COLORS.cyan : COLORS.cardBorder}`,
            }}
          >
            {year}
          </button>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// B1: WINNER SHOWCASE CELL
// ============================================================================
interface WinnerShowcaseCellProps {
  data: NationalTotals | null;
  loading: boolean;
}

function WinnerShowcaseCell({ data, loading }: WinnerShowcaseCellProps) {
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
      <div className="w-full h-full flex items-center justify-center">
        <span className="text-sm" style={{ color: COLORS.textMuted }}>No winner data</span>
      </div>
    );
  }

  const initials = leader.name.split(' ').map(n => n[0]).join('').slice(0, 2);

  return (
    <div className="w-full h-full flex p-4 gap-4">
      {/* Photo - 40% height, left side */}
      <div className="flex items-center justify-center" style={{ width: '35%' }}>
        <div
          className="rounded-full flex items-center justify-center overflow-hidden aspect-square h-4/5"
          style={{
            backgroundColor: `${leader.partyColor || COLORS.gold}30`,
            border: `4px solid ${leader.partyColor || COLORS.gold}`,
          }}
        >
          {leader.photoUrl ? (
            <img
              src={leader.photoUrl}
              alt={leader.name}
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.nextElementSibling?.classList.remove('hidden');
              }}
            />
          ) : null}
          <span
            className={`text-4xl font-bold ${leader.photoUrl ? 'hidden' : ''}`}
            style={{ color: leader.partyColor || COLORS.gold }}
          >
            {initials}
          </span>
        </div>
      </div>

      {/* Info - right side */}
      <div className="flex-1 flex flex-col justify-center">
        <div className="text-xl font-bold text-white mb-1">{leader.name}</div>
        <div
          className="text-sm mb-3"
          style={{ color: leader.partyColor || COLORS.textSecondary }}
        >
          {leader.partyName}
        </div>

        {/* Progress bar */}
        <div className="mb-2">
          <div className="h-3 rounded-full overflow-hidden" style={{ backgroundColor: `${COLORS.textMuted}30` }}>
            <div
              className="h-full rounded-full"
              style={{
                width: `${parseFloat(leader.percentage)}%`,
                backgroundColor: leader.partyColor || COLORS.gold
              }}
            />
          </div>
        </div>

        {/* Percentage and votes */}
        <div className="flex items-baseline gap-3">
          <span
            className="text-3xl font-bold font-mono"
            style={{ color: leader.partyColor || COLORS.gold }}
          >
            {leader.percentage}%
          </span>
          <span className="text-sm" style={{ color: COLORS.textSecondary }}>
            {leader.votes.toLocaleString()} votes
          </span>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// C1: TOP CANDIDATES CELL
// ============================================================================
interface TopCandidatesCellProps {
  data: NationalTotals | null;
  loading: boolean;
}

function TopCandidatesCell({ data, loading }: TopCandidatesCellProps) {
  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Get top 3 candidates (skip first as it's the winner shown in B1)
  const candidates = data?.candidates?.slice(0, 3) || [];

  if (candidates.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <span className="text-sm" style={{ color: COLORS.textMuted }}>No candidates</span>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex items-center justify-center gap-3 p-2">
      {candidates.map((candidate, index) => {
        const initials = candidate.name.split(' ').map(n => n[0]).join('').slice(0, 2);
        const isWinner = index === 0;

        return (
          <div
            key={candidate.candidateId}
            className="h-full flex flex-col items-center justify-between py-2 px-2 rounded-lg"
            style={{
              backgroundColor: isWinner ? `${candidate.partyColor}15` : `${COLORS.textMuted}08`,
              border: `2px solid ${isWinner ? candidate.partyColor : COLORS.cardBorder}`,
              width: '30%',
            }}
          >
            {/* Photo - 45% */}
            <div className="flex items-center justify-center" style={{ height: '45%' }}>
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
                  />
                ) : (
                  <span
                    className="text-lg font-bold"
                    style={{ color: candidate.partyColor }}
                  >
                    {initials}
                  </span>
                )}
              </div>
            </div>

            {/* Info - 55% */}
            <div className="flex flex-col items-center justify-center text-center" style={{ height: '55%' }}>
              <div className="text-xs font-medium text-white leading-tight mb-1">
                {candidate.name.split(' ').slice(-1)[0]}
              </div>
              <div
                className="text-xs mb-1"
                style={{ color: candidate.partyColor }}
              >
                {candidate.party}
              </div>
              <div
                className="text-lg font-bold font-mono"
                style={{ color: candidate.partyColor }}
              >
                {candidate.percentage}%
              </div>
            </div>
          </div>
        );
      })}
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

  return (
    <div className="w-full h-full flex flex-col justify-center p-2">
      {/* Turnout header */}
      <div className="text-center mb-2">
        <div className="text-xs uppercase tracking-wider mb-1" style={{ color: COLORS.textMuted }}>
          Turnout
        </div>
        <div className="text-2xl font-bold font-mono" style={{ color: COLORS.cyan }}>
          {turnout.toFixed(1)}%
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 rounded-full overflow-hidden mb-3" style={{ backgroundColor: `${COLORS.textMuted}30` }}>
        <div
          className="h-full rounded-full"
          style={{ width: `${turnout}%`, backgroundColor: COLORS.cyan }}
        />
      </div>

      {/* Stats */}
      <div className="space-y-1">
        <div className="flex justify-between items-center">
          <span className="text-xs" style={{ color: COLORS.textMuted }}>Total</span>
          <span className="text-xs font-mono" style={{ color: COLORS.green }}>
            {(totalVotes / 1000000).toFixed(1)}M
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs" style={{ color: COLORS.textMuted }}>Registered</span>
          <span className="text-xs font-mono" style={{ color: COLORS.textPrimary }}>
            {(registeredVoters / 1000000).toFixed(1)}M
          </span>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// A2: ELECTION LIST CELL
// ============================================================================
interface ElectionListCellProps {
  selectedYear: number;
}

function ElectionListCell({ selectedYear }: ElectionListCellProps) {
  const [elections, setElections] = useState<Election[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadElections = async () => {
      try {
        const data = await fetchApi('/api/elections');
        // Filter elections by year
        const yearElections = data.filter((e: Election) =>
          e.name.includes(String(selectedYear))
        );
        setElections(yearElections);
      } catch (err) {
        console.error('Error loading elections:', err);
      } finally {
        setLoading(false);
      }
    };

    loadElections();
  }, [selectedYear]);

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col p-2 overflow-y-auto">
      <div className="text-xs uppercase tracking-wider mb-2" style={{ color: COLORS.textMuted }}>
        {selectedYear} Elections
      </div>
      <div className="space-y-1">
        {elections.map((election) => (
          <div
            key={election.id}
            className="px-2 py-1.5 rounded text-xs truncate"
            style={{
              backgroundColor: election.electionTypeName === 'Presidential'
                ? `${COLORS.gold}20`
                : `${COLORS.textMuted}10`,
              color: election.electionTypeName === 'Presidential'
                ? COLORS.gold
                : COLORS.textSecondary,
            }}
            title={election.name}
          >
            {election.electionTypeName}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// B2: HISTORICAL MAP CELL
// ============================================================================
interface HistoricalMapCellProps {
  electionId: number;
}

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

function HistoricalMapCell({ electionId }: HistoricalMapCellProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Initialize map
  useEffect(() => {
    if (map.current || !mapContainer.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: EMPTY_STYLE,
      center: UGANDA_CENTER,
      zoom: 5.5,
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

  // Load election results choropleth
  useEffect(() => {
    const mapInstance = map.current;
    if (!mapInstance || !isLoaded) return;

    const loadData = async () => {
      try {
        const geojson = await fetchApi(`/api/map/aggregated/${electionId}?level=2`);

        // Remove existing layers
        try {
          if (mapInstance.getLayer('districts-fill')) mapInstance.removeLayer('districts-fill');
          if (mapInstance.getLayer('districts-outline')) mapInstance.removeLayer('districts-outline');
          if (mapInstance.getSource('districts')) mapInstance.removeSource('districts');
        } catch {
          // Layers may not exist
        }

        // Add source
        mapInstance.addSource('districts', {
          type: 'geojson',
          data: geojson
        });

        // Add fill layer with winner colors
        mapInstance.addLayer({
          id: 'districts-fill',
          type: 'fill',
          source: 'districts',
          paint: {
            'fill-color': ['coalesce', ['get', 'winnerColor'], '#1E5F8A'],
            'fill-opacity': 0.85,
          }
        });

        // Add outline
        mapInstance.addLayer({
          id: 'districts-outline',
          type: 'line',
          source: 'districts',
          paint: {
            'line-color': COLORS.cyan,
            'line-width': 0.5,
            'line-opacity': 0.5,
          }
        });

        // Fit bounds
        if (geojson.bbox) {
          mapInstance.fitBounds(
            [[geojson.bbox[0], geojson.bbox[1]], [geojson.bbox[2], geojson.bbox[3]]],
            { padding: 30, duration: 500 }
          );
        }
      } catch (err) {
        console.error('Error loading map data:', err);
      }
    };

    loadData();
  }, [isLoaded, electionId]);

  return (
    <div className="w-full h-full relative">
      <div ref={mapContainer} className="w-full h-full" />
    </div>
  );
}

// ============================================================================
// C2: VOTE SHARE BAR CHART CELL
// ============================================================================
interface VoteShareChartCellProps {
  data: NationalTotals | null;
  loading: boolean;
}

function VoteShareChartCell({ data, loading }: VoteShareChartCellProps) {
  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const candidates = data?.candidates || [];

  if (candidates.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <span className="text-sm" style={{ color: COLORS.textMuted }}>No data</span>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col p-2 overflow-y-auto">
      <div className="space-y-2">
        {candidates.map((candidate) => (
          <div key={candidate.candidateId} className="flex items-center gap-2">
            {/* Party abbreviation */}
            <div
              className="w-10 text-xs font-medium truncate"
              style={{ color: candidate.partyColor || COLORS.textSecondary }}
            >
              {candidate.party}
            </div>

            {/* Progress bar */}
            <div className="flex-1 h-4 rounded overflow-hidden" style={{ backgroundColor: `${COLORS.textMuted}20` }}>
              <div
                className="h-full rounded"
                style={{
                  width: `${parseFloat(candidate.percentage)}%`,
                  backgroundColor: candidate.partyColor || COLORS.textMuted
                }}
              />
            </div>

            {/* Percentage */}
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
// D2: COMPARE ELECTIONS CELL
// ============================================================================
interface CompareElectionsCellProps {
  selectedYear: number;
}

function CompareElectionsCell({ selectedYear }: CompareElectionsCellProps) {
  const { setViewMode, setComparisonElection, selectElection } = useBroadcastStore();
  const [election1, setElection1] = useState<number>(selectedYear);
  const [election2, setElection2] = useState<number>(2016);

  const years = [2021, 2016, 2011, 2006, 2001];

  const handleCompare = () => {
    // Find election IDs for the selected years
    const e1 = PRESIDENTIAL_ELECTIONS.find(e => e.year === election1);
    const e2 = PRESIDENTIAL_ELECTIONS.find(e => e.year === election2);

    if (e1 && e2) {
      selectElection(e1.id);
      setComparisonElection(e2.id);
      setViewMode('comparison');
    }
  };

  return (
    <div className="w-full h-full flex flex-col justify-center p-2">
      <div className="text-xs uppercase tracking-wider mb-3" style={{ color: COLORS.textMuted }}>
        Compare
      </div>

      {/* Election 1 */}
      <div className="mb-2">
        <label className="text-xs mb-1 block" style={{ color: COLORS.textSecondary }}>
          Election 1
        </label>
        <select
          value={election1}
          onChange={(e) => setElection1(parseInt(e.target.value))}
          className="w-full px-2 py-1.5 rounded text-sm"
          style={{
            backgroundColor: `${COLORS.textMuted}20`,
            color: COLORS.textPrimary,
            border: `1px solid ${COLORS.cardBorder}`,
          }}
        >
          {years.map(year => (
            <option key={year} value={year}>{year}</option>
          ))}
        </select>
      </div>

      {/* Election 2 */}
      <div className="mb-3">
        <label className="text-xs mb-1 block" style={{ color: COLORS.textSecondary }}>
          Election 2
        </label>
        <select
          value={election2}
          onChange={(e) => setElection2(parseInt(e.target.value))}
          className="w-full px-2 py-1.5 rounded text-sm"
          style={{
            backgroundColor: `${COLORS.textMuted}20`,
            color: COLORS.textPrimary,
            border: `1px solid ${COLORS.cardBorder}`,
          }}
        >
          {years.filter(y => y !== election1).map(year => (
            <option key={year} value={year}>{year}</option>
          ))}
        </select>
      </div>

      {/* Compare button */}
      <button
        onClick={handleCompare}
        className="w-full py-2 rounded text-sm font-medium transition-all hover:brightness-110 uppercase"
        style={{
          backgroundColor: COLORS.cyan,
          color: '#000',
        }}
      >
        Compare →
      </button>
    </div>
  );
}

// ============================================================================
// A3: KEY METRICS CELL
// ============================================================================
interface KeyMetricsCellProps {
  data: NationalTotals | null;
  loading: boolean;
}

function KeyMetricsCell({ data, loading }: KeyMetricsCellProps) {
  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const summary = data?.summary;

  return (
    <div className="w-full h-full flex flex-col justify-center p-2">
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-xs" style={{ color: COLORS.textMuted }}>Registered</span>
          <span className="text-sm font-mono" style={{ color: COLORS.textPrimary }}>
            {summary?.registeredVoters?.toLocaleString() || '—'}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs" style={{ color: COLORS.textMuted }}>Valid</span>
          <span className="text-sm font-mono" style={{ color: COLORS.green }}>
            {summary?.validVotes?.toLocaleString() || '—'}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs" style={{ color: COLORS.textMuted }}>Invalid</span>
          <span className="text-sm font-mono" style={{ color: COLORS.red }}>
            {summary?.invalidVotes?.toLocaleString() || '—'}
          </span>
        </div>
        <div className="flex justify-between items-center pt-1 border-t" style={{ borderColor: COLORS.cardBorder }}>
          <span className="text-xs" style={{ color: COLORS.textMuted }}>Units</span>
          <span className="text-sm font-mono" style={{ color: COLORS.cyan }}>
            {summary?.reportingUnits?.toLocaleString() || '—'}
          </span>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// B3: REGIONAL BREAKDOWN CELL
// ============================================================================
interface RegionalBreakdownCellProps {
  electionId: number;
}

function RegionalBreakdownCell({ electionId }: RegionalBreakdownCellProps) {
  const [regionData, setRegionData] = useState<{ name: string; votes: number; color: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const data = await fetchApi(`/api/elections/${electionId}/results?level=2`);
        const districts = data.data || [];

        // Get top 5 districts by votes for the winner
        const sorted = districts
          .filter((d: { winnerVotes: number }) => d.winnerVotes > 0)
          .sort((a: { winnerVotes: number }, b: { winnerVotes: number }) => b.winnerVotes - a.winnerVotes)
          .slice(0, 5);

        setRegionData(sorted.map((d: { name: string; winnerVotes: number; winnerColor: string }) => ({
          name: d.name,
          votes: d.winnerVotes,
          color: d.winnerColor || COLORS.gold
        })));
      } catch (err) {
        console.error('Error loading regional data:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [electionId]);

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const maxVotes = Math.max(...regionData.map(r => r.votes), 1);

  return (
    <div className="w-full h-full flex flex-col p-2">
      <div className="text-xs uppercase tracking-wider mb-2" style={{ color: COLORS.textMuted }}>
        Top Districts for Winner
      </div>
      <div className="flex-1 space-y-1.5 overflow-y-auto">
        {regionData.map((region, index) => (
          <div key={region.name} className="flex items-center gap-2">
            <span className="w-4 text-xs font-mono" style={{ color: COLORS.textMuted }}>
              {index + 1}.
            </span>
            <span className="w-16 text-xs truncate" style={{ color: COLORS.textSecondary }}>
              {region.name}
            </span>
            <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ backgroundColor: `${COLORS.textMuted}20` }}>
              <div
                className="h-full rounded-full"
                style={{
                  width: `${(region.votes / maxVotes) * 100}%`,
                  backgroundColor: region.color
                }}
              />
            </div>
            <span className="w-12 text-right text-xs font-mono" style={{ color: COLORS.textPrimary }}>
              {(region.votes / 1000).toFixed(0)}k
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// C3: TURNOUT TREND CELL
// ============================================================================
interface TurnoutDataPoint {
  year: string;
  turnout: number;
}

function TurnoutTrendCell() {
  const [chartData, setChartData] = useState<TurnoutDataPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const results: TurnoutDataPoint[] = [];

        for (const election of PRESIDENTIAL_ELECTIONS) {
          try {
            const data = await fetchApi(`/api/map/national/${election.id}`);
            const turnout = data?.summary?.turnout ? parseFloat(data.summary.turnout) : 0;
            if (turnout > 0) {
              results.push({
                year: `'${String(election.year).slice(-2)}`,
                turnout
              });
            }
          } catch {
            // Skip
          }
        }

        setChartData(results);
      } catch (err) {
        console.error('Error loading turnout data:', err);
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

  const avgTurnout = chartData.length > 0
    ? chartData.reduce((sum, d) => sum + d.turnout, 0) / chartData.length
    : 0;

  return (
    <div className="w-full h-full flex flex-col p-2">
      <div className="text-xs mb-1" style={{ color: COLORS.textMuted }}>
        Turnout Trend
      </div>

      <div className="flex-1" style={{ minHeight: '100px' }}>
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
              fontSize={10}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="#6B7280"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `${value}%`}
              domain={[50, 80]}
            />
            <ReferenceLine
              y={avgTurnout}
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
              formatter={(value: number) => [`${value.toFixed(1)}%`, 'Turnout']}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="turnout"
              stroke={COLORS.cyan}
              strokeWidth={2}
              isAnimationActive={false}
              dot={{
                fill: COLORS.cyan,
                stroke: '#0A0E14',
                strokeWidth: 2,
                r: 4,
              }}
              activeDot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="text-xs text-center" style={{ color: COLORS.textMuted }}>
        Avg: {avgTurnout.toFixed(1)}%
      </div>
    </div>
  );
}

// ============================================================================
// D3: BACK TO HOME CELL
// ============================================================================
function BackToHomeCell() {
  const { setViewMode } = useBroadcastStore();

  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-2">
      <button
        onClick={() => setViewMode('home')}
        className="w-full py-3 rounded text-sm font-medium transition-all hover:brightness-110 flex items-center justify-center gap-2"
        style={{
          backgroundColor: `${COLORS.cyan}20`,
          color: COLORS.cyan,
          border: `1px solid ${COLORS.cyan}40`,
        }}
      >
        ← HOME
      </button>

      <div className="mt-3 text-center">
        <span className="text-xs" style={{ color: COLORS.textMuted }}>
          Return to<br />Broadcast
        </span>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================
export function PastElectionsBroadcastHome() {
  const [selectedYear, setSelectedYear] = useState(2021);
  const [nationalData, setNationalData] = useState<NationalTotals | null>(null);
  const [loading, setLoading] = useState(true);

  // Get election ID for selected year
  const currentElection = PRESIDENTIAL_ELECTIONS.find(e => e.year === selectedYear);
  const electionId = currentElection?.id || 2;

  // Load data when year changes
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const data = await fetchApi(`/api/map/national/${electionId}`);
        setNationalData(data);
      } catch (err) {
        console.error('Error loading election data:', err);
        setNationalData(null);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [electionId]);

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

        {/* A1: Year Selector */}
        <GridCell id="A1" label="Year Selector">
          <YearSelectorCell
            selectedYear={selectedYear}
            onYearChange={setSelectedYear}
          />
        </GridCell>

        {/* B1: Winner Showcase */}
        <GridCell id="B1" label="Winner Showcase">
          <WinnerShowcaseCell data={nationalData} loading={loading} />
        </GridCell>

        {/* C1: Top Candidates */}
        <GridCell id="C1" label="Top Candidates">
          <TopCandidatesCell data={nationalData} loading={loading} />
        </GridCell>

        {/* D1: Turnout Stats */}
        <GridCell id="D1" label="Turnout Stats">
          <TurnoutStatsCell data={nationalData} loading={loading} />
        </GridCell>

        {/* ============================================================ */}
        {/* ROW 2 (MIDDLE) - 40% height - Main Content */}
        {/* ============================================================ */}

        {/* A2: Election List */}
        <GridCell id="A2" label="Election List">
          <ElectionListCell selectedYear={selectedYear} />
        </GridCell>

        {/* B2: Historical Map */}
        <GridCell id="B2" label="Historical Map" noPadding>
          <HistoricalMapCell electionId={electionId} />
        </GridCell>

        {/* C2: Vote Share Chart */}
        <GridCell id="C2" label="Vote Share">
          <VoteShareChartCell data={nationalData} loading={loading} />
        </GridCell>

        {/* D2: Compare Elections */}
        <GridCell id="D2" label="Compare">
          <CompareElectionsCell selectedYear={selectedYear} />
        </GridCell>

        {/* ============================================================ */}
        {/* ROW 3 (BOTTOM) - 30% height - Trends & Details */}
        {/* ============================================================ */}

        {/* A3: Key Metrics */}
        <GridCell id="A3" label="Key Metrics">
          <KeyMetricsCell data={nationalData} loading={loading} />
        </GridCell>

        {/* B3: Regional Breakdown */}
        <GridCell id="B3" label="Top Regions">
          <RegionalBreakdownCell electionId={electionId} />
        </GridCell>

        {/* C3: Turnout Trend */}
        <GridCell id="C3" label="Turnout Trend">
          <TurnoutTrendCell />
        </GridCell>

        {/* D3: Back to Home */}
        <GridCell id="D3" label="Navigation">
          <BackToHomeCell />
        </GridCell>
      </div>
    </div>
  );
}

export default PastElectionsBroadcastHome;
