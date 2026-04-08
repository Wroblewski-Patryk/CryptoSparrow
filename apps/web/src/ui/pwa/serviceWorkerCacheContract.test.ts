import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const loadServiceWorkerSource = () => {
  const swPath = path.resolve(process.cwd(), 'public', 'sw.js');
  return readFileSync(swPath, 'utf8');
};

describe('service worker cache contract', () => {
  it('does not precache dynamic root page payloads', () => {
    const source = loadServiceWorkerSource();
    expect(source).toContain("const PRECACHE_URLS = ['/offline', '/manifest.webmanifest', '/logo.png'];");
    expect(source).not.toContain("const PRECACHE_URLS = ['/',");
  });

  it('includes explicit runtime/api bypass guard and no-store fetch policy', () => {
    const source = loadServiceWorkerSource();
    expect(source).toContain("const RUNTIME_BYPASS_PATH_PREFIXES = ['/api/', '/auth/', '/dashboard/', '/admin/'];");
    expect(source).toContain('const isApiOrRuntimeRequest = (url) => {');
    expect(source).toContain("url.searchParams.has('_rsc')");
    expect(source).toContain("event.respondWith(fetch(new Request(event.request, { cache: 'no-store' })));");
  });

  it('supports explicit skip-waiting activation handoff via postMessage', () => {
    const source = loadServiceWorkerSource();
    expect(source).toContain("self.addEventListener('message', (event) => {");
    expect(source).toContain("if (!event.data || event.data.type !== 'SKIP_WAITING') return;");
    expect(source).toContain('self.skipWaiting();');
  });

  it('uses network-first no-store policy for Next static assets to avoid stale client bundles', () => {
    const source = loadServiceWorkerSource();
    expect(source).toContain("const NEXT_STATIC_PATH_PREFIX = '/_next/static/';");
    expect(source).toContain("if (url.pathname.startsWith(NEXT_STATIC_PATH_PREFIX)) {");
    expect(source).toContain("fetch(new Request(event.request, { cache: 'no-store' }))");
  });
});
