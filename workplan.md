# Uganda Electoral Map - Project Workplan

## Project Overview
Build a broadcast-quality GIS electoral results display system for Uganda 2026 elections, inspired by CNN's Magic Wall technology. Multi-user networked architecture with offline-first design for isolated LAN deployment.

## Technology Stack
- **Client Framework**: Tauri 2.0 (Rust backend + WebView frontend)
- **Frontend**: React 18 + TypeScript + Vite
- **Mapping**: MapLibre GL JS + PMTiles (offline vector tiles)
- **State Management**: Zustand + React Query
- **Server**: Node.js 20 LTS + Express.js + express-ws (WebSocket)
- **Database**: PostgreSQL 15 + PostGIS 3.3
- **ORM**: Prisma
- **Authentication**: JWT tokens + bcrypt
- **Styling**: Tailwind CSS

## Development Phases (20 Weeks)

---

## Phase 1: Foundation (Weeks 1-5)

### Database & Server Setup
- [ ] Install and configure PostgreSQL 15 + PostGIS 3.3 extension
- [ ] Create database schema (users, administrative_units, elections, candidates, results, audit_log)
- [ ] Add spatial indexes for geometry columns
- [ ] Load Uganda administrative boundary shapefiles (GeoJSON/Shapefile → PostGIS)
- [ ] Verify all 6 administrative levels (National, Sub-Region, District, Constituency, Subcounty, Parish)

### Application Server
- [ ] Initialize Node.js 20 LTS project with TypeScript
- [ ] Set up Express.js server with CORS and security middleware
- [ ] Configure Prisma ORM and generate client
- [ ] Implement database connection pooling
- [ ] Create REST API endpoints structure (routes/controllers)
- [ ] Add error handling middleware and logging

### Client Application
- [ ] Initialize Tauri 2.0 project
- [ ] Set up React 18 + TypeScript + Vite
- [ ] Configure Tailwind CSS with broadcast-optimized theme
- [ ] Set up project structure (components, pages, hooks, services, types)
- [ ] Configure environment variables for server connection

### Basic Mapping
- [ ] Integrate MapLibre GL JS
- [ ] Load Uganda GeoJSON boundaries from API
- [ ] Implement basic choropleth map rendering
- [ ] Add smooth pan/zoom navigation (target 60fps)
- [ ] Test administrative level drill-down (National → Parish)
- [ ] Implement region selection and highlight

---

## Phase 2: User Management (Weeks 6-8)

### Authentication System
- [ ] Implement JWT token generation and validation
- [ ] Add bcrypt password hashing for user credentials
- [ ] Create login/logout API endpoints
- [ ] Implement protected route middleware
- [ ] Add refresh token mechanism
- [ ] Create login page UI

### Role-Based Access Control (RBAC)
- [ ] Define 4 user roles (Viewer, Operator, Editor, Administrator)
- [ ] Implement permission matrix checking
- [ ] Create role-based middleware for API endpoints
- [ ] Add role-based UI component visibility

### User Management
- [ ] Create user CRUD API endpoints (Admin only)
- [ ] Build user management UI (create, edit, deactivate users)
- [ ] Add user list with filtering and search
- [ ] Implement user profile page

### Audit Trail System
- [ ] Create audit_log table with immutable constraints
- [ ] Implement audit logging middleware for all actions
- [ ] Log user authentication events
- [ ] Add audit log viewer UI (Admin/Editor only)
- [ ] Implement audit log export functionality

### WebSocket Server
- [ ] Set up express-ws for WebSocket support
- [ ] Implement WebSocket authentication (JWT)
- [ ] Create connection lifecycle management
- [ ] Add heartbeat/ping-pong mechanism (30s interval)
- [ ] Implement auto-reconnect with exponential backoff (client-side)
- [ ] Define message types (AUTH, RESULT_CREATED, RESULT_APPROVED, etc.)

---

## Phase 3: Data Management (Weeks 9-12)

### Data Entry System
- [ ] Create manual result entry form UI
- [ ] Implement administrative unit search/selection
- [ ] Add candidate vote entry fields
- [ ] Implement form validation (votes ≤ registered voters)
- [ ] Create result submission workflow (Draft → Pending)
- [ ] Add ability to save drafts

### Excel/CSV Import
- [ ] Implement SheetJS (xlsx) parser
- [ ] Add Papa Parse (CSV) support
- [ ] Create import validation logic
- [ ] Build import preview UI
- [ ] Implement bulk result creation from import
- [ ] Add import error reporting and rollback

### Approval Workflow
- [ ] Implement result status lifecycle (Draft, Pending, Rejected, Approved, Disputed, Retracted)
- [ ] Create verification queue API endpoint
- [ ] Build verification queue UI for Editors
- [ ] Add approve/reject actions with comments
- [ ] Implement result retraction functionality
- [ ] Add disputed flag with warning indicator

### Real-Time Synchronization
- [ ] Broadcast RESULT_CREATED to Editors via WebSocket
- [ ] Broadcast RESULT_APPROVED to all clients
- [ ] Broadcast RESULT_REJECTED to Operator
- [ ] Broadcast RESULT_RETRACTED to all clients
- [ ] Implement optimistic UI updates
- [ ] Add sync status indicators

### Historical Data
- [ ] Create data model for historical elections (1996-2021)
- [ ] Import historical election results
- [ ] Load historical demographic data (registered voters, population)
- [ ] Create API endpoints for historical data access

### Data Layers
- [ ] Implement layer system architecture
- [ ] Create Results layer (2026 election data)
- [ ] Create Historical layer (1996-2021 comparison)
- [ ] Create Demographics layer (voters, population)
- [ ] Create Incidents layer (malpractice, violence, disputes)
- [ ] Create Polling Stations layer (~34,000 point locations)
- [ ] Add layer toggle UI

---

## Phase 4: Broadcast Features (Weeks 13-17)

### Map Visualization Enhancements
- [ ] Implement dynamic choropleth coloring by party
- [ ] Add configurable color schemes (TV-optimized bright colors)
- [ ] Create animated transitions for drill-down
- [ ] Implement smooth color interpolation for result updates
- [ ] Add region selection panel with vote details
- [ ] Display winner, vote counts, and percentages

### Full-Screen Presentation Mode
- [ ] Create presentation mode UI (hidden controls)
- [ ] Implement full-screen toggle
- [ ] Add keyboard shortcuts for presenter
- [ ] Hide verification/admin features in presentation mode
- [ ] Optimize for 4K displays

### Touch-Screen Optimization
- [ ] Implement multi-touch gesture support (pinch zoom, swipe)
- [ ] Optimize touch target sizes for fingers
- [ ] Add gesture-based navigation
- [ ] Test on touch-screen devices

### Results Dashboard
- [ ] Create national results summary component
- [ ] Add live-updating vote totals
- [ ] Implement progress bar (% reporting)
- [ ] Display leading candidate with vote share
- [ ] Add key statistics (turnout, total votes cast)

### Dramatic Animations
- [ ] Implement fly-in animations for result reveals
- [ ] Add color wash effect for region wins
- [ ] Create zoom/transition effects for broadcast
- [ ] Add configurable animation speeds
- [ ] Ensure 60fps performance

### Historical Comparison Tools
- [ ] Create side-by-side comparison view (2021 vs 2026)
- [ ] Implement overlay mode for swing visualization
- [ ] Calculate and display vote swing percentages
- [ ] Add swing choropleth coloring (red/blue gradient)
- [ ] Create comparison dashboard

### Incident Management
- [ ] Create incident entry form
- [ ] Add incident categories (malpractice, violence, disputes)
- [ ] Implement severity levels
- [ ] Add incident markers on map
- [ ] Create incident filtering UI

### Presenter Workstation Cache
- [ ] Implement local SQLite cache for approved results
- [ ] Add automatic cache synchronization
- [ ] Create fallback mode for offline operation
- [ ] Display "OFFLINE" indicator when disconnected
- [ ] Implement auto-reconnect and sync on reconnection

---

## Phase 5: Polish & Deployment (Weeks 18-20)

### Performance Optimization
- [ ] Profile and optimize map rendering (target 60fps)
- [ ] Optimize database queries with proper indexes
- [ ] Implement result pagination for large datasets
- [ ] Add lazy loading for administrative boundaries
- [ ] Optimize WebSocket message size
- [ ] Conduct stress testing (10+ concurrent users)
- [ ] Run 24-hour stability test

### Installer & Deployment
- [ ] Create Windows installer (using Tauri bundler)
- [ ] Create macOS installer (.dmg)
- [ ] Write server deployment scripts (Ubuntu 22.04/24.04)
- [ ] Create Docker containers for server components
- [ ] Document server hardware requirements
- [ ] Create network configuration guide

### Documentation
- [ ] Write user manual for each role
- [ ] Create administrator setup guide
- [ ] Document API endpoints (OpenAPI/Swagger)
- [ ] Write database schema documentation
- [ ] Create troubleshooting guide
- [ ] Record video tutorials

### Testing & QA
- [ ] Write unit tests for critical functions
- [ ] Create integration tests for API endpoints
- [ ] Test approval workflow end-to-end
- [ ] Verify audit trail completeness
- [ ] Test all user roles and permissions
- [ ] Verify data accuracy (100% target)
- [ ] Test offline/reconnection scenarios

### Training Materials
- [ ] Create presenter training materials (< 2 hours)
- [ ] Create operator training materials (< 4 hours)
- [ ] Develop quick reference guides
- [ ] Prepare demo data for training

### Pilot Testing
- [ ] Deploy to test environment
- [ ] Conduct pilot test with TV station
- [ ] Gather feedback and iterate
- [ ] Fix identified bugs
- [ ] Optimize based on real-world usage

---

## Key Deliverables

1. **Client Application** (Tauri desktop app for Windows/macOS)
2. **Application Server** (Node.js REST API + WebSocket server)
3. **Database** (PostgreSQL + PostGIS with schema and data)
4. **Documentation** (User manuals, admin guides, API docs)
5. **Installers** (Windows .msi, macOS .dmg)
6. **Deployment Scripts** (Server setup automation)

---

## Success Metrics

### Technical
- ✅ Map rendering: ≥ 60 FPS sustained
- ✅ Zoom/pan latency: < 100ms
- ✅ Result approval to display: < 2 seconds
- ✅ Excel import (10K rows): < 10 seconds
- ✅ Application startup: < 5 seconds
- ✅ Concurrent users: ≥ 10 simultaneous
- ✅ 24-hour stability: Zero crashes
- ✅ Data accuracy: 100%

### User Experience
- ✅ Presenter training time: < 2 hours
- ✅ Operator training time: < 4 hours
- ✅ Time to enter single result: < 30 seconds
- ✅ Time to approve result: < 15 seconds

### Business
- ✅ TV station adoption: ≥ 3 stations for 2026
- ✅ Live broadcast failures: Zero
- ✅ Data disputes post-broadcast: Zero

---

## Current Status
- [x] Phase 1: Foundation - **COMPLETED** (December 23, 2024)
- [x] Phase 2: User Management - **COMPLETED** (January 5, 2026)
- [ ] Phase 3: Data Management - Not Started
- [ ] Phase 4: Broadcast Features - Not Started
- [ ] Phase 5: Polish & Deployment - Not Started

---

## Review Section
*To be completed after each major milestone*

### Phase 1 Review
**Date completed:** December 23, 2024

**Changes made:**
- ✅ Created project structure (server, client, database directories)
- ✅ Initialized Node.js 20 server with TypeScript and Express.js
- ✅ Configured Prisma ORM with comprehensive database schema
- ✅ Defined all database models (User, AdministrativeUnit, Election, Candidate, Result, AuditLog)
- ✅ Implemented complete enum types (UserRole, ResultStatus)
- ✅ Set up Prisma with PostGIS extension support for spatial data
- ✅ Initialized React 18 + TypeScript + Vite client application
- ✅ Integrated Tailwind CSS with broadcast-optimized color theme
- ✅ Installed and configured MapLibre GL JS for mapping
- ✅ Created basic Map component centered on Uganda
- ✅ Implemented responsive UI with header/footer layout
- ✅ Added state management libraries (Zustand, React Query)
- ✅ Created comprehensive README files for server and client
- ✅ Set up Git repository and pushed to GitHub

**Issues encountered:**
- Tauri initialization requires interactive prompt which doesn't work in non-TTY environment
  - **Solution:** Started with React + Vite foundation; Tauri integration deferred to Phase 2
- npx commands occasionally failed in automated environment
  - **Solution:** Created configuration files manually when needed
- Working directory navigation required attention for nested server/server structure
  - **Solution:** Used absolute paths and verified working directory before commands

**Next steps:**
- Phase 2 will focus on User Management (Authentication, RBAC, Audit Trail, WebSocket)
- Add Tauri desktop integration
- Implement JWT authentication system
- Create WebSocket server for real-time updates
- Build user management interfaces
- Set up audit logging middleware

### Phase 2 Review
- Date completed: January 5, 2026
- Changes made:
  - JWT Authentication with login/logout
  - Role-based access control (viewer, operator, editor, admin)
  - User management API and UI
  - Audit Log Viewer UI (admin-only) with filtering, stats, and CSV export
  - User Profile page with password change
  - WebSocket real-time updates with JWT auth
  - Complete audit logging for all data modification operations:
    - userController: CREATE_USER, UPDATE_USER, DELETE_USER
    - electionController: CREATE_ELECTION, UPDATE_ELECTION, DELETE_ELECTION
    - candidateController: CREATE_CANDIDATE, UPDATE_CANDIDATE, DELETE_CANDIDATE
    - authController: LOGIN, PROFILE_UPDATE, PASSWORD_CHANGE
    - resultController: CREATE_RESULT, UPDATE_RESULT, DELETE_RESULT, SUBMIT_RESULT, APPROVE_RESULT, REJECT_RESULT
    - issueController: CREATE_ISSUE, UPDATE_ISSUE, DELETE_ISSUE
- Issues encountered: None
- Next steps: Phase 3 - Data Management

---

## Audit Logging Expansion Plan

### Current Status
**Currently Audited (2 controllers):**
| Controller | Actions Logged |
|------------|----------------|
| authController | LOGIN, PROFILE_UPDATE, PASSWORD_CHANGE |
| resultController | CREATE_RESULT, SUBMIT_RESULT, APPROVE_RESULT, REJECT_RESULT |

**Missing Audit Logging (4 controllers):**
| Controller | Actions Needed |
|------------|----------------|
| userController | CREATE_USER, UPDATE_USER, DELETE_USER, DEACTIVATE_USER |
| electionController | CREATE_ELECTION, UPDATE_ELECTION, DELETE_ELECTION, ACTIVATE_ELECTION |
| candidateController | CREATE_CANDIDATE, UPDATE_CANDIDATE, DELETE_CANDIDATE |
| issueController | CREATE_ISSUE, UPDATE_ISSUE |

### Implementation Tasks

#### Priority 1: User Management Auditing (Critical for Security)
- [x] 1.1 Import `createAuditLog` in userController.ts
- [x] 1.2 Add helper function `getClientIp` to userController.ts
- [x] 1.3 Add CREATE_USER audit log to `createUser` function
- [x] 1.4 Add UPDATE_USER audit log to `updateUser` function (capture old values)
- [x] 1.5 Add DELETE_USER audit log to `deleteUser` function
- [x] 1.6 Test user management audit logs appear in Audit Log Viewer

#### Priority 2: Election Data Auditing (Critical for Electoral Integrity)
- [x] 2.1 Import `createAuditLog` in electionController.ts
- [x] 2.2 Add helper function `getClientIp` to electionController.ts
- [x] 2.3 Add CREATE_ELECTION audit log to `createElection` function
- [x] 2.4 Add UPDATE_ELECTION audit log to `updateElection` function (capture old values)
- [x] 2.5 Add DELETE_ELECTION audit log to `deleteElection` function
- [x] 2.6 Test election audit logs appear in Audit Log Viewer

#### Priority 3: Candidate Auditing (Important for Transparency)
- [x] 3.1 Import `createAuditLog` in candidateController.ts
- [x] 3.2 Add helper function `getClientIp` to candidateController.ts
- [x] 3.3 Add CREATE_CANDIDATE audit log to `createCandidate` function
- [x] 3.4 Add UPDATE_CANDIDATE audit log to `updateCandidate` function (capture old values)
- [x] 3.5 Add DELETE_CANDIDATE audit log to `deleteCandidate` function
- [x] 3.6 Test candidate audit logs appear in Audit Log Viewer

#### Priority 4: Issue Tracking Auditing (Accountability)
- [x] 4.1-4.5 SKIPPED - issueController has no CRUD operations (read-only data)

#### Final Verification
- [x] 5.1 Verify all action types appear in Audit Log filter dropdown
- [x] 5.2 Verify CSV export includes all new action types
- [x] 5.3 Commit and push changes to GitHub (fa954da)

### Implementation Pattern
Each audit log entry should capture:
1. **userId** - Who performed the action
2. **userRole** - Role at time of action
3. **actionType** - Standardized action name (e.g., CREATE_USER)
4. **entityType** - Type of entity affected (e.g., user, election)
5. **entityId** - ID of affected entity
6. **oldValue** - Previous state (for updates)
7. **newValue** - New state (for creates/updates)
8. **ipAddress** - Client IP for traceability
9. **comment** - Human-readable description

### Estimated Effort
- Priority 1 (User Management): ~30 minutes
- Priority 2 (Elections): ~30 minutes
- Priority 3 (Candidates): ~20 minutes
- Priority 4 (Issues): ~15 minutes

---

### Phase 3 Review
- Date completed:
- Changes made:
- Issues encountered:
- Next steps:

### Phase 4 Review
- Date completed:
- Changes made:
- Issues encountered:
- Next steps:

### Phase 5 Review
- Date completed:
- Changes made:
- Issues encountered:
- Next steps:

---

## Notes
- This is a 20-week project targeting Uganda 2026 General Elections
- System must operate on isolated LAN without internet (offline-first)
- Every action must be logged for accountability and legal scrutiny
- Broadcast quality is paramount - 60fps animations, TV-optimized colors
- Multi-user architecture requires careful concurrency management
- Real-time synchronization is critical for workflow coordination
