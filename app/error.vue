<template>
  <main class="bg-surface-950 flex min-h-screen items-center justify-center p-6 text-center">
    <div>
      <h1 class="text-2xl font-bold text-white">{{ error.statusCode || 500 }}</h1>
      <p class="text-surface-400 mt-2">{{ error.message }}</p>
      <UButton class="mt-5" to="/tasks">Back to tasks</UButton>
    </div>
  </main>
</template>
<script setup lang="ts">
  defineProps<{ error: { statusCode?: number; message: string } }>();
</script>
