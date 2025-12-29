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

## Test Execution Log

| Date | Tester | Test ID | Result | Notes |
|------|--------|---------|--------|-------|
| | | | | |

---

## Known Issues

| Issue | Test ID | Description | Status |
|-------|---------|-------------|--------|
| | | | |

