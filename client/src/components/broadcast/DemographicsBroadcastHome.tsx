import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Users,
  Vote,
  MapPin,
  TrendingUp,
  Home,
  RefreshCw,
  Download,
  ChevronRight,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell as RechartsCell,
} from 'recharts';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useBroadcastStore } from '../../stores/broadcastStore';

// =============================================================================
// Design Tokens (from Design_Guide.md)
// =============================================================================
const DESIGN = {
  colors: {
    background: '#0A0E14',
    cardBg: 'rgba(22, 27, 34, 0.85)',
    cardBorder: 'rgba(0, 229, 255, 0.15)',
    accent: '#00E5FF',
    text: {
      primary: '#FFFFFF',
      secondary: '#9CA3AF',
      muted: '#6B7280',
    },
    dataTypes: {
      population: '#3B82F6',
      voters: '#10B981',
      density: '#F59E0B',
      turnout: '#8B5CF6',
    },
    regions: {
      Central: '#F59E0B',
      Eastern: '#10B981',
      Northern: '#3B82F6',
      Western: '#EF4444',
    },
  },
  fonts: {
    mono: "'JetBrains Mono', monospace",
  },
};

// =============================================================================
// Type Definitions
// =============================================================================
type DataType = 'population' | 'voters' | 'density' | 'turnout';

interface DistrictData {
  id: number;
  name: string;
  population: number;
  registeredVoters: number;
  area: number;
  region: string;
}

interface RegionalData {
  region: string;
  population: number;
  voters: number;
  percentage: number;
}

interface TrendData {
  year: number;
  registeredVoters: number;
}

// =============================================================================
// Mock Data (for demonstration - would be replaced with API calls)
// =============================================================================
const MOCK_DISTRICTS: DistrictData[] = [
  { id: 1, name: 'Kampala', population: 1800000, registeredVoters: 980000, area: 189, region: 'Central' },
  { id: 2, name: 'Wakiso', population: 1700000, registeredVoters: 920000, area: 2807, region: 'Central' },
  { id: 3, name: 'Mukono', population: 800000, registeredVoters: 450000, area: 2986, region: 'Central' },
  { id: 4, name: 'Jinja', population: 600000, registeredVoters: 340000, area: 750, region: 'Eastern' },
  { id: 5, name: 'Mbarara', population: 500000, registeredVoters: 280000, area: 1846, region: 'Western' },
  { id: 6, name: 'Gulu', population: 450000, registeredVoters: 250000, area: 3449, region: 'Northern' },
  { id: 7, name: 'Lira', population: 420000, registeredVoters: 230000, area: 1584, region: 'Northern' },
  { id: 8, name: 'Mbale', population: 400000, registeredVoters: 220000, area: 534, region: 'Eastern' },
];

const MOCK_REGIONAL_DATA: RegionalData[] = [
  { region: 'Central', population: 12500000, voters: 6800000, percentage: 35 },
  { region: 'Western', population: 9200000, voters: 5000000, percentage: 25 },
  { region: 'Eastern', population: 8100000, voters: 4400000, percentage: 22 },
  { region: 'Northern', population: 6600000, voters: 3600000, percentage: 18 },
];

const MOCK_TREND_DATA: TrendData[] = [
  { year: 2001, registeredVoters: 10500000 },
  { year: 2006, registeredVoters: 12500000 },
  { year: 2011, registeredVoters: 14300000 },
  { year: 2016, registeredVoters: 15800000 },
  { year: 2021, registeredVoters: 18100000 },
  { year: 2026, registeredVoters: 19800000 },
];

const NATIONAL_STATS = {
  population: 45741000,
  registeredVoters: 19800000,
  area: 241038,
  populationGrowth: 3.2,
  voterGrowth: 9.4,
};

const ELECTION_YEARS = [2026, 2021, 2016, 2011, 2006, 2001];

// =============================================================================
// Cell Components
// =============================================================================

// A1: Data Type Selector Cell
function DataTypeSelectorCell({
  dataType,
  onSelect,
}: {
  dataType: DataType;
  onSelect: (type: DataType) => void;
}) {
  const types: { type: DataType; label: string; icon: typeof Users }[] = [
    { type: 'population', label: 'Population', icon: Users },
    { type: 'voters', label: 'Voters', icon: Vote },
    { type: 'density', label: 'Density', icon: MapPin },
    { type: 'turnout', label: 'Turnout', icon: TrendingUp },
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
        Data View
      </h3>
      {types.map(({ type, label, icon: Icon }) => (
        <button
          key={type}
          onClick={() => onSelect(type)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.5rem 0.75rem',
            borderRadius: '8px',
            border: 'none',
            cursor: 'pointer',
            transition: 'all 0.2s',
            background: dataType === type
              ? DESIGN.colors.dataTypes[type]
              : 'rgba(255, 255, 255, 0.05)',
            color: dataType === type
              ? '#FFFFFF'
              : DESIGN.colors.text.secondary,
          }}
        >
          <Icon size={16} />
          <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>{label}</span>
        </button>
      ))}
    </div>
  );
}

// B1: National Population Cell
function NationalPopulationCell({
  dataType,
}: {
  dataType: DataType;
}) {
  const getValue = () => {
    switch (dataType) {
      case 'population':
        return { value: NATIONAL_STATS.population, label: 'Total Population', growth: NATIONAL_STATS.populationGrowth };
      case 'voters':
        return { value: NATIONAL_STATS.registeredVoters, label: 'Registered Voters', growth: NATIONAL_STATS.voterGrowth };
      case 'density':
        return { value: Math.round(NATIONAL_STATS.population / NATIONAL_STATS.area), label: 'Population Density', growth: null };
      case 'turnout':
        return { value: 59.4, label: 'Average Turnout', growth: 2.1 };
      default:
        return { value: 0, label: '', growth: null };
    }
  };

  const { value, label, growth } = getValue();
  const formattedValue = dataType === 'turnout'
    ? `${value}%`
    : dataType === 'density'
    ? `${value.toLocaleString()} /km²`
    : value.toLocaleString();

  return (
    <div
      style={{
        background: DESIGN.colors.cardBg,
        border: `1px solid ${DESIGN.colors.cardBorder}`,
        borderRadius: '12px',
        padding: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          fontSize: '2.5rem',
          fontWeight: 700,
          fontFamily: DESIGN.fonts.mono,
          color: DESIGN.colors.dataTypes[dataType],
          letterSpacing: '-0.02em',
        }}
      >
        {formattedValue}
      </div>
      <div
        style={{
          color: DESIGN.colors.text.secondary,
          fontSize: '0.85rem',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          marginTop: '0.5rem',
        }}
      >
        {label}
      </div>
      {growth !== null && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
            marginTop: '0.75rem',
            color: '#10B981',
            fontSize: '0.85rem',
          }}
        >
          <TrendingUp size={14} />
          <span>+{growth}% since 2021</span>
        </div>
      )}
    </div>
  );
}

// C1: Top Districts Cell
function TopDistrictsCell({
  dataType,
}: {
  dataType: DataType;
}) {
  const sortedDistricts = useMemo(() => {
    const getMetric = (d: DistrictData) => {
      switch (dataType) {
        case 'population':
          return d.population;
        case 'voters':
          return d.registeredVoters;
        case 'density':
          return d.population / d.area;
        case 'turnout':
          return (d.registeredVoters / d.population) * 100;
        default:
          return 0;
      }
    };
    return [...MOCK_DISTRICTS]
      .sort((a, b) => getMetric(b) - getMetric(a))
      .slice(0, 5);
  }, [dataType]);

  const maxValue = useMemo(() => {
    const getMetric = (d: DistrictData) => {
      switch (dataType) {
        case 'population':
          return d.population;
        case 'voters':
          return d.registeredVoters;
        case 'density':
          return d.population / d.area;
        case 'turnout':
          return (d.registeredVoters / d.population) * 100;
        default:
          return 0;
      }
    };
    return getMetric(sortedDistricts[0]);
  }, [sortedDistricts, dataType]);

  const formatValue = (d: DistrictData) => {
    switch (dataType) {
      case 'population':
        return `${(d.population / 1000000).toFixed(1)}M`;
      case 'voters':
        return `${(d.registeredVoters / 1000000).toFixed(1)}M`;
      case 'density':
        return `${Math.round(d.population / d.area)}/km²`;
      case 'turnout':
        return `${((d.registeredVoters / d.population) * 100).toFixed(1)}%`;
      default:
        return '';
    }
  };

  const getMetricValue = (d: DistrictData) => {
    switch (dataType) {
      case 'population':
        return d.population;
      case 'voters':
        return d.registeredVoters;
      case 'density':
        return d.population / d.area;
      case 'turnout':
        return (d.registeredVoters / d.population) * 100;
      default:
        return 0;
    }
  };

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
        Top Districts by {dataType}
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
        {sortedDistricts.map((district, index) => (
          <div key={district.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span
              style={{
                color: DESIGN.colors.text.muted,
                fontSize: '0.75rem',
                width: '1.5rem',
              }}
            >
              {index + 1}.
            </span>
            <span
              style={{
                color: DESIGN.colors.text.primary,
                fontSize: '0.85rem',
                minWidth: '5rem',
              }}
            >
              {district.name}
            </span>
            <div style={{ flex: 1, height: '12px', background: 'rgba(255,255,255,0.1)', borderRadius: '6px', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${(getMetricValue(district) / maxValue) * 100}%`,
                  height: '100%',
                  background: DESIGN.colors.dataTypes[dataType],
                  borderRadius: '6px',
                }}
              />
            </div>
            <span
              style={{
                color: DESIGN.colors.text.secondary,
                fontSize: '0.75rem',
                fontFamily: DESIGN.fonts.mono,
                minWidth: '4rem',
                textAlign: 'right',
              }}
            >
              {formatValue(district)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// D1: Voter Density Stats Cell
function VoterDensityStatsCell() {
  const nationalAvg = Math.round(NATIONAL_STATS.registeredVoters / NATIONAL_STATS.area);
  const highest = { value: 5185, name: 'Kampala' };
  const lowest = { value: 12, name: 'Kaabong' };

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
        Voter Density
      </h3>

      <div style={{ textAlign: 'center', padding: '0.5rem 0' }}>
        <div
          style={{
            fontSize: '1.75rem',
            fontWeight: 700,
            fontFamily: DESIGN.fonts.mono,
            color: DESIGN.colors.dataTypes.density,
          }}
        >
          {nationalAvg}
        </div>
        <div style={{ color: DESIGN.colors.text.muted, fontSize: '0.75rem' }}>
          voters/km²
        </div>
      </div>

      <div style={{ borderTop: `1px solid ${DESIGN.colors.cardBorder}`, paddingTop: '0.75rem' }}>
        <div style={{ marginBottom: '0.5rem' }}>
          <div style={{ color: DESIGN.colors.text.muted, fontSize: '0.7rem', textTransform: 'uppercase' }}>Highest</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: DESIGN.colors.text.primary, fontSize: '0.85rem' }}>{highest.name}</span>
            <span style={{ color: '#10B981', fontFamily: DESIGN.fonts.mono, fontSize: '0.85rem' }}>{highest.value.toLocaleString()}</span>
          </div>
        </div>
        <div>
          <div style={{ color: DESIGN.colors.text.muted, fontSize: '0.7rem', textTransform: 'uppercase' }}>Lowest</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: DESIGN.colors.text.primary, fontSize: '0.85rem' }}>{lowest.name}</span>
            <span style={{ color: '#EF4444', fontFamily: DESIGN.fonts.mono, fontSize: '0.85rem' }}>{lowest.value}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// A2: Region Filter Cell
function RegionFilterCell({
  selectedRegions,
  onToggle,
}: {
  selectedRegions: string[];
  onToggle: (region: string) => void;
}) {
  const regions = ['Central', 'Eastern', 'Northern', 'Western'];

  const handleSelectAll = () => {
    regions.forEach((r) => {
      if (!selectedRegions.includes(r)) {
        onToggle(r);
      }
    });
  };

  const handleClear = () => {
    regions.forEach((r) => {
      if (selectedRegions.includes(r)) {
        onToggle(r);
      }
    });
  };

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
        Regions
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
        {regions.map((region) => (
          <label
            key={region}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              cursor: 'pointer',
              padding: '0.25rem 0',
            }}
          >
            <input
              type="checkbox"
              checked={selectedRegions.includes(region)}
              onChange={() => onToggle(region)}
              style={{
                width: '16px',
                height: '16px',
                accentColor: DESIGN.colors.regions[region as keyof typeof DESIGN.colors.regions],
              }}
            />
            <span
              style={{
                color: DESIGN.colors.text.primary,
                fontSize: '0.85rem',
              }}
            >
              {region}
            </span>
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: DESIGN.colors.regions[region as keyof typeof DESIGN.colors.regions],
                marginLeft: 'auto',
              }}
            />
          </label>
        ))}
      </div>
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          marginTop: '0.75rem',
          paddingTop: '0.75rem',
          borderTop: `1px solid ${DESIGN.colors.cardBorder}`,
        }}
      >
        <button
          onClick={handleClear}
          style={{
            flex: 1,
            padding: '0.4rem',
            border: `1px solid ${DESIGN.colors.cardBorder}`,
            borderRadius: '6px',
            background: 'transparent',
            color: DESIGN.colors.text.secondary,
            fontSize: '0.75rem',
            cursor: 'pointer',
          }}
        >
          Clear
        </button>
        <button
          onClick={handleSelectAll}
          style={{
            flex: 1,
            padding: '0.4rem',
            border: `1px solid ${DESIGN.colors.cardBorder}`,
            borderRadius: '6px',
            background: 'transparent',
            color: DESIGN.colors.text.secondary,
            fontSize: '0.75rem',
            cursor: 'pointer',
          }}
        >
          All
        </button>
      </div>
    </div>
  );
}

// B2+C2: Demographics Map Cell (Spanning)
function DemographicsMapCell({
  dataType,
  selectedRegions,
}: {
  dataType: DataType;
  selectedRegions: string[];
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

  // Load GeoJSON data
  useEffect(() => {
    if (!mapReady || !map.current) return;

    // Fetch demographics GeoJSON
    fetch('/api/demographics/geojson?level=2')
      .then((res) => res.json())
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

        // Color based on data type
        const colorStops = {
          population: ['#DBEAFE', '#93C5FD', '#3B82F6', '#1D4ED8'],
          voters: ['#D1FAE5', '#6EE7B7', '#10B981', '#047857'],
          density: ['#FEF3C7', '#FCD34D', '#F59E0B', '#D97706'],
          turnout: ['#EDE9FE', '#C4B5FD', '#8B5CF6', '#6D28D9'],
        };

        const colors = colorStops[dataType];

        // Add fill layer
        map.current.addLayer({
          id: 'districts-fill',
          type: 'fill',
          source: 'districts',
          paint: {
            'fill-color': [
              'interpolate',
              ['linear'],
              ['get', dataType === 'density' ? 'voterDensity' : dataType === 'voters' ? 'registeredVoters' : 'population'],
              0, colors[0],
              500000, colors[1],
              1000000, colors[2],
              2000000, colors[3],
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
        console.warn('Failed to load demographics GeoJSON:', err);
      });
  }, [mapReady, dataType, selectedRegions]);

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
      {/* Map mode selector */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.75rem 1rem',
          borderBottom: `1px solid ${DESIGN.colors.cardBorder}`,
        }}
      >
        <span style={{ color: DESIGN.colors.text.muted, fontSize: '0.75rem', marginRight: '0.5rem' }}>
          Mode:
        </span>
        {(['population', 'voters', 'density', 'turnout'] as DataType[]).map((type) => (
          <span
            key={type}
            style={{
              padding: '0.25rem 0.75rem',
              borderRadius: '4px',
              fontSize: '0.75rem',
              background: dataType === type ? DESIGN.colors.dataTypes[type] : 'transparent',
              color: dataType === type ? '#FFFFFF' : DESIGN.colors.text.muted,
              textTransform: 'capitalize',
            }}
          >
            {type}
          </span>
        ))}
      </div>

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
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {['Low', 'Medium', 'High', 'Very High'].map((label, i) => {
            const colors = {
              population: ['#DBEAFE', '#93C5FD', '#3B82F6', '#1D4ED8'],
              voters: ['#D1FAE5', '#6EE7B7', '#10B981', '#047857'],
              density: ['#FEF3C7', '#FCD34D', '#F59E0B', '#D97706'],
              turnout: ['#EDE9FE', '#C4B5FD', '#8B5CF6', '#6D28D9'],
            };
            return (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <span
                  style={{
                    width: '12px',
                    height: '12px',
                    background: colors[dataType][i],
                    borderRadius: '2px',
                  }}
                />
                <span style={{ color: DESIGN.colors.text.secondary, fontSize: '0.7rem' }}>{label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// D2: Regional Breakdown Cell
function RegionalBreakdownCell({
  dataType,
}: {
  dataType: DataType;
}) {
  const getValue = (region: RegionalData) => {
    switch (dataType) {
      case 'population':
        return region.population;
      case 'voters':
        return region.voters;
      case 'density':
        return Math.round(region.population / 60000); // Approximate area
      case 'turnout':
        return Math.round((region.voters / region.population) * 100);
      default:
        return 0;
    }
  };

  const total = MOCK_REGIONAL_DATA.reduce((sum, r) => sum + getValue(r), 0);

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
        By Region
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', flex: 1 }}>
        {MOCK_REGIONAL_DATA.map((region) => {
          const value = getValue(region);
          const percentage = Math.round((value / total) * 100);
          return (
            <div key={region.region}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                <span style={{ color: DESIGN.colors.text.primary, fontSize: '0.85rem' }}>
                  {region.region}
                </span>
                <span style={{ color: DESIGN.colors.text.secondary, fontSize: '0.85rem' }}>
                  {percentage}%
                </span>
              </div>
              <div
                style={{
                  height: '8px',
                  background: 'rgba(255,255,255,0.1)',
                  borderRadius: '4px',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${percentage}%`,
                    height: '100%',
                    background: DESIGN.colors.regions[region.region as keyof typeof DESIGN.colors.regions],
                    borderRadius: '4px',
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// A3: Election Year Cell
function ElectionYearCell({
  selectedYear,
  onSelect,
}: {
  selectedYear: number;
  onSelect: (year: number) => void;
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
        Election Year
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        {ELECTION_YEARS.map((year) => (
          <label
            key={year}
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
              name="electionYear"
              checked={selectedYear === year}
              onChange={() => onSelect(year)}
              style={{
                width: '14px',
                height: '14px',
                accentColor: DESIGN.colors.accent,
              }}
            />
            <span
              style={{
                color: selectedYear === year ? DESIGN.colors.accent : DESIGN.colors.text.primary,
                fontSize: '0.9rem',
                fontWeight: selectedYear === year ? 600 : 400,
              }}
            >
              {year}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

// B3: Population Pyramid Cell
function PopulationPyramidCell() {
  const ageGroups = [
    { group: '60+', male: 4, female: 5 },
    { group: '45-59', male: 8, female: 9 },
    { group: '30-44', male: 15, female: 16 },
    { group: '15-29', male: 25, female: 26 },
    { group: '0-14', male: 24, female: 23 },
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
          textAlign: 'center',
        }}
      >
        Population by Age Group
      </h3>

      <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <span style={{ width: '10px', height: '10px', background: '#3B82F6', borderRadius: '2px' }} />
          <span style={{ color: DESIGN.colors.text.muted, fontSize: '0.7rem' }}>Male</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <span style={{ width: '10px', height: '10px', background: '#EC4899', borderRadius: '2px' }} />
          <span style={{ color: DESIGN.colors.text.muted, fontSize: '0.7rem' }}>Female</span>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
        {ageGroups.map((row) => (
          <div key={row.group} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {/* Male bar (right-aligned) */}
            <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
              <div
                style={{
                  width: `${row.male * 3}%`,
                  height: '14px',
                  background: '#3B82F6',
                  borderRadius: '2px 0 0 2px',
                }}
              />
            </div>
            {/* Age label */}
            <span
              style={{
                width: '3rem',
                textAlign: 'center',
                color: DESIGN.colors.text.secondary,
                fontSize: '0.7rem',
              }}
            >
              {row.group}
            </span>
            {/* Female bar (left-aligned) */}
            <div style={{ flex: 1 }}>
              <div
                style={{
                  width: `${row.female * 3}%`,
                  height: '14px',
                  background: '#EC4899',
                  borderRadius: '0 2px 2px 0',
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// C3: Registration Trend Cell
function RegistrationTrendCell() {
  const growth = Math.round(
    ((MOCK_TREND_DATA[MOCK_TREND_DATA.length - 1].registeredVoters - MOCK_TREND_DATA[0].registeredVoters) /
      MOCK_TREND_DATA[0].registeredVoters) *
      100
  );

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
        Voter Registration Over Time
      </h3>
      <div style={{ flex: 1, minHeight: '80px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={MOCK_TREND_DATA}>
            <XAxis
              dataKey="year"
              tick={{ fill: DESIGN.colors.text.muted, fontSize: 10 }}
              axisLine={{ stroke: DESIGN.colors.cardBorder }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: DESIGN.colors.text.muted, fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${(v / 1000000).toFixed(0)}M`}
              width={35}
            />
            <Tooltip
              contentStyle={{
                background: DESIGN.colors.cardBg,
                border: `1px solid ${DESIGN.colors.cardBorder}`,
                borderRadius: '8px',
                color: DESIGN.colors.text.primary,
              }}
              formatter={(value: number) => [`${(value / 1000000).toFixed(1)}M`, 'Voters']}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="registeredVoters"
              stroke={DESIGN.colors.dataTypes.voters}
              strokeWidth={2}
              dot={{ fill: DESIGN.colors.dataTypes.voters, strokeWidth: 0, r: 3 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.25rem',
          marginTop: '0.5rem',
          color: '#10B981',
          fontSize: '0.75rem',
        }}
      >
        <TrendingUp size={12} />
        <span>+{growth}% (2001-2026)</span>
      </div>
    </div>
  );
}

// D3: Back to Home Cell
function BackToHomeCell() {
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
        gap: '0.75rem',
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
          padding: '0.75rem',
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
          padding: '0.6rem',
          borderRadius: '8px',
          border: `1px solid ${DESIGN.colors.cardBorder}`,
          cursor: 'pointer',
          background: 'transparent',
          color: DESIGN.colors.text.secondary,
          fontSize: '0.8rem',
        }}
      >
        <Download size={14} />
        Export
      </button>
      <button
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5rem',
          padding: '0.6rem',
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
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================
export function DemographicsBroadcastHome() {
  const [dataType, setDataType] = useState<DataType>('population');
  const [selectedYear, setSelectedYear] = useState(2026);
  const [selectedRegions, setSelectedRegions] = useState<string[]>(['Central', 'Eastern', 'Northern', 'Western']);

  const toggleRegion = (region: string) => {
    setSelectedRegions((prev) =>
      prev.includes(region) ? prev.filter((r) => r !== region) : [...prev, region]
    );
  };

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
        <DataTypeSelectorCell dataType={dataType} onSelect={setDataType} />
        <NationalPopulationCell dataType={dataType} />
        <TopDistrictsCell dataType={dataType} />
        <VoterDensityStatsCell />

        {/* Row 2 */}
        <RegionFilterCell selectedRegions={selectedRegions} onToggle={toggleRegion} />
        <DemographicsMapCell dataType={dataType} selectedRegions={selectedRegions} />
        <RegionalBreakdownCell dataType={dataType} />

        {/* Row 3 */}
        <ElectionYearCell selectedYear={selectedYear} onSelect={setSelectedYear} />
        <PopulationPyramidCell />
        <RegistrationTrendCell />
        <BackToHomeCell />
      </div>
    </div>
  );
}
