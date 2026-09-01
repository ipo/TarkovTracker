import { registerStaticQuestHydrationHook } from '@/stores/tarkov/staticQuestStoreBridge';
import { useMetadataStore } from '@/stores/useMetadata';
import { useTarkovStore } from '@/stores/useTarkov';
import { logger } from '@/utils/logger';
import {
  applyStaticQuestHydration,
  createStaticQuestHydrator,
  loadStaticQuestHydration,
} from '@/utils/staticQuestHydration';
import type { GameMode } from '@/utils/constants';
export default defineNuxtPlugin((nuxtApp) => {
  const metadataStore = useMetadataStore();
  const tarkovStore = useTarkovStore();
  if (import.meta.env.MODE === 'test') {
    return { provide: { metadata: metadataStore } };
  }
  const runtimeConfig = useRuntimeConfig();
  const baseUrl = String(runtimeConfig.public.staticQuestDataBaseUrl || '/quest-data');
  const hydrateLatest = createStaticQuestHydrator(
    (mode) => loadStaticQuestHydration(baseUrl, mode, (url) => $fetch(url)),
    (hydration, isLatest) =>
      applyStaticQuestHydration(hydration, metadataStore, tarkovStore, isLatest)
  );
  let pendingHydrations = 0;
  const hydrateMode = async (mode: GameMode): Promise<boolean> => {
    pendingHydrations += 1;
    metadataStore.loading = true;
    try {
      return await hydrateLatest(mode);
    } catch (error) {
      metadataStore.error = error instanceof Error ? error : new Error(String(error));
      metadataStore.initializationFailed = true;
      throw error;
    } finally {
      pendingHydrations -= 1;
      metadataStore.loading = pendingHydrations > 0;
    }
  };
  registerStaticQuestHydrationHook(hydrateMode);
  const start = () => {
    if (metadataStore.initialized) return;
    void hydrateMode(tarkovStore.getCurrentGameMode()).catch((error) => {
      logger.error('[MetadataPlugin] Static quest hydration failed', error);
    });
  };
  if (typeof nuxtApp.hook === 'function') {
    nuxtApp.hook('app:mounted', start);
  } else {
    start();
  }
  return { provide: { metadata: metadataStore } };
});
