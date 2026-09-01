import { resolve } from 'node:path';
import { SUPPORTED_LOCALES } from './app/utils/locales';
const appDir = resolve('app');
const testsDir = resolve('tests');
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  telemetry: false,
  ssr: false,
  srcDir: 'app',
  ignore: ['**/__tests__/**', '**/*.test.*', '**/*.spec.*'],
  runtimeConfig: {
    public: {
      appUrl: process.env.APP_URL || 'http://localhost:3000',
      appVersion: process.env.npm_package_version || 'dev',
      staticQuestDataBaseUrl:
        process.env.NUXT_PUBLIC_STATIC_QUEST_DATA_BASE_URL?.trim() || '/quest-data',
      staticQuestMode: process.env.NODE_ENV !== 'test',
    },
  },
  app: {
    head: {
      titleTemplate: '%s | Tarkov Tracker',
      title: 'Escape from Tarkov Map and Task Planner',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        {
          name: 'description',
          content: 'Plan Escape from Tarkov tasks on interactive maps using local static data.',
        },
      ],
    },
  },
  css: ['~/assets/css/tailwind.css'],
  alias: {
    '@': appDir,
    '#tests': testsDir,
    '~': appDir,
  },
  modules: [
    process.env.NODE_ENV !== 'production' ? '@nuxt/eslint' : undefined,
    process.env.NODE_ENV !== 'production' ? '@nuxt/test-utils/module' : undefined,
    '@pinia/nuxt',
    '@nuxt/ui',
    '@nuxt/image',
    '@nuxtjs/i18n',
  ].filter(Boolean) as string[],
  i18n: {
    bundle: { compositionOnly: true, runtimeOnly: true },
    compilation: { strictMessage: false, escapeHtml: true },
    strategy: 'no_prefix',
    defaultLocale: 'en',
    restructureDir: 'app',
    langDir: 'locales',
    locales: SUPPORTED_LOCALES.map((code) => ({ code, file: `${code}.json` })),
    vueI18n: 'i18n.config.ts',
  },
  icon: { clientBundle: { scan: true } },
  ui: {
    theme: {
      colors: [
        'primary',
        'secondary',
        'neutral',
        'pvp',
        'pve',
        'info',
        'success',
        'warning',
        'error',
      ],
    },
  },
  components: [
    { path: '~/components', pathPrefix: false, extensions: ['vue'] },
    { path: '~/features', pathPrefix: false, extensions: ['vue'] },
    { path: '~/shell', pathPrefix: false, extensions: ['vue'] },
  ],
  typescript: {
    tsConfig: {
      compilerOptions: {
        paths: {
          '@/*': ['./app/*'],
          '#tests/*': ['./tests/*'],
          '#tests': ['./tests'],
          '~/*': ['./app/*'],
        },
      },
    },
  },
  postcss: { plugins: { '@tailwindcss/postcss': {}, autoprefixer: {} } },
  vite: {
    oxc: { tsconfig: false } as never,
    optimizeDeps: { include: ['@vueuse/core', 'fflate', 'leaflet', 'pinia-plugin-persistedstate'] },
  },
  hooks: {
    'vite:configResolved'(config) {
      const vuePlugin = config.plugins?.find(
        (plugin) =>
          typeof plugin === 'object' &&
          plugin !== null &&
          !Array.isArray(plugin) &&
          'name' in plugin &&
          plugin.name === 'vite:vue'
      ) as
        | {
            api: { options: { devServer?: unknown } };
          }
        | undefined;
      if (!vuePlugin) return;
      vuePlugin.api.options = {
        ...vuePlugin.api.options,
        devServer: {
          config: { base: config.base, oxc: { tsconfig: false }, server: { hmr: false } },
          watcher: { on() {} },
        },
      };
    },
  },
});
