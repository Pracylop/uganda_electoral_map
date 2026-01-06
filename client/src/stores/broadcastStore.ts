import { create } from 'zustand';

export type ViewMode = 'map' | 'dashboard' | 'comparison' | 'issues' | 'demographics';
export type SidebarPosition = 'left' | 'right';
export type IssuesInteractionMode = 'stats' | 'view';
export type BasemapSource = 'auto' | 'online' | 'offline';

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
  issuesPanelOpen: boolean;
  annotationMode: boolean;
  headerVisible: boolean;
  searchOpen: boolean;
  electionSelectorOpen: boolean;

  // Issues filters
  selectedCategoryIds: number[]; // Empty means all categories
  issuesDateRange: {
    startDate: string | null;
    endDate: string | null;
  };
  selectedIssueDistrictId: number | null; // For region-specific summary (can be any level)
  selectedIssueDistrictName: string | null;
  selectedIssueLevel: number | null; // Admin level of the selected region (2=district, 3=constituency, etc.)
  issuesInteractionMode: IssuesInteractionMode; // 'stats' = click shows panel, 'view' = click shows tooltip

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

  // Basemap settings
  basemapOpacity: number; // 0-100
  basemapSource: BasemapSource; // 'auto' | 'online' | 'offline'
  isOnline: boolean; // Current online/offline status

  // Region highlighting (for annotation mode)
  highlightedRegions: { id: number; color: string }[];
  highlightColor: string; // Current highlight color

  // Actions
  toggleSidebar: () => void;
  setSidebarExpanded: (expanded: boolean) => void;
  toggleSidebarPosition: () => void;
  setSidebarPosition: (position: SidebarPosition) => void;
  toggleLayersPanel: () => void;
  toggleIssuesPanel: () => void;
  toggleAnnotationMode: () => void;
  showHeader: () => void;
  hideHeader: () => void;
  toggleSearch: () => void;
  toggleElectionSelector: () => void;
  closeAllPanels: () => void;

  setViewMode: (mode: ViewMode) => void;
  selectElection: (id: number, electoralLevel?: number) => void;
  setComparisonElection: (id: number | null, electoralLevel?: number) => void;

  drillDown: (regionId: number, regionName: string) => void;
  drillUp: () => void;
  navigateTo: (index: number) => void; // Navigate to specific breadcrumb level
  navigateToDistrict: (districtId: number, districtName: string) => void; // Jump directly to a district
  resetToNational: () => void;

  toggleLayer: (layer: keyof BroadcastState['layers']) => void;
  setLayer: (layer: keyof BroadcastState['layers'], visible: boolean) => void;

  // Basemap actions
  setBasemapOpacity: (opacity: number) => void;
  setBasemapSource: (source: BasemapSource) => void;
  setOnlineStatus: (isOnline: boolean) => void;

  // Issues filter actions
  toggleCategoryFilter: (categoryId: number) => void;
  setCategoryFilters: (categoryIds: number[]) => void;
  clearCategoryFilters: () => void;
  setIssuesDateRange: (startDate: string | null, endDate: string | null) => void;
  clearIssuesDateRange: () => void;
  selectIssueDistrict: (districtId: number | null, districtName: string | null, level?: number | null) => void;
  clearIssueDistrict: () => void;
  toggleIssuesInteractionMode: () => void;
  setIssuesInteractionMode: (mode: IssuesInteractionMode) => void;

  // Region highlight actions
  toggleRegionHighlight: (regionId: number, color?: string) => void;
  clearRegionHighlights: () => void;
  setHighlightColor: (color: string) => void;

  // Reset
  reset: () => void;
}

const initialState = {
  sidebarExpanded: true,
  sidebarPosition: 'left' as SidebarPosition,
  layersPanelOpen: false,
  issuesPanelOpen: false,
  annotationMode: false,
  headerVisible: true,
  searchOpen: false,
  electionSelectorOpen: false,
  selectedCategoryIds: [] as number[],
  issuesDateRange: {
    startDate: null as string | null,
    endDate: null as string | null,
  },
  selectedIssueDistrictId: null as number | null,
  selectedIssueDistrictName: null as string | null,
  selectedIssueLevel: null as number | null,
  issuesInteractionMode: 'stats' as IssuesInteractionMode,
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
  basemapOpacity: 50, // Default 50% - balanced between basemap and choropleth
  basemapSource: (localStorage.getItem('basemapSource') as BasemapSource) || 'auto',
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  highlightedRegions: [] as { id: number; color: string }[],
  highlightColor: '#FBBF24', // NRM Yellow by default
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
    issuesPanelOpen: false,
    searchOpen: false,
    electionSelectorOpen: false,
  })),

  toggleIssuesPanel: () => set((state) => ({
    issuesPanelOpen: !state.issuesPanelOpen,
    layersPanelOpen: false,
    searchOpen: false,
    electionSelectorOpen: false,
  })),

  toggleAnnotationMode: () => set((state) => ({
    annotationMode: !state.annotationMode,
    layersPanelOpen: false,
    issuesPanelOpen: false,
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
    issuesPanelOpen: false,
    searchOpen: false,
    electionSelectorOpen: false,
  }),

  // View Actions
  setViewMode: (mode) => set({ viewMode: mode }),

  // Select election and adjust starting level based on electoral level
  // electoralLevel: 0=Presidential (show districts), 2=District Woman MP (show districts), 3=Constituency MP (show constituencies)
  selectElection: (id, electoralLevel) => {
    // Determine starting level based on election type
    // For constituency-level elections (electoralLevel=3), start at level 3
    // For others, start at level 2 (districts)
    const startingLevel = electoralLevel === 3 ? 3 : 2;

    set({
      selectedElectionId: id,
      electionSelectorOpen: false,
      // Reset navigation to appropriate starting level
      drillDownStack: [{ level: startingLevel, regionId: null, regionName: 'Uganda' }],
      currentLevel: startingLevel,
      selectedRegionId: null,
      selectedRegionName: 'Uganda',
    });
  },

  setComparisonElection: (id, _electoralLevel) => {
    // For comparison, just set the ID - the level is shared with main election
    set({ comparisonElectionId: id });
  },

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

  // Basemap opacity (0-100)
  setBasemapOpacity: (opacity) => set({ basemapOpacity: Math.max(0, Math.min(100, opacity)) }),

  // Basemap source preference (persisted to localStorage)
  setBasemapSource: (source) => {
    localStorage.setItem('basemapSource', source);
    set({ basemapSource: source });
  },

  // Online status (updated by online/offline event listeners)
  setOnlineStatus: (isOnline) => set({ isOnline }),

  // Issues filter actions
  toggleCategoryFilter: (categoryId) => set((state) => {
    const current = state.selectedCategoryIds;
    const isSelected = current.includes(categoryId);
    return {
      selectedCategoryIds: isSelected
        ? current.filter(id => id !== categoryId)
        : [...current, categoryId],
    };
  }),

  setCategoryFilters: (categoryIds) => set({ selectedCategoryIds: categoryIds }),

  clearCategoryFilters: () => set({ selectedCategoryIds: [] }),

  setIssuesDateRange: (startDate, endDate) => set({
    issuesDateRange: { startDate, endDate },
  }),

  clearIssuesDateRange: () => set({
    issuesDateRange: { startDate: null, endDate: null },
  }),

  selectIssueDistrict: (districtId, districtName, level = null) => set({
    selectedIssueDistrictId: districtId,
    selectedIssueDistrictName: districtName,
    selectedIssueLevel: level,
  }),

  clearIssueDistrict: () => set({
    selectedIssueDistrictId: null,
    selectedIssueDistrictName: null,
    selectedIssueLevel: null,
  }),

  toggleIssuesInteractionMode: () => set((state) => ({
    issuesInteractionMode: state.issuesInteractionMode === 'stats' ? 'view' : 'stats',
  })),

  setIssuesInteractionMode: (mode) => set({ issuesInteractionMode: mode }),

  // Region highlight actions
  toggleRegionHighlight: (regionId, color) => set((state) => {
    const existing = state.highlightedRegions.find(r => r.id === regionId);
    if (existing) {
      // Remove if already highlighted
      return {
        highlightedRegions: state.highlightedRegions.filter(r => r.id !== regionId),
      };
    } else {
      // Add with current highlight color
      return {
        highlightedRegions: [
          ...state.highlightedRegions,
          { id: regionId, color: color || state.highlightColor }
        ],
      };
    }
  }),

  clearRegionHighlights: () => set({ highlightedRegions: [] }),

  setHighlightColor: (color) => set({ highlightColor: color }),

  // Reset
  reset: () => set(initialState),
}));
