// packages/engine/src/linkedinScraperService.ts
import crypto from 'crypto';
import type { BrowserContext, Page } from 'playwright';
import { BrowserManager } from './browser/browserManager';
import { SessionRotationService } from './sessionRotation/SessionRotationService';
import { searchLinkedInJobs } from './search';
import { LinkedInApplyService } from './apply';
import type { LinkedInJobRecord, LinkedInSearchOptions, ScrapeResult } from './types/types';
import type { ApplyResult } from '@autojobs/shared';
import { normalize } from '@autojobs/shared';
import { ModalityDetector, randomDelay as utilRandomDelay } from './utils';
import { LinkedInSessionManager } from './sessionManager';
import { ScoringPipeline, ScoringResult } from '@autojobs/scoring';



function sanitizeMetadata(metadata: any): any {
  if (!metadata) return {};
  try {
    return JSON.parse(
      JSON.stringify(metadata, (key, value) => {
        if (['request', 'response', 'messages', 'prompt'].includes(key)) return undefined;
        return value;
      })
    );
  } catch {
    return { info: 'Metadata indisponível ou não serializável' };
  }
}

function isValidStorageState(obj: any): obj is { cookies: any[]; origins: any[] } {
  return obj && Array.isArray(obj.cookies) && Array.isArray(obj.origins);
}

/**
 * LinkedInScraperService
 * - Orquestra: busca vagas, deduplica, extrai descrição, chama scoring, roteia para apply/review.
 * - Mantém responsabilidades mínimas; regras de negócio ficam em PreFilter/Scoring/Apply services.
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

  constructor(
    private headless = true,
    private applyService = new LinkedInApplyService(),
    private scoring = new ScoringPipeline(),
    private modalityDetector = new ModalityDetector(),
    private concurrency = Number(process.env.SCRAPER_CONCURRENCY ?? 2)
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
          try { await context.close(); } catch {}
          const ctx = await this.browserManager.getContext(sessionIdForProfile, {}, isValidStorageState(options.storageState) ? options.storageState : undefined);
          const p = await ctx.newPage();
          jobs = await searchLinkedInJobs(p, options);
        } catch (reErr) {
          console.error('[SCRAPER] Falha ao recuperar contexto e reexecutar searchLinkedInJobs', reErr);
          throw reErr;
        }
      }

      console.info(`🔍 Encontradas ${jobs.length} vagas para a query "${options.query}". Iniciando validação...`);

      // Process jobs in batches to respect concurrency without external libs
      for (let i = 0; i < jobs.length; i += this.concurrency) {
        const batch = jobs.slice(i, i + this.concurrency);
        await Promise.all(batch.map((job, idx) =>
          this.processJob(job, i + idx, jobs.length, page, context, options, autoApplyEnabled, result)
        ));
      }
    } finally {
      // lifecycle do browser é gerenciado por BrowserManager; não fechamos contextos aqui
    }

    return result;
  }

  // -----------------------
  // Core helpers
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
    // Dedup
    if (options.processedJobIds && options.processedJobIds.includes(job.id)) {
      console.info(`⏩ [Dedup] Vaga ${job.id} já processada. Ignorando.`);
      return;
    }

    console.info(`\n🔎 Vaga [${index + 1}/${total}]: ${job.title} (${job.id})`);
    await utilRandomDelay(1000, 2500);

    try {
      if (await page.isClosed()) {
        page = await context.newPage();
        await page.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => {});
      }

      // modality detection delegated; ensure typed modality matches LinkedInJobRecord.modality union
      const modality = this.modalityDetector.detect(job.location || job.modality || '') as 'Remoto' | 'Presencial' | 'Híbrido';

      // geolocation check delegated to helper
      if (!this.isAllowedLocation(modality, job.location || '', options.profile.hybridCities)) {
        const rejectedJob: LinkedInJobRecord = this.buildRejectedJob(job, options.profileName, modality, 'hybrid_state_mismatch', `Geolocalização incompatível: ${modality} em ${job.location}`, { allowedHybridCities: options.profile.hybridCities || [] });
        result.jobs.push(rejectedJob);
        return;
      }

      // extract description
      const fullDescription = await this.extractJobData(page, context, job);

      // scoring (prefilter + LLM + score)
      const evaluationPromise = this.scoring.evaluate({
        title: job.title,
        description: fullDescription,
        location: job.location,
        profile: options.profile
      } as any);

      const evaluation: ScoringResult = await Promise.race([
        evaluationPromise,
        new Promise<ScoringResult>((_, rej) => setTimeout(() => rej(new Error('SCORING_TIMEOUT')), Number(process.env.SCORING_TIMEOUT_MS ?? 300000)))
      ]) as ScoringResult;

      const minScore = options.profile.minScore ?? Number(process.env.MIN_SCORE_DEFAULT ?? 75);

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

      const preFilterAction = evaluation.metadata?.preFilterAction ?? 'accept';

      // routing decisions
      if (!evaluation.approved || evaluation.score < minScore) {
        this.routeRejected(normalizedJob, evaluation, preFilterAction, result);
        return;
      }

      // approved by scoring -> attempt apply if configured
      if (!autoApplyEnabled || !job.easyApply || !this.applyService) {
        normalizedJob.applyResult = {
          status: 'skipped',
          details: `Auto-apply desligado ou vaga sem EasyApply`,
          skippedBy: 'system',
          reasonCode: !autoApplyEnabled ? 'auto_apply_disabled' : 'no_easy_apply'
        } as ApplyResult;
        result.jobs.push(normalizedJob);
        return;
      }

      // pre-apply stabilization
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

      // apply
      const applyResult = await this.applyService.applyToJob(page, context, normalizedJob.url).catch(err => {
        console.error('[SCRAPER] applyToJob lançou erro não tratado', err);
        return {
          status: 'error',
          details: String(err),
          rejectedBy: 'apply',
          reasonCode: 'apply_error'
        } as ApplyResult;
      });

      const jobAfterApply: LinkedInJobRecord = {
        ...normalizedJob,
        status: applyResult.status === 'submitted' ? 'applied' : normalizedJob.status,
        applyResult
      };

      result.jobs.push(jobAfterApply);

      if (applyResult.status === 'submitted') {
        result.applications.push({
          jobId: jobAfterApply.id,
          status: 'submitted',
          result: applyResult,
          appliedAt: new Date().toISOString()
        });
      } else if (applyResult.status === 'complex_form' || applyResult.status === 'no_easy_apply') {
        const manualReview = {
          id: crypto.randomUUID(),
          jobId: jobAfterApply.id,
          profile: options.profileName,
          reviewStatus: 'pending' as const,
          reviewReason: `Apply flow result: ${applyResult.status}; reasonCode: ${applyResult.reasonCode || 'n/a'}`,
          reviewNotes: `applyResult.details: ${applyResult.details || ''}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        result.manualReviews.push(manualReview);
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
      result.jobs.push(errorJob);
    }
  }

  // -----------------------
  // Routing / builders
  // -----------------------

  private routeRejected(normalizedJob: LinkedInJobRecord, evaluation: ScoringResult, preFilterAction: string, result: ScrapeResult) {
    if (evaluation.score === 0) {
      normalizedJob.status = 'rejected';
      normalizedJob.applyResult = {
        status: 'error',
        details: `Veto absoluto da IA: ${evaluation.reason}`,
        rejectedBy: 'llm',
        reasonCode: 'llm_hard_reject',
        metadata: { llmScore: evaluation.score }
      } as ApplyResult;
      result.jobs.push(normalizedJob);
      return;
    }

    if (preFilterAction === 'soft_reject') {
      normalizedJob.status = 'pending_review';
      normalizedJob.applyResult = {
        status: 'skipped',
        details: `Pendente de revisão manual. Motivo: ${evaluation.reason}`,
        skippedBy: 'prefilter_or_llm',
        reasonCode: 'soft_reject',
        metadata: { preFilterAction, llmScore: evaluation.score, preFilterReason: evaluation.metadata?.preFilterReason }
      } as ApplyResult;

      const manualReview = {
        id: crypto.randomUUID(),
        jobId: normalizedJob.id,
        profile: normalizedJob.profileName,
        reviewStatus: 'pending' as const,
        reviewReason: `Pré-filtro soft_reject; LLM score ${evaluation.score}; reason: ${evaluation.reason}`,
        reviewNotes: `URL da vaga: ${normalizedJob.url}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      result.jobs.push(normalizedJob);
      result.manualReviews.push(manualReview);
      return;
    }

    normalizedJob.status = 'rejected';
    normalizedJob.applyResult = {
      status: 'error',
      details: `Descartado pela IA (score baixo): ${evaluation.reason}`,
      rejectedBy: 'llm',
      reasonCode: 'llm_reject',
      metadata: { llmScore: evaluation.score }
    } as ApplyResult;
    result.jobs.push(normalizedJob);
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
        metadata
      } as ApplyResult,
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
        '.msg-overlay-bubble-header__control'
      ];
      for (const sel of overlays) {
        try {
          const el = await page.$(sel);
          if (el) await el.click().catch(() => {});
        } catch { /* ignore */ }
      }
    } catch { /* ignore */ }
  }

  // -----------------------
  // Utility
  // -----------------------

  private isAllowedLocation(modality: string, location: string, allowedStates?: string[] | null): boolean {
    try {
      const mod = normalize(modality || '');
      if (mod.includes('remoto') || mod.includes('remote')) return true;
      if (!allowedStates || allowedStates.length === 0) return true;

      const parts = (location || '').split(',').map(p => p.trim()).filter(Boolean);
      const state = parts[1] ? normalize(parts[1]) : '';
      if (!state) return true;

      const configured = allowedStates.map(s => normalize(s));
      return configured.includes(state);
    } catch (error) {
      console.warn('[Filtro Geográfico] Erro ao validar estado. Liberando vaga.', error);
      return true;
    }
  }
}
