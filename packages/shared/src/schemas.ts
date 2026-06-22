// packages\shared\src\schemas.ts
import { z } from 'zod';

export const ProfileDefinitionSchema = z.object({
  name: z.enum(['backend', 'frontend', 'fullstack']),
  searches: z.array(z.string()).min(1),
  keywords: z.record(z.number()),
  negativeKeywords: z.record(z.number()),
  minScore: z.number().int().nonnegative(),
  dailyLimit: z.number().int().positive(),
  seniority: z.enum(['junior', 'mid', 'senior']),
  stackPriority: z.array(z.string()),
  cv: z.enum(['CV_PT', 'CV_EN'])
});

export const JobRecordSchema = z.object({
  id: z.string(),
  company: z.string(),
  title: z.string(),
  url: z.string().url(),
  score: z.number().int(),
  status: z.enum(['found', 'applied', 'pending_review', 'manual']),
  location: z.string(),
  modality: z.enum(['Remoto', 'Híbrido', 'Presencial']),
  easyApply: z.boolean(),
  language: z.enum(['PT', 'EN', 'ES']),
  profile: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  postedAt: z.string().optional(),
  description: z.string().optional(),
  applyResult: z.string().optional()
});

export const ApplicationRecordSchema = z.object({
  id: z.string(),
  jobId: z.string(),
  status: z.enum(['submitted', 'accepted', 'rejected', 'pending']),
  result: z.string().optional(),
  appliedAt: z.string()
});

export const ManualReviewRecordSchema = z.object({
  id: z.string(),
  jobId: z.string(),
  profile: z.string(),
  reviewStatus: z.enum(['pending', 'approved', 'rejected']),
  reviewReason: z.string().optional(),
  reviewNotes: z.string().optional(),
  reviewedAt: z.string().optional(),
  reviewedBy: z.string().optional(),
  snoozedUntil: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const LogEntrySchema = z.object({
  id: z.string(),
  type: z.string(),
  message: z.string(),
  source: z.string(),
  timestamp: z.string(),
  level: z.enum(['info', 'warning', 'error'])
});

export const SettingsRecordSchema = z.object({
  id: z.string(),
  minScore: z.number().int(),
  maxDailyApplications: z.number().int(),
  autoApply: z.boolean(),
  preferredLocation: z.string(),
  blacklist: z.string()
});

export const RuntimeStateRecordSchema = z.object({
  id: z.string(),
  currentState: z.enum(['IDLE', 'SCRAPING', 'APPLYING', 'COOLDOWN', 'BLOCKED', 'DEGRADED', 'ERROR']),
  health: z.enum(['healthy', 'warning', 'blocked', 'degraded', 'offline']),
  lastExecutionStartedAt: z.string().optional(),
  lastExecutionFinishedAt: z.string().optional(),
  nextExecutionAt: z.string().optional(),
  consecutiveFailures: z.number().int().nonnegative(),
  cooldownUntil: z.string().optional(),
  sessionStatus: z.string().optional(),
  sessionId: z.string().optional(),
  lastError: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const RuntimeHistoryRecordSchema = z.object({
  id: z.string(),
  runType: z.enum(['scheduled', 'manual', 'recovery']),
  state: z.enum(['IDLE', 'SCRAPING', 'APPLYING', 'COOLDOWN', 'BLOCKED', 'DEGRADED', 'ERROR']),
  status: z.enum(['success', 'failure', 'skipped', 'blocked']),
  startedAt: z.string(),
  finishedAt: z.string().optional(),
  durationMs: z.number().int().nonnegative().optional(),
  jobsProcessed: z.number().int().nonnegative(),
  autoApplies: z.number().int().nonnegative(),
  reviewsCreated: z.number().int().nonnegative(),
  successRate: z.number().optional(),
  errorMessage: z.string().optional(),
  metadata: z.string().optional()
});

export const RetryHistoryRecordSchema = z.object({
  id: z.string(),
  runId: z.string(),
  attempt: z.number().int().nonnegative(),
  error: z.string(),
  backoffMs: z.number().int().nonnegative(),
  timestamp: z.string()
});

export const RuntimeMetricRecordSchema = z.object({
  id: z.string(),
  recordedAt: z.string(),
  jobsPerDay: z.number().int().nonnegative(),
  appliesPerDay: z.number().int().nonnegative(),
  reviewsPerDay: z.number().int().nonnegative(),
  applySuccessRate: z.number(),
  uptimePercent: z.number(),
  averageScore: z.number(),
  averageDurationMs: z.number().int().nonnegative()
});

export const SessionHealthRecordSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  healthScore: z.number().int().nonnegative(),
  status: z.enum(['healthy', 'degraded', 'rotating']),
  reason: z.string().optional(),
  lastValidatedAt: z.string(),
  cooldownUntil: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const SelectorFailureRecordSchema = z.object({
  id: z.string(),
  selectorType: z.string(),
  selector: z.string(),
  pageUrl: z.string().optional(),
  error: z.string(),
  metadata: z.string().optional(),
  timestamp: z.string()
});

export const AnomalyLogRecordSchema = z.object({
  id: z.string(),
  type: z.string(),
  message: z.string(),
  details: z.string().optional(),
  severity: z.enum(['info', 'warning', 'error']),
  timestamp: z.string()
});

export const ScreenshotMetadataRecordSchema = z.object({
  id: z.string(),
  contextType: z.string(),
  contextId: z.string().optional(),
  path: z.string().optional(),
  metadata: z.string().optional(),
  timestamp: z.string()
});

export const RuntimeControlActionSchema = z.enum([
  'pause',
  'resume',
  'cooldown',
  'emergencyStop',
  'resetSession',
  'quarantineSession',
  'retryApplication'
]);

export const ReviewActionRequestSchema = z.object({
  reviewId: z.string(),
  action: z.enum(['approve', 'reject', 'snooze']),
  reviewer: z.string().optional(),
  note: z.string().optional()
});

export const SessionControlRequestSchema = z.object({
  sessionId: z.string(),
  action: z.enum(['reset', 'quarantine', 'refresh'])
});
