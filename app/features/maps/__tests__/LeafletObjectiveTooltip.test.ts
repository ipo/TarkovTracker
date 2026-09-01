import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
type MockTask = {
  id: string;
  name: string;
  wikiLink?: string | null;
};
const setup = async (task: MockTask) => {
  const metadataStore = {
    objectives: [{ id: 'obj-1', taskId: task.id, description: 'Find the location', count: 3 }],
    tasks: [task],
  };
  const preferencesStore = { getMapTooltipDensity: 'default' };
  const tarkovStore = {
    getObjectiveCount: vi.fn(() => 1),
    isTaskComplete: vi.fn(() => false),
    isTaskFailed: vi.fn(() => false),
    isTaskObjectiveComplete: vi.fn(() => false),
    setObjectiveCount: vi.fn(),
    setTaskObjectiveComplete: vi.fn(),
    setTaskObjectiveUncomplete: vi.fn(),
  };
  const router = { currentRoute: { value: { query: { view: 'maps' } } }, replace: vi.fn() };
  vi.doMock('@/stores/useMetadata', () => ({ useMetadataStore: () => metadataStore }));
  vi.doMock('@/stores/usePreferences', () => ({ usePreferencesStore: () => preferencesStore }));
  vi.doMock('@/stores/useTarkov', () => ({ useTarkovStore: () => tarkovStore }));
  const { default: LeafletObjectiveTooltip } =
    await import('@/features/maps/LeafletObjectiveTooltip.vue');
  const wrapper = mount(LeafletObjectiveTooltip, {
    props: { objectiveId: 'obj-1', t: (key: string) => key },
    global: { provide: { router }, stubs: { UIcon: true } },
  });
  return { router, tarkovStore, wrapper };
};
describe('LeafletObjectiveTooltip', () => {
  beforeEach(() => {
    vi.resetModules();
  });
  it('restores task context, links, completion, and task-list navigation', async () => {
    const { router, tarkovStore, wrapper } = await setup({
      id: 'task-1',
      name: 'Operation Aquarius',
      wikiLink: 'https://escapefromtarkov.fandom.com/wiki/Operation_Aquarius',
    });
    expect(wrapper.text()).toContain('Operation Aquarius');
    expect(wrapper.text()).toContain('Find the location');
    expect(wrapper.text()).toContain('1/3');
    expect(
      wrapper.find('a[href="https://escapefromtarkov.fandom.com/wiki/Operation_Aquarius"]').exists()
    ).toBe(true);
    expect(wrapper.find('a[href="https://tarkov.dev/task/task-1"]').exists()).toBe(true);
    await wrapper.get('[aria-label="maps.tooltip.complete"]').trigger('click');
    expect(tarkovStore.setTaskObjectiveComplete).toHaveBeenCalledWith('obj-1');
    expect(tarkovStore.setObjectiveCount).toHaveBeenCalledWith('obj-1', 3);
    await wrapper.get('[aria-label="maps.tooltip.go_to_in_task_list"]').trigger('click');
    expect(router.replace).toHaveBeenCalledWith({
      query: { view: 'maps', task: 'task-1', highlightObjective: 'obj-1' },
    });
  });
  it('emits close when the tooltip close button is clicked', async () => {
    const { wrapper } = await setup({ id: 'task-2', name: 'Focused Task' });
    await wrapper.get('[data-testid="objective-close-button"]').trigger('click');
    expect(wrapper.emitted('close')).toHaveLength(1);
  });
});
