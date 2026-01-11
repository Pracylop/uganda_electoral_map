# BroadcastHome Layout Specification

## Overview
This document defines the grid-based layout system for the BroadcastHome dashboard component. The layout uses a 12-column, 3-row grid system designed for broadcast display on large screens.

**Purpose:** Serve as a portal/hub to all Electoral Map features:
- Current election results (primary focus)
- Election incidents/issues awareness
- Historical election comparisons
- Demographic context

---

## Grid Structure

### Columns (12 total)
The viewport (excluding sidebar) is divided into 12 equal-width columns, grouped into 4 subsections:

| Subsection | Columns | Width   | Description              |
|------------|---------|---------|--------------------------|
| A          | 1-2     | 2/12    | Left statistics          |
| B          | 3-6     | 4/12    | Left main content        |
| C          | 7-10    | 4/12    | Right main content       |
| D          | 11-12   | 2/12    | Right stats & navigation |

### Rows (3 total)
| Row | Name   | Height | Description           |
|-----|--------|--------|-----------------------|
| 1   | TOP    | 30vh   | Header cards          |
| 2   | MIDDLE | 40vh   | Main content (map)    |
| 3   | BOTTOM | 30vh   | Secondary content     |

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
│  Leading      │  Election         │  Candidate        │  Election       │
│  Candidate    │  Details          │  Cards            │  Incidents      │
├───────────────┼───────────────────┼───────────────────┼─────────────────┤
│               │                   │                   │                 │
│      A2       │        B2         │        C2         │       D2        │
│               │                   │                   │                 │  40vh
│  District     │      MAP          │  Parliamentary    │  Past           │
│  Statistics   │  (Uganda)         │  Seats            │  Elections      │
├───────────────┼───────────────────┼───────────────────┼─────────────────┤
│               │                   │                   │                 │
│      A3       │        B3         │        C3         │       D3        │
│               │                   │                   │                 │  30vh
│  Turnout      │  Election         │  Trend            │  Demographics   │
│  Stats        │  Statistics       │  Chart            │  Overview       │
└───────────────┴───────────────────┴───────────────────┴─────────────────┘
```

---

## Cell Definitions

### Row 1 (TOP) - Header Section

| Cell | Content              | Description                                       |
|------|----------------------|---------------------------------------------------|
| A1   | Leading Candidate    | Photo (40%), name, party with proportional spacing |
| B1   | Election Details     | Election name, winner info, percentage, DETAILS button |
| C1   | Candidate Cards      | Top 3 candidates with photos, names, percentages + DETAILS button |
| D1   | Election Incidents   | Total incidents count, severity breakdown (nav cell) |

### Row 2 (MIDDLE) - Main Content

| Cell | Content              | Description                                       |
|------|----------------------|---------------------------------------------------|
| A2   | District Statistics  | Vote counts for key regions (top performing)      |
| B2   | Map                  | Interactive Uganda map with district boundaries   |
| C2   | Parliamentary Seats  | Party seat counts with progress bars + DETAILS button |
| D2   | Past Elections       | Historical voter turnout bar graph (nav cell)     |

### Row 3 (BOTTOM) - Secondary Content & Navigation

| Cell | Content              | Description                                       |
|------|----------------------|---------------------------------------------------|
| A3   | Turnout Stats        | Turnout %, total votes, registered voters         |
| B3   | Election Statistics  | Donut chart showing valid/invalid votes breakdown |
| C3   | Trend Chart          | Line chart: Winner vs Runner-up % over elections  |
| D3   | Demographics         | Population stats, voter registration (nav cell)   |

---

## Cell Layout Specifications

### A1: Leading Candidate
Internal proportions:
- Photo container: 40% height
- Spacer: 15% height (between photo and name)
- Name text: auto
- Spacer: 5% height (between name and party)
- Party text: auto

### C1: Candidate Cards
Internal proportions:
- Cards row: 80% height
  - Each card: 28% width, photo 50% of card height, text 50%
- Button row: 20% height (DETAILS button, right-aligned)

### C2: Parliamentary Seats
- Party rows with logo, abbreviation, progress bar, seat count
- Footer with total seats and DETAILS button

### D2: Past Elections (Bar Graph)
- Title: "Voter Turnout (%)"
- Bar graph with truncated Y-axis scale (55-75%)
- Bar heights in vh units for responsiveness
- Years: '01, '06, '11, '16, '21

### C3: Trend Chart (Recharts)
- Line chart using Recharts library
- Two lines: Winner (gold) and Runner-up (red)
- Reference line at 50.1%
- Y-axis: 0-100%
- Tooltip disabled animations to prevent crashes

---

## Navigation Cells

These cells serve as entry points to other sections of the application:

### D1: Election Incidents
- Key metric: Total active incidents count
- Severity breakdown: Critical/High/Medium bars
- Click navigates to Issues Map view

### D2: Past Elections
- Bar graph showing historical voter turnout
- Click navigates to historical comparison view
- Hover shows "Compare →" link

### D3: Demographics
- Key metrics: Total population, registered voters
- Visual: Registration progress bar
- Click navigates to Demographics view

---

## Design Tokens

### Colors
```css
--bg-primary: #0A0E14;              /* Main background */
--bg-card: rgba(22, 27, 34, 0.85);  /* Card background (glassmorphism) */
--border-card: rgba(0, 229, 255, 0.1); /* Card border */
--accent-cyan: #00E5FF;             /* Primary accent */
--accent-gold: #FFD700;             /* Secondary accent (leading/winner) */
--accent-red: #EF4444;              /* Incidents/alerts, runner-up */
--accent-green: #10B981;            /* Positive/demographics */
--text-primary: #FFFFFF;            /* Primary text */
--text-secondary: #8B949E;          /* Secondary text */
--text-muted: #484F58;              /* Muted text */
```

### Spacing
- Grid gap: 16px (1rem)
- Card padding: 16px (1rem)
- Card border-radius: 8px

### Typography
- Numbers: `font-family: monospace`
- Section headers: `text-transform: uppercase; letter-spacing: 0.05em`
- Touch targets: minimum 44px height

### Animations
- Transitions: 300ms ease
- Hover states: subtle brightness/scale changes
- Navigation cells: hover shows "View More" indicator
- Charts: animations disabled to prevent render loops

---

## Responsive Considerations

This layout uses vh units for row heights to enable scrolling:
- Grid rows: `30vh 40vh 30vh` (total 100vh, scrollable)
- Bar graph heights: vh-based for proportional scaling
- Images: percentage-based with aspect-square for circular photos

For smaller screens:
- Columns may stack vertically
- Map may take full width
- Statistics panels may collapse

---

## CSS Grid Implementation

```css
.broadcast-home-grid {
  display: grid;
  grid-template-columns: 2fr 4fr 4fr 2fr;
  grid-template-rows: 30vh 40vh 30vh;
  gap: 1rem;
  width: 100%;
}

/* Cell positioning (automatic via grid flow) */
/* Cells are rendered in order: A1, B1, C1, D1, A2, B2, C2, D2, A3, B3, C3, D3 */
```

---

## Content Summary by Feature Area

| Feature Area      | Cells              | Purpose                              |
|-------------------|--------------------|--------------------------------------|
| Election Results  | A1,B1,C1,A2,B2,A3,B3,C3 | Current election data           |
| Parliamentary     | C2                 | MP seat distribution by party        |
| Past Elections    | D2                 | Historical comparison gateway        |
| Election Incidents| D1                 | Issues/problems awareness gateway    |
| Demographics      | D3                 | Population data gateway              |

---

## Usage Notes

1. The sidebar is handled separately by `BroadcastApp.tsx` and can toggle left/right
2. This grid fills the remaining viewport after sidebar
3. Each cell should be a self-contained component for maintainability
4. Data is fetched from `/api/map/national/{electionId}` and `/api/elections`
5. Navigation cells (D1, D2, D3) should have clear hover states indicating clickability
6. Recharts Tooltip requires `isAnimationActive={false}` to prevent render crashes

---

## Version History

| Version | Date       | Changes                                    |
|---------|------------|--------------------------------------------|
| 1.0     | 2026-01-08 | Initial layout definition                  |
| 1.1     | 2026-01-08 | Added navigation cells for Past Elections, |
|         |            | Election Incidents, and Demographics       |
| 2.0     | 2026-01-09 | Updated to reflect current implementation: |
|         |            | - Reorganized cells (D1=Incidents, C1=Cards, etc.) |
|         |            | - Added proportional sizing specs for A1, C1 |
|         |            | - Changed row heights to vh units |
|         |            | - Added D2 bar graph specs |
|         |            | - Added C3 Recharts trend chart specs |
|         |            | - Added C2 Parliamentary Seats |
