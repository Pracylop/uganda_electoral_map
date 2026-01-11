import {
  Menu,
  Map,
  LayoutDashboard,
  GitCompare,
  AlertTriangle,
  Users,
  ArrowLeft,
  ArrowRight,
  Search,
  Layers,
  Calendar,
  Pencil,
  Home,
  LogOut,
  PanelLeftClose,
  PanelRightClose,
  History,
  Radio,
} from 'lucide-react';
import { IconButton, IconButtonDivider } from './IconButton';
import { useBroadcastStore } from '../../stores/broadcastStore';

interface BroadcastSidebarProps {
  onExit: () => void;
  canDrillUp: boolean;
}

export function BroadcastSidebar({ onExit, canDrillUp }: BroadcastSidebarProps) {
  const {
    sidebarExpanded,
    sidebarPosition,
    toggleSidebar,
    toggleSidebarPosition,
    viewMode,
    setViewMode,
    toggleLayersPanel,
    layersPanelOpen,
    toggleAnnotationMode,
    annotationMode,
    toggleSearch,
    toggleElectionSelector,
    drillUp,
    resetToNational,
    currentLevel,
  } = useBroadcastStore();

  const isLeft = sidebarPosition === 'left';

  return (
    <aside
      className={`
        fixed top-0 bottom-0
        flex flex-col items-center
        bg-gray-900/95 backdrop-blur-sm
        py-4
        transition-all duration-300 ease-out
        z-40
        ${isLeft ? 'left-0 border-r' : 'right-0 border-l'}
        border-gray-700
        ${sidebarExpanded ? 'w-20 overflow-y-auto overflow-x-hidden' : 'w-0 overflow-hidden'}
        scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent
      `}
      style={{
        scrollbarWidth: 'thin',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      {/* Toggle Button */}
      <IconButton
        icon={Menu}
        label={sidebarExpanded ? 'Collapse Sidebar' : 'Expand Sidebar'}
        onClick={toggleSidebar}
        shortcut="["
        size="md"
      />

      <IconButtonDivider />

      {/* View Mode Buttons */}
      <div className="flex flex-col gap-2">
        <IconButton
          icon={Home}
          label="Home"
          onClick={() => setViewMode('home')}
          active={viewMode === 'home'}
          shortcut="H"
        />
        <IconButton
          icon={Radio}
          label="Current Election"
          onClick={() => setViewMode('current-election')}
          active={viewMode === 'current-election'}
          shortcut="E"
        />
        <IconButton
          icon={History}
          label="Past Elections"
          onClick={() => setViewMode('past-elections')}
          active={viewMode === 'past-elections'}
          shortcut="P"
        />
        <IconButton
          icon={Map}
          label="Map View"
          onClick={() => setViewMode('map')}
          active={viewMode === 'map'}
          shortcut="M"
        />
        <IconButton
          icon={LayoutDashboard}
          label="Dashboard"
          onClick={() => setViewMode('dashboard')}
          active={viewMode === 'dashboard'}
          shortcut="D"
        />
        <IconButton
          icon={GitCompare}
          label="Compare Elections"
          onClick={() => setViewMode('comparison')}
          active={viewMode === 'comparison'}
          shortcut="C"
        />
        <IconButton
          icon={AlertTriangle}
          label="Electoral Issues"
          onClick={() => setViewMode('incidents-home')}
          active={viewMode === 'incidents-home' || viewMode === 'issues'}
          shortcut="I"
        />
        <IconButton
          icon={Users}
          label="Demographics"
          onClick={() => setViewMode('demographics-home')}
          active={viewMode === 'demographics-home' || viewMode === 'demographics'}
          shortcut="G"
        />
      </div>

      <IconButtonDivider />

      {/* Navigation */}
      <div className="flex flex-col gap-2">
        <IconButton
          icon={isLeft ? ArrowLeft : ArrowRight}
          label="Go Back"
          onClick={drillUp}
          disabled={!canDrillUp}
          shortcut="Backspace"
          size="md"
        />
        <IconButton
          icon={Home}
          label="National View"
          onClick={resetToNational}
          disabled={currentLevel === 1}
          shortcut="H"
          size="md"
        />
        <IconButton
          icon={Search}
          label="Search Regions"
          onClick={toggleSearch}
          shortcut="/"
          size="md"
        />
      </div>

      <IconButtonDivider />

      {/* Tools */}
      <div className="flex flex-col gap-2">
        <IconButton
          icon={Calendar}
          label="Select Election"
          onClick={toggleElectionSelector}
          shortcut="S"
          size="md"
        />
        <IconButton
          icon={Layers}
          label="Layers"
          onClick={toggleLayersPanel}
          active={layersPanelOpen}
          shortcut="L"
          size="md"
        />
        <IconButton
          icon={Pencil}
          label="Annotate"
          onClick={toggleAnnotationMode}
          active={annotationMode}
          shortcut="A"
          size="md"
        />
      </div>

      <IconButtonDivider />

      {/* Move Sidebar Position */}
      <IconButton
        icon={isLeft ? PanelRightClose : PanelLeftClose}
        label={`Move to ${isLeft ? 'Right' : 'Left'}`}
        onClick={toggleSidebarPosition}
        shortcut="\"
        size="sm"
      />

      {/* Spacer */}
      <div className="flex-1" />

      {/* Exit Button */}
      <IconButton
        icon={LogOut}
        label="Exit Broadcast"
        onClick={onExit}
        shortcut="Esc"
        className="bg-red-600 hover:bg-red-700 text-white"
      />
    </aside>
  );
}

// Collapsed toggle button that appears when sidebar is hidden
export function SidebarToggle() {
  const { sidebarExpanded, sidebarPosition, toggleSidebar } = useBroadcastStore();

  if (sidebarExpanded) return null;

  const isLeft = sidebarPosition === 'left';

  return (
    <button
      onClick={toggleSidebar}
      className={`
        fixed top-1/2 -translate-y-1/2
        w-8 h-20
        bg-gray-800/80 hover:bg-gray-700
        flex items-center justify-center
        text-gray-300
        transition-all duration-200
        z-50
        ${isLeft ? 'left-0 rounded-r-lg' : 'right-0 rounded-l-lg'}
      `}
      aria-label="Expand Sidebar"
    >
      <Menu size={20} />
    </button>
  );
}
