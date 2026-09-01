<template>
  <header class="bg-surface-900 border-surface-700/60 fixed top-0 right-0 z-40 h-11 border-b">
    <div class="flex h-full items-center gap-3 px-3">
      <UButton
        :icon="isDrawerCollapsed ? 'i-mdi-menu' : 'i-mdi-menu-open'"
        variant="ghost"
        color="neutral"
        size="md"
        :aria-label="t('navigation_drawer.toggle')"
        @click="appStore.toggleDrawerRail()"
      />
      <span class="min-w-0 flex-1 truncate text-base font-semibold text-white">
        {{ pageTitle }}
      </span>
      <SelectMenuFixed
        id="app-locale-select"
        v-model="selectedLocale"
        :items="localeItems"
        :aria-label="t('settings.locale')"
        value-key="value"
        class="w-32"
      />
    </div>
  </header>
</template>
<script setup lang="ts">
  import { storeToRefs } from 'pinia';
  import { useAppStore } from '@/stores/useApp';
  const { t, locale, locales } = useI18n({ useScope: 'global' });
  const route = useRoute();
  const appStore = useAppStore();
  const { drawerRail: isDrawerCollapsed } = storeToRefs(appStore);
  const selectedLocale = computed({
    get: () => locale.value,
    set: (value: string) => {
      locale.value = value as typeof locale.value;
    },
  });
  const localeItems = computed(() =>
    locales.value.map((entry) => ({ label: String(entry).toUpperCase(), value: String(entry) }))
  );
  const pageTitle = computed(() =>
    route.path === '/tasks' ? t('common.tasks') : 'Tarkov Tracker'
  );
</script>
