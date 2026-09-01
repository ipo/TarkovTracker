import { describe, expect, it } from 'vitest';
import {
  buildAppContentSecurityPolicy,
  buildContentSecurityPolicy,
  buildOverlayContentSecurityPolicy,
  getConnectSrcSources,
  getImgSrcSources,
} from '@/utils/csp';
const getDirectiveSources = (csp: string, directive: string): string[] => {
  const entry = csp
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${directive} `));
  if (!entry) {
    return [];
  }
  return entry
    .slice(directive.length + 1)
    .split(/\s+/)
    .filter(Boolean);
};
describe('nuxt.config CSP', () => {
  it('includes configured static-data and log origins in connect-src', () => {
    const connectSources = getConnectSrcSources({
      clientLogSinkUrl: 'https://logs.example.com/v1/collect',
      staticQuestDataBaseUrl: 'http://192.168.1.50:8080/exports',
    });
    expect(connectSources).toContain('https://assets.tarkov.dev');
    expect(connectSources).toContain('https://tarkovtracker.github.io');
    expect(connectSources).toContain('https://logs.example.com');
    expect(connectSources).toContain('http://192.168.1.50:8080');
    expect(connectSources).not.toContain('https://logs.example.com/v1/collect');
  });
  it('allows remote https images for map artwork and fallbacks', () => {
    const imageSources = getImgSrcSources();
    expect(imageSources).toContain('https:');
  });
  it('builds an app policy that preserves Nuxt bootstrap scripts', () => {
    const csp = buildAppContentSecurityPolicy({
      clientLogSinkUrl: 'https://logs.example.com/v1/collect',
      clarityInstrumentationKey: 'abcdef1234',
      gaMeasurementId: 'G-ABCDEF1234',
    });
    expect(getDirectiveSources(csp, 'default-src')).toEqual(["'self'"]);
    expect(getDirectiveSources(csp, 'script-src')).toContain("'unsafe-inline'");
    expect(getDirectiveSources(csp, 'script-src')).toContain(
      'https://static.cloudflareinsights.com'
    );
    expect(getDirectiveSources(csp, 'script-src')).toContain('https://*.googletagmanager.com');
    expect(getDirectiveSources(csp, 'script-src')).toContain('https://*.clarity.ms');
    expect(getDirectiveSources(csp, 'connect-src')).toContain('https://cloudflareinsights.com');
    expect(getDirectiveSources(csp, 'img-src')).toContain('https:');
    expect(getDirectiveSources(csp, 'style-src')).toEqual([
      "'self'",
      "'unsafe-inline'",
      'https://fonts.googleapis.com',
    ]);
    expect(getDirectiveSources(csp, 'font-src')).toEqual([
      "'self'",
      'data:',
      'https://fonts.gstatic.com',
    ]);
    expect(getDirectiveSources(csp, 'worker-src')).toContain('blob:');
    expect(getDirectiveSources(csp, 'worker-src')).toContain("'self'");
  });
  it('allows unsafe-inline scripts only when explicitly enabled', () => {
    const csp = buildContentSecurityPolicy({ allowUnsafeInlineScripts: true });
    expect(getDirectiveSources(csp, 'script-src')).toContain("'unsafe-inline'");
  });
  it('includes Turnstile origins only when a sitekey is configured', () => {
    const withTurnstile = buildContentSecurityPolicy({
      turnstileSiteKey: '1x00000000000000000000AA',
    });
    expect(getDirectiveSources(withTurnstile, 'script-src')).toContain(
      'https://challenges.cloudflare.com'
    );
    expect(getDirectiveSources(withTurnstile, 'frame-src')).toContain(
      'https://challenges.cloudflare.com'
    );
    const withoutTurnstile = buildContentSecurityPolicy({});
    expect(getDirectiveSources(withoutTurnstile, 'script-src')).not.toContain(
      'https://challenges.cloudflare.com'
    );
    expect(getDirectiveSources(withoutTurnstile, 'frame-src')).not.toContain(
      'https://challenges.cloudflare.com'
    );
  });
  it('allows privacy-enhanced YouTube walkthrough frames', () => {
    const csp = buildContentSecurityPolicy();
    expect(getDirectiveSources(csp, 'frame-src')).toContain('https://www.youtube-nocookie.com');
  });
  it('builds a stricter overlay policy and requires explicit inline bootstrap opt-in', () => {
    const csp = buildOverlayContentSecurityPolicy();
    expect(getDirectiveSources(csp, 'default-src')).toEqual(["'none'"]);
    expect(getDirectiveSources(csp, 'script-src')).toEqual(["'none'"]);
    expect(getDirectiveSources(csp, 'connect-src')).toEqual(["'self'"]);
    expect(getDirectiveSources(csp, 'style-src')).toContain('https://fonts.googleapis.com');
    expect(getDirectiveSources(csp, 'font-src')).toContain('https://fonts.gstatic.com');
    expect(getDirectiveSources(csp, 'frame-ancestors')).toEqual(["'self'"]);
    const inlineCsp = buildOverlayContentSecurityPolicy({ allowUnsafeInlineScripts: true });
    expect(getDirectiveSources(inlineCsp, 'script-src')).toEqual(["'unsafe-inline'"]);
  });
});
