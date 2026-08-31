import { describe, expect, it, vi } from 'vitest';
import { defaultState } from '@/stores/progressState';
import {
  applyStaticQuestHydration,
  buildStaticQuestUrl,
  createStaticQuestHydrator,
  loadStaticQuestHydration,
  type StaticQuestHydration,
} from '@/utils/staticQuestHydration';
import type { GameMode } from '@/utils/constants';
const documents = (mode: GameMode) => ({
  [`https://lan.test/eft/tasks.${mode}.json`]: {
    mode,
    schema_version: 1,
    tasks: {
      confirmed: {
        id: 'confirmed',
        english_name: 'Confirmed quest',
        trader: { id: 'trader', english_name: 'Trader' },
        map_ids: ['ground-zero'],
        required_keys: [
          {
            map_id: 'ground-zero',
            keys: [{ id: 'key', english_name: 'Door key' }],
          },
        ],
        objectives: [
          {
            id: 'confirmed-objective',
            english_description: 'Visit the zone',
            type: 'visit',
            optional: false,
            map_ids: ['ground-zero'],
            required_items: [{ id: 'item', english_name: 'Quest item' }],
            zones: [
              {
                id: 'zone',
                map: 'source-ground-zero',
                map_id: 'ground-zero',
                position: { x: 1, y: 2, z: 3 },
                outline: [
                  { x: 0, y: 0, z: 0 },
                  { x: 1, y: 0, z: 0 },
                  { x: 1, y: 0, z: 1 },
                ],
              },
            ],
          },
        ],
      },
      inferred: {
        id: 'inferred',
        english_name: 'Catalog only quest',
        trader: { id: 'trader', english_name: 'Trader' },
        map_ids: ['ground-zero'],
        required_keys: [],
        objectives: [],
      },
    },
  },
  [`https://lan.test/eft/state.${mode}.json`]: {
    mode,
    schema_version: 1,
    quests: {
      confirmed: {
        id: 'confirmed',
        status: 'active',
        objectives: [{ id: 'confirmed-objective', completed: false, pending: true }],
      },
    },
  },
  [`https://lan.test/eft/scores.${mode}.json`]: {
    mode,
    schema_version: 1,
    maps: [{ id: 'ground-zero', english_name: 'Ground Zero', score: 4.5 }],
  },
});
const fixtureFetcher = (mode: GameMode) => {
  const fixture = documents(mode);
  return vi.fn(async (url: string) => {
    const value = fixture[url];
    if (!value) throw new Error(`Unexpected URL ${url}`);
    return value;
  });
};
describe('static quest hydration', () => {
  it('builds configurable LAN URLs without duplicate separators', () => {
    expect(buildStaticQuestUrl('https://lan.test/eft///', 'state', 'pvp')).toBe(
      'https://lan.test/eft/state.pvp.json'
    );
  });
  it.each(['pvp', 'pve', 'seasonal'] as const)('loads the matching %s file set', async (mode) => {
    const fetcher = fixtureFetcher(mode);
    await loadStaticQuestHydration('https://lan.test/eft', mode, fetcher);
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual(
      ['tasks', 'state', 'scores'].map((name) => `https://lan.test/eft/${name}.${mode}.json`)
    );
  });
  it('hydrates only confirmed progress while retaining catalog task metadata', async () => {
    const fetcher = fixtureFetcher('pvp');
    const hydration = await loadStaticQuestHydration('https://lan.test/eft/', 'pvp', fetcher);
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
      'https://lan.test/eft/tasks.pvp.json',
      'https://lan.test/eft/state.pvp.json',
      'https://lan.test/eft/scores.pvp.json',
    ]);
    expect(hydration.metadata.tasks?.map((task) => task.id).sort()).toEqual([
      'confirmed',
      'inferred',
    ]);
    expect(Object.keys(hydration.progress.taskCompletions)).toEqual(['confirmed']);
    expect(hydration.progress.taskCompletions.confirmed).toEqual({
      complete: false,
      failed: false,
    });
  });
  it('shapes canonical objective maps, zones, items, and keys', async () => {
    const hydration = await loadStaticQuestHydration(
      'https://lan.test/eft',
      'pvp',
      fixtureFetcher('pvp')
    );
    const task = hydration.metadata.tasks?.find((candidate) => candidate.id === 'confirmed');
    expect(task?.objectives?.[0]).toMatchObject({
      description: 'Visit the zone',
      items: [{ id: 'item', name: 'Quest item' }],
      maps: [{ id: 'ground-zero' }],
      zones: [
        {
          map: { id: 'ground-zero' },
          position: { x: 1, y: 2, z: 3 },
        },
      ],
    });
    expect(task?.map).toEqual({ id: 'ground-zero' });
    expect(task?.requiredKeys).toEqual([
      {
        keys: [{ id: 'key', name: 'Door key' }],
        maps: [{ id: 'ground-zero' }],
      },
    ]);
  });
  it('ignores a slower stale mode response', async () => {
    let resolvePvp: ((value: StaticQuestHydration) => void) | undefined;
    const pvp = new Promise<StaticQuestHydration>((resolve) => {
      resolvePvp = resolve;
    });
    const pveHydration = {
      metadata: { maps: [], tasks: [], traders: [] },
      mode: 'pve',
      progress: { taskCompletions: {}, taskObjectives: {} },
      scores: [],
    } satisfies StaticQuestHydration;
    const applied: GameMode[] = [];
    const hydrate = createStaticQuestHydrator(
      (mode) => (mode === 'pvp' ? pvp : Promise.resolve(pveHydration)),
      async (hydration) => {
        applied.push(hydration.mode);
      }
    );
    const first = hydrate('pvp');
    await expect(hydrate('pve')).resolves.toBe(true);
    resolvePvp?.({ ...pveHydration, mode: 'pvp' });
    await expect(first).resolves.toBe(false);
    expect(applied).toEqual(['pve']);
  });
  it('replaces only the selected mode task progress when applying a reload', async () => {
    const hydration = await loadStaticQuestHydration(
      'https://lan.test/eft',
      'pvp',
      fixtureFetcher('pvp')
    );
    const state = structuredClone(defaultState);
    state.pvp.taskCompletions.stale = { complete: true };
    state.pve.taskCompletions.preserved = { complete: true };
    const metadataStore = {
      currentGameMode: 'pve',
      error: new Error('old'),
      initialized: false,
      initializationFailed: true,
      loading: true,
      loadStaticMapData: vi.fn().mockResolvedValue(undefined),
      processTasksData: vi.fn(),
      tasksObjectivesHydrated: false,
      tasksObjectivesPending: true,
    };
    await applyStaticQuestHydration(hydration, metadataStore, {
      $patch: (patcher) => patcher(state),
    });
    expect(Object.keys(state.pvp.taskCompletions)).toEqual(['confirmed']);
    expect(state.pve.taskCompletions.preserved?.complete).toBe(true);
    expect(metadataStore.processTasksData).toHaveBeenCalledWith(hydration.metadata);
    expect(metadataStore.currentGameMode).toBe('pvp');
    expect(metadataStore.initialized).toBe(true);
  });
  it('does not partially apply when a request becomes stale during map preparation', async () => {
    const hydration = await loadStaticQuestHydration(
      'https://lan.test/eft',
      'pvp',
      fixtureFetcher('pvp')
    );
    let resolveMapData: (() => void) | undefined;
    const mapData = new Promise<void>((resolve) => {
      resolveMapData = resolve;
    });
    let latest = true;
    const processTasksData = vi.fn();
    const patch = vi.fn();
    const applying = applyStaticQuestHydration(
      hydration,
      {
        currentGameMode: 'pve',
        error: null,
        initialized: false,
        initializationFailed: false,
        loading: true,
        loadStaticMapData: () => mapData,
        processTasksData,
        tasksObjectivesHydrated: false,
        tasksObjectivesPending: false,
      },
      { $patch: patch },
      () => latest
    );
    latest = false;
    resolveMapData?.();
    await expect(applying).resolves.toBe(false);
    expect(processTasksData).not.toHaveBeenCalled();
    expect(patch).not.toHaveBeenCalled();
  });
});
