import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Home,
  RefreshCw,
  ChevronLeft,
  Radio,
} from 'lucide-react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useBroadcastStore } from '../../stores/broadcastStore';
import { useElections, useNationalTotals } from '../../hooks/useElectionData';

// =============================================================================
// Design Tokens (from Design_Guide.md)
// =============================================================================
const DESIGN = {
  colors: {
    background: '#0A0E14',
    cardBg: 'rgba(22, 27, 34, 0.85)',
    cardBorder: 'rgba(0, 229, 255, 0.15)',
    accent: '#00E5FF',
    gold: '#FFD700',
    live: '#EF4444',
    text: {
      primary: '#FFFFFF',
      secondary: '#9CA3AF',
      muted: '#6B7280',
    },
    parties: {
      NRM: '#FFD700',
      NUP: '#EF4444',
      FDC: '#3B82F6',
      DP: '#10B981',
      UPC: '#8B5CF6',
      IND: '#6B7280',
    },
  },
  fonts: {
    mono: "'JetBrains Mono', monospace",
  },
};

// =============================================================================
// Type Definitions
// =============================================================================
type ElectionType = 'presidential' | 'parliamentary' | 'woman_mp' | 'local';

interface CandidateData {
  id: number;
  name: string;
  party: string;
  votes: number;
  percentage: number;
  photoUrl?: string;
}

interface PartySeats {
  party: string;
  seats: number;
  percentage: number;
}

// =============================================================================
// Mock Data (for demonstration - replaced with API calls when available)
// =============================================================================
const MOCK_CANDIDATES: CandidateData[] = [
  { id: 1, name: 'Yoweri Museveni', party: 'NRM', votes: 6042898, percentage: 58.64, photoUrl: '/images/candidates/museveni.jpg' },
  { id: 2, name: 'Robert Kyagulanyi', party: 'NUP', votes: 3631437, percentage: 35.08, photoUrl: '/images/candidates/bobi.jpg' },
  { id: 3, name: 'Patrick Amuriat', party: 'FDC', votes: 323330, percentage: 3.24, photoUrl: '/images/candidates/amuriat.jpg' },
  { id: 4, name: 'Mugisha Muntu', party: 'ANT', votes: 69459, percentage: 0.65, photoUrl: '/images/candidates/muntu.jpg' },
];

const MOCK_PARTY_SEATS: PartySeats[] = [
  { party: 'NRM', seats: 194, percentage: 63 },
  { party: 'IND', seats: 49, percentage: 16 },
  { party: 'NUP', seats: 37, percentage: 12 },
  { party: 'FDC', seats: 24, percentage: 8 },
  { party: 'DP', seats: 5, percentage: 2 },
];

const REGIONS = ['National', 'Central', 'Eastern', 'Northern', 'Western'];

// =============================================================================
// Cell Components
// =============================================================================

// A1: Election Type Tabs
function ElectionTypeTabs({
  electionType,
  onSelect,
}: {
  electionType: ElectionType;
  onSelect: (type: ElectionType) => void;
}) {
  const types: { type: ElectionType; label: string }[] = [
    { type: 'presidential', label: 'Presidential' },
    { type: 'parliamentary', label: 'Parliament' },
    { type: 'woman_mp', label: 'Woman MP' },
    { type: 'local', label: 'Local' },
  ];

  return (
    <div
      style={{
        background: DESIGN.colors.cardBg,
        border: `1px solid ${DESIGN.colors.cardBorder}`,
        borderRadius: '12px',
        padding: '1rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
      }}
    >
      <h3
        style={{
          color: DESIGN.colors.text.secondary,
          fontSize: '0.75rem',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: '0.5rem',
        }}
      >
        Election Type
      </h3>
      {types.map(({ type, label }) => (
        <button
          key={type}
          onClick={() => onSelect(type)}
          style={{
            padding: '0.6rem 0.75rem',
            borderRadius: '8px',
            border: 'none',
            cursor: 'pointer',
            transition: 'all 0.2s',
            background: electionType === type
              ? DESIGN.colors.gold
              : 'rgba(255, 255, 255, 0.05)',
            color: electionType === type
              ? '#000000'
              : DESIGN.colors.text.secondary,
            fontWeight: electionType === type ? 600 : 400,
            fontSize: '0.85rem',
            textAlign: 'left',
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

// B1: Leading Candidate Cell
function LeadingCandidateCell({
  candidate,
}: {
  candidate: CandidateData | null;
}) {
  if (!candidate) {
    return (
      <div
        style={{
          background: DESIGN.colors.cardBg,
          border: `1px solid ${DESIGN.colors.cardBorder}`,
          borderRadius: '12px',
          padding: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span style={{ color: DESIGN.colors.text.muted }}>No data available</span>
      </div>
    );
  }

  const partyColor = DESIGN.colors.parties[candidate.party as keyof typeof DESIGN.colors.parties] || DESIGN.colors.parties.IND;

  return (
    <div
      style={{
        background: DESIGN.colors.cardBg,
        border: `1px solid ${DESIGN.colors.cardBorder}`,
        borderRadius: '12px',
        padding: '1rem',
        display: 'flex',
        gap: '1rem',
        alignItems: 'center',
      }}
    >
      {/* Photo */}
      <div
        style={{
          width: '100px',
          height: '100px',
          borderRadius: '12px',
          background: `linear-gradient(135deg, ${partyColor}33, ${partyColor}11)`,
          border: `2px solid ${partyColor}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          flexShrink: 0,
        }}
      >
        {candidate.photoUrl ? (
          <img
            src={candidate.photoUrl}
            alt={candidate.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <span style={{ fontSize: '2rem' }}>👤</span>
        )}
      </div>

      {/* Info */}
      <div style={{ flex: 1 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            marginBottom: '0.25rem',
          }}
        >
          <span
            style={{
              color: DESIGN.colors.gold,
              fontSize: '0.7rem',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
            }}
          >
            Leading
          </span>
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: DESIGN.colors.live,
              animation: 'pulse 2s infinite',
            }}
          />
        </div>
        <div
          style={{
            color: DESIGN.colors.text.primary,
            fontSize: '1.25rem',
            fontWeight: 700,
            marginBottom: '0.25rem',
          }}
        >
          {candidate.name}
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            marginBottom: '0.75rem',
          }}
        >
          <span
            style={{
              padding: '0.2rem 0.5rem',
              background: partyColor,
              color: '#000000',
              borderRadius: '4px',
              fontSize: '0.7rem',
              fontWeight: 600,
            }}
          >
            {candidate.party}
          </span>
          <span
            style={{
              color: DESIGN.colors.gold,
              fontSize: '1.25rem',
              fontWeight: 700,
              fontFamily: DESIGN.fonts.mono,
            }}
          >
            {Number(candidate.percentage).toFixed(2)}%
          </span>
        </div>
        {/* Progress bar */}
        <div
          style={{
            height: '6px',
            background: 'rgba(255,255,255,0.1)',
            borderRadius: '3px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${Number(candidate.percentage)}%`,
              height: '100%',
              background: partyColor,
              borderRadius: '3px',
            }}
          />
        </div>
        <div
          style={{
            marginTop: '0.5rem',
            color: DESIGN.colors.text.secondary,
            fontSize: '0.85rem',
            fontFamily: DESIGN.fonts.mono,
          }}
        >
          {candidate.votes.toLocaleString()} votes
        </div>
      </div>
    </div>
  );
}

// C1: Live Vote Counter Cell
function LiveVoteCounterCell({
  totalVotes,
  velocity,
}: {
  totalVotes: number;
  velocity: number;
}) {
  const digits = totalVotes.toLocaleString().split('');

  return (
    <div
      style={{
        background: DESIGN.colors.cardBg,
        border: `1px solid ${DESIGN.colors.cardBorder}`,
        borderRadius: '12px',
        padding: '1rem',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          marginBottom: '0.75rem',
        }}
      >
        <span
          style={{
            color: DESIGN.colors.text.secondary,
            fontSize: '0.75rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
          }}
        >
          Total Votes
        </span>
        <span
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: DESIGN.colors.live,
            animation: 'pulse 2s infinite',
          }}
        />
      </div>

      {/* Odometer-style display */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '2px',
        }}
      >
        {digits.map((digit, i) => (
          <div
            key={i}
            style={{
              width: digit === ',' ? '12px' : '28px',
              height: '42px',
              background: digit === ',' ? 'transparent' : 'rgba(0, 229, 255, 0.1)',
              border: digit === ',' ? 'none' : `1px solid ${DESIGN.colors.cardBorder}`,
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: DESIGN.fonts.mono,
              fontSize: '1.5rem',
              fontWeight: 700,
              color: DESIGN.colors.accent,
            }}
          >
            {digit}
          </div>
        ))}
      </div>

      {velocity > 0 && (
        <div
          style={{
            marginTop: '0.75rem',
            color: DESIGN.colors.text.muted,
            fontSize: '0.75rem',
          }}
        >
          +{velocity.toLocaleString()} votes/min
        </div>
      )}
    </div>
  );
}

// D1: Reporting Progress Cell
function ReportingProgressCell({
  reported,
  total,
}: {
  reported: number;
  total: number;
}) {
  const percentage = total > 0 ? Math.round((reported / total) * 100) : 0;
  const circumference = 2 * Math.PI * 40;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div
      style={{
        background: DESIGN.colors.cardBg,
        border: `1px solid ${DESIGN.colors.cardBorder}`,
        borderRadius: '12px',
        padding: '1rem',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <h3
        style={{
          color: DESIGN.colors.text.secondary,
          fontSize: '0.7rem',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: '0.5rem',
        }}
      >
        Reporting
      </h3>

      {/* Circular progress */}
      <div style={{ position: 'relative', width: '90px', height: '90px' }}>
        <svg width="90" height="90" viewBox="0 0 90 90">
          {/* Background circle */}
          <circle
            cx="45"
            cy="45"
            r="40"
            fill="none"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth="6"
          />
          {/* Progress circle */}
          <circle
            cx="45"
            cy="45"
            r="40"
            fill="none"
            stroke={DESIGN.colors.accent}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            transform="rotate(-90 45 45)"
          />
        </svg>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
          }}
        >
          <span
            style={{
              color: DESIGN.colors.text.primary,
              fontSize: '1.5rem',
              fontWeight: 700,
              fontFamily: DESIGN.fonts.mono,
            }}
          >
            {percentage}
          </span>
          <span
            style={{
              color: DESIGN.colors.text.muted,
              fontSize: '0.7rem',
            }}
          >
            %
          </span>
        </div>
      </div>

      <div
        style={{
          marginTop: '0.5rem',
          textAlign: 'center',
          color: DESIGN.colors.text.secondary,
          fontSize: '0.75rem',
        }}
      >
        {reported.toLocaleString()} / {total.toLocaleString()}
        <div style={{ color: DESIGN.colors.text.muted, fontSize: '0.7rem' }}>
          polling units
        </div>
      </div>
    </div>
  );
}

// A2: Region Selector Cell
function RegionSelectorCell({
  selectedRegion,
  onSelect,
  onBack,
}: {
  selectedRegion: string;
  onSelect: (region: string) => void;
  onBack: () => void;
}) {
  return (
    <div
      style={{
        background: DESIGN.colors.cardBg,
        border: `1px solid ${DESIGN.colors.cardBorder}`,
        borderRadius: '12px',
        padding: '1rem',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <h3
        style={{
          color: DESIGN.colors.text.secondary,
          fontSize: '0.75rem',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: '0.75rem',
        }}
      >
        Region
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', flex: 1 }}>
        {REGIONS.map((region) => (
          <label
            key={region}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              cursor: 'pointer',
              padding: '0.35rem 0',
            }}
          >
            <input
              type="radio"
              name="region"
              checked={selectedRegion === region}
              onChange={() => onSelect(region)}
              style={{
                width: '14px',
                height: '14px',
                accentColor: DESIGN.colors.accent,
              }}
            />
            <span
              style={{
                color: selectedRegion === region ? DESIGN.colors.accent : DESIGN.colors.text.primary,
                fontSize: '0.85rem',
                fontWeight: selectedRegion === region ? 600 : 400,
              }}
            >
              {region}
            </span>
          </label>
        ))}
      </div>
      {selectedRegion !== 'National' && (
        <button
          onClick={onBack}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
            marginTop: '0.75rem',
            paddingTop: '0.75rem',
            borderTop: `1px solid ${DESIGN.colors.cardBorder}`,
            background: 'transparent',
            border: 'none',
            color: DESIGN.colors.text.secondary,
            fontSize: '0.8rem',
            cursor: 'pointer',
          }}
        >
          <ChevronLeft size={14} />
          Back to National
        </button>
      )}
    </div>
  );
}

// B2+C2: Magic Wall Map Cell (Spanning)
function MagicWallMapCell({
  candidates,
}: {
  candidates: CandidateData[];
}) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [mapReady, setMapReady] = useState(false);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {},
        layers: [
          {
            id: 'background',
            type: 'background',
            paint: { 'background-color': '#0A0E14' },
          },
        ],
      },
      center: [32.5, 1.5],
      zoom: 6,
      attributionControl: false,
    });

    map.current.on('load', () => {
      setMapReady(true);
    });

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Load election results GeoJSON
  useEffect(() => {
    if (!mapReady || !map.current) return;

    // Fetch election results for map with auth
    const token = localStorage.getItem('auth_token');
    fetch('/api/map/aggregated/6?level=2', {
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((geojson) => {
        if (!map.current) return;

        // Remove existing layers and source
        if (map.current.getLayer('districts-fill')) {
          map.current.removeLayer('districts-fill');
        }
        if (map.current.getLayer('districts-line')) {
          map.current.removeLayer('districts-line');
        }
        if (map.current.getSource('districts')) {
          map.current.removeSource('districts');
        }

        // Add source
        map.current.addSource('districts', {
          type: 'geojson',
          data: geojson,
        });

        // Add fill layer with party colors
        map.current.addLayer({
          id: 'districts-fill',
          type: 'fill',
          source: 'districts',
          paint: {
            'fill-color': [
              'match',
              ['get', 'winningParty'],
              'NRM', DESIGN.colors.parties.NRM,
              'NUP', DESIGN.colors.parties.NUP,
              'FDC', DESIGN.colors.parties.FDC,
              'DP', DESIGN.colors.parties.DP,
              'IND', DESIGN.colors.parties.IND,
              '#6B7280', // default
            ],
            'fill-opacity': 0.8,
          },
        });

        // Add line layer
        map.current.addLayer({
          id: 'districts-line',
          type: 'line',
          source: 'districts',
          paint: {
            'line-color': 'rgba(0, 229, 255, 0.3)',
            'line-width': 1,
          },
        });
      })
      .catch((err) => {
        console.warn('Failed to load election map data:', err);
      });
  }, [mapReady]);

  // Get unique parties from candidates
  const parties = useMemo(() => {
    const uniqueParties = [...new Set(candidates.map((c) => c.party))];
    return uniqueParties.slice(0, 4);
  }, [candidates]);

  return (
    <div
      style={{
        background: DESIGN.colors.cardBg,
        border: `1px solid ${DESIGN.colors.cardBorder}`,
        borderRadius: '12px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        gridColumn: 'span 2',
      }}
    >
      {/* Map container */}
      <div ref={mapContainer} style={{ flex: 1, minHeight: '200px' }} />

      {/* Legend */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          padding: '0.75rem 1rem',
          borderTop: `1px solid ${DESIGN.colors.cardBorder}`,
        }}
      >
        <span style={{ color: DESIGN.colors.text.muted, fontSize: '0.75rem' }}>Legend:</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {parties.map((party) => (
            <div key={party} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <span
                style={{
                  width: '12px',
                  height: '12px',
                  background: DESIGN.colors.parties[party as keyof typeof DESIGN.colors.parties] || DESIGN.colors.parties.IND,
                  borderRadius: '2px',
                }}
              />
              <span style={{ color: DESIGN.colors.text.secondary, fontSize: '0.75rem' }}>{party}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// D2: National Totals Cell
function NationalTotalsCell({
  totalVotes,
  registeredVoters,
  turnout,
}: {
  totalVotes: number;
  registeredVoters: number;
  turnout: number;
}) {
  return (
    <div
      style={{
        background: DESIGN.colors.cardBg,
        border: `1px solid ${DESIGN.colors.cardBorder}`,
        borderRadius: '12px',
        padding: '1rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
      }}
    >
      <h3
        style={{
          color: DESIGN.colors.text.secondary,
          fontSize: '0.75rem',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        National Totals
      </h3>

      {/* Turnout */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
          <span style={{ color: DESIGN.colors.text.muted, fontSize: '0.75rem' }}>Turnout</span>
          <span style={{ color: DESIGN.colors.accent, fontFamily: DESIGN.fonts.mono, fontSize: '0.9rem', fontWeight: 600 }}>
            {turnout.toFixed(2)}%
          </span>
        </div>
        <div style={{ height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
          <div
            style={{
              width: `${turnout}%`,
              height: '100%',
              background: DESIGN.colors.accent,
              borderRadius: '3px',
            }}
          />
        </div>
      </div>

      {/* Total Votes */}
      <div style={{ borderTop: `1px solid ${DESIGN.colors.cardBorder}`, paddingTop: '0.75rem' }}>
        <div style={{ color: DESIGN.colors.text.muted, fontSize: '0.7rem', textTransform: 'uppercase' }}>Total Votes</div>
        <div style={{ color: DESIGN.colors.text.primary, fontFamily: DESIGN.fonts.mono, fontSize: '1rem', fontWeight: 600 }}>
          {totalVotes.toLocaleString()}
        </div>
      </div>

      {/* Registered */}
      <div style={{ borderTop: `1px solid ${DESIGN.colors.cardBorder}`, paddingTop: '0.75rem' }}>
        <div style={{ color: DESIGN.colors.text.muted, fontSize: '0.7rem', textTransform: 'uppercase' }}>Registered</div>
        <div style={{ color: DESIGN.colors.text.primary, fontFamily: DESIGN.fonts.mono, fontSize: '1rem', fontWeight: 600 }}>
          {registeredVoters.toLocaleString()}
        </div>
      </div>
    </div>
  );
}

// A3: Quick Stats Cell
function QuickStatsCell({
  validVotes,
  invalidVotes,
  spoiltVotes,
}: {
  validVotes: number;
  invalidVotes: number;
  spoiltVotes: number;
}) {
  const total = validVotes + invalidVotes + spoiltVotes;

  const stats = [
    { label: 'Valid', value: validVotes, color: '#10B981' },
    { label: 'Invalid', value: invalidVotes, color: '#F59E0B' },
    { label: 'Spoilt', value: spoiltVotes, color: '#EF4444' },
  ];

  return (
    <div
      style={{
        background: DESIGN.colors.cardBg,
        border: `1px solid ${DESIGN.colors.cardBorder}`,
        borderRadius: '12px',
        padding: '1rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
      }}
    >
      <h3
        style={{
          color: DESIGN.colors.text.secondary,
          fontSize: '0.75rem',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: '0.25rem',
        }}
      >
        Vote Breakdown
      </h3>
      {stats.map((stat) => (
        <div key={stat.label}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
            <span style={{ color: DESIGN.colors.text.secondary, fontSize: '0.75rem' }}>{stat.label}</span>
            <span style={{ color: stat.color, fontFamily: DESIGN.fonts.mono, fontSize: '0.75rem' }}>
              {((stat.value / total) * 100).toFixed(1)}%
            </span>
          </div>
          <div style={{ height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
            <div
              style={{
                width: `${(stat.value / total) * 100}%`,
                height: '100%',
                background: stat.color,
                borderRadius: '2px',
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// B3: Candidate Cards Cell
function CandidateCardsCell({
  candidates,
}: {
  candidates: CandidateData[];
}) {
  const topCandidates = candidates.slice(0, 4);

  return (
    <div
      style={{
        background: DESIGN.colors.cardBg,
        border: `1px solid ${DESIGN.colors.cardBorder}`,
        borderRadius: '12px',
        padding: '1rem',
        display: 'flex',
        gap: '0.75rem',
        alignItems: 'stretch',
      }}
    >
      {topCandidates.map((candidate, index) => {
        const partyColor = DESIGN.colors.parties[candidate.party as keyof typeof DESIGN.colors.parties] || DESIGN.colors.parties.IND;
        return (
          <div
            key={candidate.id || `candidate-${index}`}
            style={{
              flex: 1,
              background: 'rgba(255,255,255,0.03)',
              borderRadius: '8px',
              padding: '0.75rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              border: index === 0 ? `2px solid ${DESIGN.colors.gold}` : `1px solid ${DESIGN.colors.cardBorder}`,
            }}
          >
            {/* Photo */}
            <div
              style={{
                width: '50px',
                height: '50px',
                borderRadius: '50%',
                background: `linear-gradient(135deg, ${partyColor}33, ${partyColor}11)`,
                border: `2px solid ${partyColor}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                marginBottom: '0.5rem',
              }}
            >
              {candidate.photoUrl ? (
                <img
                  src={candidate.photoUrl}
                  alt={candidate.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : (
                <span style={{ fontSize: '1.25rem' }}>👤</span>
              )}
            </div>
            {/* Name */}
            <div
              style={{
                color: DESIGN.colors.text.primary,
                fontSize: '0.75rem',
                fontWeight: 600,
                textAlign: 'center',
                marginBottom: '0.25rem',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                width: '100%',
              }}
            >
              {candidate.name.split(' ').pop()}
            </div>
            {/* Party */}
            <span
              style={{
                padding: '0.15rem 0.35rem',
                background: partyColor,
                color: '#000000',
                borderRadius: '3px',
                fontSize: '0.6rem',
                fontWeight: 600,
                marginBottom: '0.25rem',
              }}
            >
              {candidate.party}
            </span>
            {/* Percentage */}
            <span
              style={{
                color: DESIGN.colors.text.primary,
                fontFamily: DESIGN.fonts.mono,
                fontSize: '0.9rem',
                fontWeight: 700,
              }}
            >
              {Number(candidate.percentage).toFixed(1)}%
            </span>
          </div>
        );
      })}
    </div>
  );
}

// C3: Party Seats Summary Cell
function PartySeatsSummaryCell({
  partySeats,
}: {
  partySeats: PartySeats[];
}) {
  const totalSeats = partySeats.reduce((sum, p) => sum + p.seats, 0);

  return (
    <div
      style={{
        background: DESIGN.colors.cardBg,
        border: `1px solid ${DESIGN.colors.cardBorder}`,
        borderRadius: '12px',
        padding: '1rem',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <h3
        style={{
          color: DESIGN.colors.text.secondary,
          fontSize: '0.75rem',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: '0.5rem',
        }}
      >
        Parliamentary Seats
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', flex: 1 }}>
        {partySeats.map((party) => {
          const partyColor = DESIGN.colors.parties[party.party as keyof typeof DESIGN.colors.parties] || DESIGN.colors.parties.IND;
          return (
            <div key={party.party} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span
                style={{
                  color: DESIGN.colors.text.primary,
                  fontSize: '0.75rem',
                  minWidth: '2.5rem',
                }}
              >
                {party.party}
              </span>
              <div style={{ flex: 1, height: '10px', background: 'rgba(255,255,255,0.1)', borderRadius: '5px', overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${party.percentage}%`,
                    height: '100%',
                    background: partyColor,
                    borderRadius: '5px',
                  }}
                />
              </div>
              <span
                style={{
                  color: DESIGN.colors.text.secondary,
                  fontSize: '0.75rem',
                  fontFamily: DESIGN.fonts.mono,
                  minWidth: '3.5rem',
                  textAlign: 'right',
                }}
              >
                {party.seats} ({party.percentage}%)
              </span>
            </div>
          );
        })}
      </div>
      <div
        style={{
          marginTop: '0.5rem',
          paddingTop: '0.5rem',
          borderTop: `1px solid ${DESIGN.colors.cardBorder}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span style={{ color: DESIGN.colors.text.muted, fontSize: '0.75rem' }}>Total:</span>
        <span style={{ color: DESIGN.colors.text.primary, fontFamily: DESIGN.fonts.mono, fontSize: '0.85rem', fontWeight: 600 }}>
          {totalSeats} seats
        </span>
      </div>
    </div>
  );
}

// D3: Back to Home Cell
function BackToHomeCell({
  autoUpdate,
  onToggleAutoUpdate,
}: {
  autoUpdate: boolean;
  onToggleAutoUpdate: () => void;
}) {
  const { setViewMode } = useBroadcastStore();

  return (
    <div
      style={{
        background: DESIGN.colors.cardBg,
        border: `1px solid ${DESIGN.colors.cardBorder}`,
        borderRadius: '12px',
        padding: '1rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.6rem',
        justifyContent: 'center',
      }}
    >
      <button
        onClick={() => setViewMode('home')}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5rem',
          padding: '0.7rem',
          borderRadius: '8px',
          border: 'none',
          cursor: 'pointer',
          background: DESIGN.colors.accent,
          color: '#000000',
          fontWeight: 600,
          fontSize: '0.85rem',
        }}
      >
        <Home size={16} />
        Home
      </button>
      <button
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5rem',
          padding: '0.5rem',
          borderRadius: '8px',
          border: `1px solid ${DESIGN.colors.cardBorder}`,
          cursor: 'pointer',
          background: 'transparent',
          color: DESIGN.colors.text.secondary,
          fontSize: '0.8rem',
        }}
      >
        <RefreshCw size={14} />
        Refresh
      </button>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: '0.5rem',
          borderTop: `1px solid ${DESIGN.colors.cardBorder}`,
        }}
      >
        <span style={{ color: DESIGN.colors.text.muted, fontSize: '0.75rem' }}>Auto-update</span>
        <button
          onClick={onToggleAutoUpdate}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
            padding: '0.25rem 0.5rem',
            borderRadius: '4px',
            border: 'none',
            cursor: 'pointer',
            background: autoUpdate ? DESIGN.colors.accent : 'rgba(255,255,255,0.1)',
            color: autoUpdate ? '#000000' : DESIGN.colors.text.muted,
            fontSize: '0.7rem',
            fontWeight: 600,
          }}
        >
          {autoUpdate ? 'ON' : 'OFF'}
          {autoUpdate && <Radio size={10} />}
        </button>
      </div>
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================
export function CurrentElectionBroadcastHome() {
  const [electionType, setElectionType] = useState<ElectionType>('presidential');
  const [selectedRegion, setSelectedRegion] = useState('National');
  const [autoUpdate, setAutoUpdate] = useState(true);

  // Fetch real election data when available
  const { data: elections } = useElections();
  const currentElection = elections?.find((e) => e.name?.includes('2021') || e.id === 6);
  const { data: nationalData } = useNationalTotals(currentElection?.id || 6);

  // Use real data if available, otherwise mock data
  const candidates = useMemo(() => {
    if (nationalData?.candidates && nationalData.candidates.length > 0) {
      return nationalData.candidates
        .map((c: any) => ({
          id: c.id,
          name: c.name,
          party: c.party || 'IND',
          votes: Number(c.votes) || 0,
          percentage: Number(c.percentage) || 0,
          photoUrl: c.photoUrl,
        }))
        .sort((a: CandidateData, b: CandidateData) => b.votes - a.votes);
    }
    return MOCK_CANDIDATES;
  }, [nationalData]);

  const leadingCandidate = candidates[0] || null;
  const totalVotes = candidates.reduce((sum: number, c: CandidateData) => sum + c.votes, 0);
  const registeredVoters = nationalData?.registeredVoters || 18103603;
  const turnout = registeredVoters > 0 ? (totalVotes / registeredVoters) * 100 : 57.22;

  // Mock reporting progress
  const reportedUnits = 7234;
  const totalUnits = 8123;

  // Mock vote breakdown
  const validVotes = Math.round(totalVotes * 0.98);
  const invalidVotes = Math.round(totalVotes * 0.015);
  const spoiltVotes = totalVotes - validVotes - invalidVotes;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: DESIGN.colors.background,
        padding: '1rem',
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
      {/* Pulse animation for live indicator */}
      <style>
        {`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
        `}
      </style>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '2fr 4fr 4fr 2fr',
          gridTemplateRows: '25vh 50vh 25vh',
          gap: '1rem',
          height: '100%',
          maxHeight: 'calc(100vh - 2rem)',
        }}
      >
        {/* Row 1 */}
        <ElectionTypeTabs electionType={electionType} onSelect={setElectionType} />
        <LeadingCandidateCell candidate={leadingCandidate} />
        <LiveVoteCounterCell totalVotes={totalVotes} velocity={1234} />
        <ReportingProgressCell reported={reportedUnits} total={totalUnits} />

        {/* Row 2 */}
        <RegionSelectorCell
          selectedRegion={selectedRegion}
          onSelect={setSelectedRegion}
          onBack={() => setSelectedRegion('National')}
        />
        <MagicWallMapCell candidates={candidates} />
        <NationalTotalsCell
          totalVotes={totalVotes}
          registeredVoters={registeredVoters}
          turnout={turnout}
        />

        {/* Row 3 */}
        <QuickStatsCell
          validVotes={validVotes}
          invalidVotes={invalidVotes}
          spoiltVotes={spoiltVotes}
        />
        <CandidateCardsCell candidates={candidates} />
        <PartySeatsSummaryCell partySeats={MOCK_PARTY_SEATS} />
        <BackToHomeCell
          autoUpdate={autoUpdate}
          onToggleAutoUpdate={() => setAutoUpdate(!autoUpdate)}
        />
      </div>
    </div>
  );
}
