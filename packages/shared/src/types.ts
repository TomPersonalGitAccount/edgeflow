import type { PlanId } from './plans';

export interface TenantConfig {
  customerId: string;
  webflowDomain: string;
  planId: PlanId;
  requestLimit: number;
  enabled: boolean;
  killSwitch: boolean;
  createdAt: string;
}

export interface Customer {
  id: string;
  email: string;
  name: string | null;
  google_id: string;
  stripe_customer_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Subscription {
  id: string;
  customer_id: string;
  stripe_subscription_id: string;
  plan_id: PlanId;
  status: 'active' | 'past_due' | 'canceled' | 'trialing';
  current_period_start: string | null;
  current_period_end: string | null;
  created_at: string;
  updated_at: string;
}

export interface Domain {
  id: string;
  customer_id: string;
  hostname: string;
  webflow_domain: string;
  cf_custom_hostname_id: string | null;
  status: 'pending' | 'active' | 'inactive' | 'error';
  kill_switch: number;
  ssl_status: string | null;
  created_at: string;
  updated_at: string;
}
