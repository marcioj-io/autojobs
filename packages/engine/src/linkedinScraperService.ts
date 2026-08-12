// packages/engine/src/linkedinScraperService.ts
import crypto from 'crypto';
import type { BrowserContext, Page } from 'playwright';
import { BrowserManager } from './browser/browserManager';
import { SessionRotationService } from './sessionRotation/SessionRotationService';
import { searchLinkedInJobs } from './searchLinkedInJobs';
import { LinkedInApplyService } from './apply';
import type { LinkedInJobRecord, LinkedInSearchOptions, ScrapeResult } from './types';
import type { ApplyResult, ScoringResult } from '@autojobs/shared';
import { normalize } from '@autojobs/shared';
import { ModalityDetector, randomDelay as utilRandomDelay, safeSerialize } from './utils';
import { LinkedInSessionManager } from './sessionManager';
import { PreFilterResult, PreFilterService, ScoringPipeline } from '@autojobs/scoring';
import path from 'node:path';
import fs from 'node:fs';

/**
 * LinkedInScraperService (robust, senior+)
 *
 * Responsibilities:
 * - Search LinkedIn jobs and orchestrate scoring + apply.
 * - Apply only when scoring approves AND score >= profile.minScore.
 * - Manual review only for apply failures (error | complex_form) or critical scoring errors (llm/prefilter).
 * - Send to manual review when score is below the configured threshold or scoring is not approved, unless prefilter explicitly hard-rejects.
 * - Propagate structured errors (message, code, errorBy) from scoring into aiMetadata / applyResult / manualReview.
 *
 * Notes:
 * - This file keeps the original helpers and flow but centralizes routing decisions in a clear, testable way.
 * - Minimal surface changed from original: routing and metadata enrichment.
 */

export class LinkedInScraperService {
  private browserManager: BrowserManager;
  private readonly DESC_SELECTORS = [
    '[data-testid="expandable-text-box"]',
    '.jobs-description__content',
    '#job-details',
    'article.jobs-description__container',
    '.jobs-search__job-details',
    '.job-view-layout'
  ];

  private processingLocks = new Map<string, Promise<void>>();

  // statuses from apply service that should trigger manual review
  private static readonly APPLY_FAILURE_STATUSES = new Set([
    'error', 
    'complex_form', 
    'failed', 
    'dead_end', 
    'requires_manual_review',
    'manual_review'
  ]);

  constructor(
    private headless = true,
    private applyService = new LinkedInApplyService(),
    private scoring = new ScoringPipeline(),
    private modalityDetector = new ModalityDetector(),
    private concurrency = Number(process.env.SCRAPER_CONCURRENCY ?? 2),
    private idempotencyStore: { has(key: string): Promise<boolean>; set(key: string, ttlMs?: number): Promise<void> } = { has: async () => false, set: async () => {} },
    private preFilterService: typeof PreFilterService = PreFilterService
  ) {
    this.browserManager = BrowserManager.getInstance({ headless });
  }

  public async scrape(options: LinkedInSearchOptions & { processedJobIds?: string[] }): Promise<ScrapeResult> {
    const result: ScrapeResult = { jobs: [], applications: [], manualReviews: [] };
    const sessionManager = new LinkedInSessionManager(options.storageState);
    const rotationService = new SessionRotationService();
    const sessionIdForProfile = `profile-${options.profileName}`;

    const { context, page } = await this.prepareSession(sessionManager, sessionIdForProfile, options.storageState);

    try {
      this.maybeWarnSessionRotation(rotationService, sessionIdForProfile);
      await this.ensureOnJobsPage(page).catch(() => { /* non-fatal */ });

      const autoApplyEnabled = process.env.LINKEDIN_AUTO_APPLY === 'true';

      let jobs: LinkedInJobRecord[] = [];
      try {
        jobs = await searchLinkedInJobs(page, options);
      } catch (err) {
        console.warn('[SCRAPER] searchLinkedInJobs falhou, tentando recriar contexto e reexecutar', err);
        try {
          try { await page.close(); } catch {}
          const ctx = await this.browserManager.getContext(sessionIdForProfile, {}, undefined);
          const p = await ctx.newPage();
          jobs = await searchLinkedInJobs(p, options);
        } catch (reErr) {
          console.error('[SCRAPER] Falha ao recuperar contexto e reexecutar searchLinkedInJobs', reErr);
          throw reErr;
        }
      }

      console.info(`🔍 Encontradas ${jobs.length} vagas para a query "${options.query}". Iniciando validação...`);

      for (let i = 0; i < jobs.length; i += this.concurrency) {
        const batch = jobs.slice(i, i + this.concurrency);
        await Promise.all(batch.map((job, idx) =>
          this.safeProcessJob(job, i + idx, jobs.length, page, context, options, autoApplyEnabled, result)
        ));
      }
    } finally {
      // BrowserManager lifecycle handled elsewhere
    }

    return result;
  }

  private async safeProcessJob(
    job: LinkedInJobRecord,
    index: number,
    total: number,
    page: Page,
    context: BrowserContext,
    options: LinkedInSearchOptions & { processedJobIds?: string[] },
    autoApplyEnabled: boolean,
    result: ScrapeResult
  ) {
    const key = this.buildIdempotencyKey(job);

    if (options.processedJobIds && options.processedJobIds.includes(job.id)) {
      console.info(`⏩ [Dedup] Vaga ${job.id} já processada (processedJobIds). Ignorando.`);
      return;
    }

    try {
      if (await this.idempotencyStore.has(key)) {
        console.info(`⏩ [Idempotency] Vaga já processada (store) key=${key}. Ignorando.`);
        return;
      }
    } catch (err) {
      console.warn('[Idempotency] falha ao checar store, prosseguindo', err);
    }

    if (this.processingLocks.has(key)) {
      console.info(`⏳ [Lock] Vaga ${job.id} já em processamento no processo atual. Ignorando concorrente.`);
      return;
    }

    const lockPromise = (async () => {
      try {
        await this.processJob(job, index, total, page, context, options, autoApplyEnabled, result);
        try { await this.idempotencyStore.set(key, Number(process.env.IDEMPOTENCY_TTL_MS ?? 1000 * 60 * 60)); } catch (e) { /* ignore */ }
      } finally {
        this.processingLocks.delete(key);
      }
    })();

    this.processingLocks.set(key, lockPromise);
    await lockPromise;
  }

  private buildIdempotencyKey(job: LinkedInJobRecord) {
    const url = (job.url || '').split('?')[0].replace(/\/+$/, '');
    const normalizedUrl = normalize(url);
    const idPart = job.id ? job.id.toString() : '';
    return `job:${crypto.createHash('sha256').update(`${normalizedUrl}|${idPart}`).digest('hex')}`;
  }

  private normalizeForPersistence(job: any, profileName: string) {
    const url = (job?.url || '').toString().trim();
    const title = (job?.title || 'Sem título').toString().trim();
    const company = (job?.company || 'Desconhecido').toString().trim();
    const location = (job?.location || 'Indefinida').toString().trim();
    const id = job?.id
      ? job.id.toString()
      : crypto.createHash('sha256').update(url || title + company + String(Date.now())).digest('hex');

    return {
      ...job,
      id,
      url,
      title,
      company,
      location,
      profileName: profileName ?? job?.profileName ?? 'unknown',
      easyApply: Boolean(job?.easyApply),
      language: job?.language ?? 'PT',
      description: job?.description ?? '',
      createdAt: job?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString()
    } as LinkedInJobRecord;
  }

  // -----------------------
  // Session / navigation helpers
  // -----------------------
  private async prepareSession(sessionManager: LinkedInSessionManager, sessionIdForProfile: string, storageState: any) {
    let context: BrowserContext;
    let page: Page;
    try {
      const restored = await sessionManager.restoreAuthenticatedSession(this.browserManager).catch(() => null);
      if (restored) {
        context = restored.context;
        page = restored.page;
        try { page.setDefaultTimeout(30000); page.setDefaultNavigationTimeout(45000); } catch {}
        console.info('[SCRAPER] Reutilizando sessão restaurada');
        return { context, page };
      }

      context = await this.browserManager.getContext(sessionIdForProfile, {}, isValidStorageState(storageState) ? storageState : undefined);
      page = await context.newPage();
      try { page.setDefaultTimeout(30000); page.setDefaultNavigationTimeout(45000); } catch {}
      console.info(`[SCRAPER] Contexto criado para profile ${sessionIdForProfile}`);
      const bootstrap = await sessionManager.bootstrapLogin(this.browserManager).catch(() => null);
      if (bootstrap && bootstrap.context && bootstrap.page) {
        try { await context.close(); } catch {}
        context = bootstrap.context;
        page = bootstrap.page;
        try { page.setDefaultTimeout(30000); page.setDefaultNavigationTimeout(45000); } catch {}
        console.info('[SCRAPER] Substituído contexto/page pelo resultado do bootstrap (login realizado)');
      }
      return { context, page };
    } catch (err) {
      console.warn('[SCRAPER] Falha ao preparar contexto, criando contexto limpo', err);
      context = await this.browserManager.getContext(sessionIdForProfile, {}, isValidStorageState(storageState) ? storageState : undefined);
      page = await context.newPage();
      return { context, page };
    }
  }

  private maybeWarnSessionRotation(rotationService: SessionRotationService, sessionIdForProfile: string) {
    try {
      const healthStatus = rotationService.evaluate(sessionIdForProfile, []);
      if (rotationService.shouldRotate(healthStatus)) {
        console.warn('⚠️ [SessionRotation] Sessão com baixa saúde detectada. Recomendado re-autenticar.');
      }
    } catch (e) {
      console.warn('[SCRAPER] Falha ao avaliar saúde da sessão:', e);
    }
  }

  private async ensureOnJobsPage(page: Page) {
    try {
      const currentUrl = page.url();
      if (currentUrl.includes('/feed')) {
        await page.goto('https://www.linkedin.com/jobs/', { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
        await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
      }
    } catch {
      // non-fatal
    }
  }

  // -----------------------
  // Core job processing
  // -----------------------
  private async processJob(
    job: LinkedInJobRecord,
    index: number,
    total: number,
    page: Page,
    context: BrowserContext,
    options: LinkedInSearchOptions & { processedJobIds?: string[] },
    autoApplyEnabled: boolean,
    result: ScrapeResult
  ) {
    // garantia: sempre empurrar pelo menos um registro para result.jobs
    let pushedToResult = false;
      const pushJob = (j: any) => {
        try {
          const normalized = this.normalizeForPersistence(j, options.profileName);
          result.jobs.push(normalized);
        } catch (e) {
          console.error('[SCRAPER] Falha ao normalizar e empurrar job', e);
        } finally {
          pushedToResult = true;
        }
      };
    
    console.info(`\n🔎 Vaga [${index + 1}/${total}]: ${job.title} (${job.id})`);
    await utilRandomDelay(1000, 2500);

    try {
      if (await page.isClosed()) {
        page = await context.newPage();
        await page.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => {});
      }

      // Antes de pular automaticamente, revalida na página da vaga
      if (!job.easyApply) {
        try {
          // abre em nova aba temporária para checar Easy Apply
          const checkPage = await context.newPage();
          try { checkPage.setDefaultTimeout(30000); } catch {}
          await checkPage.goto(job.url, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
          await checkPage.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
          await this.dismissOverlays(checkPage).catch(() => {});
          // usa a mesma lógica do PlaywrightUi.findEasyApply
          const applyBtn = await this.applyService['ui'].findEasyApply(checkPage).catch(() => null);
          if (applyBtn) {
            // encontrou Easy Apply na página — prosseguir com fluxo normal de apply
            await checkPage.close().catch(() => {});
            // não pular; continue o processamento normal abaixo
          } else {
            // realmente não tem Easy Apply — manter comportamento de skip
            await checkPage.close().catch(() => {});
            const skippedJob: LinkedInJobRecord = {
              ...job,
              profileName: options.profileName,
              description: job.description || '',
              modality: this.modalityDetector.detect(`${job.location || job.modality || ''} ${job.description || ''}`) as 'Remoto' | 'Presencial' | 'Híbrido',
              status: 'rejected',
              applyResult: {
                status: 'skipped',
                details: 'Vaga sem Easy Apply; não processada automaticamente.',
                skippedBy: 'system',
                reasonCode: 'no_easy_apply'
              } as ApplyResult,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };
            pushJob(skippedJob);
            return;
          }
        } catch (err) {
          // se falhar ao validar, seguir com skip conservador
          console.warn('[SCRAPER] Falha ao revalidar Easy Apply na página da vaga, pulando por segurança', err);
          const skippedJob: LinkedInJobRecord = {
            ...job,
            profileName: options.profileName,
            description: job.description || '',
            modality: this.modalityDetector.detect(`${job.location || job.modality || ''} ${job.description || ''}`) as 'Remoto' | 'Presencial' | 'Híbrido',
            status: 'rejected',
            applyResult: {
              status: 'skipped',
              details: 'Vaga sem Easy Apply; não processada automaticamente (revalidação falhou).',
              skippedBy: 'system',
              reasonCode: 'no_easy_apply'
            } as ApplyResult,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          pushJob(skippedJob);
          return;
        }
      }

      // extract description (may open standalone page if needed)
      const fullDescription = await this.extractJobData(page, context, job);

      // detect modality using description/location/modality hints (single-string input to detector)
      const modality = this.modalityDetector.detect(`${job.location || job.modality || ''} ${fullDescription || ''}`) as 'Remoto' | 'Presencial' | 'Híbrido';

      // early prefilter (avoid LLM when possible)
      let preFilterResult: PreFilterResult | null = null;
      try {
        preFilterResult = this.preFilterService.evaluate({
          title: job.title,
          description: fullDescription,
          location: job.location,
          profile: options.profile
        } as any) as PreFilterResult;
      } catch (pfErr) {
        console.warn('[SCRAPER] preFilterService.evaluate falhou, delegando ao scoring', pfErr);
        preFilterResult = null;
      }

      if (preFilterResult && preFilterResult.action === 'reject') {
        const rejectedJob = this.buildRejectedJob(job, options.profileName, modality, 'prefilter_reject', preFilterResult.reason || 'Rejeitado pelo pré-filtro', { matchedKeywords: preFilterResult.matchedKeywords || [] });
        pushJob(rejectedJob);
        return;
      }

      // --- Prepare LLM input and call scoring (scoring may be slow)
      const scoringInput = {
        title: job.title,
        description: fullDescription,
        location: job.location,
        profile: options.profile
      } as any;

      // Call scoring with timeout (scoring pipeline already has internal timeout/caching)
      let evaluation: ScoringResult;
      try {
        const evaluationPromise = this.scoring.evaluate(scoringInput);
        evaluation = await Promise.race([
          evaluationPromise,
          new Promise<ScoringResult>((_, rej) => setTimeout(() => rej(new Error('SCORING_TIMEOUT')), Number(process.env.SCORING_TIMEOUT_MS ?? 600000)))
        ]) as ScoringResult;
      } catch (err) {
        // Structured fallback: mark for manual review with structured evidence
        console.warn('[ScoringPipeline] LLM call failed or timed out:', String(err));
        const pendingJob: LinkedInJobRecord = {
          ...job,
          profileName: options.profileName,
          description: fullDescription,
          modality,
          score: 0,
          status: 'pending_review',
          aiReason: 'LLM timeout ou erro; encaminhado para revisão manual.',
          aiMetadata: {
            llmFallback: true,
            error: {
              message: String(err),
              code: (err && (err as Error).message === 'SCORING_TIMEOUT') ? 'SCORING_TIMEOUT' : 'SCORING_ERROR',
              errorBy: 'llm'
            }
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        const manualReview = this.buildManualReview(
          pendingJob,
          options.profileName,
          `LLM error; code: ${pendingJob.aiMetadata.error.code}; message: ${pendingJob.aiMetadata.error.message}`,
          `URL: ${pendingJob.url}; aiMetadata: ${JSON.stringify(pendingJob.aiMetadata)}`
        );
        pushJob(pendingJob);
        result.manualReviews.push(manualReview);
        return;
      }

      const minScore = options.profile?.minScore ?? Number(process.env.MIN_SCORE_DEFAULT ?? 60);

      // Build normalized job and attach scoring metadata + structured scoring error if present
      const normalizedJob: LinkedInJobRecord = {
        ...job,
        profileName: options.profileName,
        description: fullDescription,
        modality,
        score: evaluation.score,
        status: 'found',
        aiReason: evaluation.reason,
        aiMetadata: sanitizeMetadata(evaluation.metadata),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Attach structured scoring error if present (llmError / preFilterError / evaluation.error)
      const scoringError = (evaluation as any).error ?? evaluation.metadata?.llmError ?? evaluation.metadata?.preFilterError;
      if (scoringError) {
        normalizedJob.aiMetadata = { ...normalizedJob.aiMetadata, scoringError };
      }

      // If LLM signaled fallback (timeout/repair), prefer manual review instead of automatic reject
      const llmRaw = evaluation.metadata?.llmRaw ?? evaluation.metadata?.llmRawSafe ?? null;
      const llmFallbackFlag = Boolean(evaluation.metadata?.llmFallback || (llmRaw && (llmRaw as any).llmFallback));

      if (llmFallbackFlag) {
        normalizedJob.status = 'pending_review';
        normalizedJob.applyResult = {
          status: 'error',
          details: 'LLM fallback/timeout — revisão manual recomendada.',
          rejectedBy: 'llm',
          reasonCode: 'llm_fallback',
          metadata: { llmRaw: llmRaw }
        } as ApplyResult;
        pushJob(normalizedJob);
        result.manualReviews.push(this.buildManualReview(normalizedJob, options.profileName, 'LLM fallback/timeout', `score: ${evaluation.score}; reason: ${evaluation.reason}`));
        return;
      }

      // routing decisions based on scoring
      const score = Number(evaluation.score);
      const scoringRejected = !evaluation.approved;
      const belowThreshold = !Number.isFinite(score) || score < minScore;

      /**
       * Score abaixo do threshold sempre é rejeição.
       * approved=false não transforma score baixo em manual review.
       */
      if (belowThreshold) {
        normalizedJob.status = 'rejected';

        normalizedJob.applyResult = {
          status: 'skipped',
          details: `Rejeitada automaticamente por score abaixo do threshold (${score} < ${minScore}).`,
          skippedBy: 'scoring',
          reasonCode: 'SCORE_BELOW_MIN',
          metadata: {
            llmScore: score,
            minScore,
            scoring: evaluation,
          },
        } as ApplyResult;

        pushJob(normalizedJob);
        return;
      }

      /**
       * A partir daqui o score já é >= minScore.
       * Só então approved=false pode justificar revisão manual.
       */
      if (scoringRejected) {
        const scoringErrorLocal =
          (evaluation as any).error ??
          evaluation.metadata?.llmError ??
          evaluation.metadata?.preFilterError;

        if (scoringErrorLocal?.errorBy === 'llm') {
          normalizedJob.status = 'pending_review';

          normalizedJob.applyResult = {
            status: 'error',
            details: `Scoring error: ${scoringErrorLocal.message}`,
            rejectedBy: scoringErrorLocal.errorBy,
            reasonCode: scoringErrorLocal.code || 'SCORING_ERROR',
            metadata: {
              scoringError: scoringErrorLocal,
              scoring: evaluation,
            },
          } as ApplyResult;

          pushJob(normalizedJob);

          result.manualReviews.push(
            this.buildManualReview(
              normalizedJob,
              options.profileName,
              `Scoring error: ${scoringErrorLocal.code}`,
              `scoringError: ${safeSerialize(scoringErrorLocal, 1000)}`
            )
          );

          return;
        }

        this.routeRejected(
          normalizedJob,
          evaluation,
          evaluation.metadata?.preFilterAction ?? 'accept',
          result,
          minScore
        );

        return;
      }

      // approved by scoring and above threshold -> attempt apply if configured
      if (!autoApplyEnabled || !job.easyApply || !this.applyService) {
        normalizedJob.applyResult = {
          status: 'skipped',
          details: `Auto-apply desligado ou vaga sem EasyApply`,
          skippedBy: 'system',
          reasonCode: !autoApplyEnabled ? 'auto_apply_disabled' : 'no_easy_apply'
        } as ApplyResult;
        pushJob(normalizedJob);
        return;
      }

      // Pre-apply stabilization on main page (best-effort)
      try {
        await this.dismissOverlays(page);
        await page.waitForTimeout(400);
        if (await page.isClosed()) {
          page = await context.newPage();
          await page.waitForLoadState('networkidle').catch(() => {});
        }
      } catch (preApplyErr) {
        console.warn('[SCRAPER] Falha ao tentar dismiss overlays antes do apply', preApplyErr);
      }

      // --- APPLY: always use isolated page to avoid overlay interference
      let applyPage: Page | null = null;
      try {
        applyPage = await context.newPage();
        try { applyPage.setDefaultTimeout(30000); } catch {}
        await applyPage.goto(normalizedJob.url, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
        await applyPage.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
        await this.dismissOverlays(applyPage);

        const applyResult = await this.applyService.applyToJob(applyPage, context, normalizedJob.url).catch(err => {
          console.error('[SCRAPER] applyToJob lançou erro não tratado', err);
          return {
            status: 'error',
            details: String(err),
            rejectedBy: 'apply',
            reasonCode: 'apply_error',
            metadata: { lastError: String(err) }
          } as ApplyResult;
        });

        // Ensure evidence exists
        applyResult.metadata = applyResult.metadata || {};
        if (!applyResult.metadata.screenshotPath) {
          applyResult.metadata.screenshotPath = await this.takeDebugScreenshot(applyPage, `apply-${normalizedJob.id}`);
        }
        if (!applyResult.metadata.pageHtmlSnippet) {
          applyResult.metadata.pageHtmlSnippet = await this.safePageContentSnippet(applyPage);
        }

        const jobAfterApply: LinkedInJobRecord = {
          ...normalizedJob,
          status: applyResult.status === 'submitted' ? 'applied' : normalizedJob.status,
          applyResult
        };

        // Route based on applyResult
        if (applyResult.status === 'submitted') {
          pushJob(jobAfterApply);
          result.applications.push({
            jobId: jobAfterApply.id,
            status: 'submitted',
            result: applyResult,
            appliedAt: new Date().toISOString()
          });
        } else if (LinkedInScraperService.APPLY_FAILURE_STATUSES.has(applyResult.status)) {
          // falha real no fluxo de apply -> enviar para revisão manual com evidências
          jobAfterApply.status = 'pending_review';
          jobAfterApply.applyResult = applyResult;
          pushJob(jobAfterApply);

          const manualReview = this.buildManualReview(
            jobAfterApply,
            options.profileName,
            `Apply failure: ${applyResult.status}; reasonCode: ${applyResult.reasonCode || 'n/a'}; details: ${applyResult.details || 'n/a'}`,
            `screenshot: ${applyResult.metadata?.screenshotPath || 'n/a'}; pageSnippet: ${applyResult.metadata?.pageHtmlSnippet || 'n/a'}`
          );
          result.manualReviews.push(manualReview);
        } else {
          // outros casos (no_easy_apply, skipped, etc) -> rejeitar/registrar como skipped
          jobAfterApply.status = 'rejected';
          jobAfterApply.applyResult = {
            ...applyResult,
            rejectedBy: applyResult.status === 'no_easy_apply' ? 'apply' : applyResult.rejectedBy ?? 'apply',
            reasonCode: applyResult.reasonCode ?? 'apply_non_submitted'
          } as ApplyResult;
          pushJob(jobAfterApply);
        }
      } finally {
        if (applyPage && !applyPage.isClosed()) {
          try { await applyPage.close(); } catch {}
        }
      }
    } catch (error: any) {
      console.error(`🚨 Erro crítico no processamento da vaga ${job.id}:`, error?.message ?? error);
      const errorJob: LinkedInJobRecord = {
        ...job,
        profileName: options.profileName,
        status: 'error',
        applyResult: { status: 'error', details: `Crash na esteira: ${error?.message ?? String(error)}`, rejectedBy: 'system', reasonCode: 'pipeline_crash' } as ApplyResult,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      pushJob(errorJob);
    }
  }

  // -----------------------
  // Routing / builders
  // -----------------------
  private routeRejected(
    normalizedJob: LinkedInJobRecord,
    evaluation: ScoringResult,
    preFilterAction: string,
    result: ScrapeResult,
    minScore: number,
  ): void {
    const score = Number(evaluation.score);

    const preFilterDecision =
      evaluation.metadata?.preFilterAction ?? preFilterAction;

    /**
     * 1. Hard reject do pré-filtro sempre vence.
     */
    if (preFilterDecision === 'reject') {
      normalizedJob.status = 'rejected';

      normalizedJob.applyResult = {
        status: 'error',
        details: `Veto do pré-filtro: ${evaluation.reason}`,
        rejectedBy: 'prefilter',
        reasonCode: 'PREFILTER_REJECT',
        metadata: {
          scoring: evaluation,
        },
      } as ApplyResult;

      result.jobs.push(normalizedJob);
      return;
    }

    /**
     * 2. Score inválido ou abaixo do threshold:
     *    nunca enviar para manual review.
     *
     *    Manual review não deve funcionar como depósito
     *    de avaliações rejeitadas pela IA.
     */
    if (!Number.isFinite(score) || score < minScore) {
      normalizedJob.status = 'rejected';

      normalizedJob.applyResult = {
        status: 'skipped',
        details: `Rejeitada automaticamente por score abaixo do threshold (${score} < ${minScore}).`,
        skippedBy: 'scoring',
        reasonCode: 'SCORE_BELOW_MIN',
        metadata: {
          llmScore: score,
          minScore,
          preFilterAction: preFilterDecision,
          scoring: evaluation,
        },
      } as ApplyResult;

      result.jobs.push(normalizedJob);
      return;
    }

    /**
     * 3. Soft reject acima do threshold:
     *    candidato legítimo para revisão humana.
     */
    if (preFilterDecision === 'soft_reject') {
      normalizedJob.status = 'pending_review';

      normalizedJob.applyResult = {
        status: 'skipped',
        details: `Encaminhada para revisão manual por soft reject com score ${score}.`,
        skippedBy: 'prefilter_or_scoring',
        reasonCode: 'SOFT_REJECT_ABOVE_MIN',
        metadata: {
          llmScore: score,
          minScore,
          preFilterAction: preFilterDecision,
          preFilterReason: evaluation.metadata?.preFilterReason,
          scoring: evaluation,
        },
      } as ApplyResult;

      result.jobs.push(normalizedJob);

      result.manualReviews.push(
        this.buildManualReview(
          normalizedJob,
          normalizedJob.profileName,
          `Soft reject com score ${score} acima do threshold ${minScore}.`,
          `URL da vaga: ${normalizedJob.url}; scoring: ${safeSerialize(evaluation, 1000)}`
        )
      );

      return;
    }

    /**
     * 4. IA rejeitou, mas o score está acima do threshold.
     *    Esse é exatamente o caso que merece revisão humana.
     */
    normalizedJob.status = 'pending_review';

    normalizedJob.applyResult = {
      status: 'skipped',
      details: `Rejeitada pela IA apesar de score ${score} >= ${minScore}; encaminhada para revisão manual.`,
      skippedBy: 'scoring',
      reasonCode: 'REJECTED_ABOVE_MIN',
      metadata: {
        llmScore: score,
        minScore,
        scoring: evaluation,
      },
    } as ApplyResult;

    result.jobs.push(normalizedJob);

    result.manualReviews.push(
      this.buildManualReview(
        normalizedJob,
        normalizedJob.profileName,
        `Rejeição da IA com score ${score} acima do threshold ${minScore}.`,
        `URL da vaga: ${normalizedJob.url}; scoring: ${safeSerialize(evaluation, 1000)}`
      )
    );
  }

  private buildRejectedJob(job: LinkedInJobRecord, profileName: string, modality: 'Remoto' | 'Presencial' | 'Híbrido', reasonCode: string, details: string, metadata: any): LinkedInJobRecord {
    return {
      ...job,
      profileName,
      modality,
      status: 'rejected',
      aiReason: details,
      applyResult: {
        status: 'error',
        details,
        rejectedBy: 'prefilter',
        reasonCode,
        metadata: safeSerialize(metadata, 1000)
      } as ApplyResult,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  private buildManualReview(job: LinkedInJobRecord, profileName: string, reason: string, notes: string) {
    return {
      id: crypto.randomUUID(),
      jobId: job.id,
      profile: profileName,
      reviewStatus: 'pending' as const,
      reviewReason: reason,
      reviewNotes: notes,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  // -----------------------
  // Page extraction helpers
  // -----------------------
  private async extractJobData(page: Page, context: BrowserContext, job: any): Promise<string> {
    await this.dismissOverlays(page);

    const jobCardSelector = `[data-job-id="${job.id}"], [data-occludable-job-id="${job.id}"]`;
    let description = '';

    try {
      const cardExists = await page.$(jobCardSelector).catch(() => null);
      if (cardExists) {
        try {
          await cardExists.scrollIntoViewIfNeeded();
          const clickableElement = await cardExists.$('.job-card-list__title, .job-card-container__link').catch(() => cardExists);
          await (clickableElement || cardExists).click({ timeout: 3000 }).catch(async () => {
            await page.evaluate((el) => (el as HTMLElement).click(), cardExists);
          });

          await page.waitForFunction(
            (jobId) => window.location.href.includes(jobId) || !!document.querySelector('.jobs-search__job-details'),
            job.id,
            { timeout: 7000 }
          ).catch(() => {});

          const selectorString = this.DESC_SELECTORS.join(', ');
          await page.waitForSelector(selectorString, { state: 'attached', timeout: 9000 }).catch(() => {});
          await utilRandomDelay(800, 1500);

          await this.clickSeeMore(page);
          description = await this.scrapeDomText(page);
        } catch (e) {
          console.warn(`[Aviso] Painel lateral inacessível para vaga ${job.id}. Acionando fallback em nova aba...`, e);
        }
      }
    } catch (e) {
      console.warn('[extractJobData] erro ao verificar card existente', e);
    }

    if (!description || description.length < 50) {
      description = await this.extractFromStandalonePage(context, job.url, job.id);
    }

    return description || job.description || '';
  }

  private async extractFromStandalonePage(context: BrowserContext, url: string, jobId: string): Promise<string> {
    let jobPage: Page | null = null;
    try {
      jobPage = await context.newPage();
      await jobPage.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
      await jobPage.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
      const selectorString = this.DESC_SELECTORS.join(', ');
      await jobPage.waitForSelector(selectorString, { state: 'attached', timeout: 9000 }).catch(() => {});
      await utilRandomDelay(500, 1000);
      await this.clickSeeMore(jobPage);
      return await this.scrapeDomText(jobPage);
    } catch (e) {
      console.warn(`[Erro Tolerado] Timeout ou falha ao abrir página standalone da vaga ${jobId}.`, e);
      if (jobPage && !jobPage.isClosed()) {
        return await this.scrapeDomText(jobPage).catch(() => '');
      }
      return '';
    } finally {
      if (jobPage && !jobPage.isClosed()) {
        try { await jobPage.close(); } catch {}
      }
    }
  }

  private async scrapeDomText(targetPage: Page): Promise<string> {
    return await targetPage.evaluate((selectors) => {
      for (const sel of selectors) {
        const element = document.querySelector(sel);
        if (element && element.textContent && element.textContent.trim().length > 50) {
          const clone = element.cloneNode(true) as HTMLElement;
          const companyBox = clone.querySelector('.jobs-company__box, .jobs-unified-top-card');
          if (companyBox) companyBox.remove();
          return clone.textContent?.replace(/\s+/g, ' ').trim() || '';
        }
      }
      return '';
    }, this.DESC_SELECTORS);
  }

  private async clickSeeMore(page: Page): Promise<void> {
    const btnLocators = [
      'button[aria-label*="see more"]',
      'button[aria-label*="Ver mais"]',
      '.show-more-less-html__button',
      '.jobs-description__footer-button',
      'button:has-text("See more")',
      'button:has-text("Ver mais")'
    ];
    for (const sel of btnLocators) {
      try {
        const btn = await page.$(sel);
        if (btn) {
          await btn.click().catch(() => {});
          await page.waitForTimeout(200).catch(() => {});
        }
      } catch { /* ignore */ }
    }
  }

  private async dismissOverlays(page: Page): Promise<void> {
    try {
      const overlays = [
        '[data-test-modal-close-btn]',
        '.artdeco-modal__dismiss',
        '.msg-overlay-bubble-header__control',
        '.msg-overlay-bubble-header__control--close-btn',
        'button[aria-label*="Dismiss"]',
        'button[aria-label*="Fechar"]'
      ];
      for (const sel of overlays) {
        try {
          const el = await page.$(sel);
          if (el) await el.click().catch(() => {});
        } catch { /* ignore */ }
      }
      await page.waitForTimeout(300).catch(() => {});
    } catch { /* ignore */ }
  }

  // -----------------------
  // Utilities for evidence capture
  // -----------------------
  private async safePageContentSnippet(page: Page): Promise<string> {
    try {
      const html = await page.content();
      if (!html) return '<no-content>';
      const cleaned = html.replace(/\s+/g, ' ').trim();
      return cleaned.length > 5000 ? cleaned.slice(0, 5000) + '...[truncated]' : cleaned;
    } catch {
      return '<no-content-failed-extract>';
    }
  }

  private async takeDebugScreenshot(page: Page, prefix: string): Promise<string | null> {
    try {
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = path.join(process.env.APPLY_DEBUG_DIR ?? './apply-debug', `${prefix}_${ts}.png`);
      await page.screenshot({ path: filename, fullPage: true, timeout: 2500 }).catch(() => {});
      return filename;
    } catch {
      return null;
    }
  }
}

/* -----------------------
   Helpers (local)
   ----------------------- */

/**
 * Very small sanitizer that preserves structured error fields we rely on:
 * - llmError, preFilterError, scoringError
 * - keeps other metadata but avoids circular references
 */
function sanitizeMetadata(meta: any) {
  if (!meta) return {};
  const safe: any = {};
  for (const k of Object.keys(meta)) {
    try {
      const v = meta[k];
      if (v === null || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
        safe[k] = v;
        continue;
      }

      if (k === 'llmRaw') {
        safe[k] = safeSerialize(v, 1500);
        continue;
      }

      if (k === 'llmRawSafe' || k === 'scoreBreakdown' || k === 'classification' || k === 'matchedSkills' || k === 'missingSkills') {
        try {
          safe[k] = JSON.parse(JSON.stringify(v));
          continue;
        } catch {
          safe[k] = safeSerialize(v, 1500);
          continue;
        }
      }

      if (k === 'llmFallback' || k === 'preFilterAction' || k === 'preFilterReason' || k === 'llmError' || k === 'preFilterError' || k === 'scoringError') {
        safe[k] = v;
        continue;
      }

      try {
        safe[k] = JSON.parse(JSON.stringify(v));
      } catch {
        safe[k] = safeSerialize(v, 1000);
      }
    } catch {
      // ignore problematic keys
    }
  }
  return safe;
}

/**
 * Validate storageState shape (best-effort)
 */
function isValidStorageState(s: any): boolean {
  try {
    return !!(s && (s.cookies || s.origins));
  } catch {
    return false;
  }
}
