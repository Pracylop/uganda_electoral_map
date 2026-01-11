# Current Election Broadcast Home - Layout Specification

**Purpose:** Live 2026 election results dashboard for broadcast
**Navigation:** Accessed from BroadcastHome B1/C1 DETAILS buttons
**Component:** `CurrentElectionBroadcastHome.tsx`
**Version:** 1.0
**Date:** 2026-01-09

---

## Overview

This is the primary broadcast interface for the current (2026) election. It provides real-time results, live-updating tallies, and detailed candidate information for on-air reporting.

**Key Features:**
- Live vote tallies with odometer-style counters
- Interactive "Magic Wall" map with drill-down
- Election type selector (Presidential, Parliamentary, etc.)
- Real-time reporting progress

---

## Grid Structure

### Columns (12 total → 4 subsections)

| Subsection | Columns | Width | Description |
|------------|---------|-------|-------------|
| A | 1-2 | 2/12 | Election selector & progress |
| B | 3-6 | 4/12 | Main map view |
| C | 7-10 | 4/12 | Candidate leaderboard |
| D | 11-12 | 2/12 | Statistics & navigation |

### Rows (3 total)

| Row | Name | Height | Description |
|-----|------|--------|-------------|
| 1 | TOP | 25vh | Header with leading candidate |
| 2 | MIDDLE | 50vh | Map and leaderboard |
| 3 | BOTTOM | 25vh | Stats and secondary info |

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
│  Election     │  Leading          │  Live Vote        │  Reporting      │
│  Type Tabs    │  Candidate        │  Counter          │  Progress       │
├───────────────┼───────────────────┴───────────────────┼─────────────────┤
│               │                                       │                 │
│      A2       │              B2 + C2                  │       D2        │
│               │         (Map spans 2 cols)            │                 │  50vh
│  Region       │                                       │  National       │
│  Selector     │          MAGIC WALL MAP               │  Totals         │
│               │                                       │                 │
├───────────────┼───────────────────┬───────────────────┼─────────────────┤
│               │                   │                   │                 │
│      A3       │        B3         │        C3         │       D3        │
│               │                   │                   │                 │  25vh
│  Quick        │  Candidate        │  Party Seats      │  Back to        │
│  Stats        │  Cards            │  Summary          │  Home           │
└───────────────┴───────────────────┴───────────────────┴─────────────────┘
```

---

## Cell Definitions

### Row 1 (TOP) - Header Section

| Cell | ID | Content | Description |
|------|-----|---------|-------------|
| A1 | ElectionTypeTabs | Presidential, MP, Woman MP tabs | Switch between election types |
| B1 | LeadingCandidateCell | Large winner display | Photo, name, party, percentage |
| C1 | LiveVoteCounterCell | Odometer vote counter | Animated real-time counter |
| D1 | ReportingProgressCell | Progress ring + percentage | Units reported / total |

### Row 2 (MIDDLE) - Main Content

| Cell | ID | Content | Description |
|------|-----|---------|-------------|
| A2 | RegionSelectorCell | Drill-down breadcrumb + region buttons | Navigate admin levels |
| B2+C2 | MagicWallMapCell | Interactive Uganda map (SPANS 2 COLUMNS) | Choropleth with touch interaction |
| D2 | NationalTotalsCell | Total votes, turnout, registered | Key national figures |

### Row 3 (BOTTOM) - Secondary Content

| Cell | ID | Content | Description |
|------|-----|---------|-------------|
| A3 | QuickStatsCell | Valid votes, invalid votes, spoilt | Detailed vote breakdown |
| B3 | CandidateCardsCell | Top 4 candidate cards | Photo, votes, percentage |
| C3 | PartySeatsSummaryCell | Party distribution bars | Parliamentary seat counts |
| D3 | BackToHomeCell | Navigation + controls | Return to BroadcastHome |

---

## Cell Specifications

### A1: Election Type Tabs
```
┌─────────────────┐
│ ELECTION TYPE   │
├─────────────────┤
│ [PRESIDENTIAL]  │ ← Active (gold)
│ [PARLIAMENT]    │
│ [WOMAN MP]      │
│ [LOCAL]         │
└─────────────────┘
```
- Vertical tabs
- Active tab highlighted in gold
- Switches all displayed data

### B1: Leading Candidate Cell (Hero Display)
```
┌──────────────────────────────────────┐
│   ┌─────────┐                        │
│   │   📷    │   LEADING              │
│   │  Photo  │   ─────────            │
│   │  60%h   │   YOWERI MUSEVENI      │
│   └─────────┘   NRM · 58.64%         │
│                                      │
│   ████████████████████ 12,456,789    │
└──────────────────────────────────────┘
```
- Large photo (60% of cell height)
- "LEADING" label
- Progress bar under percentage

### C1: Live Vote Counter Cell
```
┌──────────────────────────────────────┐
│            TOTAL VOTES               │
│                                      │
│     1 2 , 4 5 6 , 7 8 9             │
│     ┌─┐┌─┐ ┌─┐┌─┐┌─┐ ┌─┐┌─┐┌─┐     │
│     │1││2│ │4││5││6│ │7││8││9│     │ ← Odometer style
│     └─┘└─┘ └─┘└─┘└─┘ └─┘└─┘└─┘     │
│                                      │
│      +1,234 votes/min               │
└──────────────────────────────────────┘
```
- Large odometer-style numbers (JetBrains Mono)
- Vote velocity indicator

### D1: Reporting Progress Cell
```
┌─────────────────┐
│   REPORTING     │
│                 │
│      ┌───┐      │
│     /  89 \     │
│    │   %   │    │  ← Circular progress
│     \ ___ /     │
│      └───┘      │
│                 │
│  7,234 / 8,123  │
│  polling units  │
└─────────────────┘
```
- Circular progress indicator
- Units reported count

### B2+C2: Magic Wall Map (Spanning Cell)
```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│                    ┌────────────────┐                    │
│                    │                │                    │
│                    │    UGANDA      │                    │
│                    │   (Choropleth) │                    │
│                    │                │                    │
│                    │   [Touch to    │                    │
│                    │    drill-down] │                    │
│                    │                │                    │
│                    └────────────────┘                    │
│                                                          │
│  [🏠 Uganda > Central > Kampala]                        │
│                                                          │
│  Legend: █ NRM  █ NUP  █ FDC  █ IND                    │
└──────────────────────────────────────────────────────────┘
```
- Full interactive map
- Breadcrumb navigation at bottom
- Party color legend

### A2: Region Selector Cell
```
┌─────────────────┐
│ REGION          │
├─────────────────┤
│ ◉ National      │
│ ○ Central       │
│ ○ Eastern       │
│ ○ Northern      │
│ ○ Western       │
├─────────────────┤
│ ← Back to       │
│   previous      │
└─────────────────┘
```
- Radio-style region selector
- Back navigation

### D2: National Totals Cell
```
┌─────────────────┐
│ NATIONAL TOTALS │
├─────────────────┤
│ Turnout         │
│ 57.22%          │
│ ▓▓▓▓▓▓▓░░░      │
├─────────────────┤
│ Total Votes     │
│ 10,567,234      │
├─────────────────┤
│ Registered      │
│ 18,103,603      │
└─────────────────┘
```

### B3: Candidate Cards Cell
Similar to BroadcastHome C1:
- 4 cards in a row
- Photo, name, party, percentage
- 80% cards / 20% spacing

### C3: Party Seats Summary Cell
```
┌──────────────────────────────────────┐
│ PARLIAMENTARY SEATS                  │
├──────────────────────────────────────┤
│ NRM  ████████████████  194  (63%)   │
│ IND  ████              49   (16%)   │
│ NUP  ███               37   (12%)   │
│ FDC  ██                24   (8%)    │
│ DP   █                 5    (2%)    │
├──────────────────────────────────────┤
│ Total: 309 seats                     │
└──────────────────────────────────────┘
```

### D3: Back to Home Cell
```
┌─────────────────┐
│                 │
│   [← HOME]      │
│                 │
│   [REFRESH]     │
│                 │
│   Auto-update   │
│   [ON] / OFF    │
└─────────────────┘
```
- Home navigation
- Refresh button
- Auto-update toggle

---

## Data Sources

| Data | API Endpoint | WebSocket | Notes |
|------|--------------|-----------|-------|
| Elections | `GET /api/elections` | No | 2026 elections |
| National totals | `GET /api/map/national/{id}` | Yes | Live updates |
| District results | `GET /api/map/aggregated/{id}?level=2` | Yes | Map choropleth |
| Candidates | `GET /api/elections/{id}/candidates` | No | With photos |
| Parliamentary | `GET /api/elections/{id}/results?level=3` | Yes | Constituency winners |

---

## State Management

```typescript
interface CurrentElectionState {
  electionType: 'presidential' | 'parliamentary' | 'woman_mp' | 'local';
  selectedElectionId: number;
  adminLevel: number;              // 1=National, 2=Region, 3=District, etc.
  selectedRegionId: number | null;
  nationalData: NationalTotals | null;
  mapData: GeoJSON.FeatureCollection | null;
  autoUpdate: boolean;
  loading: boolean;
}
```

---

## Real-Time Features

### WebSocket Integration
```typescript
// Subscribe to live updates
ws.subscribe(`election:${electionId}:results`, (data) => {
  // Update vote counts
  // Trigger odometer animation
  // Update map choropleth
});
```

### Odometer Animation
- Uses CSS animation or library (odometer.js)
- Smooth scroll effect on number changes
- Highlights digits that changed

---

## Navigation Flow

```
BroadcastHome
    │
    ├─── B1 DETAILS button ──► CurrentElectionBroadcastHome
    │
    └─── C1 DETAILS button ──► CurrentElectionBroadcastHome
                                    │
                                    ├── Election type tabs switch data
                                    ├── Map drill-down for regions
                                    └── Back button → BroadcastHome
```

---

## Design Tokens

Follow `Design_Guide.md` standards:
- Background: `#0A0E14`
- Cards: `rgba(22, 27, 34, 0.85)`
- Accent: `#00E5FF` (cyan), `#FFD700` (gold for leaders)
- Live indicator: Pulsing red dot
- Grid: Modified for map span

### CSS Grid Implementation

```css
.current-election-grid {
  display: grid;
  grid-template-columns: 2fr 4fr 4fr 2fr;
  grid-template-rows: 25vh 50vh 25vh;
  gap: 1rem;
}

/* Map spans B2 and C2 */
.magic-wall-map {
  grid-column: 2 / 4;  /* Span columns 2-3 */
  grid-row: 2;
}
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-01-09 | Initial layout specification |
