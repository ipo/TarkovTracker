<template>
  <div class="bg-military-background text-surface-200 flex min-h-screen flex-col">
    <NavDrawer />
    <AppBar :style="{ left: mainMarginLeft }" />
    <main class="flex flex-1 flex-col pt-11" :style="{ marginLeft: mainMarginLeft }">
      <slot />
    </main>
    <AppFooter :style="{ marginLeft: mainMarginLeft }" />
  </div>
</template>
<script setup lang="ts">
  import AppBar from '@/shell/AppBar.vue';
  import AppFooter from '@/shell/AppFooter.vue';
  import NavDrawer from '@/shell/NavDrawer.vue';
  import { useAppStore } from '@/stores/useApp';
  import { SHELL_DRAWER_COLLAPSED_WIDTH, SHELL_DRAWER_EXPANDED_WIDTH } from '@/utils/shellConfig';
  const appStore = useAppStore();
  const { belowMd } = useSharedBreakpoints();
  const mainMarginLeft = computed(() =>
    belowMd.value || appStore.drawerRail
      ? SHELL_DRAWER_COLLAPSED_WIDTH
      : SHELL_DRAWER_EXPANDED_WIDTH
  );
</script>
