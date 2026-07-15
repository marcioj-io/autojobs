// packages\db\src\schema.ts
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { InferModel } from 'drizzle-orm';
import { SkillMatrix } from '@autojobs/shared';

export const jobs = sqliteTable('jobs', {
  id: text('id').primaryKey(),
  company: text('company').notNull(),
  title: text('title').notNull(),
  url: text('url').notNull(),
  score: integer('score').notNull(),
  status: text('status').notNull(),
  location: text('location').notNull(),
  modality: text('modality').notNull(),
  easyApply: integer('easy_apply', { mode: 'boolean' }).notNull().default(false),
  language: text('language').notNull(),
  profileName: text('profile_name').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().defaultNow(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull().defaultNow(),
  applyResult: text('apply_result'),
  postedAt: text('posted_at'),
  description: text('description')
});

export const applications = sqliteTable('applications', {
  id: text('id').primaryKey(),
  jobId: text('job_id').notNull(),
  status: text('status').notNull(),
  result: text('result'),
  appliedAt: integer('applied_at', { mode: 'timestamp_ms' }).notNull().defaultNow()
});

export const manualReviews = sqliteTable('manual_reviews', {
  id: text('id').primaryKey(),
  jobId: text('job_id').notNull(),
  profile: text('profile').notNull(),
  reviewStatus: text('review_status').notNull().default('pending'),
  reviewReason: text('review_reason').notNull().default(''),
  reviewNotes: text('review_notes'),
  reviewedAt: integer('reviewed_at', { mode: 'timestamp_ms' }),
  reviewedBy: text('reviewed_by'),
  snoozedUntil: integer('snoozed_until', { mode: 'timestamp_ms' }),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().defaultNow(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull().defaultNow()
});

export const runtimeState = sqliteTable('runtime_state', {
  id: text('id').primaryKey(),
  currentState: text('current_state').notNull(),
  health: text('health').notNull(),
  lastExecutionStartedAt: integer('last_execution_started_at', { mode: 'timestamp_ms' }),
  lastExecutionFinishedAt: integer('last_execution_finished_at', { mode: 'timestamp_ms' }),
  nextExecutionAt: integer('next_execution_at', { mode: 'timestamp_ms' }),
  consecutiveFailures: integer('consecutive_failures').notNull().default(0),
  cooldownUntil: integer('cooldown_until', { mode: 'timestamp_ms' }),
  sessionStatus: text('session_status'),
  sessionId: text('session_id'),
  lastError: text('last_error'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().defaultNow(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull().defaultNow()
});

export const runtimeHistory = sqliteTable('runtime_history', {
  id: text('id').primaryKey(),
  runType: text('run_type').notNull(),
  state: text('state').notNull(),
  status: text('status').notNull(),
  startedAt: integer('started_at', { mode: 'timestamp_ms' }).notNull(),
  finishedAt: integer('finished_at', { mode: 'timestamp_ms' }),
  durationMs: integer('duration_ms'),
  jobsProcessed: integer('jobs_processed').notNull().default(0),
  autoApplies: integer('auto_applies').notNull().default(0),
  reviewsCreated: integer('reviews_created').notNull().default(0),
  successRate: integer('success_rate'),
  errorMessage: text('error_message'),
  metadata: text('metadata'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().defaultNow(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull().defaultNow()
});

export const retryHistory = sqliteTable('retry_history', {
  id: text('id').primaryKey(),
  runId: text('run_id').notNull(),
  attempt: integer('attempt').notNull(),
  error: text('error').notNull(),
  backoffMs: integer('backoff_ms').notNull(),
  timestamp: integer('timestamp', { mode: 'timestamp_ms' }).notNull().defaultNow()
});

export const runtimeMetrics = sqliteTable('runtime_metrics', {
  id: text('id').primaryKey(),
  recordedAt: integer('recorded_at', { mode: 'timestamp_ms' }).notNull(),
  jobsPerDay: integer('jobs_per_day').notNull().default(0),
  appliesPerDay: integer('applies_per_day').notNull().default(0),
  reviewsPerDay: integer('reviews_per_day').notNull().default(0),
  applySuccessRate: integer('apply_success_rate').notNull().default(0),
  uptimePercent: integer('uptime_percent').notNull().default(0),
  averageScore: integer('average_score').notNull().default(0),
  averageDurationMs: integer('average_duration_ms').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().defaultNow(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull().defaultNow()
});

export const logs = sqliteTable('logs', {
  id: text('id').primaryKey(),
  type: text('type').notNull(),
  message: text('message').notNull(),
  source: text('source').notNull(),
  timestamp: integer('timestamp', { mode: 'timestamp_ms' }).notNull().defaultNow(),
  level: text('level').notNull()
});

export const auditLogs = sqliteTable('audit_logs', {
  id: text('id').primaryKey(),
  eventType: text('event_type').notNull(),
  action: text('action').notNull(),
  message: text('message').notNull(),
  source: text('source').notNull(),
  metadata: text('metadata'),
  severity: text('severity').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().defaultNow()
});

export const settings = sqliteTable('settings', {
  id: text('id').primaryKey(),
  minScore: integer('min_score').notNull(),
  maxDailyApplications: integer('max_daily_applications').notNull(),
  autoApply: integer('auto_apply', { mode: 'boolean' }).notNull().default(true),
  preferredLocation: text('preferred_location').notNull(),
  blacklist: text('blacklist').notNull()
});
export const linkedinSessions = sqliteTable('linkedin_sessions', {
  id: text('id').primaryKey(),
  profile: text('profile').notNull(),
  cookies: text('cookies').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().defaultNow(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull().defaultNow()
});

export const sessionHealth = sqliteTable('session_health', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull(),
  healthScore: integer('health_score').notNull(),
  status: text('status').notNull(),
  reason: text('reason'),
  lastValidatedAt: integer('last_validated_at', { mode: 'timestamp_ms' }).notNull(),
  cooldownUntil: integer('cooldown_until', { mode: 'timestamp_ms' }),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().defaultNow(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull().defaultNow()
});

export const selectorFailures = sqliteTable('selector_failures', {
  id: text('id').primaryKey(),
  selectorType: text('selector_type').notNull(),
  selector: text('selector').notNull(),
  pageUrl: text('page_url'),
  error: text('error').notNull(),
  metadata: text('metadata'),
  timestamp: integer('timestamp', { mode: 'timestamp_ms' }).notNull().defaultNow()
});

export const anomalyLogs = sqliteTable('anomaly_logs', {
  id: text('id').primaryKey(),
  type: text('type').notNull(),
  message: text('message').notNull(),
  details: text('details'),
  severity: text('severity').notNull(),
  timestamp: integer('timestamp', { mode: 'timestamp_ms' }).notNull().defaultNow()
});

export const screenshotMetadata = sqliteTable('screenshot_metadata', {
  id: text('id').primaryKey(),
  contextType: text('context_type').notNull(),
  contextId: text('context_id'),
  path: text('path'),
  metadata: text('metadata'),
  timestamp: integer('timestamp', { mode: 'timestamp_ms' }).notNull().defaultNow()
});

export const searchFilters = sqliteTable('search_filters', {
  id: text('id').primaryKey(),
  profile: text('profile').notNull(),
  name: text('name').notNull(),
  jobTitle: text('job_title'),
  modalities: text('modalities').notNull().default('Remoto,Híbrido,Presencial'),
  cvId: text('cv_id'),
  useLatestCv: integer('use_latest_cv', { mode: 'boolean' }).notNull().default(true),
  postedWithinHours: integer('posted_within_hours').notNull().default(24),
  requiredSkills: text('required_skills'),
  excludedSkills: text('excluded_skills'),
  seniority: text('seniority').notNull().default('junior,mid,senior'),
  locations: text('locations').notNull(),
  excludedCompanies: text('excluded_companies'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().defaultNow(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull().defaultNow(),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true)
});

export const profiles = sqliteTable('profiles', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').unique().notNull(), 

  // 🌟 1. INTENÇÃO DO USUÁRIO
  targetRoles: text('target_roles', { mode: 'json' }).$type<string[]>().notNull().default([]),
  targetAreas: text('target_areas', { mode: 'json' }).$type<string[]>().notNull().default([]),

  // 🌟 2. PRÉ-FILTROS GENÉRICOS (Filtros Baratos)
  seniority: text('seniority', { mode: 'json' }).$type<string[]>().notNull().default([]),
  searchLocation: text('search_location', { mode: 'json' }).$type<string[]>().notNull().default(['Brasil']), 
  allowedModalities: text('allowed_modalities', { mode: 'json' }).$type<string[]>().notNull().default(['remoto', 'híbrido']),
  hybridCities: text('hybrid_cities', { mode: 'json' }).$type<string[]>().notNull().default([]),
  
  // 🌟 3. CONTEXTO PARA MATCHING DO LLM
  skillMatrix: text('skill_matrix', { mode: 'json' }).$type<SkillMatrix>().notNull().default({}),
  languages: text('languages', { mode: 'json' }).$type<Record<string, string>>().notNull().default({}),
  negativeKeywords: text('negative_keywords', { mode: 'json' }).$type<string[]>().notNull().default([]), 

  // 🌟 4. MOTOR DE APLICAÇÃO (RPA / Copilot)
  
  // O currículo físico apenas para o RPA fazer o upload no form do LinkedIn/Gupy
  resumeFilePath: text('resume_file_path'), 
  
  // O "Brain Dump": Instruções livres do candidato para a IA saber como representá-lo nos formulários
  aiApplicationContext: text('ai_application_context').notNull().default(''),

  // 🌟 5. REGRAS DA ENGINE
  minScore: integer('min_score').notNull().default(75),
  dailyLimit: integer('daily_limit').notNull().default(10),
  
  aiReason: text('ai_reason'),
  aiMetadata: text('ai_metadata', { mode: 'json' }).$type<any>(), // Para salvar o { matchedSkills, missingSkills, classification }

  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date())
});


// export type JobModel = InferModel<typeof jobs>;
export type ApplicationModel = InferModel<typeof applications>;
export type ManualReviewModel = InferModel<typeof manualReviews>;
export type RuntimeStateModel = InferModel<typeof runtimeState>;
export type RuntimeHistoryModel = InferModel<typeof runtimeHistory>;
export type RetryHistoryModel = InferModel<typeof retryHistory>;
export type RuntimeMetricModel = InferModel<typeof runtimeMetrics>;
export type LogModel = InferModel<typeof logs>;
export type SettingsModel = InferModel<typeof settings>;
export type LinkedInSessionModel = InferModel<typeof linkedinSessions>;
export type SessionHealthModel = InferModel<typeof sessionHealth>;
export type SelectorFailureModel = InferModel<typeof selectorFailures>;
export type AnomalyLogModel = InferModel<typeof anomalyLogs>;
export type AuditLogModel = InferModel<typeof auditLogs>;
export type ScreenshotMetadataModel = InferModel<typeof screenshotMetadata>;
export type SearchFilterModel = InferModel<typeof searchFilters>;
// export type ProfileModel = InferModel<typeof profiles>;
export type JobModel = typeof jobs.$inferSelect;
export type NewJobModel = typeof jobs.$inferInsert;

export type Profile = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;

export const dbSchema = {
  jobs,
  applications,
  manualReviews,
  runtimeState,
  runtimeHistory,
  retryHistory,
  runtimeMetrics,
  logs,
  settings,
  linkedinSessions,
  sessionHealth,
  selectorFailures,
  anomalyLogs,
  screenshotMetadata,
  searchFilters,
  profiles
};
