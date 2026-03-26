/**
 * EdgeFlow — Multi-tenant Cloudflare Edge Cache Worker
 *
 * Proxies Webflow sites through Cloudflare's edge cache to reduce
 * bandwidth costs. Identifies tenants by hostname, loads config from
 * KV, rewrites CDN URLs, and caches responses at the edge.
 *
 * Based on the proven rtb-edge-cache v8 worker.
 */

import type { Env, TenantConfig } from './types';
import { loadTenantConfig } from './config';
import { handleAssetProxy } from './asset-proxy';
import { handleHealthCheck } from './health';
import { rewriteHTML } from './rewriter';
import { trackUsage, isOverLimit } from './usage';
import {
  fixHeaders,
  makeCacheKey,
  STATIC_EXT,
  TTL_HTML,
  TTL_STATIC,
} from './cache';
import { ASSET_PREFIX } from './rewriter';

// ─── Passthrough: fetch directly from Webflow ────────────────────────
async function passthrough(
  request: Request,
  config: TenantConfig,
  url: URL
): Promise<Response> {
  const origin = `https://${config.webflowDomain}${url.pathname}${url.search}`;
  return fetch(origin, {
    headers: request.headers,
    redirect: 'follow',
  });
}

// ─── HTML Proxy (with Cache API) ─────────────────────────────────────
async function handleHTMLProxy(
  request: Request,
  config: TenantConfig,
  ctx: ExecutionContext
): Promise<Response> {
  const cache = caches.default;
  const cacheKey = makeCacheKey(request.url);

  // Check edge cache
  const cached = await cache.match(cacheKey);
  if (cached) {
    const headers = new Headers(cached.headers);
    headers.set('x-edgeflow-cache', 'HIT');
    return new Response(cached.body, { status: cached.status, headers });
  }

  // Cache miss — fetch from Webflow origin
  const url = new URL(request.url);
  const originUrl = `https://${config.webflowDomain}${url.pathname}${url.search}`;
  const originResponse = await fetch(originUrl, {
    headers: request.headers,
    cf: { cacheEverything: true, cacheTtl: TTL_HTML },
  });

  const contentType = originResponse.headers.get('content-type') || '';

  // Non-HTML responses: cache as-is
  if (!contentType.includes('text/html')) {
    const headers = fixHeaders(originResponse.headers, 'pass', TTL_HTML);
    headers.set('x-edgeflow-cache', 'MISS');
    const response = new Response(originResponse.body, {
      status: originResponse.status,
      headers,
    });
    ctx.waitUntil(cache.put(cacheKey, response.clone()));
    return response;
  }

  // HTML: rewrite CDN URLs and strip SRI
  const html = await originResponse.text();
  const rewritten = rewriteHTML(html);

  const headers = fixHeaders(originResponse.headers, 'html', TTL_HTML);
  headers.set('x-edgeflow-cache', 'MISS');
  const response = new Response(rewritten, { status: 200, headers });

  ctx.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
}

// ─── Static File Passthrough (with Cache API) ────────────────────────
async function handleStaticFile(
  request: Request,
  config: TenantConfig,
  ctx: ExecutionContext
): Promise<Response> {
  const cache = caches.default;
  const cacheKey = makeCacheKey(request.url);

  const cached = await cache.match(cacheKey);
  if (cached) {
    const headers = new Headers(cached.headers);
    headers.set('x-edgeflow-cache', 'HIT');
    return new Response(cached.body, { status: cached.status, headers });
  }

  const url = new URL(request.url);
  const originUrl = `https://${config.webflowDomain}${url.pathname}${url.search}`;
  const resp = await fetch(originUrl, {
    headers: request.headers,
    cf: { cacheEverything: true, cacheTtl: TTL_STATIC },
  });

  const headers = fixHeaders(resp.headers, 'static', TTL_STATIC);
  headers.set('x-edgeflow-cache', 'MISS');
  const response = new Response(resp.body, { status: resp.status, headers });

  ctx.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
}

// ─── Main Worker ─────────────────────────────────────────────────────
export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    const url = new URL(request.url);

    // Only cache GET requests
    if (request.method !== 'GET') {
      return fetch(request);
    }

    // Load tenant config by hostname
    const config = await loadTenantConfig(env, url.hostname);
    if (!config) {
      return new Response(
        JSON.stringify({ error: 'Domain not configured', hostname: url.hostname }),
        { status: 404, headers: { 'content-type': 'application/json' } }
      );
    }

    // Kill switch — pass through to Webflow unmodified
    if (config.killSwitch || !config.enabled) {
      return passthrough(request, config, url);
    }

    // Health check endpoint
    if (url.pathname === '/.edgeflow/health') {
      return handleHealthCheck(config);
    }

    // Usage tracking (sampled, non-blocking)
    ctx.waitUntil(trackUsage(env, config.customerId));

    // Over-limit check — graceful degradation
    if (await isOverLimit(env, config.customerId, config.requestLimit)) {
      const response = await passthrough(request, config, url);
      const headers = new Headers(response.headers);
      headers.set('x-edgeflow-worker', 'over-limit');
      return new Response(response.body, {
        status: response.status,
        headers,
      });
    }

    // Asset proxy (/wf-assets/*)
    if (url.pathname.startsWith(ASSET_PREFIX + '/')) {
      return handleAssetProxy(url, config, ctx);
    }

    // Static files
    if (STATIC_EXT.test(url.pathname)) {
      return handleStaticFile(request, config, ctx);
    }

    // HTML pages
    return handleHTMLProxy(request, config, ctx);
  },

  // Hourly cron for usage monitoring
  async scheduled(
    controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext
  ): Promise<void> {
    // Phase 5: will aggregate usage from KV to D1 and send alerts
    console.log('EdgeFlow cron: usage monitoring triggered');
  },
};
