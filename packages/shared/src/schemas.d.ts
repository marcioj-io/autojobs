import { z } from 'zod';
export declare const ProfileDefinitionSchema: z.ZodObject<{
    name: z.ZodEnum<["backend", "frontend", "fullstack"]>;
    searches: z.ZodArray<z.ZodString, "many">;
    keywords: z.ZodRecord<z.ZodString, z.ZodNumber>;
    negativeKeywords: z.ZodRecord<z.ZodString, z.ZodNumber>;
    minScore: z.ZodNumber;
    dailyLimit: z.ZodNumber;
    seniority: z.ZodEnum<["junior", "mid", "senior"]>;
    stackPriority: z.ZodArray<z.ZodString, "many">;
    cv: z.ZodEnum<["CV_PT", "CV_EN"]>;
}, "strip", z.ZodTypeAny, {
    name: "backend" | "frontend" | "fullstack";
    minScore: number;
    searches: string[];
    keywords: Record<string, number>;
    negativeKeywords: Record<string, number>;
    dailyLimit: number;
    seniority: "junior" | "mid" | "senior";
    stackPriority: string[];
    cv: "CV_PT" | "CV_EN";
}, {
    name: "backend" | "frontend" | "fullstack";
    minScore: number;
    searches: string[];
    keywords: Record<string, number>;
    negativeKeywords: Record<string, number>;
    dailyLimit: number;
    seniority: "junior" | "mid" | "senior";
    stackPriority: string[];
    cv: "CV_PT" | "CV_EN";
}>;
export declare const JobRecordSchema: z.ZodObject<{
    id: z.ZodString;
    company: z.ZodString;
    title: z.ZodString;
    url: z.ZodString;
    score: z.ZodNumber;
    status: z.ZodEnum<["found", "applied", "pending_review", "manual"]>;
    location: z.ZodString;
    modality: z.ZodEnum<["Remoto", "Híbrido", "Presencial"]>;
    easyApply: z.ZodBoolean;
    language: z.ZodEnum<["PT", "EN", "ES"]>;
    profile: z.ZodString;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
    postedAt: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    applyResult: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    id: string;
    company: string;
    title: string;
    url: string;
    score: number;
    status: "found" | "applied" | "pending_review" | "manual";
    location: string;
    modality: "Remoto" | "Híbrido" | "Presencial";
    easyApply: boolean;
    language: "PT" | "EN" | "ES";
    profile: string;
    createdAt: string;
    updatedAt: string;
    applyResult?: string | undefined;
    postedAt?: string | undefined;
    description?: string | undefined;
}, {
    id: string;
    company: string;
    title: string;
    url: string;
    score: number;
    status: "found" | "applied" | "pending_review" | "manual";
    location: string;
    modality: "Remoto" | "Híbrido" | "Presencial";
    easyApply: boolean;
    language: "PT" | "EN" | "ES";
    profile: string;
    createdAt: string;
    updatedAt: string;
    applyResult?: string | undefined;
    postedAt?: string | undefined;
    description?: string | undefined;
}>;
export declare const ApplicationRecordSchema: z.ZodObject<{
    id: z.ZodString;
    jobId: z.ZodString;
    status: z.ZodEnum<["submitted", "accepted", "rejected", "pending"]>;
    result: z.ZodOptional<z.ZodString>;
    appliedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    status: "pending" | "submitted" | "accepted" | "rejected";
    jobId: string;
    appliedAt: string;
    result?: string | undefined;
}, {
    id: string;
    status: "pending" | "submitted" | "accepted" | "rejected";
    jobId: string;
    appliedAt: string;
    result?: string | undefined;
}>;
export declare const ManualReviewRecordSchema: z.ZodObject<{
    id: z.ZodString;
    jobId: z.ZodString;
    profile: z.ZodString;
    reviewStatus: z.ZodEnum<["pending", "approved", "rejected"]>;
    reviewReason: z.ZodOptional<z.ZodString>;
    reviewNotes: z.ZodOptional<z.ZodString>;
    reviewedAt: z.ZodOptional<z.ZodString>;
    reviewedBy: z.ZodOptional<z.ZodString>;
    snoozedUntil: z.ZodOptional<z.ZodString>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    profile: string;
    createdAt: string;
    updatedAt: string;
    jobId: string;
    reviewStatus: "pending" | "rejected" | "approved";
    reviewReason?: string | undefined;
    reviewNotes?: string | undefined;
    reviewedAt?: string | undefined;
    reviewedBy?: string | undefined;
    snoozedUntil?: string | undefined;
}, {
    id: string;
    profile: string;
    createdAt: string;
    updatedAt: string;
    jobId: string;
    reviewStatus: "pending" | "rejected" | "approved";
    reviewReason?: string | undefined;
    reviewNotes?: string | undefined;
    reviewedAt?: string | undefined;
    reviewedBy?: string | undefined;
    snoozedUntil?: string | undefined;
}>;
export declare const LogEntrySchema: z.ZodObject<{
    id: z.ZodString;
    type: z.ZodString;
    message: z.ZodString;
    source: z.ZodString;
    timestamp: z.ZodString;
    level: z.ZodEnum<["info", "warning", "error"]>;
}, "strip", z.ZodTypeAny, {
    id: string;
    timestamp: string;
    type: string;
    message: string;
    source: string;
    level: "error" | "info" | "warning";
}, {
    id: string;
    timestamp: string;
    type: string;
    message: string;
    source: string;
    level: "error" | "info" | "warning";
}>;
export declare const SettingsRecordSchema: z.ZodObject<{
    id: z.ZodString;
    minScore: z.ZodNumber;
    maxDailyApplications: z.ZodNumber;
    autoApply: z.ZodBoolean;
    preferredLocation: z.ZodString;
    blacklist: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    minScore: number;
    maxDailyApplications: number;
    autoApply: boolean;
    preferredLocation: string;
    blacklist: string;
}, {
    id: string;
    minScore: number;
    maxDailyApplications: number;
    autoApply: boolean;
    preferredLocation: string;
    blacklist: string;
}>;
export declare const RuntimeStateRecordSchema: z.ZodObject<{
    id: z.ZodString;
    currentState: z.ZodEnum<["IDLE", "SCRAPING", "APPLYING", "COOLDOWN", "BLOCKED", "DEGRADED", "ERROR"]>;
    health: z.ZodEnum<["healthy", "warning", "blocked", "degraded", "offline"]>;
    lastExecutionStartedAt: z.ZodOptional<z.ZodString>;
    lastExecutionFinishedAt: z.ZodOptional<z.ZodString>;
    nextExecutionAt: z.ZodOptional<z.ZodString>;
    consecutiveFailures: z.ZodNumber;
    cooldownUntil: z.ZodOptional<z.ZodString>;
    sessionStatus: z.ZodOptional<z.ZodString>;
    sessionId: z.ZodOptional<z.ZodString>;
    lastError: z.ZodOptional<z.ZodString>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    createdAt: string;
    updatedAt: string;
    currentState: "IDLE" | "SCRAPING" | "APPLYING" | "COOLDOWN" | "BLOCKED" | "DEGRADED" | "ERROR";
    health: "warning" | "healthy" | "blocked" | "degraded" | "offline";
    consecutiveFailures: number;
    lastExecutionStartedAt?: string | undefined;
    lastExecutionFinishedAt?: string | undefined;
    nextExecutionAt?: string | undefined;
    cooldownUntil?: string | undefined;
    sessionStatus?: string | undefined;
    sessionId?: string | undefined;
    lastError?: string | undefined;
}, {
    id: string;
    createdAt: string;
    updatedAt: string;
    currentState: "IDLE" | "SCRAPING" | "APPLYING" | "COOLDOWN" | "BLOCKED" | "DEGRADED" | "ERROR";
    health: "warning" | "healthy" | "blocked" | "degraded" | "offline";
    consecutiveFailures: number;
    lastExecutionStartedAt?: string | undefined;
    lastExecutionFinishedAt?: string | undefined;
    nextExecutionAt?: string | undefined;
    cooldownUntil?: string | undefined;
    sessionStatus?: string | undefined;
    sessionId?: string | undefined;
    lastError?: string | undefined;
}>;
export declare const RuntimeHistoryRecordSchema: z.ZodObject<{
    id: z.ZodString;
    runType: z.ZodEnum<["scheduled", "manual", "recovery"]>;
    state: z.ZodEnum<["IDLE", "SCRAPING", "APPLYING", "COOLDOWN", "BLOCKED", "DEGRADED", "ERROR"]>;
    status: z.ZodEnum<["success", "failure", "skipped", "blocked"]>;
    startedAt: z.ZodString;
    finishedAt: z.ZodOptional<z.ZodString>;
    durationMs: z.ZodOptional<z.ZodNumber>;
    jobsProcessed: z.ZodNumber;
    autoApplies: z.ZodNumber;
    reviewsCreated: z.ZodNumber;
    successRate: z.ZodOptional<z.ZodNumber>;
    errorMessage: z.ZodOptional<z.ZodString>;
    metadata: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    id: string;
    status: "blocked" | "success" | "failure" | "skipped";
    runType: "manual" | "scheduled" | "recovery";
    state: "IDLE" | "SCRAPING" | "APPLYING" | "COOLDOWN" | "BLOCKED" | "DEGRADED" | "ERROR";
    startedAt: string;
    jobsProcessed: number;
    autoApplies: number;
    reviewsCreated: number;
    finishedAt?: string | undefined;
    durationMs?: number | undefined;
    successRate?: number | undefined;
    errorMessage?: string | undefined;
    metadata?: string | undefined;
}, {
    id: string;
    status: "blocked" | "success" | "failure" | "skipped";
    runType: "manual" | "scheduled" | "recovery";
    state: "IDLE" | "SCRAPING" | "APPLYING" | "COOLDOWN" | "BLOCKED" | "DEGRADED" | "ERROR";
    startedAt: string;
    jobsProcessed: number;
    autoApplies: number;
    reviewsCreated: number;
    finishedAt?: string | undefined;
    durationMs?: number | undefined;
    successRate?: number | undefined;
    errorMessage?: string | undefined;
    metadata?: string | undefined;
}>;
export declare const RetryHistoryRecordSchema: z.ZodObject<{
    id: z.ZodString;
    runId: z.ZodString;
    attempt: z.ZodNumber;
    error: z.ZodString;
    backoffMs: z.ZodNumber;
    timestamp: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    timestamp: string;
    runId: string;
    attempt: number;
    error: string;
    backoffMs: number;
}, {
    id: string;
    timestamp: string;
    runId: string;
    attempt: number;
    error: string;
    backoffMs: number;
}>;
export declare const RuntimeMetricRecordSchema: z.ZodObject<{
    id: z.ZodString;
    recordedAt: z.ZodString;
    jobsPerDay: z.ZodNumber;
    appliesPerDay: z.ZodNumber;
    reviewsPerDay: z.ZodNumber;
    applySuccessRate: z.ZodNumber;
    uptimePercent: z.ZodNumber;
    averageScore: z.ZodNumber;
    averageDurationMs: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    id: string;
    recordedAt: string;
    jobsPerDay: number;
    appliesPerDay: number;
    reviewsPerDay: number;
    applySuccessRate: number;
    uptimePercent: number;
    averageScore: number;
    averageDurationMs: number;
}, {
    id: string;
    recordedAt: string;
    jobsPerDay: number;
    appliesPerDay: number;
    reviewsPerDay: number;
    applySuccessRate: number;
    uptimePercent: number;
    averageScore: number;
    averageDurationMs: number;
}>;
export declare const SessionHealthRecordSchema: z.ZodObject<{
    id: z.ZodString;
    sessionId: z.ZodString;
    healthScore: z.ZodNumber;
    status: z.ZodEnum<["healthy", "degraded", "rotating"]>;
    reason: z.ZodOptional<z.ZodString>;
    lastValidatedAt: z.ZodString;
    cooldownUntil: z.ZodOptional<z.ZodString>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    status: "healthy" | "degraded" | "rotating";
    createdAt: string;
    updatedAt: string;
    sessionId: string;
    healthScore: number;
    lastValidatedAt: string;
    cooldownUntil?: string | undefined;
    reason?: string | undefined;
}, {
    id: string;
    status: "healthy" | "degraded" | "rotating";
    createdAt: string;
    updatedAt: string;
    sessionId: string;
    healthScore: number;
    lastValidatedAt: string;
    cooldownUntil?: string | undefined;
    reason?: string | undefined;
}>;
export declare const SelectorFailureRecordSchema: z.ZodObject<{
    id: z.ZodString;
    selectorType: z.ZodString;
    selector: z.ZodString;
    pageUrl: z.ZodOptional<z.ZodString>;
    error: z.ZodString;
    metadata: z.ZodOptional<z.ZodString>;
    timestamp: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    timestamp: string;
    error: string;
    selectorType: string;
    selector: string;
    metadata?: string | undefined;
    pageUrl?: string | undefined;
}, {
    id: string;
    timestamp: string;
    error: string;
    selectorType: string;
    selector: string;
    metadata?: string | undefined;
    pageUrl?: string | undefined;
}>;
export declare const AnomalyLogRecordSchema: z.ZodObject<{
    id: z.ZodString;
    type: z.ZodString;
    message: z.ZodString;
    details: z.ZodOptional<z.ZodString>;
    severity: z.ZodEnum<["info", "warning", "error"]>;
    timestamp: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    timestamp: string;
    type: string;
    message: string;
    severity: "error" | "info" | "warning";
    details?: string | undefined;
}, {
    id: string;
    timestamp: string;
    type: string;
    message: string;
    severity: "error" | "info" | "warning";
    details?: string | undefined;
}>;
export declare const ScreenshotMetadataRecordSchema: z.ZodObject<{
    id: z.ZodString;
    contextType: z.ZodString;
    contextId: z.ZodOptional<z.ZodString>;
    path: z.ZodOptional<z.ZodString>;
    metadata: z.ZodOptional<z.ZodString>;
    timestamp: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    timestamp: string;
    contextType: string;
    metadata?: string | undefined;
    contextId?: string | undefined;
    path?: string | undefined;
}, {
    id: string;
    timestamp: string;
    contextType: string;
    metadata?: string | undefined;
    contextId?: string | undefined;
    path?: string | undefined;
}>;
export declare const RuntimeControlActionSchema: z.ZodEnum<["pause", "resume", "cooldown", "emergencyStop", "resetSession", "quarantineSession", "retryApplication"]>;
export declare const ReviewActionRequestSchema: z.ZodObject<{
    reviewId: z.ZodString;
    action: z.ZodEnum<["approve", "reject", "snooze"]>;
    reviewer: z.ZodOptional<z.ZodString>;
    note: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    action: "approve" | "reject" | "snooze";
    reviewId: string;
    reviewer?: string | undefined;
    note?: string | undefined;
}, {
    action: "approve" | "reject" | "snooze";
    reviewId: string;
    reviewer?: string | undefined;
    note?: string | undefined;
}>;
export declare const SessionControlRequestSchema: z.ZodObject<{
    sessionId: z.ZodString;
    action: z.ZodEnum<["reset", "quarantine", "refresh"]>;
}, "strip", z.ZodTypeAny, {
    sessionId: string;
    action: "reset" | "quarantine" | "refresh";
}, {
    sessionId: string;
    action: "reset" | "quarantine" | "refresh";
}>;
