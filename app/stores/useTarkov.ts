import { defineStore } from 'pinia';
import { defaultState, getters, progressActions, type UserState } from '@/stores/progressState';
import { hydrateStaticQuestStores } from '@/stores/tarkov/staticQuestStoreBridge';
import type { GameMode } from '@/utils/constants';
const STORE_ACTIONS_KEY = 'actions' as const;
export const useTarkovStore = defineStore('tarkov', {
  state: (): UserState => structuredClone(defaultState),
  getters,
  [STORE_ACTIONS_KEY]: {
    ...progressActions,
    async switchGameMode(mode: GameMode) {
      progressActions.switchGameMode.call(this, mode);
      await hydrateStaticQuestStores(mode);
    },
  },
});
