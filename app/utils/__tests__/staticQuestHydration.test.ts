import { describe, expect, it, vi } from 'vitest';
import { defaultState } from '@/stores/progressState';
import {
  applyStaticQuestHydration,
  buildStaticQuestUrl,
  createStaticQuestHydrator,
  loadStaticQuestHydration,
  normalizeStaticQuestBaseUrl,
  resolveStaticQuestFileMode,
  type StaticQuestHydration,
} from '@/utils/staticQuestHydration';
import type { GameMode } from '@/utils/constants';
const documents = (gameMode: GameMode) => {
  const mode = resolveStaticQuestFileMode(gameMode);
  return {
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
                  bottom: 1,
                  custom_geometry: { rotation: 90 },
                  id: 'zone',
                  map: 'source-ground-zero',
                  map_id: 'ground-zero',
                  position: { x: 1, y: 2, z: 3 },
                  size: { x: 4, y: 5, z: 6 },
                  terrainElevation: 2,
                  top: 8,
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
        completed: {
          id: 'completed',
          status: 'completed',
          objectives: [{ id: 'completed-objective', completed: true }],
        },
        failed: {
          id: 'failed',
          status: 'failed',
          objectives: [{ id: 'failed-objective', completed: false }],
        },
        unknown: {
          id: 'unknown',
          status: 'completed',
          objectives: [{ id: 'unknown-objective', completed: true }],
        },
      },
    },
    [`https://lan.test/eft/scores.${mode}.json`]: {
      mode,
      schema_version: 1,
      maps: [
        {
          id: 'ground-zero',
          english_name: 'Ground Zero',
          score: 4.5,
          gateway: true,
          off_goal: false,
          finishable_here: true,
          quests: [
            {
              id: 'confirmed',
              english_name: 'Confirmed quest',
              label: 'gateway',
              gateway: true,
              off_goal: false,
              finishable_here: true,
            },
          ],
        },
      ],
    },
  };
};
const fixtureFetcher = (mode: GameMode) => {
  const fixture = documents(mode);
  return vi.fn(async (url: string) => {
    const value = fixture[url as keyof typeof fixture];
    if (!value) throw new Error(`Unexpected URL ${url}`);
    return value;
  });
};
const emptyHydration = (mode: GameMode): StaticQuestHydration => ({
  fileMode: resolveStaticQuestFileMode(mode),
  metadata: { maps: [], tasks: [], traders: [] },
  mode,
  progress: {
    activeTaskIds: [],
    confirmedTaskIds: [],
    taskCompletions: {},
    taskObjectives: {},
  },
  scores: [],
});
describe('static quest hydration', () => {
  it('normalizes local and HTTP(S) base URLs and rejects executable schemes', () => {
    expect(normalizeStaticQuestBaseUrl(' quest-data/// ')).toBe('/quest-data');
    expect(normalizeStaticQuestBaseUrl('https://lan.test/eft///?ignored=1#hash')).toBe(
      'https://lan.test/eft'
    );
    expect(buildStaticQuestUrl('https://lan.test/eft///', 'state', 'pvp')).toBe(
      'https://lan.test/eft/state.pvp.json'
    );
    expect(() => normalizeStaticQuestBaseUrl('javascript:alert(1)')).toThrow(/HTTP or HTTPS/);
  });
  it.each([
    ['pvp', 'pvp'],
    ['pve', 'pve'],
    ['seasonal', 'pvp'],
  ] as const)('loads %s from the exporter %s file set', async (gameMode, fileMode) => {
    const fetcher = fixtureFetcher(gameMode);
    const hydration = await loadStaticQuestHydration('https://lan.test/eft', gameMode, fetcher);
    expect(hydration.fileMode).toBe(fileMode);
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual(
      ['tasks', 'state', 'scores'].map((name) => `https://lan.test/eft/${name}.${fileMode}.json`)
    );
  });
  it('uses only state keys for confirmed progress and preserves exact failed semantics', async () => {
    const hydration = await loadStaticQuestHydration(
      'https://lan.test/eft',
      'pvp',
      fixtureFetcher('pvp')
    );
    expect(hydration.metadata.tasks?.map((task) => task.id).sort()).toEqual([
      'confirmed',
      'inferred',
    ]);
    expect(hydration.progress.activeTaskIds).toEqual(['confirmed']);
    expect(hydration.progress.confirmedTaskIds).toEqual([
      'confirmed',
      'completed',
      'failed',
      'unknown',
    ]);
    expect(hydration.progress.taskCompletions.inferred).toBeUndefined();
    expect(hydration.progress.taskCompletions.completed).toEqual({
      complete: true,
      failed: false,
    });
    expect(hydration.progress.taskCompletions.failed).toEqual({
      complete: false,
      failed: true,
    });
    expect(hydration.progress.taskObjectives['unknown-objective']).toEqual({ complete: true });
    expect(hydration.metadata.tasks?.some((task) => task.id === 'unknown')).toBe(false);
  });
  it('preserves source identity, full geometry, items, and keys', async () => {
    const hydration = await loadStaticQuestHydration(
      'https://lan.test/eft',
      'pvp',
      fixtureFetcher('pvp')
    );
    const task = hydration.metadata.tasks?.find((candidate) => candidate.id === 'confirmed');
    expect(task?.objectives?.[0]).toMatchObject({
      item: { id: 'item', name: 'Quest item' },
      items: [{ id: 'item', name: 'Quest item' }],
      maps: [{ id: 'ground-zero' }],
      zones: [
        {
          bottom: 1,
          custom_geometry: { rotation: 90 },
          id: 'zone',
          map: { id: 'ground-zero' },
          map_id: 'ground-zero',
          sourceMapId: 'source-ground-zero',
          size: { x: 4, y: 5, z: 6 },
          terrainElevation: 2,
          top: 8,
        },
      ],
    });
    expect(task?.requiredKeys).toMatchObject([
      {
        keys: [{ id: 'key', name: 'Door key' }],
        maps: [{ id: 'ground-zero' }],
      },
    ]);
  });
  it('preserves score order, rank values, and recommendation flags', async () => {
    const hydration = await loadStaticQuestHydration(
      'https://lan.test/eft',
      'pvp',
      fixtureFetcher('pvp')
    );
    expect(hydration.scores).toEqual([
      expect.objectContaining({
        id: 'ground-zero',
        score: 4.5,
        gateway: true,
        off_goal: false,
        finishable_here: true,
        quests: [expect.objectContaining({ id: 'confirmed', label: 'gateway', gateway: true })],
      }),
    ]);
  });
  it('rejects malformed or mixed-mode bundles and failed fetches before apply', async () => {
    const fixture = documents('pvp');
    const mismatched = structuredClone(fixture);
    mismatched['https://lan.test/eft/state.pvp.json']!.mode = 'pve';
    await expect(
      loadStaticQuestHydration('https://lan.test/eft', 'pvp', async (url) => mismatched[url])
    ).rejects.toThrow(/declares mode pve/);
    await expect(
      loadStaticQuestHydration('https://lan.test/eft', 'pvp', async () => {
        throw new Error('network down');
      })
    ).rejects.toThrow('network down');
  });
  it('ignores slower stale success and failure responses during rapid switches', async () => {
    let resolvePvp: ((value: StaticQuestHydration) => void) | undefined;
    let rejectPve: ((reason: Error) => void) | undefined;
    const pvp = new Promise<StaticQuestHydration>((resolve) => {
      resolvePvp = resolve;
    });
    const pve = new Promise<StaticQuestHydration>((_, reject) => {
      rejectPve = reject;
    });
    const applied: GameMode[] = [];
    const hydrate = createStaticQuestHydrator(
      (mode) =>
        mode === 'pvp' ? pvp : mode === 'pve' ? pve : Promise.resolve(emptyHydration(mode)),
      async (hydration) => {
        applied.push(hydration.mode);
        return true;
      }
    );
    const first = hydrate('pvp');
    const second = hydrate('pve');
    await expect(hydrate('seasonal')).resolves.toBe(true);
    resolvePvp?.(emptyHydration('pvp'));
    rejectPve?.(new Error('stale failure'));
    await expect(first).resolves.toBe(false);
    await expect(second).resolves.toBe(false);
    expect(applied).toEqual(['seasonal']);
  });
  it('persists scores and confirmed ids while replacing only selected-mode task progress', async () => {
    const hydration = await loadStaticQuestHydration(
      'https://lan.test/eft',
      'pvp',
      fixtureFetcher('pvp')
    );
    const state = structuredClone(defaultState);
    state.pvp.taskCompletions.stale = { complete: true };
    state.pve.taskCompletions.preserved = { complete: true };
    const metadataStore = {
      confirmedStaticTaskIds: [],
      confirmedStaticUnlockedTaskIds: [],
      currentGameMode: 'pve',
      error: new Error('old'),
      initialized: false,
      initializationFailed: true,
      loadStaticMapData: vi.fn().mockResolvedValue(undefined),
      processTasksData: vi.fn(),
      staticMapScores: [],
      staticQuestFileMode: null,
      tasksObjectivesHydrated: false,
      tasksObjectivesPending: true,
    };
    await applyStaticQuestHydration(hydration, metadataStore, {
      $patch: (patcher) => patcher(state),
    });
    expect(Object.keys(state.pvp.taskCompletions)).toEqual([
      'confirmed',
      'completed',
      'failed',
      'unknown',
    ]);
    expect(state.pve.taskCompletions.preserved?.complete).toBe(true);
    expect(metadataStore.confirmedStaticUnlockedTaskIds).toEqual(['confirmed']);
    expect(metadataStore.staticMapScores).toEqual(hydration.scores);
    expect(metadataStore.staticQuestFileMode).toBe('pvp');
  });
  it('does not partially apply when a request becomes stale during map preparation', async () => {
    const hydration = emptyHydration('pvp');
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
        confirmedStaticTaskIds: [],
        confirmedStaticUnlockedTaskIds: [],
        currentGameMode: 'pve',
        error: null,
        initialized: false,
        initializationFailed: false,
        loadStaticMapData: () => mapData,
        processTasksData,
        staticMapScores: [],
        staticQuestFileMode: null,
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
