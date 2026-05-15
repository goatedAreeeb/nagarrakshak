import { create } from 'zustand';
import { buildSearchIndex } from './search/searchIndex';

export function wardPayloadFromFeature(feature) {
  const p = feature.properties ?? {};
  return {
    feature,
    wardId: p.ward_id,
    wardName: p.ward_name,
    analytics: { ...p },
  };
}

export const useCivicStore = create((set) => ({
  selectedWard: null,
  hoverInfo: null,
  wardIssues: [],
  searchEntries: [],
  flyNonce: 0,
  showAllWardColors: false,

  toggleShowAllWardColors: () =>
    set((state) => ({ showAllWardColors: !state.showAllWardColors })),

  setSelectedWard: (ward) =>
    set({
      selectedWard: ward,
      flyNonce: ward ? Date.now() : 0,
      hoverInfo: null,
    }),

  selectFromSearch: (entry) =>
    set({
      selectedWard: wardPayloadFromFeature(entry.feature),
      flyNonce: Date.now(),
      hoverInfo: null,
    }),

  clearSelectedWard: () =>
    set({ selectedWard: null, wardIssues: [], flyNonce: 0 }),

  setHoverInfo: (info) => set({ hoverInfo: info }),
  clearHoverInfo: () => set({ hoverInfo: null }),

  setWardIssues: (issues) => set({ wardIssues: issues }),

  setSearchEntriesFromGeoJson: (geojson) =>
    set({
      searchEntries: geojson ? buildSearchIndex(geojson) : [],
    }),
}));
