// LinkedInScraperService.ts
import crypto from 'crypto';
import type { BrowserContext, Page } from 'playwright';
import { BrowserManager } from './browser/browserManager';
import { SessionRotationService } from './sessionRotation/SessionRotationService';
import { searchLinkedInJobs } from './search';
import { LinkedInApplyService } from './apply';
import type { LinkedInJobRecord, LinkedInSearchOptions } from './types/types';
import { normalize, type ApplyResult } from '@autojobs/shared';
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
    private modalityDetector = new ModalityDetector()
  ) {
    this.browserManager = BrowserManager.getInstance({ headless });
  }

  public async scrape(options: LinkedInSearchOptions & { processedJobIds?: string[] }) {
    const result = { jobs: [] as LinkedInJobRecord[], applications: [] as any[], manualReviews: [] as any[] };
    const sessionManager = new LinkedInSessionManager(options.storageState);
    const rotationService = new SessionRotationService();
    const sessionIdForProfile = `profile-${options.profileName}`;

    let context: BrowserContext;
    let page: Page;

    // --- Preparar contexto / sessão
    try {
      const restored = await sessionManager.restoreAuthenticatedSession(this.browserManager).catch(() => null);
      if (restored) {
        context = restored.context;
        page = restored.page;
        try { page.setDefaultTimeout(30000); page.setDefaultNavigationTimeout(45000); } catch {}
        console.info('[SCRAPER] Reutilizando sessão restaurada');
      } else {
        context = await this.browserManager.getContext(sessionIdForProfile, {}, isValidStorageState(options.storageState) ? options.storageState : undefined);
        page = await context.newPage();
        try { page.setDefaultTimeout(30000); page.setDefaultNavigationTimeout(45000); } catch {}
        console.info(`[SCRAPER] Contexto criado para profile ${options.profileName}`);
        const bootstrap = await sessionManager.bootstrapLogin(this.browserManager).catch(() => null);
        if (bootstrap && bootstrap.context && bootstrap.page) {
          try { await context.close(); } catch {}
          context = bootstrap.context;
          page = bootstrap.page;
          try { page.setDefaultTimeout(30000); page.setDefaultNavigationTimeout(45000); } catch {}
          console.info('[SCRAPER] Substituído contexto/page pelo resultado do bootstrap (login realizado)');
        }
      }
    } catch (err) {
      console.warn('[SCRAPER] Falha ao preparar contexto, tentando criar contexto limpo', err);
      context = await this.browserManager.getContext(sessionIdForProfile, {}, isValidStorageState(options.storageState) ? options.storageState : undefined);
      page = await context.newPage();
    }

    try {
      // Avalia rotação de sessão (melhor esforço)
      try {
        const healthStatus = rotationService.evaluate(sessionIdForProfile, []);
        if (rotationService.shouldRotate(healthStatus)) {
          console.warn('⚠️ [SessionRotation] Sessão com baixa saúde detectada. Recomendado re-autenticar.');
        }
      } catch (e) {
        console.warn('[SCRAPER] Falha ao avaliar saúde da sessão:', e);
      }

      // Garante estar na página de jobs
      try {
        const currentUrl = page.url();
        if (currentUrl.includes('/feed')) {
          await page.goto('https://www.linkedin.com/jobs/', { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
          await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
        }
      } catch { /* ignore */ }

      const autoApplyEnabled = process.env.LINKEDIN_AUTO_APPLY === 'true';
      const scoring = new ScoringPipeline();

      let jobs: LinkedInJobRecord[] = [];
      try {
        jobs = await searchLinkedInJobs(page, options);
      } catch (err) {
        console.warn('[SCRAPER] searchLinkedInJobs falhou, tentando recriar contexto e reexecutar', err);
        try {
          try { await context.close(); } catch {}
          context = await this.browserManager.getContext(sessionIdForProfile, {}, isValidStorageState(options.storageState) ? options.storageState : undefined);
          page = await context.newPage();
          try { page.setDefaultTimeout(30000); page.setDefaultNavigationTimeout(45000); } catch {}
          await page.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => {});
          jobs = await searchLinkedInJobs(page, options);
        } catch (reErr) {
          console.error('[SCRAPER] Falha ao recuperar contexto e reexecutar searchLinkedInJobs', reErr);
          throw reErr;
        }
      }

      console.info(`🔍 Encontradas ${jobs.length} vagas para a query "${options.query}". Iniciando validação...`);

      for (let i = 0; i < jobs.length; i++) {
        const job = jobs[i];

        // Deduplicação
        if (options.processedJobIds && options.processedJobIds.includes(job.id)) {
          console.info(`⏩ [Dedup] Vaga ${job.id} já processada. Ignorando.`);
          continue;
        }

        console.info(`\n🔎 Vaga [${i + 1}/${jobs.length}]: ${job.title} (${job.id})`);
        await utilRandomDelay(1000, 2500);

        try {
          if (await page.isClosed()) {
            page = await context.newPage();
            await page.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => {});
          }

          // Detecta modalidade via serviço dedicado
          const modality = this.modalityDetector.detect(job.location || job.modality || '');

          // Validação geográfica (delegada a função utilitária)
          if (!this.isAllowedLocation(modality, job.location || '', options.profile.hybridCities)) {
            const rejectedJob: LinkedInJobRecord = {
              ...job,
              profileName: options.profileName,
              modality,
              status: 'rejected',
              aiReason: `Geolocalização incompatível: ${modality} em ${job.location}`,
              applyResult: {
                status: 'error',
                details: `Geolocalização incompatível: ${job.location}`,
                rejectedBy: 'prefilter',
                reasonCode: 'hybrid_state_mismatch',
                metadata: { allowedHybridCities: options.profile.hybridCities || [] }
              } as ApplyResult,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };
            result.jobs.push(rejectedJob);
            continue;
          }

          // Extrai descrição completa
          const fullDescription = await this.extractJobData(page, context, job);

          // Avalia com pipeline de scoring (LLM)
          const evaluationPromise = scoring.evaluate({
            title: job.title,
            description: fullDescription,
            location: job.location,
            profile: options.profile
          } as any);

          const evaluation: ScoringResult = await Promise.race([
            evaluationPromise,
            new Promise<ScoringResult>((_, rej) => setTimeout(() => rej(new Error('SCORING_TIMEOUT')), 300000))
          ]) as ScoringResult;

          const minScore = options.profile.minScore ?? 75;
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

          // Roteamento por score / decisão LLM
          if (!evaluation.approved || evaluation.score < minScore) {
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
              continue;
            } else if (preFilterAction === 'soft_reject') {
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
                profile: options.profileName,
                reviewStatus: 'pending' as const,
                reviewReason: `Pré-filtro soft_reject; LLM score ${evaluation.score}; reason: ${evaluation.reason}`,
                reviewNotes: `URL da vaga: ${normalizedJob.url}`,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              };

              result.jobs.push(normalizedJob);
              result.manualReviews.push(manualReview);
              continue;
            } else {
              normalizedJob.status = 'rejected';
              normalizedJob.applyResult = {
                status: 'error',
                details: `Descartado pela IA (score baixo): ${evaluation.reason}`,
                rejectedBy: 'llm',
                reasonCode: 'llm_reject',
                metadata: { llmScore: evaluation.score }
              } as ApplyResult;
              result.jobs.push(normalizedJob);
              continue;
            }
          }

          // IA aprovou -> tenta aplicar se auto-apply habilitado e vaga com easyApply
          if (!autoApplyEnabled || !job.easyApply || !this.applyService) {
            normalizedJob.applyResult = {
              status: 'skipped',
              details: `Auto-apply desligado ou vaga sem EasyApply`,
              skippedBy: 'system',
              reasonCode: !autoApplyEnabled ? 'auto_apply_disabled' : 'no_easy_apply'
            } as ApplyResult;
            result.jobs.push(normalizedJob);
            continue;
          }

          // Pre-apply: estabiliza UI
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

          // --- Chamada correta para o serviço de apply (applyToJob)
          const applyResult = await this.applyService.applyToJob(page, context, normalizedJob.url).catch(err => {
            console.error('[SCRAPER] applyToJob lançou erro não tratado', err);
            return {
              status: 'error',
              details: String(err),
              rejectedBy: 'apply',
              reasonCode: 'apply_error'
            } as ApplyResult;
          });

          // Mapeia resultado do apply para job / applications / manualReviews
          const jobAfterApply: LinkedInJobRecord = {
            ...normalizedJob,
            status: applyResult.status === 'submitted' ? 'applied' : normalizedJob.status,
            applyResult
          };

          result.jobs.push(jobAfterApply);

          if (applyResult.status === 'submitted') {
            result.applications.push({
              jobId: jobAfterApply.id,
              profile: options.profileName,
              appliedAt: new Date().toISOString(),
              details: applyResult.details || ''
            });
          } else if (applyResult.status === 'complex_form' || applyResult.status === 'no_easy_apply') {
            // cria revisão manual quando necessário
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

    } finally {
      // lifecycle do browser gerenciado por BrowserManager (não fecha aqui)
    }

    return result;
  }

  // --- Helpers (extraídos para manter método scrape enxuto)
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
        } catch {
          // fallback para abrir em nova aba
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

  // Reaproveita a função já presente no código original (mesma lógica)
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
