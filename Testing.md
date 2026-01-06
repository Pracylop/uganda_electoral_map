# Testing Protocols

This document contains testing protocols for features implemented in the Uganda Electoral Map application.

---

## Polling Station Clustering (Step 2)

**Date:** 2026-01-06
**Feature:** Display polling stations as clustered markers on the map

### Prerequisites
- Application running locally (`npm run dev` in client and server)
- Logged in as any user
- At least one election with polling station data

### Test Cases

#### TC-PS-01: Toggle Visibility
1. Navigate to Map page (`/map`)
2. Select an election from the dropdown
3. Locate "Stations" section in toolbar
4. Click "Show" button
5. **Expected:** Orange/colored markers appear on map
6. Click "Hide" button
7. **Expected:** Markers disappear from map

#### TC-PS-02: Cluster Display
1. Enable polling stations (Show button)
2. Zoom out to view entire country
3. **Expected:** Markers are clustered into circles with counts
4. Cluster colors should vary by size:
   - Blue: Small clusters (<10 parishes)
   - Yellow: Medium clusters (10-50 parishes)
   - Pink: Large clusters (50+ parishes)

#### TC-PS-03: Cluster Expansion
1. With polling stations visible at low zoom
2. Click on a cluster circle
3. **Expected:** Map zooms in to expand the cluster
4. Repeat clicking clusters until individual markers visible
5. **Expected:** At high zoom, see individual orange markers

#### TC-PS-04: Station Popup
1. Zoom in until individual markers are visible (orange circles)
2. Click on an individual marker
3. **Expected:** Popup appears showing:
   - Parish name (bold header)
   - Subcounty and Constituency
   - Station count (e.g., "5 stations")
   - Voter count (e.g., "12,345 voters")
   - List of station names (up to 5)
4. Click elsewhere on map
5. **Expected:** Popup closes

#### TC-PS-05: Cursor Feedback
1. Hover over a cluster circle
2. **Expected:** Cursor changes to pointer
3. Move away from cluster
4. **Expected:** Cursor returns to default
5. Hover over individual marker
6. **Expected:** Cursor changes to pointer

#### TC-PS-06: Election Change
1. With polling stations enabled
2. Change selected election in dropdown
3. **Expected:** Markers update for new election data
4. Console should show "Loaded polling stations: X parishes"

#### TC-PS-07: Disabled State
1. Without selecting an election (or clear selection)
2. Observe "Stations" button
3. **Expected:** Button is disabled/grayed out
4. **Expected:** Cannot enable polling stations without election

#### TC-PS-08: Basemap Interaction
1. Enable polling stations
2. Open Map Settings widget (gear icon, bottom-left)
3. Switch basemap (Auto/Online/Offline)
4. **Expected:** Polling station markers persist after basemap change

### Known Limitations
- Markers show parish centroids, not individual station locations
- Reporting status coloring not implemented (future enhancement)
- Data loads for all districts at once (may be slow for large elections)

---

## Basemap Settings

**Date:** 2026-01-06
**Feature:** User-configurable basemap source with online/offline options

### Test Cases

#### TC-BS-01: Default Behavior (Auto Mode)
1. Navigate to any map page (Map, Demographics, Issues)
2. Open Map Settings widget (gear icon)
3. **Expected:** "Auto" is selected by default
4. **Expected:** Online status indicator shows green dot if connected

#### TC-BS-02: Manual Online Mode
1. Click "Online" button in settings
2. **Expected:** Map uses OSM raster tiles (more detailed labels)
3. Zoom in/out to verify tiles load

#### TC-BS-03: Manual Offline Mode
1. Click "Offline" button in settings
2. **Expected:** Map uses PMTiles (local vector tiles)
3. **Expected:** Labels may be sparser but map still functional

#### TC-BS-04: Settings Persistence
1. Set basemap to "Offline"
2. Refresh the page
3. **Expected:** Setting persists (Offline still selected)

#### TC-BS-05: Auto-Switching (requires network toggle)
1. Set basemap to "Auto"
2. Disconnect from network (airplane mode)
3. **Expected:** Map automatically uses offline tiles
4. Reconnect to network
5. **Expected:** Map switches back to online tiles

---

## Click-to-Navigate (District Navigation)

**Date:** 2026-01-06
**Feature:** Click on basemap to navigate to district

### Test Cases

#### TC-CN-01: Basemap Click Navigation
1. Navigate to Map page with election selected
2. Drill down into a district (click on choropleth region)
3. Click on basemap area (white/gray area outside colored regions)
4. **Expected:** "Navigating to [District]" popup appears briefly
5. **Expected:** Map navigates to clicked district showing constituencies
6. **Expected:** Popup auto-closes when navigation completes

#### TC-CN-02: Breadcrumb Reset
1. Drill deep into hierarchy (District > Constituency > Subcounty)
2. Click on basemap in a different district area
3. **Expected:** Breadcrumb resets to: Uganda > [New District]
4. **Expected:** Shows constituencies of new district

#### TC-CN-03: Works on All Map Pages
1. Test basemap click on Demographics page
2. Test basemap click on Issues page
3. **Expected:** Navigation works consistently across all map views

---

## Heat Map for Incidents (Step 6)

**Date:** 2026-01-06
**Feature:** Heatmap visualization for electoral issues/incidents

### Prerequisites
- Application running locally (`npm run dev` in client and server)
- Logged in as any user
- At least some issues in the database

### Test Cases

#### TC-HM-01: Enable Heatmap View
1. Navigate to Issues page (`/issues`)
2. Ensure "Map" view is selected (not List)
3. Click "Heatmap" button in the map type toggle
4. **Expected:** Map displays heatmap visualization showing incident density
5. **Expected:** Red/orange gradient shows hot spots where issues are concentrated

#### TC-HM-02: Heatmap Color Gradient
1. With heatmap enabled, observe the visualization
2. **Expected:** Areas with more issues appear in warmer colors (red/orange)
3. **Expected:** Areas with fewer issues appear in cooler colors (yellow/transparent)
4. **Expected:** Empty areas are transparent (basemap visible)

#### TC-HM-03: Intensity Control
1. With heatmap enabled, locate the legend (bottom-left)
2. Find the "Intensity" slider
3. Drag slider to minimum (left)
4. **Expected:** Heatmap becomes more transparent/subtle
5. Drag slider to maximum (right)
6. **Expected:** Heatmap becomes more intense/vibrant
7. Console shows heatmap reloads with new intensity value

#### TC-HM-04: Radius Control
1. With heatmap enabled, locate the "Radius" slider in legend
2. Drag slider to minimum (left)
3. **Expected:** Heat spots become tighter/more focused
4. Drag slider to maximum (right)
5. **Expected:** Heat spots spread out more

#### TC-HM-05: Filter Interaction
1. With heatmap enabled, select a category from the filter dropdown
2. **Expected:** Heatmap updates to show only that category's issues
3. Select a severity level
4. **Expected:** Heatmap further filters to that severity
5. Click "Clear" to remove filters
6. **Expected:** Heatmap shows all issues again

#### TC-HM-06: Zoom Behavior
1. With heatmap enabled, zoom out to see entire country
2. **Expected:** Heat spots merge together at low zoom
3. Zoom in to a specific region
4. **Expected:** Heat spots become more detailed/separated
5. At high zoom, heatmap should fade slightly (0.5 opacity)

#### TC-HM-07: Legend Display
1. With heatmap enabled, observe the legend
2. **Expected:** Shows gradient bar from light to dark
3. **Expected:** Labels show "Low" and "High" density
4. **Expected:** Intensity and Radius sliders are visible

#### TC-HM-08: Switch Between Map Types
1. Start with Choropleth view
2. Switch to Heatmap
3. **Expected:** Choropleth removed, heatmap displayed
4. Switch to Points
5. **Expected:** Heatmap removed, point markers displayed
6. Switch back to Choropleth
7. **Expected:** Points removed, choropleth displayed

### Notes
- Heatmap uses severity as weight (higher severity = more intense)
- Heatmap color ramp: transparent → light yellow → orange → red
- Default intensity: 1.0, Default radius: 20

---

## Annotation Tools (Step 7)

**Date:** 2026-01-06
**Feature:** Drawing and highlighting tools for broadcast presentations

### Prerequisites
- Application running locally (`npm run dev` in client and server)
- Navigate to Broadcast mode (`/broadcast`)
- Select an election

### Test Cases

#### TC-AN-01: Enter Annotation Mode
1. In broadcast mode, press `A` key or click annotation icon in sidebar
2. **Expected:** Annotation toolbar appears at bottom of screen
3. **Expected:** Map panning/zooming is disabled
4. **Expected:** Cursor changes to crosshair when over map

#### TC-AN-02: Circle Tool
1. Enter annotation mode
2. Click Circle tool in toolbar
3. Click and drag on map
4. **Expected:** Circle preview appears while dragging
5. Release mouse
6. **Expected:** Circle annotation rendered with selected color

#### TC-AN-03: Arrow Tool
1. Click Arrow tool in toolbar
2. Click start point, drag to end point
3. **Expected:** Arrow with head rendered from start to end
4. Verify arrow head points in correct direction

#### TC-AN-04: Rectangle/Highlight Tool
1. Click Highlight (square) tool in toolbar
2. Click and drag to create rectangle
3. **Expected:** Semi-transparent filled rectangle appears
4. **Expected:** Rectangle has colored border

#### TC-AN-05: Freehand Tool
1. Click Freehand (pencil) tool in toolbar
2. Click and drag freely on map
3. **Expected:** Smooth line follows mouse movement
4. Release to finish drawing

#### TC-AN-06: Text Tool
1. Click Text tool in toolbar
2. Click on map where text should appear
3. **Expected:** Prompt asks for text input
4. Enter text and confirm
5. **Expected:** Text rendered at clicked location with shadow

#### TC-AN-07: Color Selection
1. With any drawing tool selected
2. Click different color buttons (Yellow, Blue, Red, etc.)
3. Draw an annotation
4. **Expected:** Annotation uses selected color

#### TC-AN-08: Stroke Width
1. Select freehand or circle tool
2. Click different stroke width options (Thin/Medium/Thick)
3. Draw annotations
4. **Expected:** Line thickness varies accordingly

#### TC-AN-09: Undo/Redo
1. Draw several annotations
2. Click Undo button or press `Z`
3. **Expected:** Last annotation removed
4. Click Redo button or press `Y`
5. **Expected:** Annotation restored
6. Verify multiple undo/redo operations work

#### TC-AN-10: Clear All
1. Draw multiple annotations and highlight some regions
2. Click Clear All (trash) button
3. **Expected:** All SVG annotations removed
4. **Expected:** All region highlights removed

#### TC-AN-11: Region Highlighting
1. Enter annotation mode
2. Click on a colored region (district/constituency)
3. **Expected:** Region gets highlighted with current color
4. Click same region again
5. **Expected:** Highlight removed (toggle behavior)
6. Click multiple different regions
7. **Expected:** Multiple regions can be highlighted simultaneously

#### TC-AN-12: Exit Annotation Mode
1. With annotations drawn
2. Press `Escape` or click X button
3. **Expected:** Annotation toolbar closes
4. **Expected:** Map interactions re-enabled
5. **Expected:** Annotations remain visible on map

### Keyboard Shortcuts
| Key | Action |
|-----|--------|
| A | Toggle annotation mode |
| Z | Undo |
| Y | Redo |
| Escape | Exit annotation mode |

### Notes
- Annotations are SVG overlays, not saved to database
- Region highlights use map layers, cleared with "Clear All"
- Default highlight color is NRM Yellow (#FBBF24)

---
