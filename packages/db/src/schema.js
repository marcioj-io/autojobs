"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dbSchema = exports.profiles = exports.screenshotMetadata = exports.anomalyLogs = exports.selectorFailures = exports.sessionHealth = exports.linkedinSessions = exports.settings = exports.auditLogs = exports.logs = exports.runtimeMetrics = exports.retryHistory = exports.runtimeHistory = exports.runtimeState = exports.manualReviews = exports.applications = exports.jobs = void 0;
// packages\db\src\schema.ts
const sqlite_core_1 = require("drizzle-orm/sqlite-core");
exports.jobs = (0, sqlite_core_1.sqliteTable)('jobs', {
    id: (0, sqlite_core_1.text)('id').primaryKey(),
    company: (0, sqlite_core_1.text)('company').notNull(),
    title: (0, sqlite_core_1.text)('title').notNull(),
    url: (0, sqlite_core_1.text)('url').notNull(),
    score: (0, sqlite_core_1.integer)('score').notNull(),
    status: (0, sqlite_core_1.text)('status').notNull(),
    location: (0, sqlite_core_1.text)('location').notNull(),
    modality: (0, sqlite_core_1.text)('modality').notNull(),
    easyApply: (0, sqlite_core_1.integer)('easy_apply', { mode: 'boolean' }).notNull().default(false),
    language: (0, sqlite_core_1.text)('language').notNull(),
    profile: (0, sqlite_core_1.text)('profile').notNull(),
    createdAt: (0, sqlite_core_1.integer)('created_at', { mode: 'timestamp_ms' }).notNull().defaultNow(),
    updatedAt: (0, sqlite_core_1.integer)('updated_at', { mode: 'timestamp_ms' }).notNull().defaultNow(),
    applyResult: (0, sqlite_core_1.text)('apply_result'),
    postedAt: (0, sqlite_core_1.text)('posted_at'),
    description: (0, sqlite_core_1.text)('description')
});
exports.applications = (0, sqlite_core_1.sqliteTable)('applications', {
    id: (0, sqlite_core_1.text)('id').primaryKey(),
    jobId: (0, sqlite_core_1.text)('job_id').notNull(),
    status: (0, sqlite_core_1.text)('status').notNull(),
    result: (0, sqlite_core_1.text)('result'),
    appliedAt: (0, sqlite_core_1.integer)('applied_at', { mode: 'timestamp_ms' }).notNull().defaultNow()
});
exports.manualReviews = (0, sqlite_core_1.sqliteTable)('manual_reviews', {
    id: (0, sqlite_core_1.text)('id').primaryKey(),
    jobId: (0, sqlite_core_1.text)('job_id').notNull(),
    profile: (0, sqlite_core_1.text)('profile').notNull(),
    reviewStatus: (0, sqlite_core_1.text)('review_status').notNull().default('pending'),
    reviewReason: (0, sqlite_core_1.text)('review_reason').notNull().default(''),
    reviewNotes: (0, sqlite_core_1.text)('review_notes'),
    reviewedAt: (0, sqlite_core_1.integer)('reviewed_at', { mode: 'timestamp_ms' }),
    reviewedBy: (0, sqlite_core_1.text)('reviewed_by'),
    snoozedUntil: (0, sqlite_core_1.integer)('snoozed_until', { mode: 'timestamp_ms' }),
    createdAt: (0, sqlite_core_1.integer)('created_at', { mode: 'timestamp_ms' }).notNull().defaultNow(),
    updatedAt: (0, sqlite_core_1.integer)('updated_at', { mode: 'timestamp_ms' }).notNull().defaultNow()
});
exports.runtimeState = (0, sqlite_core_1.sqliteTable)('runtime_state', {
    id: (0, sqlite_core_1.text)('id').primaryKey(),
    currentState: (0, sqlite_core_1.text)('current_state').notNull(),
    health: (0, sqlite_core_1.text)('health').notNull(),
    lastExecutionStartedAt: (0, sqlite_core_1.integer)('last_execution_started_at', { mode: 'timestamp_ms' }),
    lastExecutionFinishedAt: (0, sqlite_core_1.integer)('last_execution_finished_at', { mode: 'timestamp_ms' }),
    nextExecutionAt: (0, sqlite_core_1.integer)('next_execution_at', { mode: 'timestamp_ms' }),
    consecutiveFailures: (0, sqlite_core_1.integer)('consecutive_failures').notNull().default(0),
    cooldownUntil: (0, sqlite_core_1.integer)('cooldown_until', { mode: 'timestamp_ms' }),
    sessionStatus: (0, sqlite_core_1.text)('session_status'),
    sessionId: (0, sqlite_core_1.text)('session_id'),
    lastError: (0, sqlite_core_1.text)('last_error'),
    createdAt: (0, sqlite_core_1.integer)('created_at', { mode: 'timestamp_ms' }).notNull().defaultNow(),
    updatedAt: (0, sqlite_core_1.integer)('updated_at', { mode: 'timestamp_ms' }).notNull().defaultNow()
});
exports.runtimeHistory = (0, sqlite_core_1.sqliteTable)('runtime_history', {
    id: (0, sqlite_core_1.text)('id').primaryKey(),
    runType: (0, sqlite_core_1.text)('run_type').notNull(),
    state: (0, sqlite_core_1.text)('state').notNull(),
    status: (0, sqlite_core_1.text)('status').notNull(),
    startedAt: (0, sqlite_core_1.integer)('started_at', { mode: 'timestamp_ms' }).notNull(),
    finishedAt: (0, sqlite_core_1.integer)('finished_at', { mode: 'timestamp_ms' }),
    durationMs: (0, sqlite_core_1.integer)('duration_ms'),
    jobsProcessed: (0, sqlite_core_1.integer)('jobs_processed').notNull().default(0),
    autoApplies: (0, sqlite_core_1.integer)('auto_applies').notNull().default(0),
    reviewsCreated: (0, sqlite_core_1.integer)('reviews_created').notNull().default(0),
    successRate: (0, sqlite_core_1.integer)('success_rate'),
    errorMessage: (0, sqlite_core_1.text)('error_message'),
    metadata: (0, sqlite_core_1.text)('metadata'),
    createdAt: (0, sqlite_core_1.integer)('created_at', { mode: 'timestamp_ms' }).notNull().defaultNow(),
    updatedAt: (0, sqlite_core_1.integer)('updated_at', { mode: 'timestamp_ms' }).notNull().defaultNow()
});
exports.retryHistory = (0, sqlite_core_1.sqliteTable)('retry_history', {
    id: (0, sqlite_core_1.text)('id').primaryKey(),
    runId: (0, sqlite_core_1.text)('run_id').notNull(),
    attempt: (0, sqlite_core_1.integer)('attempt').notNull(),
    error: (0, sqlite_core_1.text)('error').notNull(),
    backoffMs: (0, sqlite_core_1.integer)('backoff_ms').notNull(),
    timestamp: (0, sqlite_core_1.integer)('timestamp', { mode: 'timestamp_ms' }).notNull().defaultNow()
});
exports.runtimeMetrics = (0, sqlite_core_1.sqliteTable)('runtime_metrics', {
    id: (0, sqlite_core_1.text)('id').primaryKey(),
    recordedAt: (0, sqlite_core_1.integer)('recorded_at', { mode: 'timestamp_ms' }).notNull(),
    jobsPerDay: (0, sqlite_core_1.integer)('jobs_per_day').notNull().default(0),
    appliesPerDay: (0, sqlite_core_1.integer)('applies_per_day').notNull().default(0),
    reviewsPerDay: (0, sqlite_core_1.integer)('reviews_per_day').notNull().default(0),
    applySuccessRate: (0, sqlite_core_1.integer)('apply_success_rate').notNull().default(0),
    uptimePercent: (0, sqlite_core_1.integer)('uptime_percent').notNull().default(0),
    averageScore: (0, sqlite_core_1.integer)('average_score').notNull().default(0),
    averageDurationMs: (0, sqlite_core_1.integer)('average_duration_ms').notNull().default(0),
    createdAt: (0, sqlite_core_1.integer)('created_at', { mode: 'timestamp_ms' }).notNull().defaultNow(),
    updatedAt: (0, sqlite_core_1.integer)('updated_at', { mode: 'timestamp_ms' }).notNull().defaultNow()
});
exports.logs = (0, sqlite_core_1.sqliteTable)('logs', {
    id: (0, sqlite_core_1.text)('id').primaryKey(),
    type: (0, sqlite_core_1.text)('type').notNull(),
    message: (0, sqlite_core_1.text)('message').notNull(),
    source: (0, sqlite_core_1.text)('source').notNull(),
    timestamp: (0, sqlite_core_1.integer)('timestamp', { mode: 'timestamp_ms' }).notNull().defaultNow(),
    level: (0, sqlite_core_1.text)('level').notNull()
});
exports.auditLogs = (0, sqlite_core_1.sqliteTable)('audit_logs', {
    id: (0, sqlite_core_1.text)('id').primaryKey(),
    eventType: (0, sqlite_core_1.text)('event_type').notNull(),
    action: (0, sqlite_core_1.text)('action').notNull(),
    message: (0, sqlite_core_1.text)('message').notNull(),
    source: (0, sqlite_core_1.text)('source').notNull(),
    metadata: (0, sqlite_core_1.text)('metadata'),
    severity: (0, sqlite_core_1.text)('severity').notNull(),
    createdAt: (0, sqlite_core_1.integer)('created_at', { mode: 'timestamp_ms' }).notNull().defaultNow()
});
exports.settings = (0, sqlite_core_1.sqliteTable)('settings', {
    id: (0, sqlite_core_1.text)('id').primaryKey(),
    minScore: (0, sqlite_core_1.integer)('min_score').notNull(),
    maxDailyApplications: (0, sqlite_core_1.integer)('max_daily_applications').notNull(),
    autoApply: (0, sqlite_core_1.integer)('auto_apply', { mode: 'boolean' }).notNull().default(true),
    preferredLocation: (0, sqlite_core_1.text)('preferred_location').notNull(),
    blacklist: (0, sqlite_core_1.text)('blacklist').notNull()
});
exports.linkedinSessions = (0, sqlite_core_1.sqliteTable)('linkedin_sessions', {
    id: (0, sqlite_core_1.text)('id').primaryKey(),
    profile: (0, sqlite_core_1.text)('profile').notNull(),
    cookies: (0, sqlite_core_1.text)('cookies').notNull(),
    createdAt: (0, sqlite_core_1.integer)('created_at', { mode: 'timestamp_ms' }).notNull().defaultNow(),
    updatedAt: (0, sqlite_core_1.integer)('updated_at', { mode: 'timestamp_ms' }).notNull().defaultNow()
});
exports.sessionHealth = (0, sqlite_core_1.sqliteTable)('session_health', {
    id: (0, sqlite_core_1.text)('id').primaryKey(),
    sessionId: (0, sqlite_core_1.text)('session_id').notNull(),
    healthScore: (0, sqlite_core_1.integer)('health_score').notNull(),
    status: (0, sqlite_core_1.text)('status').notNull(),
    reason: (0, sqlite_core_1.text)('reason'),
    lastValidatedAt: (0, sqlite_core_1.integer)('last_validated_at', { mode: 'timestamp_ms' }).notNull(),
    cooldownUntil: (0, sqlite_core_1.integer)('cooldown_until', { mode: 'timestamp_ms' }),
    createdAt: (0, sqlite_core_1.integer)('created_at', { mode: 'timestamp_ms' }).notNull().defaultNow(),
    updatedAt: (0, sqlite_core_1.integer)('updated_at', { mode: 'timestamp_ms' }).notNull().defaultNow()
});
exports.selectorFailures = (0, sqlite_core_1.sqliteTable)('selector_failures', {
    id: (0, sqlite_core_1.text)('id').primaryKey(),
    selectorType: (0, sqlite_core_1.text)('selector_type').notNull(),
    selector: (0, sqlite_core_1.text)('selector').notNull(),
    pageUrl: (0, sqlite_core_1.text)('page_url'),
    error: (0, sqlite_core_1.text)('error').notNull(),
    metadata: (0, sqlite_core_1.text)('metadata'),
    timestamp: (0, sqlite_core_1.integer)('timestamp', { mode: 'timestamp_ms' }).notNull().defaultNow()
});
exports.anomalyLogs = (0, sqlite_core_1.sqliteTable)('anomaly_logs', {
    id: (0, sqlite_core_1.text)('id').primaryKey(),
    type: (0, sqlite_core_1.text)('type').notNull(),
    message: (0, sqlite_core_1.text)('message').notNull(),
    details: (0, sqlite_core_1.text)('details'),
    severity: (0, sqlite_core_1.text)('severity').notNull(),
    timestamp: (0, sqlite_core_1.integer)('timestamp', { mode: 'timestamp_ms' }).notNull().defaultNow()
});
exports.screenshotMetadata = (0, sqlite_core_1.sqliteTable)('screenshot_metadata', {
    id: (0, sqlite_core_1.text)('id').primaryKey(),
    contextType: (0, sqlite_core_1.text)('context_type').notNull(),
    contextId: (0, sqlite_core_1.text)('context_id'),
    path: (0, sqlite_core_1.text)('path'),
    metadata: (0, sqlite_core_1.text)('metadata'),
    timestamp: (0, sqlite_core_1.integer)('timestamp', { mode: 'timestamp_ms' }).notNull().defaultNow()
});
exports.profiles = (0, sqlite_core_1.sqliteTable)('profiles', {
    name: (0, sqlite_core_1.text)('name').primaryKey(),
    searches: (0, sqlite_core_1.text)('searches').notNull(),
    keywords: (0, sqlite_core_1.text)('keywords').notNull(),
    negativeKeywords: (0, sqlite_core_1.text)('negative_keywords').notNull(),
    minScore: (0, sqlite_core_1.integer)('min_score').notNull(),
    dailyLimit: (0, sqlite_core_1.integer)('daily_limit').notNull(),
    seniority: (0, sqlite_core_1.text)('seniority').notNull(),
    stackPriority: (0, sqlite_core_1.text)('stack_priority').notNull(),
    cv: (0, sqlite_core_1.text)('cv').notNull(),
    createdAt: (0, sqlite_core_1.integer)('created_at', { mode: 'timestamp_ms' }).notNull().defaultNow(),
    updatedAt: (0, sqlite_core_1.integer)('updated_at', { mode: 'timestamp_ms' }).notNull().defaultNow()
});
exports.dbSchema = {
    jobs: exports.jobs,
    applications: exports.applications,
    manualReviews: exports.manualReviews,
    runtimeState: exports.runtimeState,
    runtimeHistory: exports.runtimeHistory,
    retryHistory: exports.retryHistory,
    runtimeMetrics: exports.runtimeMetrics,
    logs: exports.logs,
    settings: exports.settings,
    linkedinSessions: exports.linkedinSessions,
    sessionHealth: exports.sessionHealth,
    selectorFailures: exports.selectorFailures,
    anomalyLogs: exports.anomalyLogs,
    screenshotMetadata: exports.screenshotMetadata,
    profiles: exports.profiles
};
