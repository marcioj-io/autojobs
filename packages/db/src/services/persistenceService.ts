// packages\db\src\services\persistenceService.ts
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { ApplicationsRepository } from '../repositories/applicationsRepository';
import { JobsRepository } from '../repositories/jobsRepository';
import { LinkedInSessionsRepository } from '../repositories/linkedinSessionsRepository';
import { LogsRepository } from '../repositories/logsRepository';
import { ManualReviewsRepository } from '../repositories/manualReviewsRepository';
import { ProfilesRepository } from '../repositories/profilesRepository';
import { SettingsRepository } from '../repositories/settingsRepository';
import { SessionHealthRepository } from '../repositories/sessionHealthRepository';
import { SelectorFailuresRepository } from '../repositories/selectorFailuresRepository';
import { AnomalyLogsRepository } from '../repositories/anomalyLogsRepository';
import { ScreenshotMetadataRepository } from '../repositories/screenshotMetadataRepository';

import type { Profile } from '../schema';
import { ApplicationRecord, JobRecord, LogEntry, ManualReviewRecord, SettingsRecord } from '@autojobs/shared';

export class PersistenceService {
  private jobsRepository: JobsRepository;
  private logsRepository: LogsRepository;
  private applicationsRepository: ApplicationsRepository;
  private linkedinSessionsRepository: LinkedInSessionsRepository;
  private manualReviewsRepository: ManualReviewsRepository;
  private profilesRepository: ProfilesRepository;
  private settingsRepository: SettingsRepository;
  private sessionHealthRepository: SessionHealthRepository;
  private selectorFailuresRepository: SelectorFailuresRepository;
  private anomalyLogsRepository: AnomalyLogsRepository;
  private screenshotMetadataRepository: ScreenshotMetadataRepository;

  constructor(db: DrizzleD1Database<any>) {
    this.jobsRepository = new JobsRepository(db);
    this.logsRepository = new LogsRepository(db);
    this.applicationsRepository = new ApplicationsRepository(db);
    this.linkedinSessionsRepository = new LinkedInSessionsRepository(db);
    this.manualReviewsRepository = new ManualReviewsRepository(db);
    this.profilesRepository = new ProfilesRepository(db);
    this.settingsRepository = new SettingsRepository(db);
    this.sessionHealthRepository = new SessionHealthRepository(db);
    this.selectorFailuresRepository = new SelectorFailuresRepository(db);
    this.anomalyLogsRepository = new AnomalyLogsRepository(db);
    this.screenshotMetadataRepository = new ScreenshotMetadataRepository(db)

  }

  async persistJob(job: JobRecord) {
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

  async persistLog(entry: Omit<LogEntry, 'id' | 'timestamp'>) {
    await this.logsRepository.createLog({
      ...entry,
      id: crypto.randomUUID(),
      timestamp: new Date()
    });
  }

  async createApplication(application: ApplicationRecord) {
    await this.applicationsRepository.createApplication({
      ...application,
      result: application.result ?? null,
      appliedAt: application.appliedAt ? new Date(application.appliedAt) : new Date()
    });
  }

  async persistApplication(application: Omit<ApplicationRecord, 'id'>) {
    await this.createApplication({
      ...application,
      id: crypto.randomUUID()
    });
  }

  async createManualReview(review: ManualReviewRecord) {
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

  async getApplicationById(id: string) {
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

  async updateManualReview(
    id: string,
    reviewStatus: string,
    payload: Partial<Omit<ManualReviewRecord, 'id' | 'jobId' | 'profile' | 'createdAt' | 'updatedAt'>>
  ) {
    await this.manualReviewsRepository.updateReviewStatus(id, reviewStatus, {
      reviewNotes: payload.reviewNotes,
      reviewReason: payload.reviewReason,
      reviewedBy: payload.reviewedBy,
      reviewedAt: payload.reviewedAt ? new Date(payload.reviewedAt) : null,
      snoozedUntil: payload.snoozedUntil ? new Date(payload.snoozedUntil) : null
    });
  }

  async snoozeManualReview(id: string, until: Date) {
    await this.manualReviewsRepository.snoozeReview(id, until);
  }

  async getLinkedInSession(id: string) {
    return this.linkedinSessionsRepository.getSessionById(id);
  }

  async upsertLinkedInSession(session: {
    id: string;
    profile: string;
    cookies: string;
  }) {
    await this.linkedinSessionsRepository.upsertSession({
      ...session,
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }

  async getSettings(id: string) {
    return this.settingsRepository.getSettings(id);
  }

  async upsertSettings(settings: SettingsRecord) {
    await this.settingsRepository.upsertSettings(settings);

    return this.settingsRepository.getSettings(settings.id);
  }
  
  async getAllJobs() {
    return this.jobsRepository.getAllJobs();
  }

  async getAllProfiles() {
    return this.profilesRepository.getAllProfiles();
  }

  async createProfile(profile: Profile) {
  const profileWithId = {
    ...profile,
    id: profile.id ?? crypto.randomUUID()
  };

  await this.profilesRepository.createProfile(profileWithId);

  return this.profilesRepository.getProfileById(profileWithId.id);
}

  async persistSessionHealth(entry: {
    sessionId: string;
    healthScore: number;
    status: string;
    reason: string | null;
    lastValidatedAt: Date;
    cooldownUntil?: Date | null;
  }) {
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

  async persistSelectorFailure(entry: {
    selectorType: string;
    selector: string;
    pageUrl?: string | null;
    error: string;
    metadata?: string | null;
    timestamp: Date;
  }) {
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

  async persistAnomalyLog(entry: {
    type: string;
    message: string;
    details?: string | null;
    severity: 'info' | 'warning' | 'error';
    timestamp: Date;
  }) {
    await this.anomalyLogsRepository.createAnomaly({
      id: crypto.randomUUID(),
      type: entry.type,
      message: entry.message,
      details: entry.details ?? null,
      severity: entry.severity,
      timestamp: entry.timestamp
    });
  }

  async persistScreenshotMetadata(entry: {
    contextType: string;
    contextId?: string | null;
    path?: string | null;
    metadata?: string | null;
    timestamp: Date;
  }) {
    await this.screenshotMetadataRepository.createMetadata({
      id: crypto.randomUUID(),
      contextType: entry.contextType,
      contextId: entry.contextId ?? null,
      path: entry.path ?? null,
      metadata: entry.metadata ?? null,
      timestamp: entry.timestamp
    });
  }

  async getProfileByName(name: string) {
  return this.profilesRepository.getProfileByName(
    name
  );
  }

}
