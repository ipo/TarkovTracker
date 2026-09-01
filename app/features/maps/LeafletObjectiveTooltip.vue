<template>
  <div :class="isCompact ? 'min-w-40' : 'min-w-55'">
    <div class="flex items-center justify-between gap-2">
      <div class="min-w-0 flex-1">
        <a
          v-if="task?.wikiLink"
          :href="task.wikiLink"
          target="_blank"
          rel="noopener noreferrer"
          :class="taskTitleClass"
          @click.stop
        >
          <span class="truncate">{{ taskName }}</span>
          <UIcon name="i-mdi-open-in-new" class="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        </a>
        <div v-else :class="taskTitleClass">{{ taskName }}</div>
      </div>
      <div class="flex shrink-0 gap-1">
        <a
          v-if="task"
          :href="`https://tarkov.dev/task/${task.id}`"
          target="_blank"
          rel="noopener noreferrer"
          :class="buttonClass"
          :aria-label="t('common.view_on_tarkov_dev')"
          @click.stop
        >
          <img src="/img/logos/tarkovdevlogo.webp" alt="tarkov.dev" class="h-4 w-4" />
        </a>
        <button
          v-if="task"
          type="button"
          :class="buttonClass"
          :aria-label="t('maps.tooltip.go_to_in_task_list')"
          :title="t('maps.tooltip.go_to')"
          @click.stop="scrollToObjective"
        >
          <UIcon name="i-mdi-arrow-down-circle-outline" :class="iconClass" />
        </button>
        <button
          type="button"
          :class="[
            buttonClass,
            isToggleDisabled ? 'cursor-not-allowed opacity-50' : 'hover:bg-white/10',
          ]"
          :aria-label="isComplete ? t('maps.tooltip.uncomplete') : t('maps.tooltip.complete')"
          :aria-pressed="isComplete"
          :disabled="isToggleDisabled"
          @click.stop="toggleObjective"
        >
          <UIcon
            :name="isComplete ? 'i-mdi-check-circle' : 'i-mdi-circle-outline'"
            :class="iconClass"
          />
        </button>
        <button
          type="button"
          data-testid="objective-close-button"
          :class="buttonClass"
          :aria-label="t('common.close')"
          @click.stop="emit('close')"
        >
          <UIcon name="i-mdi-close" :class="iconClass" />
        </button>
      </div>
    </div>
    <div :class="isCompact ? 'mt-0.5' : 'mt-1'">
      <div v-if="!objective" class="text-xs text-gray-400">
        {{ t('maps.tooltip.objective_unavailable') }}
      </div>
      <div v-else :class="isCompact ? 'text-xs text-gray-200' : 'text-sm text-gray-200'">
        <div class="text-gray-300">{{ objective.description }}</div>
        <div v-if="requiredCount > 1" class="mt-1 text-[11px] text-gray-400">
          {{ currentCount }}/{{ requiredCount }}
        </div>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
  import { useMetadataStore } from '@/stores/useMetadata';
  import { usePreferencesStore } from '@/stores/usePreferences';
  import { useTarkovStore } from '@/stores/useTarkov';
  import type { Composer } from 'vue-i18n';
  import type { Router } from 'vue-router';
  const props = defineProps<{ objectiveId: string; t: Composer['t'] }>();
  const emit = defineEmits<{ close: [] }>();
  const router = inject<Router>('router');
  const metadataStore = useMetadataStore();
  const preferencesStore = usePreferencesStore();
  const tarkovStore = useTarkovStore();
  const isCompact = computed(() => preferencesStore.getMapTooltipDensity === 'compact');
  const objective = computed(() =>
    metadataStore.objectives.find(({ id }) => id === props.objectiveId)
  );
  const task = computed(() => {
    const taskId = objective.value?.taskId;
    return taskId ? metadataStore.tasks.find(({ id }) => id === taskId) : undefined;
  });
  const taskName = computed(() => task.value?.name ?? props.t('common.task'));
  const requiredCount = computed(() => objective.value?.count ?? 1);
  const currentCount = computed(() => tarkovStore.getObjectiveCount(props.objectiveId));
  const isComplete = computed(() => tarkovStore.isTaskObjectiveComplete(props.objectiveId));
  const isToggleDisabled = computed(() => {
    const taskId = task.value?.id;
    return taskId ? tarkovStore.isTaskComplete(taskId) || tarkovStore.isTaskFailed(taskId) : false;
  });
  const iconClass = computed(() => (isCompact.value ? 'h-3 w-3' : 'h-4 w-4'));
  const buttonClass = computed(() =>
    isCompact.value
      ? 'inline-flex h-5 w-5 items-center justify-center rounded border border-white/10 bg-white/5 text-gray-200'
      : 'inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/10 bg-white/5 text-gray-200'
  );
  const taskTitleClass = computed(() =>
    task.value?.wikiLink
      ? 'flex min-w-0 items-center gap-1 text-sm font-semibold text-link hover:text-link-hover no-underline'
      : 'text-sm font-semibold text-gray-100'
  );
  const toggleObjective = () => {
    if (isToggleDisabled.value) return;
    if (isComplete.value) {
      tarkovStore.setTaskObjectiveUncomplete(props.objectiveId);
      if (requiredCount.value > 1)
        tarkovStore.setObjectiveCount(props.objectiveId, requiredCount.value - 1);
      return;
    }
    tarkovStore.setTaskObjectiveComplete(props.objectiveId);
    if (requiredCount.value > 1)
      tarkovStore.setObjectiveCount(props.objectiveId, requiredCount.value);
  };
  const scrollToObjective = () => {
    const taskId = task.value?.id;
    if (!router || !taskId) return;
    router.replace({
      query: {
        ...router.currentRoute.value.query,
        task: taskId,
        highlightObjective: props.objectiveId,
      },
    });
  };
</script>
