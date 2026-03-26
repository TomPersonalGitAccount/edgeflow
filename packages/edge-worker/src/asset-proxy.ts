import { WEBFLOW_CDN, ASSET_PREFIX, rewriteCSS } from './rewriter';
import { fixHeaders, makeCacheKey, TTL_ASSET_PROXY } from './cache';
import type { TenantConfig } from './types';

/**
 * Handle requests to /wf-assets/* by proxying from the Webflow CDN.
 * CSS files are rewritten to fix internal url() references.
 * All responses are cached via the Cache API.
 */
export async function handleAssetProxy(
  url: URL,
  config: TenantConfig,
  ctx: ExecutionContext
): Promise<Response> {
  const cache = caches.default;
  const cacheKey = makeCacheKey(url.toString());

  // Check edge cache
  const cached = await cache.match(cacheKey);
  if (cached) {
    const headers = new Headers(cached.headers);
    headers.set('x-edgeflow-cache', 'HIT');
    return new Response(cached.body, { status: cached.status, headers });
  }

  // Cache miss — fetch from Webflow CDN
  const assetPath = url.pathname.slice(ASSET_PREFIX.length);
  const assetUrl = `https://${WEBFLOW_CDN}${assetPath}${url.search}`;

  let assetResponse: Response;
  try {
    assetResponse = await fetch(assetUrl, {
      headers: { 'Accept-Encoding': 'identity' },
      cf: { cacheEverything: true, cacheTtl: TTL_ASSET_PROXY },
    });
  } catch {
    return Response.redirect(assetUrl, 302);
  }

  if (!assetResponse.ok) {
    return Response.redirect(assetUrl, 302);
  }

  // For CSS: rewrite url() references that point to the CDN
  const ct = assetResponse.headers.get('content-type') || '';
  if (ct.includes('text/css')) {
    const cssText = await assetResponse.text();
    const rewritten = rewriteCSS(cssText);
    const headers = fixHeaders(assetResponse.headers, 'css', TTL_ASSET_PROXY);
    headers.set('x-edgeflow-cache', 'MISS');
    const response = new Response(rewritten, { status: 200, headers });
    ctx.waitUntil(cache.put(cacheKey, response.clone()));
    return response;
  }

  // Non-CSS assets: stream through and cache
  const headers = fixHeaders(assetResponse.headers, 'asset', TTL_ASSET_PROXY);
  headers.set('x-edgeflow-cache', 'MISS');
  const response = new Response(assetResponse.body, {
    status: assetResponse.status,
    headers,
  });
  ctx.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
}
