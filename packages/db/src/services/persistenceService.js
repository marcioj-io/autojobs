"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PersistenceService = void 0;
const applicationsRepository_1 = require("../repositories/applicationsRepository");
const jobsRepository_1 = require("../repositories/jobsRepository");
const linkedinSessionsRepository_1 = require("../repositories/linkedinSessionsRepository");
const logsRepository_1 = require("../repositories/logsRepository");
const manualReviewsRepository_1 = require("../repositories/manualReviewsRepository");
const profilesRepository_1 = require("../repositories/profilesRepository");
const settingsRepository_1 = require("../repositories/settingsRepository");
const sessionHealthRepository_1 = require("../repositories/sessionHealthRepository");
const selectorFailuresRepository_1 = require("../repositories/selectorFailuresRepository");
const anomalyLogsRepository_1 = require("../repositories/anomalyLogsRepository");
const screenshotMetadataRepository_1 = require("../repositories/screenshotMetadataRepository");
class PersistenceService {
    jobsRepository;
    logsRepository;
    applicationsRepository;
    linkedinSessionsRepository;
    manualReviewsRepository;
    profilesRepository;
    settingsRepository;
    sessionHealthRepository;
    selectorFailuresRepository;
    anomalyLogsRepository;
    screenshotMetadataRepository;
    constructor(db) {
        this.jobsRepository = new jobsRepository_1.JobsRepository(db);
        this.logsRepository = new logsRepository_1.LogsRepository(db);
        this.applicationsRepository = new applicationsRepository_1.ApplicationsRepository(db);
        this.linkedinSessionsRepository = new linkedinSessionsRepository_1.LinkedInSessionsRepository(db);
        this.manualReviewsRepository = new manualReviewsRepository_1.ManualReviewsRepository(db);
        this.profilesRepository = new profilesRepository_1.ProfilesRepository(db);
        this.settingsRepository = new settingsRepository_1.SettingsRepository(db);
        this.sessionHealthRepository = new sessionHealthRepository_1.SessionHealthRepository(db);
        this.selectorFailuresRepository = new selectorFailuresRepository_1.SelectorFailuresRepository(db);
        this.anomalyLogsRepository = new anomalyLogsRepository_1.AnomalyLogsRepository(db);
        this.screenshotMetadataRepository = new screenshotMetadataRepository_1.ScreenshotMetadataRepository(db);
    }
    async persistJob(job) {
        await this.jobsRepository.upsertJob({
            ...job,
            id: job.id || crypto.randomUUID(),
            createdAt: job.createdAt ? new Date(job.createdAt) : new Date(),
            updatedAt: new Date(),
            applyResult: job.applyResult ?? null,
            postedAt: job.postedAt ?? null,
            description: job.description ?? null
        });
    }
    async persistLog(entry) {
        await this.logsRepository.createLog({
            ...entry,
            id: crypto.randomUUID(),
            timestamp: new Date()
        });
    }
    async createApplication(application) {
        await this.applicationsRepository.createApplication({
            ...application,
            result: application.result ?? null,
            appliedAt: application.appliedAt ? new Date(application.appliedAt) : new Date()
        });
    }
    async persistApplication(application) {
        await this.createApplication({
            ...application,
            id: crypto.randomUUID()
        });
    }
    async createManualReview(review) {
        await this.manualReviewsRepository.createReview({
            ...review,
            reviewNotes: review.reviewNotes ?? null,
            reviewReason: review.reviewReason ?? '',
            reviewedBy: review.reviewedBy ?? null,
            reviewedAt: review.reviewedAt ? new Date(review.reviewedAt) : null,
            snoozedUntil: review.snoozedUntil ? new Date(review.snoozedUntil) : null,
            createdAt: review.createdAt ? new Date(review.createdAt) : new Date(),
            updatedAt: review.updatedAt ? new Date(review.updatedAt) : new Date()
        });
    }
    async getPendingReviews() {
        return this.manualReviewsRepository.getPendingReviews();
    }
    async getApplications() {
        return this.applicationsRepository.listAll();
    }
    async getApplicationById(id) {
        return this.applicationsRepository.getById(id);
    }
    async getSessions() {
        return this.linkedinSessionsRepository.listAll();
    }
    async getRecentSessionHealth(limit = 50) {
        return this.sessionHealthRepository.getRecentHealth(limit);
    }
    async getRecentLogs(limit = 50) {
        return this.logsRepository.getRecentLogs(limit);
    }
    async getRecentSelectorFailures(limit = 50) {
        return this.selectorFailuresRepository.getRecentFailures(limit);
    }
    async getRecentAnomalyLogs(limit = 50) {
        return this.anomalyLogsRepository.getRecentAnomalies(limit);
    }
    async updateManualReview(id, reviewStatus, payload) {
        await this.manualReviewsRepository.updateReviewStatus(id, reviewStatus, {
            reviewNotes: payload.reviewNotes,
            reviewReason: payload.reviewReason,
            reviewedBy: payload.reviewedBy,
            reviewedAt: payload.reviewedAt ? new Date(payload.reviewedAt) : null,
            snoozedUntil: payload.snoozedUntil ? new Date(payload.snoozedUntil) : null
        });
    }
    async snoozeManualReview(id, until) {
        await this.manualReviewsRepository.snoozeReview(id, until);
    }
    async getLinkedInSession(id) {
        return this.linkedinSessionsRepository.getSessionById(id);
    }
    async upsertLinkedInSession(session) {
        await this.linkedinSessionsRepository.upsertSession({
            ...session,
            createdAt: new Date(),
            updatedAt: new Date()
        });
    }
    async getSettings(id) {
        return this.settingsRepository.getSettings(id);
    }
    async upsertSettings(settings) {
        await this.settingsRepository.upsertSettings(settings);
    }
    async getAllJobs() {
        return this.jobsRepository.getAllJobs();
    }
    async getAllProfiles() {
        return this.profilesRepository.getAllProfiles();
    }
    async createProfile(profile) {
        await this.profilesRepository.createProfile(profile);
    }
    async persistSessionHealth(entry) {
        await this.sessionHealthRepository.createHealthRecord({
            id: crypto.randomUUID(),
            sessionId: entry.sessionId,
            healthScore: entry.healthScore,
            status: entry.status,
            reason: entry.reason,
            lastValidatedAt: entry.lastValidatedAt,
            cooldownUntil: entry.cooldownUntil ?? null,
            createdAt: new Date(),
            updatedAt: new Date()
        });
    }
    async persistSelectorFailure(entry) {
        await this.selectorFailuresRepository.createFailure({
            id: crypto.randomUUID(),
            selectorType: entry.selectorType,
            selector: entry.selector,
            pageUrl: entry.pageUrl ?? null,
            error: entry.error,
            metadata: entry.metadata ?? null,
            timestamp: entry.timestamp
        });
    }
    async persistAnomalyLog(entry) {
        await this.anomalyLogsRepository.createAnomaly({
            id: crypto.randomUUID(),
            type: entry.type,
            message: entry.message,
            details: entry.details ?? null,
            severity: entry.severity,
            timestamp: entry.timestamp
        });
    }
    async persistScreenshotMetadata(entry) {
        await this.screenshotMetadataRepository.createMetadata({
            id: crypto.randomUUID(),
            contextType: entry.contextType,
            contextId: entry.contextId ?? null,
            path: entry.path ?? null,
            metadata: entry.metadata ?? null,
            timestamp: entry.timestamp
        });
    }
}
exports.PersistenceService = PersistenceService;
