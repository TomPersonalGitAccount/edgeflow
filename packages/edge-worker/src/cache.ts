// Cache TTLs (seconds)
export const TTL_HTML = 3600;           // 1 hour — HTML pages
export const TTL_STATIC = 604800;       // 7 days — static files on origin
export const TTL_ASSET_PROXY = 2592000; // 30 days — proxied /wf-assets/ (fingerprinted)

// Static file extensions
export const STATIC_EXT =
  /\.(css|js|mjs|json|xml|txt|ico|png|jpe?g|gif|svg|webp|avif|woff2?|ttf|eot|otf|mp4|webm|ogg|mp3|pdf|zip|gz|br|map|wasm)$/i;

/**
 * Build a clean cache key from a URL (strips headers that shouldn't vary the cache).
 */
export function makeCacheKey(url: string): Request {
  return new Request(url, { method: 'GET' });
}

/**
 * Fix response headers for caching:
 * - Normalize Vary header (remove Webflow-specific values)
 * - Set Cache-Control with explicit TTL
 * - Remove headers that prevent caching
 * - Add EdgeFlow worker tag
 */
export function fixHeaders(
  responseHeaders: Headers,
  tag: string,
  cacheTTL: number
): Headers {
  const headers = new Headers(responseHeaders);

  const vary = headers.get('Vary');
  if (vary && vary.includes('x-wf-forwarded-proto')) {
    headers.set('Vary', 'Accept-Encoding');
  }

  headers.set('x-edgeflow-worker', tag);
  headers.set('Cache-Control', `public, max-age=${cacheTTL}`);

  // Remove headers that interfere with caching or leak info
  headers.delete('content-length');
  headers.delete('content-encoding');
  headers.delete('transfer-encoding');
  headers.delete('set-cookie');

  return headers;
}
