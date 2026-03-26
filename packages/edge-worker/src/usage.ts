import type { Env } from './types';

/** Count roughly 1 in every SAMPLE_RATE requests */
const SAMPLE_RATE = 10;

/**
 * Get the current month key (e.g., "2026-03").
 */
function getMonthKey(): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Track a request for usage metering (sampled).
 * Increments the counter by SAMPLE_RATE on ~1/SAMPLE_RATE of requests.
 * Non-blocking — call via ctx.waitUntil.
 */
export async function trackUsage(
  env: Env,
  customerId: string
): Promise<void> {
  // Probabilistic sampling: only write on ~1 in SAMPLE_RATE requests
  if (Math.random() * SAMPLE_RATE >= 1) return;

  const monthKey = getMonthKey();
  const kvKey = `usage:${customerId}:${monthKey}`;

  const current = parseInt((await env.USAGE_COUNTERS.get(kvKey)) || '0');
  const newCount = current + SAMPLE_RATE;

  await env.USAGE_COUNTERS.put(kvKey, String(newCount), {
    expirationTtl: 86400 * 45, // Auto-expire after 45 days
  });
}

/**
 * Check if a customer has exceeded their plan's request limit.
 */
export async function isOverLimit(
  env: Env,
  customerId: string,
  requestLimit: number
): Promise<boolean> {
  const monthKey = getMonthKey();
  const kvKey = `usage:${customerId}:${monthKey}`;
  const current = parseInt((await env.USAGE_COUNTERS.get(kvKey)) || '0');
  return current >= requestLimit;
}
