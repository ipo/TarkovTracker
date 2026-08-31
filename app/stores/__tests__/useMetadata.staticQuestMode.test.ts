import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useMetadataStore } from '@/stores/useMetadata';
describe('useMetadataStore static quest mode', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });
  it('suppresses every retained Tarkov data API entrypoint', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('$fetch', fetchMock);
    const store = useMetadataStore();
    store.staticQuestModeActive = true;
    store.tasks = [{ id: 'task', objectives: [] }];
    await Promise.all([
      store.checkCachePurge(),
      store.fetchAllData(),
      store.fetchBootstrapData(),
      store.fetchMapSpawnsData(),
      store.fetchPersistentObjectiveModeCountDifferences(),
      store.fetchTasksCoreData(),
    ]);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(store.objectiveModeCountDifferences).toEqual({});
  });
});
