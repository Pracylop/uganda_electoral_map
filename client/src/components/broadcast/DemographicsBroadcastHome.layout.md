# Demographics Broadcast Home - Layout Specification

**Purpose:** Demographic data visualization for broadcast
**Navigation:** Accessed from BroadcastSidebar Demographics icon
**Component:** `DemographicsBroadcastHome.tsx`
**Version:** 1.0
**Date:** 2026-01-09

---

## Overview

This page provides a comprehensive view of Uganda's demographic data including population, registered voters, and voter density. It's designed for broadcast reporting on electoral demographics and regional comparisons.

**Key Features:**
- Population distribution visualization
- Registered voters by region
- Voter density choropleth map
- Age group breakdown
- Regional comparison charts

---

## Grid Structure

### Columns (12 total → 4 subsections)

| Subsection | Columns | Width | Description |
|------------|---------|-------|-------------|
| A | 1-2 | 2/12 | Filters & region selector |
| B | 3-6 | 4/12 | Main map view |
| C | 7-10 | 4/12 | Statistics & charts |
| D | 11-12 | 2/12 | Quick stats & navigation |

### Rows (3 total)

| Row | Name | Height | Description |
|-----|------|--------|-------------|
| 1 | TOP | 25vh | National totals & top regions |
| 2 | MIDDLE | 50vh | Map and regional data |
| 3 | BOTTOM | 25vh | Charts and trends |

---

## Visual Grid

```
┌─────────────────────────────────────────────────────────────────────────┐
│           A (2col)      B (4col)         C (4col)         D (2col)      │
│           16.67%        33.33%           33.33%           16.67%        │
├───────────────┬───────────────────┬───────────────────┬─────────────────┤
│               │                   │                   │                 │
│      A1       │        B1         │        C1         │       D1        │
│               │                   │                   │                 │  25vh
│  Data         │  National         │  Top 5            │  Voter          │
│  Type         │  Population       │  Districts        │  Density        │
│  Selector     │  Counter          │  By Population    │  Stats          │
├───────────────┼───────────────────┴───────────────────┼─────────────────┤
│               │                                       │                 │
│      A2       │              B2 + C2                  │       D2        │
│               │         (Map spans 2 cols)            │                 │  50vh
│  Region       │                                       │  Regional       │
│  Filter       │        CHOROPLETH MAP                │  Breakdown      │
│               │                                       │                 │
├───────────────┼───────────────────┬───────────────────┼─────────────────┤
│               │                   │                   │                 │
│      A3       │        B3         │        C3         │       D3        │
│               │                   │                   │                 │  25vh
│  Election     │  Population       │  Registration     │  Back to        │
│  Year         │  Pyramid          │  Trend            │  Home           │
└───────────────┴───────────────────┴───────────────────┴─────────────────┘
```

---

## Cell Definitions

### Row 1 (TOP) - Header Section

| Cell | ID | Content | Description |
|------|-----|---------|-------------|
| A1 | DataTypeSelectorCell | Population, Voters, Density buttons | Switch data visualization |
| B1 | NationalPopulationCell | Large population count | "45,741,000 Population" |
| C1 | TopDistrictsCell | Top 5 districts by population | Ranked list with bars |
| D1 | VoterDensityStatsCell | National voter density stats | Voters per km² |

### Row 2 (MIDDLE) - Main Content

| Cell | ID | Content | Description |
|------|-----|---------|-------------|
| A2 | RegionFilterCell | Region checkboxes (Central, Eastern, etc.) | Filter map by region |
| B2+C2 | DemographicsMapCell | Choropleth map (SPANS 2 COLUMNS) | Population/voter density visualization |
| D2 | RegionalBreakdownCell | Breakdown by selected metric | Regional statistics |

### Row 3 (BOTTOM) - Charts & Navigation

| Cell | ID | Content | Description |
|------|-----|---------|-------------|
| A3 | ElectionYearCell | Year selector for historical comparison | 2016, 2021, 2026 |
| B3 | PopulationPyramidCell | Age/gender population pyramid | Demographic distribution |
| C3 | RegistrationTrendCell | Voter registration over time | Line chart 2001-2026 |
| D3 | BackToHomeCell | Navigation back to BroadcastHome | Return button |

---

## Cell Specifications

### A1: Data Type Selector Cell
```
┌─────────────────┐
│ DATA VIEW       │
├─────────────────┤
│ [POPULATION]    │ ← Active
│ [VOTERS]        │
│ [DENSITY]       │
│ [TURNOUT]       │
└─────────────────┘
```
- Vertical toggle buttons
- Active type highlighted in cyan
- Switches map and all data displays

### B1: National Population Cell
```
┌──────────────────────────────────────┐
│                                      │
│         45,741,000                   │
│     TOTAL POPULATION                 │
│                                      │
│   📈 +3.2% since 2021               │
│                                      │
└──────────────────────────────────────┘
```
- Large number display (JetBrains Mono, 48pt)
- Growth indicator
- Source label (Census year)

### C1: Top Districts Cell
```
┌──────────────────────────────────────┐
│ TOP DISTRICTS BY POPULATION          │
├──────────────────────────────────────┤
│ 1. Kampala    █████████████  1.8M   │
│ 2. Wakiso     ████████████   1.7M   │
│ 3. Mukono     ██████         0.8M   │
│ 4. Jinja      █████          0.6M   │
│ 5. Mbarara    ████           0.5M   │
└──────────────────────────────────────┘
```
- Horizontal bars
- Population in millions
- Click to zoom map

### D1: Voter Density Stats Cell
```
┌─────────────────┐
│ VOTER DENSITY   │
├─────────────────┤
│ National Avg    │
│ 85.2            │
│ voters/km²      │
├─────────────────┤
│ Highest: 4,123  │
│ (Kampala)       │
│                 │
│ Lowest: 12.4    │
│ (Kaabong)       │
└─────────────────┘
```
- Key density metrics
- Highest/lowest extremes

### A2: Region Filter Cell
```
┌─────────────────┐
│ REGIONS         │
├─────────────────┤
│ ☑ Central       │
│ ☑ Eastern       │
│ ☑ Northern      │
│ ☑ Western       │
├─────────────────┤
│ [CLEAR] [ALL]   │
└─────────────────┘
```
- Multi-select checkboxes
- Clear/Select All buttons

### B2+C2: Demographics Map (Spanning Cell)
```
┌──────────────────────────────────────────────────────────┐
│  Mode: [Population] [Registered] [Density] [Turnout]    │
├──────────────────────────────────────────────────────────┤
│                                                          │
│                    ┌────────────────┐                    │
│                    │                │                    │
│                    │    UGANDA      │                    │
│                    │  (Choropleth)  │                    │
│                    │                │                    │
│                    │   Darker =     │                    │
│                    │   Higher value │                    │
│                    │                │                    │
│                    └────────────────┘                    │
│                                                          │
│  [🏠 Uganda > Central]                                  │
│                                                          │
│  Legend: ░ Low  ▒ Medium  ▓ High  █ Very High          │
└──────────────────────────────────────────────────────────┘
```
- Choropleth visualization
- Drill-down navigation
- Gradient legend

### D2: Regional Breakdown Cell
```
┌─────────────────┐
│ BY REGION       │
├─────────────────┤
│ Central  35%    │
│ ████████████    │
│                 │
│ Western  25%    │
│ ████████        │
│                 │
│ Eastern  22%    │
│ ███████         │
│                 │
│ Northern 18%    │
│ █████           │
└─────────────────┘
```
- Regional percentage bars
- Color-coded by region

### B3: Population Pyramid Cell
```
┌──────────────────────────────────────┐
│      POPULATION BY AGE GROUP         │
│                                      │
│   Male           │         Female    │
│ ██████████████   │   ██████████████  │
│ ████████████     │     ████████████  │
│ ██████████       │       ██████████  │
│ ████████         │         ████████  │
│ ██████           │           ██████  │
│ ████             │             ████  │
│   0-14  15-29  30-44  45-59  60+     │
└──────────────────────────────────────┘
```
- Horizontal bar chart (bidirectional)
- Age groups on Y-axis
- Male/Female comparison

### C3: Registration Trend Cell
```
┌──────────────────────────────────────┐
│ VOTER REGISTRATION OVER TIME         │
├──────────────────────────────────────┤
│       📈                             │
│      /  \     /\     /\              │
│    /     \   /  \   /  \             │
│   /       \ /    \ /    \   ...      │
│ ─/─────────────────────────▶         │
│   2001   2006   2011   2016   2021   │
│                                      │
│ Growth: +42% (2001-2026)             │
└──────────────────────────────────────┘
```
- Line chart (Recharts)
- X-axis: Election years
- Y-axis: Registered voters

### A3: Election Year Cell
```
┌─────────────────┐
│ ELECTION YEAR   │
├─────────────────┤
│ ◉ 2026          │
│ ○ 2021          │
│ ○ 2016          │
│ ○ 2011          │
│ ○ 2006          │
└─────────────────┘
```
- Radio-style year selector
- Changes demographic data to that year

### D3: Back to Home Cell
```
┌─────────────────┐
│                 │
│   [← HOME]      │
│                 │
│   [EXPORT]      │
│   Data export   │
│                 │
│   [REFRESH]     │
└─────────────────┘
```
- Home navigation
- Data export button
- Refresh button

---

## Data Sources

| Data | API Endpoint | Notes |
|------|--------------|-------|
| Demographics | `GET /api/demographics/data?level={level}` | Population, voters |
| GeoJSON | `GET /api/demographics/geojson?level={level}` | Geographic boundaries |
| Admin Units | `GET /api/demographics/units?level={level}` | Unit metadata |
| Historical | `GET /api/demographics/historical?year={year}` | Past census data |

---

## State Management

```typescript
interface DemographicsState {
  // View
  dataType: 'population' | 'voters' | 'density' | 'turnout';
  selectedYear: number;
  selectedRegions: string[]; // 'Central', 'Eastern', etc.

  // Navigation
  drillDownStack: DrillDownItem[];
  currentLevel: number;

  // Data
  nationalStats: NationalDemographics | null;
  topDistricts: DistrictStats[];
  regionBreakdown: RegionStats[];

  loading: boolean;
}
```

---

## Navigation Flow

```
BroadcastHome
    │
    ├─── Sidebar Demographics Icon
    │
    ▼
┌─────────────────────────────────────┐
│      DemographicsBroadcastHome       │
│                                     │
│  - Data type switches visualization │
│  - Year selector for historical     │
│  - Map drill-down for regions       │
│  - Back button → BroadcastHome      │
└─────────────────────────────────────┘
```

---

## Color Coding

### Data Type Colors
| Type | Color | Hex |
|------|-------|-----|
| Population | Blue | `#3B82F6` |
| Voters | Green | `#10B981` |
| Density | Orange | `#F59E0B` |
| Turnout | Purple | `#8B5CF6` |

### Choropleth Gradients
```css
/* Population (Blue gradient) */
rgba(219, 234, 254, 0.7) → /* Light blue */
rgba(147, 197, 253, 0.8) → /* Medium blue */
rgba(59, 130, 246, 0.9)  → /* Blue */
rgba(29, 78, 216, 1)     → /* Dark blue */

/* Voter Density (Orange gradient) */
rgba(254, 243, 199, 0.7) → /* Light amber */
rgba(252, 211, 77, 0.8)  → /* Amber */
rgba(245, 158, 11, 0.9)  → /* Orange */
rgba(217, 119, 6, 1)     → /* Dark orange */
```

---

## Design Tokens

Follow `Design_Guide.md` standards:
- Background: `#0A0E14`
- Cards: `rgba(22, 27, 34, 0.85)`
- Primary accent: `#00E5FF` (cyan)
- Data accent: `#3B82F6` (blue for population)
- Grid: Modified for map span

### CSS Grid Implementation

```css
.demographics-grid {
  display: grid;
  grid-template-columns: 2fr 4fr 4fr 2fr;
  grid-template-rows: 25vh 50vh 25vh;
  gap: 1rem;
}

/* Map spans B2 and C2 */
.demographics-map {
  grid-column: 2 / 4;
  grid-row: 2;
}
```

---

## Accessibility Notes

- Color-blind friendly gradients with pattern overlays option
- High contrast text on all backgrounds
- Keyboard navigation for filter controls
- Screen reader support for data values

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-01-09 | Initial layout specification |
