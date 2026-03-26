import type { TenantConfig } from './types';

/**
 * Health check endpoint at /.edgeflow/health
 * Returns JSON with worker status and tenant config (redacted).
 */
export function handleHealthCheck(config: TenantConfig): Response {
  return new Response(
    JSON.stringify({
      status: 'ok',
      worker: 'edgeflow-edge',
      tenant: {
        customerId: config.customerId,
        planId: config.planId,
        enabled: config.enabled,
        killSwitch: config.killSwitch,
      },
      timestamp: new Date().toISOString(),
    }, null, 2),
    {
      headers: {
        'content-type': 'application/json',
        'x-edgeflow-worker': 'health',
        'cache-control': 'no-store',
      },
    }
  );
}
