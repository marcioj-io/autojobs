// worker/src/runtime/RuntimeController.ts

import { randomUUID } from 'node:crypto';

import {
  AuditLogsService,
  PersistenceService,
  RuntimeService,
  type DrizzleD1Database,
  type Profile
} from '@autojobs/db';

import {
  EngineClient,
  type EngineScrapeResult,
  type LinkedInJobRecord
} from '@autojobs/engine';

import { RuntimeLogger } from '../logging/RuntimeLogger';
import { RetryPolicy } from '../retry/RetryPolicy';
import { Scheduler } from '../scheduler/Scheduler';
import { HealthService } from '../health/HealthService';
import { LimitsService } from '../limits/LimitsService';
import { RecoveryService } from '../recovery/RecoveryService';
import { ObservabilityService } from '../observability/ObservabilityService';

import type { RuntimePipelineResult } from './types';
import type { Env } from '../env';
import { JobRecord } from '@autojobs/shared';

export interface WorkerRuntimeOptions {
  runId?: string;
  profile: string;
  query: string;
  location: string;
  language: 'PT' | 'EN' | 'ES';
  maxResults: number;
  modalities?: string[];
  profileDefinition?: Profile;
}

export class RuntimeController {
  private readonly runtimeService: RuntimeService;
  private readonly logger: RuntimeLogger;
  private readonly scheduler: Scheduler;
  private readonly retryPolicy: RetryPolicy;
  private readonly healthService: HealthService;
  private readonly limitsService: LimitsService;
  private readonly recoveryService: RecoveryService;
  private readonly observabilityService: ObservabilityService;
  private readonly auditLogsService: AuditLogsService;

  constructor(
    private readonly db: DrizzleD1Database<any>,
    private readonly persistence: PersistenceService,
    auditLogsService: AuditLogsService,
    private readonly runtimeStateId = 'main',
    private readonly engineClient: EngineClient,
    private readonly env: Env
  ) {
    this.auditLogsService = auditLogsService;
    this.runtimeService = new RuntimeService(db);
    this.logger = new RuntimeLogger(persistence);

    this.scheduler = new Scheduler({
      cooldownMs: Number(process.env.SCRAPE_COOLDOWN_MS ?? 1000 * 60 * 15),
      errorCooldownMs: Number(process.env.ERROR_COOLDOWN_MS ?? 1000 * 60 * 30),
      minRandomDelayMs: Number(process.env.MIN_RANDOM_DELAY_MS ?? 15000),
      maxRandomDelayMs: Number(process.env.MAX_RANDOM_DELAY_MS ?? 60000)
    });

    this.retryPolicy = new RetryPolicy({
      maxAttempts: Number(process.env.RETRY_MAX_ATTEMPTS ?? 3),
      baseDelayMs: Number(process.env.RETRY_BASE_DELAY_MS ?? 2000),
      maxDelayMs: Number(process.env.RETRY_MAX_DELAY_MS ?? 20000)
    });

    this.healthService = new HealthService();
    
    this.limitsService = new LimitsService(db, {
      dailyApplyLimit: Number(process.env.AUTO_APPLY_LIMIT_DAILY ?? 10),
      hourlyApplyLimit: Number(process.env.AUTO_APPLY_LIMIT_HOURLY ?? 3),
      applyCooldownMs: Number(process.env.AUTO_APPLY_COOLDOWN_MS ?? 1000 * 60 * 15),
      scrapeCooldownMs: Number(process.env.SCRAPE_COOLDOWN_MS ?? 1000 * 60 * 15),
      allowAutoApply: process.env.LINKEDIN_AUTO_APPLY === 'true'
    });

    this.recoveryService = new RecoveryService();
    this.observabilityService = new ObservabilityService(persistence);
  }

  async execute(options: WorkerRuntimeOptions) {
    const startedAt = new Date();
    const runId = options.runId ?? randomUUID();

    const state = await this.runtimeService.ensureState(this.runtimeStateId);

    if (state.currentState === 'BLOCKED' && process.env.FORCE_RUN !== 'true') {
      await this.logger.logInfo('Runtime bloqueado. Execução ignorada.');

      await this.auditLogsService.recordAuditLog({
        eventType: 'runtime',
        action: 'blocked',
        message: 'Runtime execution skipped because state is BLOCKED.',
        source: 'worker.runtime',
        metadata: JSON.stringify({ runId }),
        severity: 'warning'
      });

      return { status: 'blocked' };
    }

    await this.runtimeService.updateState(this.runtimeStateId, {
      currentState: 'SCRAPING',
      lastExecutionStartedAt: startedAt,
      lastError: null,
      updatedAt: new Date()
    });

    await this.auditLogsService.recordAuditLog({
      eventType: 'runtime',
      action: 'started',
      message: 'Runtime execution started.',
      source: 'worker.runtime',
      metadata: JSON.stringify({ runId, profile: options.profile }),
      severity: 'info'
    });

    let pipelineResult: RuntimePipelineResult = {
      jobsProcessed: 0,
      autoApplies: 0,
      reviewsCreated: 0,
      averageScore: 0
    };

    let status: 'success' | 'failure' | 'blocked' = 'success';
    let errorMessage: string | undefined;

    try {
      const session = await this.persistence.getLinkedInSession('linkedin-default');
      const storageState = session?.cookies ? JSON.parse(session.cookies) : undefined;

      const profileDefinition = options.profileDefinition ?? await this.persistence.getProfileByName(options.profile);

      if (!profileDefinition) {
        throw new Error(`Profile ${options.profile} não encontrado.`);
      }

      const response: EngineScrapeResult = await this.retryPolicy.execute(
        async () => {
          return await this.engineClient.scrape({
            profile: options.profile,
            profileDefinition,
            query: options.query,
            location: options.location,
            language: options.language,
            maxResults: options.maxResults,
            storageState,
            modalities: options.modalities
          });
        },
        async (attempt, error, delayMs) => {
          await this.runtimeService.recordRetry({
            runId,
            attempt,
            error: error instanceof Error ? error.message : String(error),
            backoffMs: delayMs,
            timestamp: new Date()
          });
        }
      );

      for (const job of response.jobs ?? []) {
        await this.persistence.persistJob(this.normalizeJob(job));
      }

      for (const application of response.applications ?? []) {
        await this.persistence.persistApplication(application);
      }

      for (const review of response.manualReviews ?? []) {
        await this.persistence.createManualReview(review);
      }

      const jobs = response.jobs ?? [];
      pipelineResult = {
        jobsProcessed: jobs.length,
        autoApplies: await this.limitsService.countAutoAppliesToday(),
        reviewsCreated: response.manualReviews?.length ?? 0,
        averageScore: jobs.length > 0 
          ? jobs.reduce((total, job) => total + (job.score ?? 0), 0) / jobs.length
          : 0
      };

      const nextRun = this.scheduler.getNextExecutionTime(startedAt, null);

      await this.runtimeService.updateState(this.runtimeStateId, {
        currentState: 'IDLE',
        health: this.healthService.determineHealth('IDLE', 0, state.sessionStatus),
        nextExecutionAt: nextRun,
        consecutiveFailures: 0,
        cooldownUntil: null,
        lastExecutionFinishedAt: new Date(),
        updatedAt: new Date()
      });

    } catch (error) {
      const recovery = this.recoveryService.analyzeError(error);
      const nextRun = recovery.shouldRetry
        ? this.scheduler.getErrorCooldownTime(startedAt)
        : this.scheduler.getNextExecutionTime(startedAt, null);

      await this.runtimeService.updateState(this.runtimeStateId, {
        currentState: recovery.nextState,
        health: this.healthService.determineHealth(
          recovery.nextState,
          state.consecutiveFailures + 1,
          state.sessionStatus
        ),
        consecutiveFailures: state.consecutiveFailures + 1,
        cooldownUntil: recovery.shouldRetry ? this.scheduler.getErrorCooldownTime(startedAt) : nextRun,
        nextExecutionAt: nextRun,
        lastError: recovery.reason,
        lastExecutionFinishedAt: new Date(),
        updatedAt: new Date()
      });

      await this.logger.logError('Falha durante execução do runtime', error);

      await this.observabilityService.logAnomaly(
        'runtime.failure',
        recovery.reason,
        {
          error: error instanceof Error ? error.message : String(error),
          nextState: recovery.nextState,
          nextRun: nextRun.toISOString()
        },
        'error'
      );

      await this.auditLogsService.recordAuditLog({
        eventType: 'runtime',
        action: recovery.shouldBlock ? 'failure.blocked' : 'failure',
        message: `Runtime failed: ${recovery.reason}`,
        source: 'worker.runtime',
        metadata: JSON.stringify({ runId, nextState: recovery.nextState }),
        severity: 'error'
      });

      status = recovery.shouldBlock ? 'blocked' : 'failure';
      errorMessage = recovery.reason;
    }

    const finishedAt = new Date();

    await this.runtimeService.recordRun({
      runType: 'scheduled',
      state: status === 'success' ? 'SCRAPING' : 'ERROR',
      status,
      startedAt,
      finishedAt,
      durationMs: finishedAt.getTime() - startedAt.getTime(),
      jobsProcessed: pipelineResult.jobsProcessed,
      autoApplies: pipelineResult.autoApplies,
      reviewsCreated: pipelineResult.reviewsCreated,
      successRate: pipelineResult.jobsProcessed > 0
        ? pipelineResult.autoApplies / pipelineResult.jobsProcessed
        : 0,
      errorMessage: errorMessage ?? null,
      metadata: JSON.stringify({ runId, profile: options.profile, query: options.query })
    });

    await this.runtimeService.recordMetrics({
      recordedAt: new Date(),
      jobsPerDay: pipelineResult.jobsProcessed,
      appliesPerDay: pipelineResult.autoApplies,
      reviewsPerDay: pipelineResult.reviewsCreated,
      applySuccessRate: pipelineResult.jobsProcessed > 0
        ? pipelineResult.autoApplies / pipelineResult.jobsProcessed
        : 0,
      uptimePercent: status === 'success' ? 100 : 0,
      averageScore: pipelineResult.averageScore,
      averageDurationMs: finishedAt.getTime() - startedAt.getTime()
    });

    await this.auditLogsService.recordAuditLog({
      eventType: 'runtime',
      action: status === 'success'
        ? 'completed'
        : status === 'blocked' ? 'blocked' : 'failed',
      message: status === 'success'
        ? `Runtime finalizado. ${pipelineResult.jobsProcessed} vagas processadas.`
        : `Runtime terminou com status ${status}.`,
      source: 'worker.runtime',
      metadata: JSON.stringify({ runId, status, profile: options.profile }),
      severity: status === 'success' ? 'info' : status === 'failure' ? 'error' : 'warning'
    });

    return {
      runId,
      pipelineResult,
      status
    };
  }

  /**
   * Garante compatibilidade antes da persistência.
   *
   * O Engine já entrega:
   * - score
   * - status
   * - modality
   * - timestamps
   *
   * Worker apenas completa campos ausentes.
   */
    /**
   * /Garante compatibilidade antes da persistência.
   */
  private normalizeJob(job: LinkedInJobRecord): JobRecord {
    const now = new Date().toISOString();

    // Forçamos o cast e damos um valor padrão seguro caso venha undefined do Engine
    const safeModality = (job.modality as 'Remoto' | 'Híbrido' | 'Presencial') ?? 'Remoto';
    
    // Mesma proteção para a linguagem, que também é um tipo estrito (LanguageCode)
    const safeLanguage = (job.language as 'PT' | 'EN' | 'ES') ?? 'PT';

    return {
      ...job, // Espalha as propriedades que já são compatíveis (company, title, etc)
      score: job.score ?? 0,
      status: (job.status as 'found' | 'applied' | 'pending_review' | 'manual') ?? 'found',
      modality: safeModality,
      language: safeLanguage,
      createdAt: job.createdAt ?? now,
      updatedAt: now
    } as JobRecord;
  }
}