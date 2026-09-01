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
          color="neutral"
          variant="outline"
          :class="selectedMapId === map.id ? 'ring-2 ring-white/70' : ''"
          :style="
            getMapRecommendationButtonStyle(
              map,
              metadataStore.staticMapScores,
              selectedMapId === map.id
            )
          "
          @click="selectedMapId = map.id"
        >
          {{ map.name }}
          <span v-if="map.id === topRecommendedMapId">★</span>
          <span class="text-xs tabular-nums opacity-80">{{ getMapScoreLabel(map) }}</span>
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
      <section v-if="selectedMap" class="mt-6">
        <p class="border-surface-700 bg-surface-900 rounded border p-3 text-white">
          <span class="font-semibold">{{ t('page.tasks.map.you_need_to_bring') }}</span>
          {{ mapQuestBringItems.join(', ') }}
        </p>
        <ul class="mt-3 grid gap-3 sm:grid-cols-2">
          <li
            v-for="quest in selectedMapQuests"
            :key="quest.id"
            class="border-surface-700 rounded border p-4"
          >
            <h2 class="font-semibold text-white">{{ quest.name }}</h2>
            <p v-if="quest.summary" class="text-surface-300 mt-2 text-sm">
              {{ quest.summary }}
            </p>
            <ul v-else class="text-surface-300 mt-2 list-disc space-y-1 pl-5 text-sm">
              <li v-for="objective in quest.objectives" :key="objective">{{ objective }}</li>
            </ul>
          </li>
        </ul>
      </section>
    </template>
  </section>
</template>
<script setup lang="ts">
  import { buildStaticObjectiveMarks } from '@/features/maps/staticObjectiveMarks';
  import {
    buildMapQuestSummaries,
    collectMapQuestBringItems,
    parseQuestSummaries,
  } from '@/features/tasks/mapQuestSummaries';
  import {
    getMapRecommendationButtonStyle,
    getMapRecommendationScore,
    sortMapsByRecommendation,
  } from '@/features/tasks/mapRecommendation';
  import { useMetadataStore } from '@/stores/useMetadata';
  import { useTarkovStore } from '@/stores/useTarkov';
  import { logger } from '@/utils/logger';
  import { normalizeStaticQuestBaseUrl } from '@/utils/staticQuestHydration';
  import type { TarkovMap } from '@/types/tarkov';
  useSeoMeta({ title: 'Tasks and Maps' });
  const { t } = useI18n({ useScope: 'global' });
  const metadataStore = useMetadataStore();
  const tarkovStore = useTarkovStore();
  const runtimeConfig = useRuntimeConfig();
  const questSummaries = shallowRef(parseQuestSummaries(''));
  const maps = computed(() =>
    sortMapsByRecommendation(metadataStore.mapsWithSvg, metadataStore.staticMapScores)
  );
  const topRecommendedMapId = computed(() => maps.value[0]?.id ?? null);
  const getMapScoreLabel = (map: TarkovMap): string => {
    const score = getMapRecommendationScore(map, metadataStore.staticMapScores);
    return score === null ? '—' : score.toFixed(1);
  };
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
  const selectedMapQuests = computed(() =>
    buildMapQuestSummaries(
      selectedMap.value,
      metadataStore.staticMapScores,
      metadataStore.tasks,
      questSummaries.value
    )
  );
  const mapQuestBringItems = computed(() => collectMapQuestBringItems(selectedMapQuests.value));
  const mapObjectiveMarks = computed(() =>
    buildStaticObjectiveMarks({
      activeTaskIds: metadataStore.confirmedStaticUnlockedTaskIds,
      isObjectiveComplete: (objectiveId) => tarkovStore.isTaskObjectiveComplete(objectiveId),
      mapId: selectedMapId.value,
      scores: metadataStore.staticMapScores,
      tasks: metadataStore.tasks,
    })
  );
  onMounted(async () => {
    const baseUrl = normalizeStaticQuestBaseUrl(
      String(runtimeConfig.public.staticQuestDataBaseUrl || '/quest-data')
    );
    try {
      const document = await $fetch<string>(`${baseUrl}/quest_summaries.jsonl`, {
        responseType: 'text',
      });
      questSummaries.value = parseQuestSummaries(document);
    } catch (error) {
      logger.error('[MapQuestSummaries] Failed to load quest summaries', error);
    }
  });
</script>
