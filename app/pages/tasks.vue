<template>
  <section class="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">
    <h1 class="text-2xl font-bold text-white">{{ t('common.tasks') }}</h1>
    <p class="text-surface-400 mt-2 text-sm">{{ t('page.tasks.map.plan_marker_legend') }}</p>
    <div v-if="metadataStore.loading" class="text-surface-400 py-8">Loading local task data…</div>
    <template v-else>
      <div class="mt-5 flex flex-wrap gap-2">
        <UButton
          v-for="map in maps"
          :key="map.id"
          :color="selectedMapId === map.id ? 'primary' : 'neutral'"
          :variant="selectedMapId === map.id ? 'soft' : 'ghost'"
          @click="selectedMapId = map.id"
        >
          {{ map.name }}
          <span
            v-if="getMapRecommendationTier(map.id, metadataStore.staticMapScores) === 'primary'"
          >
            ★
          </span>
        </UButton>
      </div>
      <LeafletMap
        v-if="selectedMap"
        class="mt-5"
        :map="selectedMap"
        :marks="mapObjectiveMarks"
        :show-extracts="true"
        :show-extract-toggle="true"
        :show-legend="true"
        :show-fullscreen-toggle="true"
        :height="600"
      />
      <ul class="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <li
          v-for="task in metadataStore.tasks"
          :key="task.id"
          class="border-surface-700 rounded border p-3"
        >
          <p class="font-medium text-white">{{ task.name }}</p>
          <p class="text-surface-400 text-xs">{{ task.trader?.name }}</p>
        </li>
      </ul>
    </template>
  </section>
</template>
<script setup lang="ts">
  import { buildStaticObjectiveMarks } from '@/features/maps/staticObjectiveMarks';
  import { getMapRecommendationTier } from '@/features/tasks/mapRecommendation';
  import { useMetadataStore } from '@/stores/useMetadata';
  import { useTarkovStore } from '@/stores/useTarkov';
  useSeoMeta({ title: 'Tasks and Maps' });
  const { t } = useI18n({ useScope: 'global' });
  const metadataStore = useMetadataStore();
  const tarkovStore = useTarkovStore();
  const maps = computed(() => metadataStore.mapsWithSvg);
  const selectedMapId = ref<string | null>(null);
  watch(
    maps,
    (availableMaps) => {
      if (!selectedMapId.value || !availableMaps.some((map) => map.id === selectedMapId.value)) {
        selectedMapId.value = availableMaps[0]?.id ?? null;
      }
    },
    { immediate: true }
  );
  const selectedMap = computed(() => maps.value.find((map) => map.id === selectedMapId.value));
  const mapObjectiveMarks = computed(() =>
    buildStaticObjectiveMarks({
      activeTaskIds: metadataStore.confirmedStaticUnlockedTaskIds,
      isObjectiveComplete: (objectiveId) => tarkovStore.isTaskObjectiveComplete(objectiveId),
      mapId: selectedMapId.value,
      scores: metadataStore.staticMapScores,
      tasks: metadataStore.tasks,
    })
  );
</script>
