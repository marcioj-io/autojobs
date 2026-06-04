// worker\src\runtime\RuntimeController.ts
import { LinkedInScraperService } from '../services/linkedinScraperService';
import { RuntimeLogger } from '../logging/RuntimeLogger';
import { RetryPolicy } from '../retry/RetryPolicy';
import { Scheduler } from '../scheduler/Scheduler';
import { HealthService } from '../health/HealthService';
import { LimitsService } from '../limits/LimitsService';
import { RecoveryService } from '../recovery/RecoveryService';
import { ObservabilityService } from '../observability/ObservabilityService';
import { AuditLogsService, PersistenceService, RuntimeService } from '@autojobs/db';
import type { DrizzleD1Database } from '@autojobs/db';
import type { RuntimePipelineResult } from './types';

export interface WorkerRuntimeOptions {
  runId: string;
  profile: string;
  query: string;
  location: string;
  language: 'PT' | 'EN' | 'ES';
  maxResults: number;
}

export class RuntimeController {
  private runtimeService: RuntimeService;
  private logger: RuntimeLogger;
  private scheduler: Scheduler;
  private retryPolicy: RetryPolicy;
  private healthService: HealthService;
  private limitsService: LimitsService;
  private recoveryService: RecoveryService;
  private observabilityService: ObservabilityService;
  private auditLogsService: AuditLogsService;

  constructor(
    private db: DrizzleD1Database<any>,
    private persistence: PersistenceService,
    private scraper: LinkedInScraperService,
    auditLogsService: AuditLogsService,
    private runtimeStateId = 'main'
  ) {
    this.auditLogsService = auditLogsService;
    this.runtimeService = new RuntimeService(db);
    this.logger = new RuntimeLogger(persistence);
    this.scheduler = new Scheduler({
      cooldownMs: Number(process.env.SCRAPE_COOLDOWN_MS ?? 1000 * 60 * 15),
      errorCooldownMs: Number(process.env.ERROR_COOLDOWN_MS ?? 1000 * 60 * 30),
      minRandomDelayMs: Number(process.env.MIN_RANDOM_DELAY_MS ?? 1000 * 15),
      maxRandomDelayMs: Number(process.env.MAX_RANDOM_DELAY_MS ?? 1000 * 60)
    });
    this.retryPolicy = new RetryPolicy({
      maxAttempts: Number(process.env.RETRY_MAX_ATTEMPTS ?? 3),
      baseDelayMs: Number(process.env.RETRY_BASE_DELAY_MS ?? 2000),
      maxDelayMs: Number(process.env.RETRY_MAX_DELAY_MS ?? 20000)
    });
    this.healthService = new HealthService();
    this.limitsService = new LimitsService(this.db, {
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
    const now = new Date();
    const runId = options.runId ?? crypto.randomUUID();
    const state = await this.runtimeService.ensureState(this.runtimeStateId);
    const nextExecutionAt = state.nextExecutionAt ? new Date(state.nextExecutionAt) : null;
    const cooldownUntil = state.cooldownUntil ? new Date(state.cooldownUntil) : null;

    if (state.currentState === 'BLOCKED' && process.env.FORCE_RUN !== 'true') {
      await this.logger.logInfo('Execução bloqueada pelo operador; ignorando execução agendada.');
      await this.auditLogsService.recordAuditLog({
        eventType: 'runtime',
        action: 'blocked',
        message: 'Runtime execution skipped because state is BLOCKED.',
        source: 'worker.runtime',
        metadata: JSON.stringify({ runId, currentState: state.currentState, lastError: state.lastError }),
        severity: 'warning'
      });
      return { status: 'blocked' } as const;
    }

    if (!this.scheduler.shouldStart(now, nextExecutionAt, cooldownUntil, state.currentState) && process.env.FORCE_RUN !== 'true') {
      await this.logger.logInfo(`Ignorando execução: próximo agendamento em ${nextExecutionAt?.toISOString()}`);
      return { status: 'skipped' } as const;
    }

    await this.runtimeService.updateState(this.runtimeStateId, {
      currentState: 'SCRAPING',
      lastExecutionStartedAt: now,
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

    let runStatus: 'success' | 'failure' | 'blocked' = 'success';
    let errorMessage: string | undefined;

    try {
      const beforeApplications = await this.limitsService.countAutoAppliesToday();
      const beforeReviews = await this.persistence.getPendingReviews();
      const jobs = await this.retryPolicy.execute(() =>
        this.scraper.scrape({
          query: options.query,
          location: options.location,
          profile: options.profile,
          language: options.language,
          maxResults: options.maxResults
        })
      , async (attempt, error, delayMs) => {
        await this.runtimeService.recordRetry({
          runId,
          attempt,
          error: error instanceof Error ? error.message : String(error),
          backoffMs: delayMs,
          timestamp: new Date()
        });
      });

      const afterApplications = await this.limitsService.countAutoAppliesToday();
      const afterReviews = await this.persistence.getPendingReviews();
      pipelineResult = {
        jobsProcessed: jobs.length,
        autoApplies: Math.max(0, afterApplications - beforeApplications),
        reviewsCreated: afterReviews.length - beforeReviews.length,
        averageScore: 0
      };

      if (await this.limitsService.shouldPauseAfterApply()) {
        const cooldownUntilNext = this.limitsService.getApplyCooldownUntil(now);
        await this.runtimeService.updateState(this.runtimeStateId, {
          currentState: 'COOLDOWN',
          health: 'healthy',
          cooldownUntil: cooldownUntilNext,
          nextExecutionAt: cooldownUntilNext,
          lastExecutionFinishedAt: new Date(),
          updatedAt: new Date()
        });
      } else {
        const nextRun = this.scheduler.getNextExecutionTime(now, null);
        await this.runtimeService.updateState(this.runtimeStateId, {
          currentState: 'IDLE',
          health: this.healthService.determineHealth('IDLE', 0, state.sessionStatus),
          nextExecutionAt: nextRun,
          consecutiveFailures: 0,
          cooldownUntil: null,
          lastExecutionFinishedAt: new Date(),
          updatedAt: new Date()
        });
      }
    } catch (error) {
      const recovery = this.recoveryService.analyzeError(error);
      const nextState = recovery.nextState;
      const nextRun = recovery.shouldRetry ? this.scheduler.getErrorCooldownTime(now) : this.scheduler.getNextExecutionTime(now, null);
      await this.runtimeService.updateState(this.runtimeStateId, {
        currentState: nextState,
        health: this.healthService.determineHealth(nextState, state.consecutiveFailures + 1, state.sessionStatus),
        consecutiveFailures: state.consecutiveFailures + 1,
        cooldownUntil: recovery.shouldRetry ? this.scheduler.getErrorCooldownTime(now) : nextRun,
        nextExecutionAt: nextRun,
        lastError: recovery.reason,
        lastExecutionFinishedAt: new Date(),
        updatedAt: new Date()
      });
      await this.logger.logError('Falha durante execução do runtime', error);
      await this.observabilityService.logAnomaly('runtime.failure', recovery.reason, {
        error: error instanceof Error ? error.message : String(error),
        nextState,
        nextRun: nextRun.toISOString()
      }, 'error');
      await this.auditLogsService.recordAuditLog({
        eventType: 'runtime',
        action: recovery.shouldBlock ? 'failure.blocked' : 'failure',
        message: `Runtime execution failed: ${recovery.reason}`,
        source: 'worker.runtime',
        metadata: JSON.stringify({ runId, currentState: state.currentState, nextState, nextRun: nextRun.toISOString() }),
        severity: 'error'
      });
      runStatus = recovery.shouldBlock ? 'blocked' : 'failure';
      errorMessage = recovery.reason;
    }

    const finishAt = new Date();
    await this.runtimeService.recordRun({
      runType: 'scheduled',
      state: 'SCRAPING',
      status: runStatus,
      startedAt: state.lastExecutionStartedAt ?? now,
      finishedAt: finishAt,
      durationMs: finishAt.getTime() - now.getTime(),
      jobsProcessed: pipelineResult.jobsProcessed,
      autoApplies: pipelineResult.autoApplies,
      reviewsCreated: pipelineResult.reviewsCreated,
      successRate: pipelineResult.jobsProcessed ? pipelineResult.autoApplies / pipelineResult.jobsProcessed : 0,
      errorMessage: errorMessage ?? null,
      metadata: JSON.stringify({ profile: options.profile, runId })
    });

    await this.runtimeService.recordMetrics({
      recordedAt: new Date(),
      jobsPerDay: await this.limitsService.countAutoAppliesToday(),
      appliesPerDay: await this.limitsService.countAutoAppliesToday(),
      reviewsPerDay: (await this.persistence.getPendingReviews()).length,
      applySuccessRate: pipelineResult.jobsProcessed ? pipelineResult.autoApplies / pipelineResult.jobsProcessed : 0,
      uptimePercent: 100,
      averageScore: pipelineResult.averageScore,
      averageDurationMs: finishAt.getTime() - now.getTime()
    });

    await this.auditLogsService.recordAuditLog({
      eventType: 'runtime',
      action: runStatus === 'success' ? 'completed' : runStatus === 'blocked' ? 'blocked' : 'failed',
      message: runStatus === 'success'
        ? `Runtime execution completed successfully with ${pipelineResult.jobsProcessed} jobs processed.`
        : `Runtime execution ended with status ${runStatus}: ${errorMessage ?? 'unknown error'}`,
      source: 'worker.runtime',
      metadata: JSON.stringify({ runId, status: runStatus, jobsProcessed: pipelineResult.jobsProcessed, autoApplies: pipelineResult.autoApplies }),
      severity: runStatus === 'success' ? 'info' : runStatus === 'failure' ? 'error' : 'warning'
    });

    return {
      runId,
      pipelineResult,
      status: runStatus
    };
  }
}
