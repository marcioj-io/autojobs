import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type { ApplicationRecord, JobRecord, LogEntry, ManualReviewRecord, SettingsRecord } from '@autojobs/shared';
import type { Profile } from '@autojobs/db';
export declare class PersistenceService {
    private jobsRepository;
    private logsRepository;
    private applicationsRepository;
    private linkedinSessionsRepository;
    private manualReviewsRepository;
    private profilesRepository;
    private settingsRepository;
    private sessionHealthRepository;
    private selectorFailuresRepository;
    private anomalyLogsRepository;
    private screenshotMetadataRepository;
    constructor(db: DrizzleD1Database<any>);
    persistJob(job: JobRecord): Promise<void>;
    persistLog(entry: Omit<LogEntry, 'id' | 'timestamp'>): Promise<void>;
    createApplication(application: ApplicationRecord): Promise<void>;
    persistApplication(application: Omit<ApplicationRecord, 'id'>): Promise<void>;
    createManualReview(review: ManualReviewRecord): Promise<void>;
    getPendingReviews(): Promise<{
        id: string;
        jobId: string;
        profile: string;
        reviewStatus: string;
        reviewReason: string;
        reviewNotes: string | null;
        reviewedAt: Date | null;
        reviewedBy: string | null;
        snoozedUntil: Date | null;
        createdAt: Date;
        updatedAt: Date;
    }[]>;
    getApplications(): Promise<{
        id: string;
        jobId: string;
        status: string;
        result: string | null;
        appliedAt: Date;
    }[]>;
    getApplicationById(id: string): Promise<{
        id: string;
        jobId: string;
        status: string;
        result: string | null;
        appliedAt: Date;
    } | undefined>;
    getSessions(): Promise<{
        id: string;
        profile: string;
        cookies: string;
        createdAt: Date;
        updatedAt: Date;
    }[]>;
    getRecentSessionHealth(limit?: number): Promise<{
        id: string;
        sessionId: string;
        healthScore: number;
        status: string;
        reason: string | null;
        lastValidatedAt: Date;
        cooldownUntil: Date | null;
        createdAt: Date;
        updatedAt: Date;
    }[]>;
    getRecentLogs(limit?: number): Promise<{
        id: string;
        type: string;
        message: string;
        source: string;
        timestamp: Date;
        level: string;
    }[]>;
    getRecentSelectorFailures(limit?: number): Promise<{
        id: string;
        selectorType: string;
        selector: string;
        pageUrl: string | null;
        error: string;
        metadata: string | null;
        timestamp: Date;
    }[]>;
    getRecentAnomalyLogs(limit?: number): Promise<{
        id: string;
        type: string;
        message: string;
        details: string | null;
        severity: string;
        timestamp: Date;
    }[]>;
    updateManualReview(id: string, reviewStatus: string, payload: Partial<Omit<ManualReviewRecord, 'id' | 'jobId' | 'profile' | 'createdAt' | 'updatedAt'>>): Promise<void>;
    snoozeManualReview(id: string, until: Date): Promise<void>;
    getLinkedInSession(id: string): Promise<{
        id: string;
        profile: string;
        cookies: string;
        createdAt: Date;
        updatedAt: Date;
    } | undefined>;
    upsertLinkedInSession(session: {
        id: string;
        profile: string;
        cookies: string;
    }): Promise<void>;
    getSettings(id: string): Promise<{
        id: string;
        minScore: number;
        maxDailyApplications: number;
        autoApply: boolean;
        preferredLocation: string;
        blacklist: string;
    } | undefined>;
    upsertSettings(settings: SettingsRecord): Promise<void>;
    getAllJobs(): Promise<{
        id: string;
        company: string;
        title: string;
        url: string;
        score: number;
        status: string;
        location: string;
        modality: string;
        easyApply: boolean;
        language: string;
        profile: string;
        createdAt: Date;
        updatedAt: Date;
        applyResult: string | null;
        postedAt: string | null;
        description: string | null;
    }[]>;
    getAllProfiles(): Promise<{
        name: string;
        searches: string;
        keywords: string;
        negativeKeywords: string;
        minScore: number;
        dailyLimit: number;
        seniority: string;
        stackPriority: string;
        cv: string;
        createdAt: Date;
        updatedAt: Date;
    }[]>;
    createProfile(profile: Profile): Promise<void>;
    persistSessionHealth(entry: {
        sessionId: string;
        healthScore: number;
        status: string;
        reason: string | null;
        lastValidatedAt: Date;
        cooldownUntil?: Date | null;
    }): Promise<void>;
    persistSelectorFailure(entry: {
        selectorType: string;
        selector: string;
        pageUrl?: string | null;
        error: string;
        metadata?: string | null;
        timestamp: Date;
    }): Promise<void>;
    persistAnomalyLog(entry: {
        type: string;
        message: string;
        details?: string | null;
        severity: 'info' | 'warning' | 'error';
        timestamp: Date;
    }): Promise<void>;
    persistScreenshotMetadata(entry: {
        contextType: string;
        contextId?: string | null;
        path?: string | null;
        metadata?: string | null;
        timestamp: Date;
    }): Promise<void>;
}
