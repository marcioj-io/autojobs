export type RuntimeStateType = 'IDLE' | 'SCRAPING' | 'APPLYING' | 'COOLDOWN' | 'BLOCKED' | 'DEGRADED' | 'ERROR';
export type HealthStatus = 'healthy' | 'warning' | 'blocked' | 'degraded' | 'offline';

export interface SchedulerConfig {
  cooldownMs: number;
  errorCooldownMs: number;
  minRandomDelayMs: number;
  maxRandomDelayMs: number;
}

export interface SchedulerWindow {
  name: 'morning' | 'afternoon' | 'night';
  startHour: number;
  endHour: number;
}

export interface RuntimePipelineResult {
  jobsProcessed: number;
  autoApplies: number;
  reviewsCreated: number;
  averageScore: number;
}

export interface RuntimeRunSummary {
  runType: 'scheduled' | 'manual' | 'recovery';
  state: RuntimeStateType;
  status: 'success' | 'failure' | 'skipped' | 'blocked';
  jobsProcessed: number;
  autoApplies: number;
  reviewsCreated: number;
  successRate: number;
  errorMessage?: string;
}
