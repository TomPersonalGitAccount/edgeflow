import Stripe from 'stripe';

export function getStripe(secretKey: string) {
  return new Stripe(secretKey, {
    apiVersion: '2025-03-31.basil',
  });
}

export const PLANS = {
  starter: {
    name: 'Starter',
    pageviews: '100K',
    price: '$10',
    features: ['Up to 100K pageviews/mo', 'Edge caching', 'One-click deploy', 'Kill switch'],
  },
  growth: {
    name: 'Growth',
    pageviews: '500K',
    price: '$25',
    features: ['Up to 500K pageviews/mo', 'Edge caching', 'One-click deploy', 'Kill switch', 'Priority support'],
  },
  scale: {
    name: 'Scale',
    pageviews: '2M',
    price: '$49',
    features: ['Up to 2M pageviews/mo', 'Edge caching', 'One-click deploy', 'Kill switch', 'Priority support', 'Custom cache rules'],
  },
} as const;
