"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionControlRequestSchema = exports.ReviewActionRequestSchema = exports.RuntimeControlActionSchema = exports.ScreenshotMetadataRecordSchema = exports.AnomalyLogRecordSchema = exports.SelectorFailureRecordSchema = exports.SessionHealthRecordSchema = exports.RuntimeMetricRecordSchema = exports.RetryHistoryRecordSchema = exports.RuntimeHistoryRecordSchema = exports.RuntimeStateRecordSchema = exports.SettingsRecordSchema = exports.LogEntrySchema = exports.ManualReviewRecordSchema = exports.ApplicationRecordSchema = exports.JobRecordSchema = exports.ProfileDefinitionSchema = void 0;
const zod_1 = require("zod");
exports.ProfileDefinitionSchema = zod_1.z.object({
    name: zod_1.z.enum(['backend', 'frontend', 'fullstack']),
    searches: zod_1.z.array(zod_1.z.string()).min(1),
    keywords: zod_1.z.record(zod_1.z.number()),
    negativeKeywords: zod_1.z.record(zod_1.z.number()),
    minScore: zod_1.z.number().int().nonnegative(),
    dailyLimit: zod_1.z.number().int().positive(),
    seniority: zod_1.z.enum(['junior', 'mid', 'senior']),
    stackPriority: zod_1.z.array(zod_1.z.string()),
    cv: zod_1.z.enum(['CV_PT', 'CV_EN'])
});
exports.JobRecordSchema = zod_1.z.object({
    id: zod_1.z.string(),
    company: zod_1.z.string(),
    title: zod_1.z.string(),
    url: zod_1.z.string().url(),
    score: zod_1.z.number().int(),
    status: zod_1.z.enum(['found', 'applied', 'pending_review', 'manual']),
    location: zod_1.z.string(),
    modality: zod_1.z.enum(['Remoto', 'Híbrido', 'Presencial']),
    easyApply: zod_1.z.boolean(),
    language: zod_1.z.enum(['PT', 'EN', 'ES']),
    profile: zod_1.z.string(),
    createdAt: zod_1.z.string(),
    updatedAt: zod_1.z.string(),
    postedAt: zod_1.z.string().optional(),
    description: zod_1.z.string().optional(),
    applyResult: zod_1.z.string().optional()
});
exports.ApplicationRecordSchema = zod_1.z.object({
    id: zod_1.z.string(),
    jobId: zod_1.z.string(),
    status: zod_1.z.enum(['submitted', 'accepted', 'rejected', 'pending']),
    result: zod_1.z.string().optional(),
    appliedAt: zod_1.z.string()
});
exports.ManualReviewRecordSchema = zod_1.z.object({
    id: zod_1.z.string(),
    jobId: zod_1.z.string(),
    profile: zod_1.z.string(),
    reviewStatus: zod_1.z.enum(['pending', 'approved', 'rejected']),
    reviewReason: zod_1.z.string().optional(),
    reviewNotes: zod_1.z.string().optional(),
    reviewedAt: zod_1.z.string().optional(),
    reviewedBy: zod_1.z.string().optional(),
    snoozedUntil: zod_1.z.string().optional(),
    createdAt: zod_1.z.string(),
    updatedAt: zod_1.z.string()
});
exports.LogEntrySchema = zod_1.z.object({
    id: zod_1.z.string(),
    type: zod_1.z.string(),
    message: zod_1.z.string(),
    source: zod_1.z.string(),
    timestamp: zod_1.z.string(),
    level: zod_1.z.enum(['info', 'warning', 'error'])
});
exports.SettingsRecordSchema = zod_1.z.object({
    id: zod_1.z.string(),
    minScore: zod_1.z.number().int(),
    maxDailyApplications: zod_1.z.number().int(),
    autoApply: zod_1.z.boolean(),
    preferredLocation: zod_1.z.string(),
    blacklist: zod_1.z.string()
});
exports.RuntimeStateRecordSchema = zod_1.z.object({
    id: zod_1.z.string(),
    currentState: zod_1.z.enum(['IDLE', 'SCRAPING', 'APPLYING', 'COOLDOWN', 'BLOCKED', 'DEGRADED', 'ERROR']),
    health: zod_1.z.enum(['healthy', 'warning', 'blocked', 'degraded', 'offline']),
    lastExecutionStartedAt: zod_1.z.string().optional(),
    lastExecutionFinishedAt: zod_1.z.string().optional(),
    nextExecutionAt: zod_1.z.string().optional(),
    consecutiveFailures: zod_1.z.number().int().nonnegative(),
    cooldownUntil: zod_1.z.string().optional(),
    sessionStatus: zod_1.z.string().optional(),
    sessionId: zod_1.z.string().optional(),
    lastError: zod_1.z.string().optional(),
    createdAt: zod_1.z.string(),
    updatedAt: zod_1.z.string()
});
exports.RuntimeHistoryRecordSchema = zod_1.z.object({
    id: zod_1.z.string(),
    runType: zod_1.z.enum(['scheduled', 'manual', 'recovery']),
    state: zod_1.z.enum(['IDLE', 'SCRAPING', 'APPLYING', 'COOLDOWN', 'BLOCKED', 'DEGRADED', 'ERROR']),
    status: zod_1.z.enum(['success', 'failure', 'skipped', 'blocked']),
    startedAt: zod_1.z.string(),
    finishedAt: zod_1.z.string().optional(),
    durationMs: zod_1.z.number().int().nonnegative().optional(),
    jobsProcessed: zod_1.z.number().int().nonnegative(),
    autoApplies: zod_1.z.number().int().nonnegative(),
    reviewsCreated: zod_1.z.number().int().nonnegative(),
    successRate: zod_1.z.number().optional(),
    errorMessage: zod_1.z.string().optional(),
    metadata: zod_1.z.string().optional()
});
exports.RetryHistoryRecordSchema = zod_1.z.object({
    id: zod_1.z.string(),
    runId: zod_1.z.string(),
    attempt: zod_1.z.number().int().nonnegative(),
    error: zod_1.z.string(),
    backoffMs: zod_1.z.number().int().nonnegative(),
    timestamp: zod_1.z.string()
});
exports.RuntimeMetricRecordSchema = zod_1.z.object({
    id: zod_1.z.string(),
    recordedAt: zod_1.z.string(),
    jobsPerDay: zod_1.z.number().int().nonnegative(),
    appliesPerDay: zod_1.z.number().int().nonnegative(),
    reviewsPerDay: zod_1.z.number().int().nonnegative(),
    applySuccessRate: zod_1.z.number(),
    uptimePercent: zod_1.z.number(),
    averageScore: zod_1.z.number(),
    averageDurationMs: zod_1.z.number().int().nonnegative()
});
exports.SessionHealthRecordSchema = zod_1.z.object({
    id: zod_1.z.string(),
    sessionId: zod_1.z.string(),
    healthScore: zod_1.z.number().int().nonnegative(),
    status: zod_1.z.enum(['healthy', 'degraded', 'rotating']),
    reason: zod_1.z.string().optional(),
    lastValidatedAt: zod_1.z.string(),
    cooldownUntil: zod_1.z.string().optional(),
    createdAt: zod_1.z.string(),
    updatedAt: zod_1.z.string()
});
exports.SelectorFailureRecordSchema = zod_1.z.object({
    id: zod_1.z.string(),
    selectorType: zod_1.z.string(),
    selector: zod_1.z.string(),
    pageUrl: zod_1.z.string().optional(),
    error: zod_1.z.string(),
    metadata: zod_1.z.string().optional(),
    timestamp: zod_1.z.string()
});
exports.AnomalyLogRecordSchema = zod_1.z.object({
    id: zod_1.z.string(),
    type: zod_1.z.string(),
    message: zod_1.z.string(),
    details: zod_1.z.string().optional(),
    severity: zod_1.z.enum(['info', 'warning', 'error']),
    timestamp: zod_1.z.string()
});
exports.ScreenshotMetadataRecordSchema = zod_1.z.object({
    id: zod_1.z.string(),
    contextType: zod_1.z.string(),
    contextId: zod_1.z.string().optional(),
    path: zod_1.z.string().optional(),
    metadata: zod_1.z.string().optional(),
    timestamp: zod_1.z.string()
});
exports.RuntimeControlActionSchema = zod_1.z.enum([
    'pause',
    'resume',
    'cooldown',
    'emergencyStop',
    'resetSession',
    'quarantineSession',
    'retryApplication'
]);
exports.ReviewActionRequestSchema = zod_1.z.object({
    reviewId: zod_1.z.string(),
    action: zod_1.z.enum(['approve', 'reject', 'snooze']),
    reviewer: zod_1.z.string().optional(),
    note: zod_1.z.string().optional()
});
exports.SessionControlRequestSchema = zod_1.z.object({
    sessionId: zod_1.z.string(),
    action: zod_1.z.enum(['reset', 'quarantine', 'refresh'])
});
