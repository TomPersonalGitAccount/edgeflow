export interface Env {
  TENANT_CONFIG: KVNamespace;
  USAGE_COUNTERS: KVNamespace;
}

export interface TenantConfig {
  customerId: string;
  webflowDomain: string;
  planId: string;
  requestLimit: number;
  enabled: boolean;
  killSwitch: boolean;
  createdAt: string;
}
