import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  GITHUB_IMAGE_DOMAINS,
  isPrimaryAppHostname,
  isPagesPreviewHostname,
  resolveClientLogSinkUrl,
  resolveCanonicalSiteUrl,
  resolvePublicAppUrl,
  resolveStaticQuestDataRuntimeConfig,
  resolveSupabaseRuntimeConfig,
  shouldEnableAnalyticsIntegrations,
  shouldUseOfflineSupabaseFallback,
  TARKOV_IMAGE_DOMAINS,
  YOUTUBE_IMAGE_DOMAINS,
} from '@/utils/runtimeConfig';
describe('resolveSupabaseRuntimeConfig', () => {
  it('resolves shared Supabase env values', () => {
    const config = resolveSupabaseRuntimeConfig({
      SUPABASE_ANON_KEY: ' shared-anon-key ',
      SUPABASE_URL: ' https://shared.supabase.co ',
    });
    expect(config.privateUrl).toBe('https://shared.supabase.co');
    expect(config.privateAnonKey).toBe('shared-anon-key');
    expect(config.publicUrl).toBe('https://shared.supabase.co');
    expect(config.publicAnonKey).toBe('shared-anon-key');
  });
  it('rejects partial credentials', () => {
    expect(() =>
      resolveSupabaseRuntimeConfig({
        SUPABASE_ANON_KEY: 'shared-anon-key',
      })
    ).toThrow('[Config] Incomplete Supabase credentials: SUPABASE_*');
  });
  it('allows both shared credentials to be absent for offline development', () => {
    expect(resolveSupabaseRuntimeConfig({})).toEqual({
      privateAnonKey: '',
      privateUrl: '',
      publicAnonKey: '',
      publicUrl: '',
    });
  });
  it('uses the committed local env stub as an empty pair that selects offline mode', () => {
    const envPath = join(process.cwd(), '.env.example.local');
    const parsed: NodeJS.ProcessEnv = {};
    for (const line of readFileSync(envPath, 'utf8').split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const separator = trimmed.indexOf('=');
      if (separator <= 0) continue;
      parsed[trimmed.slice(0, separator)] = trimmed.slice(separator + 1);
    }
    expect(parsed.SUPABASE_URL ?? '').toBe('');
    expect(parsed.SUPABASE_ANON_KEY ?? '').toBe('');
    const config = resolveSupabaseRuntimeConfig(parsed);
    expect(config).toEqual({
      privateAnonKey: '',
      privateUrl: '',
      publicAnonKey: '',
      publicUrl: '',
    });
    expect(!config.publicUrl.trim() || !config.publicAnonKey.trim()).toBe(true);
    expect(
      shouldUseOfflineSupabaseFallback({
        hostname: 'localhost',
        isProduction: false,
      })
    ).toBe(true);
  });
  it('includes Tarkov asset hosts alongside GitHub image hosts', () => {
    expect([...GITHUB_IMAGE_DOMAINS, ...TARKOV_IMAGE_DOMAINS, ...YOUTUBE_IMAGE_DOMAINS]).toEqual(
      expect.arrayContaining([
        'assets.tarkov.dev',
        'avatars.githubusercontent.com',
        'github.com',
        'i.ytimg.com',
      ])
    );
  });
});
describe('resolveClientLogSinkUrl', () => {
  it('disables browser log forwarding unless a sink is explicitly configured', () => {
    expect(resolveClientLogSinkUrl({})).toBe('');
    expect(resolveClientLogSinkUrl({ NUXT_PUBLIC_CLIENT_LOG_SINK_URL: '  ' })).toBe('');
    expect(resolveClientLogSinkUrl({ NUXT_PUBLIC_CLIENT_LOG_SINK_URL: ' /api/logs/client ' })).toBe(
      '/api/logs/client'
    );
  });
});
describe('resolvePublicAppUrl', () => {
  it('resolves APP_URL', () => {
    expect(
      resolvePublicAppUrl({
        APP_URL: 'https://platform.example.com',
      })
    ).toBe('https://platform.example.com');
  });
  it('falls back to the current Cloudflare Pages deployment url', () => {
    expect(
      resolvePublicAppUrl({
        CF_PAGES_URL: 'deploy-preview.pages.dev',
      })
    ).toBe('https://deploy-preview.pages.dev');
  });
  it('falls back to localhost when no deployment url exists', () => {
    expect(resolvePublicAppUrl({})).toBe('http://localhost:3000');
  });
});
describe('resolveCanonicalSiteUrl', () => {
  it('uses the production origin when a production build has only the local fallback', () => {
    expect(resolveCanonicalSiteUrl('http://localhost:3000')).toBe('https://tarkovtracker.org');
  });
  it('preserves deployed origins and removes trailing slashes', () => {
    expect(resolveCanonicalSiteUrl('https://preview.pages.dev/')).toBe('https://preview.pages.dev');
  });
});
describe('shouldUseOfflineSupabaseFallback', () => {
  it('allows offline fallback outside production', () => {
    expect(
      shouldUseOfflineSupabaseFallback({
        hostname: 'tarkovtracker.org',
        isProduction: false,
      })
    ).toBe(true);
  });
  it('allows offline fallback on Cloudflare preview hosts', () => {
    expect(
      shouldUseOfflineSupabaseFallback({
        hostname: 'feature-branch.tarkovtrackernuxt.pages.dev',
        isProduction: true,
      })
    ).toBe(true);
    expect(isPagesPreviewHostname('feature-branch.tarkovtrackernuxt.pages.dev')).toBe(true);
  });
  it('keeps production strict on primary hosts', () => {
    expect(
      shouldUseOfflineSupabaseFallback({
        hostname: 'tarkovtracker.org',
        isProduction: true,
      })
    ).toBe(false);
  });
});
describe('shouldEnableAnalyticsIntegrations', () => {
  it('disables analytics outside production', () => {
    expect(
      shouldEnableAnalyticsIntegrations({
        appUrl: 'https://tarkovtracker.org',
        hostname: 'tarkovtracker.org',
        isProduction: false,
      })
    ).toBe(false);
  });
  it('disables analytics on preview hosts', () => {
    expect(
      shouldEnableAnalyticsIntegrations({
        appUrl: 'https://feature-branch.tarkovtrackernuxt.pages.dev',
        hostname: 'feature-branch.tarkovtrackernuxt.pages.dev',
        isProduction: true,
      })
    ).toBe(false);
    expect(isPagesPreviewHostname('feature-branch.tarkovtrackernuxt.pages.dev')).toBe(true);
  });
  it('uses appUrl when hostname is unavailable', () => {
    expect(
      shouldEnableAnalyticsIntegrations({
        appUrl: 'https://tarkovtracker.org',
        isProduction: true,
      })
    ).toBe(true);
    expect(
      shouldEnableAnalyticsIntegrations({
        appUrl: 'https://preview.tarkovtrackernuxt.pages.dev',
        isProduction: true,
      })
    ).toBe(false);
  });
  it('disables analytics on non-primary production hosts', () => {
    expect(
      shouldEnableAnalyticsIntegrations({
        appUrl: 'https://preview.example.com',
        hostname: 'preview.example.com',
        isProduction: true,
      })
    ).toBe(false);
  });
  it('enables analytics on primary production hosts', () => {
    expect(
      shouldEnableAnalyticsIntegrations({
        appUrl: 'https://tarkovtracker.org',
        hostname: 'www.tarkovtracker.org',
        isProduction: true,
      })
    ).toBe(true);
    expect(isPrimaryAppHostname('tarkovtracker.org')).toBe(true);
    expect(isPrimaryAppHostname('www.tarkovtracker.org')).toBe(true);
  });
  it('normalizes bare hostnames with ports before checking primary hosts', () => {
    expect(
      shouldEnableAnalyticsIntegrations({
        hostname: 'tarkovtracker.org:443',
        isProduction: true,
      })
    ).toBe(true);
    expect(isPrimaryAppHostname('www.tarkovtracker.org:443')).toBe(true);
  });
});
describe('resolveStaticQuestDataRuntimeConfig', () => {
  it('defaults to enabled outside tests and /quest-data', () => {
    expect(resolveStaticQuestDataRuntimeConfig({}, 'development')).toEqual({
      staticQuestDataBaseUrl: '/quest-data',
      staticQuestMode: true,
    });
    expect(resolveStaticQuestDataRuntimeConfig({}, 'test').staticQuestMode).toBe(false);
  });
  it('honors explicit public env overrides without an object key', () => {
    expect(
      resolveStaticQuestDataRuntimeConfig(
        {
          NUXT_PUBLIC_STATIC_QUEST_MODE: 'true',
          NUXT_PUBLIC_STATIC_QUEST_DATA_BASE_URL: 'http://192.168.0.5:9000/',
        },
        'test'
      )
    ).toEqual({
      staticQuestDataBaseUrl: 'http://192.168.0.5:9000',
      staticQuestMode: true,
    });
  });
  it('does not treat NUXT_PUBLIC_STATIC_QUEST_DATA as the mode flag', () => {
    expect(
      resolveStaticQuestDataRuntimeConfig({ NUXT_PUBLIC_STATIC_QUEST_DATA: 'true' }, 'test')
        .staticQuestMode
    ).toBe(false);
  });
});
