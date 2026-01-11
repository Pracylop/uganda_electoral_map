# Past Elections Broadcast Home - Layout Specification

**Purpose:** Historical election comparison and analysis for broadcast
**Navigation:** Accessed from BroadcastHome D2 cell (Past Elections bar graph)
**Component:** `PastElectionsBroadcastHome.tsx`
**Version:** 1.0
**Date:** 2026-01-09

---

## Overview

This page provides a comprehensive view of historical presidential election data, enabling presenters to compare results, trends, and voter turnout across multiple election cycles (1996-2021).

**Key Features:**
- Year/election selector for quick switching
- Side-by-side election comparison
- Historical trend visualization
- Winner showcase with key statistics

---

## Grid Structure

### Columns (12 total → 4 subsections)

| Subsection | Columns | Width | Description |
|------------|---------|-------|-------------|
| A | 1-2 | 2/12 | Election selector & stats |
| B | 3-6 | 4/12 | Winner showcase & map |
| C | 7-10 | 4/12 | Comparison charts |
| D | 11-12 | 2/12 | Quick stats & navigation |

### Rows (3 total)

| Row | Name | Height | Description |
|-----|------|--------|-------------|
| 1 | TOP | 30vh | Election header & winner |
| 2 | MIDDLE | 40vh | Main comparison content |
| 3 | BOTTOM | 30vh | Trends & detailed stats |

---

## Visual Grid

```
┌─────────────────────────────────────────────────────────────────────────┐
│           A (2col)      B (4col)         C (4col)         D (2col)      │
│           16.67%        33.33%           33.33%           16.67%        │
├───────────────┬───────────────────┬───────────────────┬─────────────────┤
│               │                   │                   │                 │
│      A1       │        B1         │        C1         │       D1        │
│               │                   │                   │                 │  30vh
│  Year         │  Winner           │  Top 3            │  Turnout        │
│  Selector     │  Showcase         │  Candidates       │  Stats          │
├───────────────┼───────────────────┼───────────────────┼─────────────────┤
│               │                   │                   │                 │
│      A2       │        B2         │        C2         │       D2        │
│               │                   │                   │                 │  40vh
│  Election     │  Historical       │  Vote Share       │  Compare        │
│  List         │  Map              │  Bar Chart        │  Elections      │
├───────────────┼───────────────────┼───────────────────┼─────────────────┤
│               │                   │                   │                 │
│      A3       │        B3         │        C3         │       D3        │
│               │                   │                   │                 │  30vh
│  Key          │  Regional         │  Turnout          │  Back to        │
│  Metrics      │  Breakdown        │  Trend            │  Home           │
└───────────────┴───────────────────┴───────────────────┴─────────────────┘
```

---

## Cell Definitions

### Row 1 (TOP) - Header Section

| Cell | ID | Content | Description |
|------|-----|---------|-------------|
| A1 | YearSelectorCell | Year buttons (1996-2021) | Click to switch between elections |
| B1 | WinnerShowcaseCell | Winner photo, name, party, percentage | Large featured winner display |
| C1 | TopCandidatesCell | Top 3 candidates with results | Horizontal card layout |
| D1 | TurnoutStatsCell | Turnout %, total votes | Key statistics |

### Row 2 (MIDDLE) - Main Content

| Cell | ID | Content | Description |
|------|-----|---------|-------------|
| A2 | ElectionListCell | List of all elections for year | Parliamentary, Presidential, etc. |
| B2 | HistoricalMapCell | Uganda map with winner colors | Static choropleth showing results |
| C2 | VoteShareChartCell | Horizontal bar chart | All candidates vote percentages |
| D2 | CompareElectionsCell | Side-by-side comparison picker | Select 2 elections to compare |

### Row 3 (BOTTOM) - Trends & Details

| Cell | ID | Content | Description |
|------|-----|---------|-------------|
| A3 | KeyMetricsCell | Registered voters, valid votes, invalid | Detailed statistics |
| B3 | RegionalBreakdownCell | Top 5 regions for winner | Regional performance |
| C3 | TurnoutTrendCell | Line chart across all elections | Historical turnout trend |
| D3 | BackToHomeCell | Navigation back to BroadcastHome | Return button |

---

## Cell Specifications

### A1: Year Selector Cell
```
┌─────────────────┐
│ SELECT YEAR     │
├─────────────────┤
│ [2021] ← Active │
│ [2016]          │
│ [2011]          │
│ [2006]          │
│ [2001]          │
│ [1996]          │
└─────────────────┘
```
- Vertical button list
- Active year highlighted in cyan
- Click switches all data

### B1: Winner Showcase Cell
```
┌──────────────────────────────────────┐
│  ┌────────┐                          │
│  │  📷    │  YOWERI MUSEVENI         │
│  │ Photo  │  National Resistance Mvt │
│  │  40%h  │                          │
│  └────────┘  ████████████  58.64%    │
│                                      │
│              12,456,789 votes        │
└──────────────────────────────────────┘
```
- Photo: 40% height, left-aligned
- Name, party, percentage bar
- Total votes count

### C1: Top Candidates Cell
Internal proportions:
- Cards row: 80% height
- Each card: 30% width
- Similar to BroadcastHome C1

### D1: Turnout Stats Cell
```
┌─────────────────┐
│ TURNOUT         │
│ 57.22%          │
│ ▓▓▓▓▓▓▓░░░      │
├─────────────────┤
│ Total: 10.5M    │
│ Reg:   18.1M    │
└─────────────────┘
```

### B2: Historical Map Cell
- Static choropleth (no interaction)
- Districts colored by winner
- Legend overlay

### C2: Vote Share Bar Chart
```
┌──────────────────────────────────────┐
│  NRM  ████████████████████  58.64%   │
│  NUP  ████████████          35.08%   │
│  FDC  ███                    3.24%   │
│  IND  ██                     1.83%   │
│  DP   █                      0.56%   │
└──────────────────────────────────────┘
```
- Horizontal bars
- Party colors
- All candidates listed

### D2: Compare Elections Cell
```
┌─────────────────┐
│ COMPARE         │
├─────────────────┤
│ Election 1:     │
│ [2021 ▼]        │
│                 │
│ Election 2:     │
│ [2016 ▼]        │
│                 │
│ [COMPARE →]     │
└─────────────────┘
```
- Two dropdowns
- Compare button navigates to comparison view

### C3: Turnout Trend Cell
- Line chart (Recharts)
- X-axis: Years (1996-2021)
- Y-axis: Turnout %
- Reference line at average

### D3: Back to Home Cell
```
┌─────────────────┐
│                 │
│    [← HOME]     │
│                 │
│  Return to      │
│  Broadcast      │
└─────────────────┘
```
- Large navigation button
- Returns to BroadcastHome

---

## Data Sources

| Data | API Endpoint | Notes |
|------|--------------|-------|
| Elections list | `GET /api/elections` | Filter by type=Presidential |
| Election results | `GET /api/map/national/{id}` | National totals |
| Candidates | `GET /api/elections/{id}/candidates` | With photos |
| Regional data | `GET /api/elections/{id}/results?level=2` | District breakdown |

---

## State Management

```typescript
interface PastElectionsState {
  selectedYear: number;           // Active year (1996-2021)
  selectedElectionId: number;     // Presidential election for year
  compareElection1: number | null;
  compareElection2: number | null;
  nationalData: NationalTotals | null;
  loading: boolean;
}
```

---

## Navigation Flow

```
BroadcastHome (D2: Past Elections bar graph)
    │
    ▼ Click bar or "Compare →"
┌─────────────────────────────────────┐
│     PastElectionsBroadcastHome      │
│                                     │
│  - Year selector switches data      │
│  - Compare button → Comparison view │
│  - Back button → BroadcastHome      │
└─────────────────────────────────────┘
```

---

## Design Tokens

Follow `Design_Guide.md` standards:
- Background: `#0A0E14`
- Cards: `rgba(22, 27, 34, 0.85)`
- Accent: `#00E5FF` (cyan), `#FFD700` (gold for winners)
- Grid: `2fr 4fr 4fr 2fr` columns, `30vh 40vh 30vh` rows

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-01-09 | Initial layout specification |
