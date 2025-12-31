import { create } from 'zustand';

export type ViewMode = 'map' | 'dashboard' | 'comparison';
export type SidebarPosition = 'left' | 'right';

export interface DrillDownLevel {
  level: number; // 1=national, 2=region, 3=district, 4=constituency, 5=parish
  regionId: number | null;
  regionName: string;
}

interface BroadcastState {
  // UI State
  sidebarExpanded: boolean;
  sidebarPosition: SidebarPosition;
  layersPanelOpen: boolean;
  annotationMode: boolean;
  headerVisible: boolean;
  searchOpen: boolean;
  electionSelectorOpen: boolean;

  // View State
  viewMode: ViewMode;
  selectedElectionId: number | null;
  comparisonElectionId: number | null;

  // Navigation State
  drillDownStack: DrillDownLevel[];
  currentLevel: number;
  selectedRegionId: number | null;
  selectedRegionName: string;

  // Layer visibility
  layers: {
    results: boolean;
    demographics: boolean;
    issues: boolean;
    historical: boolean;
    boundaries: boolean;
  };

  // Actions
  toggleSidebar: () => void;
  setSidebarExpanded: (expanded: boolean) => void;
  toggleSidebarPosition: () => void;
  setSidebarPosition: (position: SidebarPosition) => void;
  toggleLayersPanel: () => void;
  toggleAnnotationMode: () => void;
  showHeader: () => void;
  hideHeader: () => void;
  toggleSearch: () => void;
  toggleElectionSelector: () => void;
  closeAllPanels: () => void;

  setViewMode: (mode: ViewMode) => void;
  selectElection: (id: number) => void;
  setComparisonElection: (id: number | null) => void;

  drillDown: (regionId: number, regionName: string) => void;
  drillUp: () => void;
  navigateTo: (index: number) => void; // Navigate to specific breadcrumb level
  navigateToDistrict: (districtId: number, districtName: string) => void; // Jump directly to a district
  resetToNational: () => void;

  toggleLayer: (layer: keyof BroadcastState['layers']) => void;
  setLayer: (layer: keyof BroadcastState['layers'], visible: boolean) => void;

  // Reset
  reset: () => void;
}

const initialState = {
  sidebarExpanded: true,
  sidebarPosition: 'left' as SidebarPosition,
  layersPanelOpen: false,
  annotationMode: false,
  headerVisible: true,
  searchOpen: false,
  electionSelectorOpen: false,
  viewMode: 'map' as ViewMode,
  selectedElectionId: null,
  comparisonElectionId: null,
  drillDownStack: [{ level: 2, regionId: null, regionName: 'Uganda' }],
  currentLevel: 2, // Start at district level (same as MapDashboard)
  selectedRegionId: null,
  selectedRegionName: 'Uganda',
  layers: {
    results: true,
    demographics: false,
    issues: false,
    historical: false,
    boundaries: true,
  },
};

export const useBroadcastStore = create<BroadcastState>((set, get) => ({
  ...initialState,

  // UI Actions
  toggleSidebar: () => set((state) => ({ sidebarExpanded: !state.sidebarExpanded })),
  setSidebarExpanded: (expanded) => set({ sidebarExpanded: expanded }),

  toggleSidebarPosition: () => set((state) => ({
    sidebarPosition: state.sidebarPosition === 'left' ? 'right' : 'left',
  })),
  setSidebarPosition: (position) => set({ sidebarPosition: position }),

  toggleLayersPanel: () => set((state) => ({
    layersPanelOpen: !state.layersPanelOpen,
    searchOpen: false,
    electionSelectorOpen: false,
  })),

  toggleAnnotationMode: () => set((state) => ({
    annotationMode: !state.annotationMode,
    layersPanelOpen: false,
    searchOpen: false,
    electionSelectorOpen: false,
  })),

  showHeader: () => set({ headerVisible: true }),
  hideHeader: () => set({ headerVisible: false }),

  toggleSearch: () => set((state) => ({
    searchOpen: !state.searchOpen,
    layersPanelOpen: false,
    electionSelectorOpen: false,
  })),

  toggleElectionSelector: () => set((state) => ({
    electionSelectorOpen: !state.electionSelectorOpen,
    layersPanelOpen: false,
    searchOpen: false,
  })),

  closeAllPanels: () => set({
    layersPanelOpen: false,
    searchOpen: false,
    electionSelectorOpen: false,
  }),

  // View Actions
  setViewMode: (mode) => set({ viewMode: mode }),

  selectElection: (id) => set({
    selectedElectionId: id,
    electionSelectorOpen: false,
  }),

  setComparisonElection: (id) => set({ comparisonElectionId: id }),

  // Navigation Actions
  drillDown: (regionId, regionName) => {
    const { drillDownStack, currentLevel } = get();
    const newLevel = currentLevel + 1;

    if (newLevel > 5) return; // Max level is parish (5)

    const newStack = [
      ...drillDownStack,
      { level: newLevel, regionId, regionName }
    ];

    set({
      drillDownStack: newStack,
      currentLevel: newLevel,
      selectedRegionId: regionId,
      selectedRegionName: regionName,
    });
  },

  drillUp: () => {
    const { drillDownStack } = get();

    if (drillDownStack.length <= 1) return; // Already at national

    const newStack = drillDownStack.slice(0, -1);
    const previousLevel = newStack[newStack.length - 1];

    set({
      drillDownStack: newStack,
      currentLevel: previousLevel.level,
      selectedRegionId: previousLevel.regionId,
      selectedRegionName: previousLevel.regionName,
    });
  },

  navigateTo: (index) => {
    const { drillDownStack } = get();

    if (index < 0 || index >= drillDownStack.length) return;

    const newStack = drillDownStack.slice(0, index + 1);
    const targetLevel = newStack[newStack.length - 1];

    set({
      drillDownStack: newStack,
      currentLevel: targetLevel.level,
      selectedRegionId: targetLevel.regionId,
      selectedRegionName: targetLevel.regionName,
    });
  },

  // Navigate directly to a district (from basemap clicks)
  // Creates a new stack: Uganda -> District (showing constituencies at level 3)
  navigateToDistrict: (districtId, districtName) => {
    set({
      drillDownStack: [
        { level: 2, regionId: null, regionName: 'Uganda' },
        { level: 3, regionId: districtId, regionName: districtName }
      ],
      currentLevel: 3,
      selectedRegionId: districtId,
      selectedRegionName: districtName,
    });
  },

  resetToNational: () => set({
    drillDownStack: [{ level: 2, regionId: null, regionName: 'Uganda' }],
    currentLevel: 2,
    selectedRegionId: null,
    selectedRegionName: 'Uganda',
  }),

  // Layer Actions
  toggleLayer: (layer) => set((state) => ({
    layers: {
      ...state.layers,
      [layer]: !state.layers[layer],
    },
  })),

  setLayer: (layer, visible) => set((state) => ({
    layers: {
      ...state.layers,
      [layer]: visible,
    },
  })),

  // Reset
  reset: () => set(initialState),
}));
