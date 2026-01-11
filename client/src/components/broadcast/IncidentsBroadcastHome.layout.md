# Incidents Broadcast Home - Layout Specification

**Purpose:** Electoral incidents and issues dashboard for broadcast
**Navigation:** Accessed from BroadcastHome D1 cell (Election Incidents)
**Component:** `IncidentsBroadcastHome.tsx`
**Version:** 1.0
**Date:** 2026-01-09

---

## Overview

This page provides a comprehensive view of electoral incidents, irregularities, and issues. It's designed for broadcast reporting on election security and integrity.

**Key Features:**
- Real-time incident tracking
- Severity-based visualization
- Geographic distribution via choropleth/heatmap
- Category breakdown and analysis

---

## Grid Structure

### Columns (12 total → 4 subsections)

| Subsection | Columns | Width | Description |
|------------|---------|-------|-------------|
| A | 1-2 | 2/12 | Filters & severity |
| B | 3-6 | 4/12 | Main map view |
| C | 7-10 | 4/12 | Incident details |
| D | 11-12 | 2/12 | Statistics & navigation |

### Rows (3 total)

| Row | Name | Height | Description |
|-----|------|--------|-------------|
| 1 | TOP | 25vh | Header with totals & severity |
| 2 | MIDDLE | 50vh | Map and incident list |
| 3 | BOTTOM | 25vh | Charts and categories |

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
│  Severity     │  Total            │  Recent           │  Casualties     │
│  Breakdown    │  Counter          │  Incidents        │  Summary        │
├───────────────┼───────────────────┴───────────────────┼─────────────────┤
│               │                                       │                 │
│      A2       │              B2 + C2                  │       D2        │
│               │         (Map spans 2 cols)            │                 │  50vh
│  Category     │                                       │  Top            │
│  Filter       │       INCIDENT HEATMAP / MAP         │  Districts      │
│               │                                       │                 │
├───────────────┼───────────────────┬───────────────────┼─────────────────┤
│               │                   │                   │                 │
│      A3       │        B3         │        C3         │       D3        │
│               │                   │                   │                 │  25vh
│  Date         │  Category         │  Trend            │  Back to        │
│  Range        │  Pie Chart        │  Chart            │  Home           │
└───────────────┴───────────────────┴───────────────────┴─────────────────┘
```

---

## Cell Definitions

### Row 1 (TOP) - Header Section

| Cell | ID | Content | Description |
|------|-----|---------|-------------|
| A1 | SeverityBreakdownCell | Severity bars (Critical to Low) | Visual severity distribution |
| B1 | TotalCounterCell | Large incident count + status | "127 Active Incidents" |
| C1 | RecentIncidentsCell | Latest 3-4 incidents scrolling | Ticker-style recent reports |
| D1 | CasualtiesSummaryCell | Deaths, injuries, arrests | Key impact metrics |

### Row 2 (MIDDLE) - Main Content

| Cell | ID | Content | Description |
|------|-----|---------|-------------|
| A2 | CategoryFilterCell | Category checkboxes/buttons | Filter incidents by type |
| B2+C2 | IncidentMapCell | Heatmap/choropleth (SPANS 2 COLUMNS) | Geographic visualization |
| D2 | TopDistrictsCell | Districts ranked by incident count | Hotspot list |

### Row 3 (BOTTOM) - Analysis

| Cell | ID | Content | Description |
|------|-----|---------|-------------|
| A3 | DateRangeCell | Date picker for filtering | Time-based filtering |
| B3 | CategoryPieChartCell | Pie/donut chart by category | Category distribution |
| C3 | TrendChartCell | Line chart over time | Incidents per day/week |
| D3 | BackToHomeCell | Navigation back to BroadcastHome | Return button |

---

## Cell Specifications

### A1: Severity Breakdown Cell
```
┌─────────────────┐
│ SEVERITY        │
├─────────────────┤
│ ████ Critical 12│
│ ███  High     34│
│ ██   Medium   45│
│ █    Low      36│
├─────────────────┤
│ Total: 127      │
└─────────────────┘
```
- Horizontal bars color-coded
- Critical: Red (#EF4444)
- High: Orange (#F59E0B)
- Medium: Yellow (#FDE047)
- Low: Green (#10B981)

### B1: Total Counter Cell
```
┌──────────────────────────────────────┐
│                                      │
│          127                         │
│     ACTIVE INCIDENTS                 │
│                                      │
│   ● 12 Critical  ● 5 New Today      │
│                                      │
└──────────────────────────────────────┘
```
- Large number display (JetBrains Mono, 64pt)
- Pulsing dot if critical incidents exist
- "New Today" counter

### C1: Recent Incidents Cell (Ticker)
```
┌──────────────────────────────────────┐
│ LATEST REPORTS                       │
├──────────────────────────────────────┤
│ ● Violence - Kampala Central  2m ago │
│ ● Ballot Box - Wakiso         5m ago │
│ ● Intimidation - Mukono       8m ago │
│ ▼ scrolling...                       │
└──────────────────────────────────────┘
```
- Auto-scrolling ticker
- Category badge + location + time
- Click expands detail

### D1: Casualties Summary Cell
```
┌─────────────────┐
│ IMPACT          │
├─────────────────┤
│ 💀 Deaths    3  │
│ 🩹 Injuries  12 │
│ 🚔 Arrests   28 │
├─────────────────┤
│ Source: EC      │
└─────────────────┘
```
- Key impact metrics
- Icon + label + count

### A2: Category Filter Cell
```
┌─────────────────┐
│ CATEGORIES      │
├─────────────────┤
│ ☑ Violence      │
│ ☑ Intimidation  │
│ ☑ Ballot Issues │
│ ☑ Vote Buying   │
│ ☐ Hate Speech   │
│ ☐ Other         │
├─────────────────┤
│ [CLEAR] [ALL]   │
└─────────────────┘
```
- Multi-select checkboxes
- Clear/Select All buttons

### B2+C2: Incident Map (Spanning Cell)
```
┌──────────────────────────────────────────────────────────┐
│  Mode: [Choropleth] [Heatmap] [Points]                   │
├──────────────────────────────────────────────────────────┤
│                                                          │
│                    ┌────────────────┐                    │
│                    │                │                    │
│                    │    UGANDA      │                    │
│                    │   (Heatmap)    │                    │
│                    │                │                    │
│                    │   Red zones =  │                    │
│                    │   high density │                    │
│                    │                │                    │
│                    └────────────────┘                    │
│                                                          │
│  [🏠 Uganda > Kampala]                                  │
│                                                          │
│  Legend: ░ Low  ▒ Medium  ▓ High  █ Critical           │
└──────────────────────────────────────────────────────────┘
```
- Map mode toggle (choropleth/heatmap/points)
- Drill-down navigation
- Severity-based coloring

### D2: Top Districts Cell
```
┌─────────────────┐
│ HOTSPOTS        │
├─────────────────┤
│ 1. Kampala   43 │
│ 2. Wakiso    28 │
│ 3. Mukono    15 │
│ 4. Jinja     12 │
│ 5. Mbarara    9 │
├─────────────────┤
│ Click to zoom   │
└─────────────────┘
```
- Ranked list
- Click zooms map to district

### B3: Category Pie Chart Cell
```
┌──────────────────────────────────────┐
│         INCIDENTS BY CATEGORY        │
│                                      │
│              ┌───────┐               │
│            /    █    \               │
│           │  █     █  │              │
│            \   █████ /               │
│              └───────┘               │
│                                      │
│  █ Violence 35%  █ Ballot 25%       │
│  █ Intimid. 20%  █ Other  20%       │
└──────────────────────────────────────┘
```
- Donut/Pie chart
- Category legend below

### C3: Trend Chart Cell
```
┌──────────────────────────────────────┐
│ INCIDENTS OVER TIME                  │
├──────────────────────────────────────┤
│       📈                             │
│      /  \      /\                    │
│    /     \    /  \                   │
│   /       \  /    \                  │
│ ─/─────────\/──────\───▶            │
│   Jan 1    Jan 5    Jan 9           │
│                                      │
│ Peak: Jan 5 (Election Day)          │
└──────────────────────────────────────┘
```
- Line chart (Recharts)
- X-axis: Days/dates
- Y-axis: Incident count
- Highlight election day

### A3: Date Range Cell
```
┌─────────────────┐
│ DATE RANGE      │
├─────────────────┤
│ From:           │
│ [2026-01-01]    │
│                 │
│ To:             │
│ [2026-01-09]    │
│                 │
│ [APPLY]         │
├─────────────────┤
│ Quick: [Today]  │
│ [Week] [Month]  │
└─────────────────┘
```
- Date inputs
- Quick select buttons

### D3: Back to Home Cell
```
┌─────────────────┐
│                 │
│   [← HOME]      │
│                 │
│   [STATS →]     │
│   Full analysis │
│                 │
│   [REFRESH]     │
└─────────────────┘
```
- Home navigation
- Link to full stats page
- Refresh button

---

## Data Sources

| Data | API Endpoint | Notes |
|------|--------------|-------|
| Issues list | `GET /api/issues` | With filters |
| Categories | `GET /api/issues/categories` | Category list |
| Choropleth | `GET /api/issues/choropleth` | Geographic aggregation |
| GeoJSON | `GET /api/issues/geojson` | Point data |
| Stats | `GET /api/issues/stats` | Aggregated statistics |

---

## State Management

```typescript
interface IncidentsState {
  // Filters
  selectedCategories: number[];
  selectedSeverity: number | null;
  dateRange: { start: string; end: string };

  // View
  mapMode: 'choropleth' | 'heatmap' | 'points';
  drillDownStack: DrillDownItem[];

  // Data
  incidents: Issue[];
  totalCount: number;
  severityCounts: Record<number, number>;
  categoryCounts: Record<string, number>;
  topDistricts: { name: string; count: number }[];

  loading: boolean;
}
```

---

## Navigation Flow

```
BroadcastHome (D1: Election Incidents)
    │
    ▼ Click cell
┌─────────────────────────────────────┐
│       IncidentsBroadcastHome        │
│                                     │
│  - Category filters change data     │
│  - Map drill-down for regions       │
│  - Stats button → full stats page   │
│  - Back button → BroadcastHome      │
└─────────────────────────────────────┘
    │
    ▼ Click STATS
┌─────────────────────────────────────┐
│         IssuesStats Page            │
│   (Full analysis & charts)          │
└─────────────────────────────────────┘
```

---

## Color Coding

### Severity Colors
| Level | Name | Color | Hex |
|-------|------|-------|-----|
| 5 | Critical | Red | `#EF4444` |
| 4 | High | Orange | `#F97316` |
| 3 | Medium | Amber | `#F59E0B` |
| 2 | Medium-Low | Blue | `#3B82F6` |
| 1 | Low | Green | `#10B981` |

### Heatmap Gradient
```css
/* Low to High density */
rgba(254, 240, 217, 0.6) → /* Cream */
rgba(253, 204, 138, 0.7) → /* Light orange */
rgba(252, 141, 89, 0.8)  → /* Orange */
rgba(227, 74, 51, 0.9)   → /* Red-orange */
rgba(179, 0, 0, 1)       → /* Dark red */
```

---

## Design Tokens

Follow `Design_Guide.md` standards:
- Background: `#0A0E14`
- Cards: `rgba(22, 27, 34, 0.85)`
- Primary accent: `#00E5FF` (cyan)
- Alert accent: `#EF4444` (red for critical)
- Grid: Modified for map span

### CSS Grid Implementation

```css
.incidents-grid {
  display: grid;
  grid-template-columns: 2fr 4fr 4fr 2fr;
  grid-template-rows: 25vh 50vh 25vh;
  gap: 1rem;
}

/* Map spans B2 and C2 */
.incident-map {
  grid-column: 2 / 4;
  grid-row: 2;
}
```

---

## Accessibility Notes

- Critical incidents have pulsing animation for attention
- High contrast colors for severity badges
- Keyboard navigation for filter controls
- Screen reader announcements for new incidents

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-01-09 | Initial layout specification |
