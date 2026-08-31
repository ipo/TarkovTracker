import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GAME_MODES } from '@/utils/constants';
import {
  normalizeStaticQuestDataBaseUrl,
  resolveStaticQuestDataRuntimeConfig,
} from '@/utils/runtimeConfig';
import {
  adaptStaticQuestBundle,
  beginStaticQuestHydration,
  buildStaticQuestFileUrl,
  fetchStaticQuestBundle,
  isCurrentStaticQuestHydration,
  resetStaticQuestHydrationForTests,
  resolveStaticQuestFileMode,
} from '@/utils/staticQuestData';
import type { StaticQuestBundle } from '@/types/staticQuestData';
const fixtureDir = join(process.cwd(), 'public/quest-data');
const loadFixture = (name: string) => JSON.parse(readFileSync(join(fixtureDir, name), 'utf8'));
const loadBundle = (mode: 'pvp' | 'pve'): StaticQuestBundle => ({
  tasks: loadFixture(`tasks.${mode}.json`),
  state: loadFixture(`state.${mode}.json`),
  scores: loadFixture(`scores.${mode}.json`),
});
describe('static quest data adapter', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    resetStaticQuestHydrationForTests();
  });
  it('builds configurable file URLs for LAN hosting', () => {
    expect(buildStaticQuestFileUrl('/quest-data', 'tasks', 'pvp')).toBe(
      '/quest-data/tasks.pvp.json'
    );
    expect(buildStaticQuestFileUrl('http://192.168.1.10:8080/', 'state', 'pve')).toBe(
      'http://192.168.1.10:8080/state.pve.json'
    );
    expect(normalizeStaticQuestDataBaseUrl('served')).toBe('/served');
    expect(normalizeStaticQuestDataBaseUrl('javascript:alert(1)')).toBe('/javascript:alert(1)');
  });
  it('maps seasonal and pvp game modes onto pvp files', () => {
    expect(resolveStaticQuestFileMode(GAME_MODES.PVP)).toBe('pvp');
    expect(resolveStaticQuestFileMode(GAME_MODES.SEASONAL)).toBe('pvp');
    expect(resolveStaticQuestFileMode(GAME_MODES.PVE)).toBe('pve');
  });
  it('enables static hydration outside tests unless explicitly disabled', () => {
    expect(resolveStaticQuestDataRuntimeConfig({}, 'development').staticQuestMode).toBe(true);
    expect(resolveStaticQuestDataRuntimeConfig({}, 'test').staticQuestMode).toBe(false);
    expect(
      resolveStaticQuestDataRuntimeConfig({ NUXT_PUBLIC_STATIC_QUEST_MODE: 'false' }, 'development')
        .staticQuestMode
    ).toBe(false);
    expect(
      resolveStaticQuestDataRuntimeConfig({ NUXT_PUBLIC_STATIC_QUEST_MODE: 'true' }, 'test')
        .staticQuestMode
    ).toBe(true);
  });
  it('shapes exporter zones and confirmed-only progress', () => {
    const adapted = adaptStaticQuestBundle(loadBundle('pvp'));
    const active = adapted.tasks.find((task) => task.id === 'quest-active');
    const inferred = adapted.tasks.find((task) => task.id === '5a27ba1c86f77461ea5a3c56');
    const zone = active?.objectives?.[0]?.zones?.[0] as {
      map?: { id: string };
      terrainElevation?: number;
      outline?: unknown[];
    };
    expect(zone?.map?.id).toBe('ground-zero');
    expect(zone?.terrainElevation).toBe(2.5);
    expect(zone?.outline).toHaveLength(4);
    expect(active?.objectives?.[0]?.maps?.[0]?.id).toBe('ground-zero');
    expect(adapted.progress.unlockedTaskIds).toEqual(['quest-active']);
    expect(adapted.progress.taskCompletions['quest-completed']).toEqual({
      complete: true,
      failed: false,
    });
    expect(adapted.progress.taskCompletions['quest-failed']).toEqual({
      complete: false,
      failed: true,
    });
    expect(adapted.progress.taskObjectives['obj-active']).toEqual({ complete: false });
    expect(adapted.progress.unlockedTaskIds).not.toContain('5a27ba1c86f77461ea5a3c56');
    expect(inferred?.id).toBe('5a27ba1c86f77461ea5a3c56');
    expect(adapted.maps.map((map) => map.id)).toEqual(
      expect.arrayContaining(['ground-zero', 'customs'])
    );
  });
  it('loads matching files for a mode', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      const file = url.split('/').at(-1);
      if (!file) throw new Error(url);
      return loadFixture(file);
    });
    vi.stubGlobal('$fetch', fetchMock);
    const bundle = await fetchStaticQuestBundle('pve', { enabled: true, baseUrl: '/quest-data' });
    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      '/quest-data/tasks.pve.json',
      '/quest-data/state.pve.json',
      '/quest-data/scores.pve.json',
    ]);
    expect(Object.keys(bundle.state.quests)).toEqual(['quest-pve']);
  });
  it('rejects non-confirmed quest statuses', async () => {
    const bundle = loadBundle('pvp');
    bundle.state.quests['quest-active'] = {
      ...bundle.state.quests['quest-active']!,
      status: 'available',
    } as never;
    vi.stubGlobal(
      '$fetch',
      vi.fn(async (url: string) => {
        if (url.endsWith('state.pvp.json')) return bundle.state;
        if (url.endsWith('tasks.pvp.json')) return bundle.tasks;
        return bundle.scores;
      })
    );
    await expect(
      fetchStaticQuestBundle('pvp', { enabled: true, baseUrl: '/quest-data' })
    ).rejects.toThrow(/non-confirmed status/);
  });
  it('uses exporter pvp files for Seasonal because issue #2 only emits pvp and reserves pve', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      const file = url.split('/').at(-1);
      if (!file) throw new Error(url);
      return loadFixture(file.replace('seasonal', 'pvp'));
    });
    vi.stubGlobal('$fetch', fetchMock);
    const bundle = await fetchStaticQuestBundle(GAME_MODES.SEASONAL, {
      enabled: true,
      baseUrl: '/quest-data',
    });
    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      '/quest-data/tasks.pvp.json',
      '/quest-data/state.pvp.json',
      '/quest-data/scores.pvp.json',
    ]);
    expect(bundle.tasks.mode).toBe('pvp');
    expect(bundle.state.mode).toBe('pvp');
  });
  it('rejects malformed schema versions and mixed document modes', async () => {
    const bundle = loadBundle('pvp');
    vi.stubGlobal(
      '$fetch',
      vi.fn(async (url: string) => {
        if (url.endsWith('tasks.pvp.json')) {
          return { ...bundle.tasks, schema_version: 2 };
        }
        if (url.endsWith('state.pvp.json')) return bundle.state;
        return bundle.scores;
      })
    );
    await expect(
      fetchStaticQuestBundle('pvp', { enabled: true, baseUrl: '/quest-data' })
    ).rejects.toThrow(/unsupported schema_version/);
    vi.stubGlobal(
      '$fetch',
      vi.fn(async (url: string) => {
        if (url.endsWith('state.pvp.json')) {
          return { ...bundle.state, mode: 'pve' };
        }
        if (url.endsWith('tasks.pvp.json')) return bundle.tasks;
        return bundle.scores;
      })
    );
    await expect(
      fetchStaticQuestBundle('pvp', { enabled: true, baseUrl: '/quest-data' })
    ).rejects.toThrow(/does not match pvp/);
  });
  it('rejects a failed fetch before adapting', async () => {
    vi.stubGlobal(
      '$fetch',
      vi.fn(async (url: string) => {
        if (url.endsWith('state.pvp.json')) {
          throw new Error('network down');
        }
        const file = url.split('/').at(-1);
        if (!file) throw new Error(url);
        return loadFixture(file);
      })
    );
    await expect(
      fetchStaticQuestBundle('pvp', { enabled: true, baseUrl: '/quest-data' })
    ).rejects.toThrow(/network down/);
  });
  it('tracks hydration generations so stale work can be ignored', () => {
    const first = beginStaticQuestHydration();
    const second = beginStaticQuestHydration();
    expect(isCurrentStaticQuestHydration(first.generation)).toBe(false);
    expect(isCurrentStaticQuestHydration(second.generation)).toBe(true);
    expect(first.signal.aborted).toBe(true);
    expect(second.signal.aborted).toBe(false);
  });
});
