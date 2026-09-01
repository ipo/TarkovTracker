<template>
  <nav
    :aria-label="t('navigation_drawer.main_navigation')"
    class="bg-sidebar border-pvp-700/50 fixed inset-y-0 left-0 z-50 flex flex-col border-r transition-all duration-300"
    :style="{ width: sidebarWidth }"
  >
    <NuxtLink
      to="/tasks"
      class="group mt-3 flex items-center gap-3 px-3 py-2 text-white"
      :aria-label="t('common.tasks')"
    >
      <UIcon name="i-mdi-map-marker-radius-outline" class="text-primary-300 h-6 w-6 shrink-0" />
      <span v-if="!isCollapsed" class="truncate font-semibold">{{ t('common.tasks') }}</span>
    </NuxtLink>
  </nav>
</template>
<script setup lang="ts">
  import { useAppStore } from '@/stores/useApp';
  import { SHELL_DRAWER_COLLAPSED_WIDTH, SHELL_DRAWER_EXPANDED_WIDTH } from '@/utils/shellConfig';
  const { t } = useI18n({ useScope: 'global' });
  const { belowMd } = useSharedBreakpoints();
  const appStore = useAppStore();
  const isCollapsed = computed(() => belowMd.value || appStore.drawerRail);
  const sidebarWidth = computed(() =>
    isCollapsed.value ? SHELL_DRAWER_COLLAPSED_WIDTH : SHELL_DRAWER_EXPANDED_WIDTH
  );
</script>
