import type { Env, TenantConfig } from './types';

/**
 * Load tenant configuration from KV by hostname.
 * Returns null if the hostname is not configured.
 */
export async function loadTenantConfig(
  env: Env,
  hostname: string
): Promise<TenantConfig | null> {
  const raw = await env.TENANT_CONFIG.get(`domain:${hostname}`);
  if (!raw) return null;
  return JSON.parse(raw) as TenantConfig;
}
