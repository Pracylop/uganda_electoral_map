# Uganda Electoral Map - Client Application

Frontend client application for the Uganda Electoral Map system - a broadcast-quality GIS electoral results display.

## Technology Stack

- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite
- **Desktop Framework**: Tauri 2.0 (to be added)
- **Mapping**: MapLibre GL JS + PMTiles
- **Styling**: Tailwind CSS
- **State Management**: Zustand + React Query
- **Real-time**: WebSocket client

## Project Structure

```
client/
├── src/
│   ├── components/          # React components
│   │   └── Map.tsx          # MapLibre GL JS map component
│   ├── App.tsx              # Main application component
│   ├── main.tsx             # Application entry point
│   └── index.css            # Global styles with Tailwind
├── public/                  # Static assets
├── index.html               # HTML template
├── tailwind.config.js       # Tailwind configuration
├── vite.config.ts           # Vite configuration
└── package.json
```

## Setup

### Prerequisites

- Node.js 20 LTS or higher
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Start development server:
```bash
npm run dev
```

The application will be available at `http://localhost:5173`

## Features

### Current Implementation

- ✅ Basic map display centered on Uganda
- ✅ MapLibre GL JS integration with OpenStreetMap tiles
- ✅ Tailwind CSS styling with broadcast-optimized colors
- ✅ Responsive layout with header and footer

### Planned Features

- [ ] Tauri desktop application integration
- [ ] Administrative boundary layers (District, Constituency, etc.)
- [ ] Choropleth visualization of election results
- [ ] Interactive drill-down navigation
- [ ] Real-time WebSocket updates
- [ ] User authentication and role-based UI
- [ ] Data entry and verification interfaces
- [ ] Full-screen presentation mode
- [ ] Touch-screen gesture support
- [ ] Dramatic animations for broadcast
- [ ] Historical data comparison views
- [ ] Results dashboard

## Development

### Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm run preview` - Preview production build locally
- `npm run lint` - Run ESLint

### Map Configuration

The map is configured to display Uganda with the following settings:

- **Center**: [32.5825, 1.3733] (Kampala, Uganda)
- **Initial Zoom**: 6.5
- **Tile Source**: OpenStreetMap (temporary - will be replaced with PMTiles for offline use)

### Tailwind Theme

Custom broadcast-optimized colors are defined in `tailwind.config.js`:

- `tv-primary`: #0066CC - Blue for primary elements
- `tv-secondary`: #FF6B00 - Orange for secondary elements
- `tv-success`: #00C853 - Green for success/wins
- `tv-danger`: #DC143C - Red for alerts/losses
- `tv-warning`: #FFD600 - Yellow for warnings

## Building for Production

### Web Build

```bash
npm run build
```

Output will be in `dist/` directory.

### Desktop Build (Tauri)

To be added in next phase:

```bash
npm run tauri build
```

This will create installers for Windows (.msi) and macOS (.dmg).

## Architecture

The client follows a component-based architecture:

1. **Presentation Layer**: React components for UI
2. **State Management**: Zustand for client state, React Query for server state
3. **Data Layer**: WebSocket + REST API communication with server
4. **Mapping Layer**: MapLibre GL JS for GIS visualization

## Next Steps (Phase 2)

1. Add Tauri integration for desktop application
2. Implement authentication (login page)
3. Set up WebSocket client for real-time updates
4. Create reusable UI components (buttons, forms, modals)
5. Implement routing with React Router
6. Add state management with Zustand
7. Set up React Query for server data fetching

## License

MIT
