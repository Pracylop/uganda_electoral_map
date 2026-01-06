import { useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  BroadcastSidebar,
  SidebarToggle,
  BroadcastHeader,
  BroadcastBreadcrumb,
  BroadcastMap,
  BroadcastComparisonView,
  BroadcastIssuesMap,
  BroadcastDemographicsMap,
  LayersPanel,
  IssuesPanel,
  AnnotationCanvas,
  AnnotationToolbar,
  ElectionSelector,
  RegionSearch,
} from '../components/broadcast';
import { useBroadcastStore } from '../stores/broadcastStore';
import { useAnnotations } from '../hooks/useAnnotations';
import { useElections } from '../hooks/useElectionData';
import NationalDashboard from '../components/NationalDashboard';

export function BroadcastApp() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const {
    sidebarExpanded,
    sidebarPosition,
    setSidebarExpanded,
    toggleSidebarPosition,
    viewMode,
    annotationMode,
    currentLevel,
    selectedElectionId,
    drillDown,
    drillUp,
    toggleAnnotationMode,
    toggleLayersPanel,
    toggleIssuesPanel,
    toggleIssuesInteractionMode,
    toggleSearch,
    toggleElectionSelector,
    setViewMode,
    resetToNational,
    reset,
    clearRegionHighlights,
  } = useBroadcastStore();

  const isLeft = sidebarPosition === 'left';

  const {
    annotations,
    activeTool,
    activeColor,
    strokeWidth,
    isDrawing,
    currentPoints,
    setActiveTool,
    setActiveColor,
    setStrokeWidth,
    startDrawing,
    continueDrawing,
    finishDrawing,
    undo,
    redo,
    clearAll,
    canUndo,
    canRedo,
  } = useAnnotations();

  const { data: elections } = useElections();

  // Get selected election details
  const selectedElection = elections?.find((e) => e.id === selectedElectionId);

  // Auto fullscreen on load if requested
  useEffect(() => {
    const autoFullscreen = searchParams.get('fullscreen') === 'true';
    if (autoFullscreen && document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {
        // Ignore fullscreen errors (user gesture required)
      });
    }
  }, [searchParams]);

  // Exit broadcast mode
  const handleExit = useCallback(() => {
    // Exit fullscreen if active
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
    // Reset broadcast state
    reset();
    // Navigate back
    navigate('/map');
  }, [navigate, reset]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture if typing in input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key) {
        case 'Escape':
          if (annotationMode) {
            toggleAnnotationMode();
          } else {
            handleExit();
          }
          break;
        case 'F11':
          e.preventDefault();
          if (document.fullscreenElement) {
            document.exitFullscreen();
          } else {
            document.documentElement.requestFullscreen();
          }
          break;
        case '[':
          setSidebarExpanded(false);
          break;
        case ']':
          setSidebarExpanded(true);
          break;
        case 'm':
        case 'M':
          setViewMode('map');
          break;
        case 'd':
        case 'D':
          setViewMode('dashboard');
          break;
        case 'c':
        case 'C':
          setViewMode('comparison');
          break;
        case 'i':
        case 'I':
          setViewMode('issues');
          break;
        case 'g':
        case 'G':
          setViewMode('demographics');
          break;
        case 'f':
        case 'F':
          // Toggle issues filter panel (only when in issues view)
          if (viewMode === 'issues') {
            toggleIssuesPanel();
          }
          break;
        case 't':
        case 'T':
          // Toggle interaction mode (stats vs view) - only when in issues view
          if (viewMode === 'issues') {
            toggleIssuesInteractionMode();
          }
          break;
        case 'l':
        case 'L':
          toggleLayersPanel();
          break;
        case 'a':
        case 'A':
          toggleAnnotationMode();
          break;
        case 'e':
        case 'E':
          toggleElectionSelector();
          break;
        case '/':
          e.preventDefault();
          toggleSearch();
          break;
        case 'h':
        case 'H':
          resetToNational();
          break;
        case 'b':
          // 'B' is used for drill-up/back navigation
          if (currentLevel > 2) {
            drillUp();
          }
          break;
        case 'z':
        case 'Z':
          if (annotationMode) {
            undo();
          }
          break;
        case 'y':
        case 'Y':
          if (annotationMode) {
            redo();
          }
          break;
        case 'p':
        case 'P':
          toggleSidebarPosition();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    annotationMode,
    currentLevel,
    viewMode,
    handleExit,
    setSidebarExpanded,
    toggleSidebarPosition,
    setViewMode,
    toggleAnnotationMode,
    toggleLayersPanel,
    toggleIssuesPanel,
    toggleIssuesInteractionMode,
    toggleSearch,
    toggleElectionSelector,
    resetToNational,
    drillUp,
    undo,
    redo,
  ]);

  // Handle region click on map
  const handleRegionClick = useCallback(
    (regionId: number, regionName: string, _level: number) => {
      if (!annotationMode) {
        drillDown(regionId, regionName);
      }
    },
    [annotationMode, drillDown]
  );

  return (
    <div className="fixed inset-0 bg-gray-900 overflow-hidden">
      {/* Sidebar */}
      <BroadcastSidebar onExit={handleExit} canDrillUp={currentLevel > 2} />
      <SidebarToggle />

      {/* Header */}
      <BroadcastHeader
        electionName={selectedElection?.name}
        electionType={selectedElection?.electionTypeName}
      />

      {/* Main Content */}
      <main
        className={`
          absolute inset-0
          transition-all duration-300
          ${isLeft
            ? sidebarExpanded ? 'left-20' : 'left-0'
            : sidebarExpanded ? 'right-20' : 'right-0'
          }
        `}
      >
        {/* Map View */}
        {viewMode === 'map' && (
          <div className="w-full h-full relative">
            <BroadcastMap
              onRegionClick={handleRegionClick}
              interactionsDisabled={annotationMode}
            />

            {/* Annotation Canvas Overlay */}
            <AnnotationCanvas
              annotations={annotations}
              isDrawing={isDrawing}
              currentPoints={currentPoints}
              activeTool={activeTool}
              activeColor={activeColor}
              strokeWidth={strokeWidth}
              onStartDrawing={startDrawing}
              onContinueDrawing={continueDrawing}
              onFinishDrawing={finishDrawing}
              enabled={annotationMode}
            />
          </div>
        )}

        {/* Dashboard View */}
        {viewMode === 'dashboard' && selectedElectionId && (
          <div className="w-full h-full overflow-auto p-6">
            <NationalDashboard electionId={selectedElectionId} />
          </div>
        )}

        {/* Comparison View */}
        {viewMode === 'comparison' && (
          <BroadcastComparisonView />
        )}

        {/* Issues View */}
        {viewMode === 'issues' && (
          <div className="w-full h-full relative">
            <BroadcastIssuesMap interactionsDisabled={annotationMode} />

            {/* Annotation Canvas Overlay */}
            <AnnotationCanvas
              annotations={annotations}
              isDrawing={isDrawing}
              currentPoints={currentPoints}
              activeTool={activeTool}
              activeColor={activeColor}
              strokeWidth={strokeWidth}
              onStartDrawing={startDrawing}
              onContinueDrawing={continueDrawing}
              onFinishDrawing={finishDrawing}
              enabled={annotationMode}
            />
          </div>
        )}

        {/* Demographics View */}
        {viewMode === 'demographics' && (
          <div className="w-full h-full relative">
            <BroadcastDemographicsMap
              onRegionClick={handleRegionClick}
              interactionsDisabled={annotationMode}
            />

            {/* Annotation Canvas Overlay */}
            <AnnotationCanvas
              annotations={annotations}
              isDrawing={isDrawing}
              currentPoints={currentPoints}
              activeTool={activeTool}
              activeColor={activeColor}
              strokeWidth={strokeWidth}
              onStartDrawing={startDrawing}
              onContinueDrawing={continueDrawing}
              onFinishDrawing={finishDrawing}
              enabled={annotationMode}
            />
          </div>
        )}

        {/* No Election Selected */}
        {!selectedElectionId && viewMode !== 'comparison' && viewMode !== 'issues' && viewMode !== 'demographics' && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80 z-10">
            <div className="text-center">
              <p className="text-2xl text-white mb-4">No Election Selected</p>
              <button
                onClick={toggleElectionSelector}
                className="px-6 py-3 bg-yellow-500 text-gray-900 font-semibold rounded-lg hover:bg-yellow-400 transition-colors"
              >
                Select an Election
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Panels & Modals */}
      <LayersPanel />
      <IssuesPanel />
      <ElectionSelector />
      <RegionSearch />

      {/* Breadcrumb Navigation (bottom of screen) */}
      {(viewMode === 'map' || viewMode === 'demographics') && !annotationMode && <BroadcastBreadcrumb />}

      {/* Annotation Toolbar */}
      <AnnotationToolbar
        activeTool={activeTool}
        activeColor={activeColor}
        strokeWidth={strokeWidth}
        canUndo={canUndo}
        canRedo={canRedo}
        onSelectTool={setActiveTool}
        onSelectColor={setActiveColor}
        onSelectStrokeWidth={setStrokeWidth}
        onUndo={undo}
        onRedo={redo}
        onClearAll={() => {
          clearAll();
          clearRegionHighlights();
        }}
      />
    </div>
  );
}
