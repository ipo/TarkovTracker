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
/**
 * Plugin to initialize the metadata store
 * This ensures the store is properly initialized and data is fetched
 * when the application starts.
 */
export default defineNuxtPlugin((nuxtApp) => {
  const metadataStore = useMetadataStore();
  const tarkovStore = useTarkovStore();
  if (import.meta.env.MODE === 'test') {
    return {
      provide: {
        metadata: metadataStore,
      },
    };
  }
  const toast = useToast();
  const route = useRoute();
  const SKIP_METADATA_PATH_PREFIXES = [
    '/auth',
    '/changelog',
    '/credits',
    '/login',
    '/not-found',
    '/oauth',
    '/privacy',
    '/supporter',
    '/terms-of-service',
  ];
  const runtimeConfig = useRuntimeConfig();
  if (runtimeConfig.public.staticQuestMode === true) {
    metadataStore.staticQuestModeActive = true;
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
    let started = false;
    const start = () => {
      if (started) return;
      started = true;
      watch(
        () => route.path,
        (path) => {
          const shouldLoad = !SKIP_METADATA_PATH_PREFIXES.some(
            (prefix) => path === prefix || path.startsWith(`${prefix}/`)
          );
          if (shouldLoad && !metadataStore.initialized) {
            void hydrateMode(tarkovStore.getCurrentGameMode()).catch((error) => {
              logger.error('[MetadataPlugin] Static quest hydration failed', error);
            });
          }
        },
        { immediate: true }
      );
    };
    if (typeof nuxtApp.hook === 'function') {
      nuxtApp.hook('app:mounted', start);
    } else {
      start();
    }
    return {
      provide: {
        metadata: metadataStore,
      },
    };
  }
  // Initialize the metadata store and fetch data (non-blocking)
  // This allows the app to render immediately while data loads in the background
  const MAX_ATTEMPTS = 3;
  const INITIAL_DELAY = 1000;
  const shouldInitializeForPath = (path: string): boolean => {
    return !SKIP_METADATA_PATH_PREFIXES.some(
      (prefix) => path === prefix || path.startsWith(`${prefix}/`)
    );
  };
  let initPromise: Promise<void> | null = null;
  async function initializeWithRetry(attempt = 1): Promise<void> {
    try {
      await metadataStore.initialize({ gameMode: tarkovStore.getCurrentGameMode() });
    } catch (err) {
      // Safety catch for any unhandled rejections; internal errors are already handled/logged
      if (attempt < MAX_ATTEMPTS) {
        const delay = INITIAL_DELAY * Math.pow(2, attempt - 1);
        logger.warn(
          `[MetadataPlugin] Background initialization failed (attempt ${attempt}/${MAX_ATTEMPTS}). Retrying in ${delay}ms...`,
          err
        );
        await new Promise((resolve) => {
          setTimeout(resolve, delay);
        });
        return initializeWithRetry(attempt + 1);
      }
      // Final failure handling after all retries
      logger.error('[MetadataPlugin] Critical error during background initialization:', err);
      // Surface a user-visible state (e.g., set an application-level flag)
      // The store handles its own error state, but we can also use a toast
      toast.add({
        title: 'Application Data Error',
        description: 'Failed to load critical game data. Some features may be disabled.',
        color: 'error',
        duration: 0, // Keep visible until closed
      });
    }
  }
  const ensureMetadataInitialized = async (path: string): Promise<void> => {
    if (!shouldInitializeForPath(path) || metadataStore.hasInitialized || initPromise) {
      return initPromise ?? Promise.resolve();
    }
    initPromise = initializeWithRetry().finally(() => {
      initPromise = null;
    });
    return initPromise;
  };
  let hasStartedWatchingRoute = false;
  const startWatchingRoute = () => {
    if (hasStartedWatchingRoute) return;
    hasStartedWatchingRoute = true;
    watch(
      () => route.path,
      (path) => {
        void ensureMetadataInitialized(path);
      },
      { immediate: true }
    );
  };
  if (typeof nuxtApp.hook === 'function') {
    nuxtApp.hook('app:mounted', startWatchingRoute);
  } else {
    startWatchingRoute();
  }
  return {
    provide: {
      metadata: metadataStore,
    },
  };
});
