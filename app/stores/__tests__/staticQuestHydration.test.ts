import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { computed } from 'vue';
import { useMapObjectiveMarks } from '@/composables/useMapObjectiveMarks';
import { GAME_MODES } from '@/utils/constants';
import { resetStaticQuestHydrationForTests } from '@/utils/staticQuestData';
const fixtureDir = join(process.cwd(), 'public/quest-data');
const loadFixture = (name: string) => JSON.parse(readFileSync(join(fixtureDir, name), 'utf8'));
vi.mock('@/utils/staticQuestData', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/staticQuestData')>();
  return {
    ...actual,
    isStaticQuestDataEnabled: () => true,
    getStaticQuestDataConfig: () => ({ enabled: true, baseUrl: '/quest-data' }),
  };
});
vi.mock('@/utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));
const createFetchMock = (options?: { delayPvpMs?: number }) => {
  return vi.fn(async (url: string) => {
    const file = String(url).split('/').at(-1) || '';
    if (file.includes('.pvp.json') && options?.delayPvpMs) {
      await new Promise((resolve) => setTimeout(resolve, options.delayPvpMs));
    }
    if (file.startsWith('/api/') || url.includes('/api/')) {
      throw new Error(`unexpected remote call: ${url}`);
    }
    return loadFixture(file);
  });
};
describe('static quest hydration', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    resetStaticQuestHydrationForTests();
    vi.stubGlobal('$fetch', createFetchMock());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    resetStaticQuestHydrationForTests();
  });
  it('hydrates confirmed-only progress and objective zones from exporter files', async () => {
    const { useMetadataStore } = await import('@/stores/useMetadata');
    const { useProgressStore } = await import('@/stores/useProgress');
    const { useTarkovStore } = await import('@/stores/useTarkov');
    const metadataStore = useMetadataStore();
    await metadataStore.fetchAllData(true);
    const progressStore = useProgressStore();
    const tarkovStore = useTarkovStore();
    expect(metadataStore.staticQuestFileMode).toBe('pvp');
    expect(metadataStore.tasks.map((task) => task.id)).toEqual(
      expect.arrayContaining(['quest-active', 'quest-completed', '5a27ba1c86f77461ea5a3c56'])
    );
    expect(progressStore.unlockedTasks).toEqual({ 'quest-active': { self: true } });
    expect(progressStore.unlockedTasks['5a27ba1c86f77461ea5a3c56']).toBeUndefined();
    expect(tarkovStore.isTaskComplete('quest-completed')).toBe(true);
    expect(tarkovStore.isTaskFailed('quest-failed')).toBe(true);
    const active = metadataStore.tasks.find((task) => task.id === 'quest-active');
    const zone = active?.objectives?.[0]?.zones?.[0];
    expect(zone?.map?.id).toBe('ground-zero');
    const fetchMock = vi.mocked(globalThis.$fetch as unknown as ReturnType<typeof createFetchMock>);
    expect(fetchMock.mock.calls.some((call) => String(call[0]).includes('/api/'))).toBe(false);
    expect(fetchMock.mock.calls.map((call) => String(call[0]))).toEqual(
      expect.arrayContaining([
        '/quest-data/tasks.pvp.json',
        '/quest-data/state.pvp.json',
        '/quest-data/scores.pvp.json',
      ])
    );
  });
  it('reloads matching files when the game mode changes and ignores stale pvp results', async () => {
    vi.stubGlobal('$fetch', createFetchMock({ delayPvpMs: 40 }));
    const { useMetadataStore } = await import('@/stores/useMetadata');
    const { useProgressStore } = await import('@/stores/useProgress');
    const metadataStore = useMetadataStore();
    metadataStore.currentGameMode = GAME_MODES.PVP;
    const pvpHydration = metadataStore.fetchAllData(true);
    metadataStore.currentGameMode = GAME_MODES.PVE;
    await metadataStore.fetchAllData(true);
    await pvpHydration;
    const progressStore = useProgressStore();
    expect(metadataStore.staticQuestFileMode).toBe('pve');
    expect(metadataStore.tasks.map((task) => task.id)).toEqual(['quest-pve']);
    expect(progressStore.unlockedTasks).toEqual({ 'quest-pve': { self: true } });
    expect(progressStore.unlockedTasks['quest-active']).toBeUndefined();
  });
  it('renders map marks only for confirmed quests', async () => {
    const { useMetadataStore } = await import('@/stores/useMetadata');
    const { useProgressStore } = await import('@/stores/useProgress');
    const metadataStore = useMetadataStore();
    await metadataStore.fetchAllData(true);
    useProgressStore();
    const mapId = computed(() => 'ground-zero');
    const shouldShowCompletedObjectives = computed(() => false);
    const tasks = computed(() => metadataStore.tasks);
    const { mapObjectiveMarks } = useMapObjectiveMarks({
      mapId,
      shouldShowCompletedObjectives,
      tasks,
    });
    expect(mapObjectiveMarks.value.map((mark) => mark.id)).toEqual(['obj-active']);
  });
  it('leaves stores empty when a static document fetch fails', async () => {
    vi.stubGlobal(
      '$fetch',
      vi.fn(async (url: string) => {
        if (String(url).endsWith('state.pvp.json')) {
          throw new Error('state missing');
        }
        return loadFixture(String(url).split('/').at(-1) || '');
      })
    );
    const { useMetadataStore } = await import('@/stores/useMetadata');
    const metadataStore = useMetadataStore();
    await expect(metadataStore.fetchAllData(true)).rejects.toThrow(/state missing/);
    expect(metadataStore.tasks).toEqual([]);
    expect(metadataStore.confirmedUnlockedTaskIds).toEqual([]);
    expect(metadataStore.initialized).toBe(false);
  });
  it('rolls the selected mode back when static hydration fails', async () => {
    vi.stubGlobal(
      '$fetch',
      vi.fn(async (url: string) => {
        const file = String(url).split('/').at(-1) || '';
        if (file.includes('.pve.json')) {
          throw new Error('pve unavailable');
        }
        return loadFixture(file);
      })
    );
    const { useMetadataStore } = await import('@/stores/useMetadata');
    const { useTarkovStore } = await import('@/stores/useTarkov');
    const metadataStore = useMetadataStore();
    const tarkovStore = useTarkovStore();
    await metadataStore.fetchAllData(true);
    expect(tarkovStore.getCurrentGameMode()).toBe(GAME_MODES.PVP);
    await expect(tarkovStore.switchGameMode(GAME_MODES.PVE)).rejects.toThrow(/pve unavailable/);
    expect(tarkovStore.getCurrentGameMode()).toBe(GAME_MODES.PVP);
  });
  it('exposes scalar public runtime config keys instead of an object', () => {
    const publicConfig = useRuntimeConfig().public as {
      staticQuestData?: unknown;
      staticQuestDataBaseUrl?: string;
      staticQuestMode?: boolean;
    };
    expect(typeof publicConfig.staticQuestMode).toBe('boolean');
    expect(typeof publicConfig.staticQuestDataBaseUrl).toBe('string');
    expect(publicConfig.staticQuestData).toBeUndefined();
  });
  it('does not call supabase or tarkovtracker APIs while hydrating', async () => {
    const fetchMock = createFetchMock();
    vi.stubGlobal('$fetch', fetchMock);
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        throw new Error(`unexpected fetch: ${String(input)}`);
      })
    );
    const { useMetadataStore } = await import('@/stores/useMetadata');
    const { initializeTarkovSync } = await import('@/stores/useTarkov');
    await useMetadataStore().fetchAllData(true);
    await initializeTarkovSync();
    const urls = fetchMock.mock.calls.map((call) => String(call[0]));
    expect(urls.every((url) => url.startsWith('/quest-data/'))).toBe(true);
    expect(urls.some((url) => url.includes('supabase') || url.includes('tarkovtracker'))).toBe(
      false
    );
  });
});
