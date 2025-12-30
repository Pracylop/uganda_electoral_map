# Uganda Electoral Map - Testing Documentation

This document contains test cases for verifying feature functionality. Use this for debugging and regression testing.

---

## Test Case Format

```
### [Feature Name]

**Test ID:** TEST-XXX
**Date Added:** YYYY-MM-DD
**Status:** Passing / Failing / Not Tested

**Prerequisites:**
- List of conditions that must be met before testing

**Test Steps:**
1. Step one
2. Step two
3. ...

**Expected Results:**
- What should happen

**Actual Results:**
- What actually happened (fill in during testing)

**Notes:**
- Any additional observations
```

---

## Feature Tests

---

### Map Comparison Mode - Sync Feature

**Test ID:** TEST-001
**Date Added:** 2024-12-29
**Status:** Not Tested

**Prerequisites:**
- Application running at http://localhost:5173
- User logged in
- At least 2 elections with results in database (e.g., 2016 and 2021 Presidential)

#### Test Case 1.1: Enable Comparison Mode

**Test Steps:**
1. Navigate to Electoral Map page
2. Select an election from the dropdown (e.g., 2021 Presidential)
3. Click "Compare Elections" button

**Expected Results:**
- Map splits into two side-by-side panels (50/50)
- Left map shows selected election with blue dropdown
- Right map shows a different election with green dropdown
- Purple "Sync On" button appears at bottom center
- Header election dropdown disappears

---

#### Test Case 1.2: Sync ON - Drill-Down Mirroring

**Test Steps:**
1. Enable comparison mode (Test 1.1)
2. Ensure sync button shows "🔗 Sync On" (purple)
3. Select "2021 Presidential Election" on left map
4. Select "2016 Presidential Election" on right map
5. Click on WAKISO district on the LEFT map

**Expected Results:**
- BOTH maps drill down to WAKISO constituencies
- Left map breadcrumb shows: Uganda > WAKISO > Constituencys
- Right map breadcrumb shows: Uganda > WAKISO > Constituencys
- Both maps zoom to fit WAKISO boundaries
- Each map shows its respective election's results (colors may differ)

---

#### Test Case 1.3: Sync ON - Breadcrumb Mirroring

**Test Steps:**
1. Complete Test 1.2 (both maps showing WAKISO constituencies)
2. Click "Uganda" in the LEFT map breadcrumb

**Expected Results:**
- BOTH maps return to national district view
- Left breadcrumb shows: Uganda > Districts
- Right breadcrumb shows: Uganda > Districts
- Both maps zoom to fit full Uganda

---

#### Test Case 1.4: Sync ON - Pan/Zoom Mirroring

**Test Steps:**
1. Enable comparison mode with sync ON
2. Both maps at district level (national view)
3. Use mouse to pan the LEFT map (drag to move)
4. Use mouse wheel to zoom the LEFT map

**Expected Results:**
- RIGHT map follows the pan movement
- RIGHT map follows the zoom level
- Both maps show the same geographic area

---

#### Test Case 1.5: Sync OFF - Independent Navigation

**Test Steps:**
1. Enable comparison mode
2. Click "🔗 Sync On" button to toggle OFF
3. Button should now show "🔓 Sync Off" (gray)
4. Click on WAKISO district on LEFT map
5. Click on KAMPALA district on RIGHT map

**Expected Results:**
- LEFT map shows WAKISO constituencies
- RIGHT map shows KAMPALA constituencies
- Maps show DIFFERENT geographic areas
- Breadcrumbs are independent

---

#### Test Case 1.6: Election Selection in Comparison Mode

**Test Steps:**
1. Enable comparison mode
2. Click the blue dropdown on LEFT map
3. Select a different election
4. Click the green dropdown on RIGHT map
5. Select another election

**Expected Results:**
- Left map reloads with new election data
- Right map reloads with new election data
- Drill-down state resets to district level for changed map
- Colors reflect winning parties for each respective election

---

#### Test Case 1.7: Exit Comparison Mode

**Test Steps:**
1. Enable comparison mode and drill down to a specific district
2. Click "Exit Compare" button

**Expected Results:**
- Map returns to single full-width view
- Header election dropdown reappears
- Left map's current view/drill-down state is preserved

---

### Choropleth Map Rendering

**Test ID:** TEST-002
**Date Added:** 2024-12-29
**Status:** Not Tested

**Prerequisites:**
- Application running
- Election with results in database

#### Test Case 2.1: District Level Choropleth

**Test Steps:**
1. Navigate to Electoral Map
2. Select an election with results

**Expected Results:**
- Map displays all districts colored by winning party
- Yellow = NRM, Blue = FDC, Red = NUP, Green = DP, Gray = No data
- District boundaries visible with thin dark outlines

---

#### Test Case 2.2: Drill-Down Navigation

**Test Steps:**
1. View district-level choropleth
2. Click on any district (e.g., WAKISO)
3. Click on any constituency
4. Click on any subcounty
5. Click on any parish

**Expected Results:**
- Each click drills down to next admin level
- Breadcrumb updates: Uganda > District > Constituency > Subcounty > Parish
- Map zooms to fit selected area
- Colors update to show winners at each level
- At parish level, clicking shows popup with detailed results

---

### National Dashboard

**Test ID:** TEST-003
**Date Added:** 2024-12-29
**Status:** Not Tested

**Prerequisites:**
- Application running
- Election with results

#### Test Case 3.1: View Dashboard

**Test Steps:**
1. Navigate to Electoral Map
2. Select an election
3. Click "Dashboard" button (next to Map button)

**Expected Results:**
- Dashboard view displays
- Shows national results summary
- Party breakdown with vote counts/percentages

---

### Touch-Screen Optimization (BCAST-002)

**Test ID:** TEST-004
**Date Added:** 2024-12-30
**Status:** Not Tested

**Prerequisites:**
- Application running at http://localhost:5173
- Access from a touch-enabled device (tablet, touch-screen monitor, or mobile)
- User logged in
- Election with results in database

#### Test Case 4.1: Gesture Tutorial Auto-Show

**Test Steps:**
1. Clear browser localStorage (DevTools > Application > Storage > Clear site data)
2. Navigate to Electoral Map on a touch device
3. Select an election

**Expected Results:**
- Gesture tutorial overlay appears automatically
- Shows "Touch Gestures" title
- Displays first gesture (Drag to Pan) with animated icon
- Page indicators (dots) at bottom show 6 pages
- "Next" and close buttons visible

---

#### Test Case 4.2: Gesture Tutorial Navigation

**Test Steps:**
1. Open gesture tutorial (Test 4.1 or tap help button)
2. Tap "Next" button
3. Swipe left on the tutorial card
4. Tap on different page indicator dots
5. Navigate to last page
6. Tap "Got it!" button

**Expected Results:**
- Each page shows different gesture (Pan, Pinch, Rotate, Tilt, Double-Tap, Tap)
- Swipe left/right navigates between pages
- Tapping dots jumps to that page
- "Got it!" button dismisses tutorial
- Tutorial doesn't appear again on subsequent visits

---

#### Test Case 4.3: Touch Gesture Visual Feedback

**Test Steps:**
1. Navigate to Electoral Map on touch device
2. Place one finger on map and drag
3. Place two fingers on map and pinch
4. Place two fingers and twist (rotate)
5. Place two fingers and drag up/down (tilt)

**Expected Results:**
- Single finger drag: Blue circle appears at touch point, "Panning" label shows at bottom
- Pinch gesture: Two blue circles appear, dashed line connects them, "Zooming in/out" label
- Rotate gesture: Two circles + center point, "Rotating clockwise/counter-clockwise" label
- Tilt gesture: Two circles moving vertically, "Tilting view" label
- All indicators fade out ~300ms after gesture ends

---

#### Test Case 4.4: Presentation Mode Touch Controls

**Test Steps:**
1. Navigate to Electoral Map, select election
2. Tap "Present" button (or press F11)
3. Wait for presentation mode to activate
4. Tap anywhere on the screen
5. Observe the control panel at bottom

**Expected Results:**
- Presentation mode enters fullscreen
- Thin edge indicators visible on left, right, top edges
- Tapping screen reveals control panel at bottom
- Control panel shows: election name, current level, navigation buttons
- Panel auto-hides after ~4 seconds

---

#### Test Case 4.5: Presentation Mode Edge Swipe

**Test Steps:**
1. Enter presentation mode
2. Touch the left edge of screen and swipe right
3. Touch the right edge and swipe left
4. Touch the top edge and swipe down

**Expected Results:**
- Edge swipe from left/right/top reveals control panel
- Blue gradient shows during edge touch
- Control panel appears with navigation options

---

#### Test Case 4.6: Swipe Navigation in Presentation Mode

**Test Steps:**
1. Enter presentation mode with election at district level
2. Drill down to a constituency (tap on a district)
3. Swipe right (from center of screen)
4. Swipe up
5. Swipe down

**Expected Results:**
- Swipe right: Goes back one level (shows "Go Back" indicator during swipe)
- Swipe up: Switches to next election (shows "Next Election" indicator)
- Swipe down: Switches to previous election (shows "Previous Election" indicator)
- Visual feedback shows swipe direction and progress

---

#### Test Case 4.7: Presentation Controls Panel Features

**Test Steps:**
1. Enter presentation mode
2. Tap to reveal controls
3. Test each button:
   - Left/Right arrows (level navigation)
   - Up/Down arrows (election navigation)
   - Grid icon (dashboard toggle)
   - Question mark icon (help)
   - X icon (exit presentation)

**Expected Results:**
- Left arrow: Goes back one level (disabled at top level)
- Right arrow: Disabled (drill-down via map tap)
- Up/Down arrows: Cycle through elections
- Grid icon: Toggles between map and dashboard view
- Question mark: Opens gesture tutorial
- X icon: Exits presentation mode

---

#### Test Case 4.8: Touch-Friendly Popups

**Test Steps:**
1. On touch device, navigate to Electoral Map
2. Drill down to parish level
3. Tap on a parish to open results popup
4. Attempt to tap the close button (X)

**Expected Results:**
- Popup has adequate padding (16px+)
- Close button is large (44px+ touch target)
- Close button has visible background on touch devices
- Easy to dismiss popup with one tap

---

#### Test Case 4.9: Help Button Visibility

**Test Steps:**
1. On touch device, navigate to Electoral Map
2. Look for help button in bottom-right corner
3. Tap the help button

**Expected Results:**
- Help button (question mark in circle) visible on touch devices
- Button is 56px diameter (easy to tap)
- Tapping opens gesture tutorial
- Button hidden on non-touch devices (desktop)

---

#### Test Case 4.10: Map Touch Controls

**Test Steps:**
1. On touch device, view the map
2. Look at zoom controls (top-right)
3. Attempt to tap zoom +/- buttons

**Expected Results:**
- Zoom buttons are 52px on touch devices (larger than desktop)
- Easy to tap without accidental presses
- Proper spacing between buttons

---

### Electoral Incidents Layer

**Test ID:** TEST-005
**Date Added:** 2024-12-30
**Status:** Not Tested

**Prerequisites:**
- Application running at http://localhost:5173
- User logged in
- Electoral issues imported in database

#### Test Case 5.1: Incidents Layer Toggle

**Test Steps:**
1. Navigate to Electoral Map
2. Select an election
3. Look for "Electoral Issues" panel in bottom-right corner
4. Check the "Show" checkbox

**Expected Results:**
- Incidents filter panel visible at bottom-right
- Checking "Show" displays incident markers on the map
- Unchecking hides the markers
- Markers appear as colored circles based on category

---

#### Test Case 5.2: Category Filter

**Test Steps:**
1. Enable incidents layer (Test 5.1)
2. Click the category dropdown
3. Select a specific category (e.g., "Violence/Assault")
4. Select "All Categories" again

**Expected Results:**
- Dropdown shows all available issue categories
- Selecting a category filters markers to only show that type
- "All Categories" shows all incidents
- Map updates immediately after selection

---

#### Test Case 5.3: Incident Clustering

**Test Steps:**
1. Enable incidents layer
2. Zoom out to show all of Uganda
3. Observe clustered markers
4. Click on a clustered marker

**Expected Results:**
- When zoomed out, incidents cluster into numbered circles
- Cluster color changes based on count (orange < 10, red >= 25)
- Clicking a cluster zooms in to expand it
- At higher zoom levels, individual markers appear

---

#### Test Case 5.4: Incident Popup

**Test Steps:**
1. Enable incidents layer
2. Zoom in to see individual incident markers
3. Click on an incident marker (colored circle)

**Expected Results:**
- Popup appears with incident details:
  - Category name with color dot
  - Date (and time if available)
  - Summary text
  - Location/district information
  - Severity (1-5 stars)
  - Status badge (reported/resolved)
- Popup has close button
- Clicking elsewhere closes popup

---

#### Test Case 5.5: Incident Marker Styling

**Test Steps:**
1. Enable incidents layer
2. Zoom in to view individual markers
3. Observe marker sizes and colors

**Expected Results:**
- Markers are colored by category:
  - Violence: Red (#DC143C)
  - Campaign Blockage: Orange (#FF6B6B)
  - Court Case: Blue (#4169E1)
  - Arrest/Detention: Dark Red (#B22222)
  - Other: Gray (#808080)
- Marker size varies by severity (larger = more severe)
- White stroke around each marker for visibility

---

#### Test Case 5.6: Incidents with Election Results

**Test Steps:**
1. Select an election and view choropleth map
2. Enable incidents layer
3. Drill down to constituency level
4. Toggle incidents layer off and on

**Expected Results:**
- Incidents layer overlays on top of election results
- Both layers interactive (can click either)
- Results choropleth visible beneath incident markers
- Toggling incidents doesn't affect election results layer

---

#### Test Case 5.7: API Endpoints

**Test Steps (via curl or browser DevTools):**
1. GET /api/issues/categories
2. GET /api/issues/geojson
3. GET /api/issues/stats
4. GET /api/issues?limit=10

**Expected Results:**
1. Categories: Returns array of issue categories with id, name, code, color, severity
2. GeoJSON: Returns FeatureCollection with Point features for each issue
3. Stats: Returns total count, byCategory, byStatus, topDistricts
4. Issues: Returns paginated list of issues with full details

---

## Test Execution Log

| Date | Tester | Test ID | Result | Notes |
|------|--------|---------|--------|-------|
| | | | | |

---

## Known Issues

| Issue | Test ID | Description | Status |
|-------|---------|-------------|--------|
| | | | |

