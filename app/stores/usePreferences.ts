import { defineStore } from 'pinia';
import { MAP_MARKER_COLORS, type MapMarkerColorKey } from '@/utils/theme-colors';
export const usePreferencesStore = defineStore('preferences', {
  state: () => ({
    localeOverride: null as string | null,
    mapMarkerColors: { ...MAP_MARKER_COLORS } as Record<MapMarkerColorKey, string>,
    mapZoomSpeed: 1,
    mapPanSpeed: 1,
    mapZoneOpacity: 0.24,
    mapTooltipDensity: 'default' as 'default' | 'compact',
    mapShowSelfObjectives: true,
    mapShowPinnedObjectives: true,
    mapShowTeamObjectives: false,
  }),
  getters: {
    getMapMarkerColors: (state) => state.mapMarkerColors,
    getMapZoomSpeed: (state) => state.mapZoomSpeed,
    getMapZoneOpacity: (state) => state.mapZoneOpacity,
    getMapTooltipDensity: (state) => state.mapTooltipDensity,
    getMapShowSelfObjectives: (state) => state.mapShowSelfObjectives,
    getMapShowPinnedObjectives: (state) => state.mapShowPinnedObjectives,
    getMapShowTeamObjectives: (state) => state.mapShowTeamObjectives,
  },
  actions: {
    setMapMarkerColor(key: MapMarkerColorKey, value: string) {
      this.mapMarkerColors[key] = value;
    },
    resetMapMarkerColors() {
      this.mapMarkerColors = { ...MAP_MARKER_COLORS };
    },
    setMapZoomSpeed(value: number) {
      this.mapZoomSpeed = value;
    },
    setMapPanSpeed(value: number) {
      this.mapPanSpeed = value;
    },
    setMapZoneOpacity(value: number) {
      this.mapZoneOpacity = value;
    },
    setMapTooltipDensity(value: 'default' | 'compact') {
      this.mapTooltipDensity = value;
    },
    setMapShowSelfObjectives(value: boolean) {
      this.mapShowSelfObjectives = value;
    },
    setMapShowPinnedObjectives(value: boolean) {
      this.mapShowPinnedObjectives = value;
    },
    setMapShowTeamObjectives(value: boolean) {
      this.mapShowTeamObjectives = value;
    },
  },
  persist: true,
});
