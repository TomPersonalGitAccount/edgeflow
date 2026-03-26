export const PLANS = {
  starter: {
    id: 'starter',
    name: 'Starter',
    price: 1000, // cents
    pageviewLimit: 100_000,
    requestLimit: 9_500_000, // ~95x pageviews
  },
  growth: {
    id: 'growth',
    name: 'Growth',
    price: 2500,
    pageviewLimit: 500_000,
    requestLimit: 47_500_000,
  },
  scale: {
    id: 'scale',
    name: 'Scale',
    price: 4900,
    pageviewLimit: 2_000_000,
    requestLimit: 190_000_000,
  },
} as const;

export type PlanId = keyof typeof PLANS;
