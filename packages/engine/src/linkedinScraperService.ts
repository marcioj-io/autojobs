// packages/engine/src/linkedinScraperService.ts
import crypto from 'crypto';
import { BrowserManager } from './browser/browserManager';
import { SessionRotationService } from './sessionRotation/SessionRotationService';
import { searchLinkedInJobs } from './search';
import { LinkedInApplyService } from './apply';
import type { BrowserContext, Page } from 'playwright';
import { normalize } from '@autojobs/scoring/src/utils/normalize';
import { EngineScrapeResult, LinkedInJobRecord, LinkedInSearchOptions } from './types/types';
import { normalizeForCompare, randomDelay as utilRandomDelay } from './utils';
import { LinkedInSessionManager } from './sessionManager';
import { ScoringPipeline, ScoringResult } from '@autojobs/scoring';

/**
 * LinkedInScraperService - versão senior+
 * - Restaura sessão antes de criar contexts
 * - Reutiliza context/page restaurados
 * - Substitui context/page com segurança após bootstrap login
 * - Garante que fallback de aplicação abra nova aba no mesmo context
 * - Logs e timeouts mais robustos
 */

// ----------------------------- Helpers ------------------------------------

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

function normalizeModality(location: string): 'Remoto' | 'Presencial' | 'Híbrido' {
  const norm = normalize(location || '');
  if (/(remot[oa]|remote|teletrabaj[oa]|home\s*office|work\s*from\s*home|wfh)/i.test(norm)) return 'Remoto';
  if (/(presencial|onsite|on-site|in-person|alocacao)/i.test(norm)) return 'Presencial';
  if (/(hibrid[oa]|hybrid)/i.test(norm)) return 'Híbrido';
  return 'Híbrido';
}

export function isAllowedLocation(modality: string, location: string, allowedCities?: string[] | null): boolean {
  try {
    if (!modality) return true;
    const mod = normalize(modality || '');
    if (mod !== normalize('híbrido') && mod !== normalize('hibrido')) return true;
    if (!allowedCities || allowedCities.length === 0) return true;

    const locNorm = normalizeForCompare(location || '');
    const allowed = (allowedCities || []).map(c => normalizeForCompare(c));

    // 1) match direto
    for (const city of allowed) {
      if (!city) continue;
      if (locNorm.includes(city) || city.includes(locNorm)) return true;
    }

    // 2) token intersection (fuzzy leve)
    const locTokens = new Set(locNorm.split(' ').filter(Boolean));
    for (const city of allowed) {
      const cityTokens = city.split(' ').filter(Boolean);
      let common = 0;
      for (const t of cityTokens) if (locTokens.has(t)) common++;
      if (common >= 1) return true;
    }

    return false;
  } catch (e) {
    console.warn('⚠️ [Filtro Geográfico] Falha ao verificar as cidades híbridas. Bloqueando por segurança.', e);
    return false;
  }
}

function isValidStorageState(obj: any): obj is { cookies: any[]; origins: any[] } {
  return obj && Array.isArray(obj.cookies) && Array.isArray(obj.origins);
}

// ----------------------------- Service ------------------------------------

export class LinkedInScraperService {
  private browserManager: BrowserManager;
  private isHeadless: boolean;

  private readonly DESC_SELECTORS = [
    '[data-testid="expandable-text-box"]',
    '.jobs-description__content',
    '#job-details',
    'article.jobs-description__container',
    '.jobs-search__job-details',
    '.job-view-layout'
  ];

  constructor(headless: boolean) {
    this.isHeadless = headless;
    this.browserManager = BrowserManager.getInstance({ headless });
  }

  /**
   * Orquestra o scraping para um conjunto de queries do profile.
   * Estratégia:
   *  - Tenta restaurar sessão (sessionManager.restoreAuthenticatedSession)
   *  - Se restaurada: reutiliza context + page retornados
   *  - Se não: cria context temporário e tenta bootstrapLogin; se bootstrap retornar context/page, substitui com segurança
   */
  async scrape(options: LinkedInSearchOptions): Promise<EngineScrapeResult> {
    const result: EngineScrapeResult = { jobs: [], applications: [], manualReviews: [] };

    const sessionManager = new LinkedInSessionManager(options.storageState);
    const rotationService = new SessionRotationService();
    const sessionIdForProfile = `profile-${options.profileName}`;

    // 1) Tentar restaurar sessão antes de criar novos contexts
    let restoredSession: { context: BrowserContext; page: Page } | null = null;
    try {
      restoredSession = await sessionManager.restoreAuthenticatedSession(this.browserManager);
    } catch (err) {
      console.warn('[SCRAPER] Falha ao restaurar sessão (não fatal):', err);
      restoredSession = null;
    }

    // 2) Variáveis reatribuíveis para context/page
    let context: BrowserContext;
    let page: Page;

    if (restoredSession) {
      context = restoredSession.context;
      page = restoredSession.page;
      console.info('[SCRAPER] Reutilizando contexto e página restaurados (linkedin-default)');
    } else {
      // cria contexto inicial para o profile (pode ser substituído pelo bootstrap)
      context = await this.browserManager.getContext(sessionIdForProfile, {}, isValidStorageState(options.storageState) ? options.storageState : undefined);
      page = await context.newPage();
      console.info(`[SCRAPER] Contexto criado para profile ${options.profileName}`);

      // tenta bootstrap login e, se obtiver novo context/page, substitui com segurança
      try {
        const bootstrap = await sessionManager.bootstrapLogin(this.browserManager);
        if (bootstrap && bootstrap.context && bootstrap.page) {
          // fecha o context que criamos para evitar contexts duplicados
          try {
            await context.close();
          } catch (e) {
            /* ignore close errors */
          }

          context = bootstrap.context;
          page = bootstrap.page;
          console.info('[SCRAPER] Substituído contexto/page pelo resultado do bootstrap (login realizado)');
        }
      } catch (err) {
        console.warn('[SCRAPER] Bootstrap login falhou ou não foi necessário:', err);
        // continua com o context/page já criado
      }
    }

    // 3) Health check / session rotation evaluation
    try {
      const healthStatus = restoredSession ? rotationService.evaluate('linkedin-default', []) : rotationService.evaluate(sessionIdForProfile, [{ type: 'missing_session', weight: 80 }]);
      if (rotationService.shouldRotate(healthStatus)) {
        console.warn('⚠️ [SessionRotation] Sessão com baixa saúde detectada. Recomendado re-autenticar.');
      }
    } catch (e) {
      console.warn('[SCRAPER] Falha ao avaliar saúde da sessão:', e);
    }

    // 4) Se a page estiver no /feed, navegue para /jobs para estabilizar o fluxo
    try {
      const currentUrl = page.url();
      if (currentUrl.includes('/feed')) {
        await page.goto('https://www.linkedin.com/jobs/', { waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {});
        await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
      }
    } catch {
      /* ignore */
    }

    // 5) Pipeline principal
    try {
      const autoApplyEnabled = process.env.LINKEDIN_AUTO_APPLY === 'true';
      const applyService = autoApplyEnabled ? new LinkedInApplyService() : null;
      const scoring = new ScoringPipeline();

      // Executa a busca de vagas (searchLinkedInJobs deve usar a page para navegação)
      const jobs = await searchLinkedInJobs(page, options);
      console.log(`\n🔍 Encontradas ${jobs.length} vagas para a query "${options.query}". Iniciando esteira de validação...`);

      for (let i = 0; i < jobs.length; i++) {
        const job = jobs[i];
        console.log(`\n🔍 Vaga [${i + 1}/${jobs.length}]: ${job.title} (${job.id})`);

        // jitter anti-deteção
        await utilRandomDelay(1000, 2500);

        try {
          if (page.isClosed()) {
            page = await context.newPage();
          }

          const modality = normalizeModality(job.location || job.modality || '');

          // Filtro geográfico (hard reject para geolocalização incompatível)
          if (!isAllowedLocation(modality, job.location || '', options.profile.hybridCities)) {
            console.log(`[Filtro Geográfico] ❌ Rejeitada: ${modality} em "${job.location}"`);
            const rejectedJob: LinkedInJobRecord = {
              ...job,
              profileName: options.profileName,
              modality,
              status: 'rejected',
              aiReason: `Geolocalização incompatível: ${modality} em ${job.location}`,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };
            result.jobs.push(rejectedJob);
            continue;
          }

          // Extração de descrição (painel lateral preferencial; fallback para standalone)
          const fullDescription = await this.extractJobData(page, context, job);

          // Scoring IA
          console.log(`🧠 Avaliando vaga com IA: ${job.title}...`);
          const evaluation: ScoringResult = await scoring.evaluate({
            title: job.title,
            description: fullDescription,
            location: job.location,
            profile: options.profile
          } as any);

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

          // Tratamento especial para soft_reject: enviar para revisão manual em vez de rejeitar
          const preFilterAction = evaluation.metadata?.preFilterAction ?? 'accept';

          if (!evaluation.approved || evaluation.score < minScore) {
            if (preFilterAction === 'soft_reject') {
              normalizedJob.status = 'pending_review';
              normalizedJob.aiReason = evaluation.reason || normalizedJob.aiReason;
              normalizedJob.aiMetadata = sanitizeMetadata(evaluation.metadata);

              console.log(`⚠️ [Soft Reject -> Pending Review] Vaga ${normalizedJob.id} marcada para revisão manual (score ${evaluation.score}/${minScore}).`);

              const manualReview: EngineScrapeResult['manualReviews'][number] = {
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
              // Hard reject (comportamento inalterado)
              normalizedJob.status = 'rejected';
              normalizedJob.aiReason = evaluation.reason || normalizedJob.aiReason;
              normalizedJob.aiMetadata = sanitizeMetadata(evaluation.metadata);
              console.log(`❌ [IA Rejeitou] Score: ${evaluation.score}/${minScore}. Motivo: ${evaluation.reason}`);
              result.jobs.push(normalizedJob);
              continue;
            }
          }

          console.log(`✅ [IA Aprovou] Score: ${evaluation.score}/${minScore}.`);

          if (!autoApplyEnabled || !job.easyApply || !applyService) {
            console.log(`ℹ️ Auto-apply ignorado (Habilitado: ${autoApplyEnabled}, EasyApply: ${job.easyApply})`);
            result.jobs.push(normalizedJob);
            continue;
          }

          // Aplicação: passa page/context para garantir que o apply rode no mesmo contexto
          const applyOutcome = await this.handleApplication(page, context, normalizedJob, applyService, options.profileName);

          result.jobs.push(applyOutcome.job);
          if (applyOutcome.application) result.applications.push(applyOutcome.application);
          if (applyOutcome.manualReview) result.manualReviews.push(applyOutcome.manualReview);

        } catch (error: any) {
          console.error(`🚨 Erro crítico no processamento da vaga ${job.id}:`, error?.message ?? error);
          const errorJob: LinkedInJobRecord = {
            ...job,
            profileName: options.profileName,
            status: 'error',
            applyResult: `Crash na esteira: ${error?.message ?? String(error)}`,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          result.jobs.push(errorJob);
        }
      }

    } finally {
      // Não fechamos context/page aqui: BrowserManager gerencia lifecycle globalmente.
      // Se desejar forçar fechamento para perfis isolados, chame browserManager.closeContext(sessionId) externamente.
    }

    return result;
  }

  // ----------------------------- Extração ---------------------------------

  private async extractJobData(page: Page, context: BrowserContext, job: any): Promise<string> {
    await this.dismissOverlays(page);

    const jobCardSelector = `[data-job-id="${job.id}"], [data-occludable-job-id="${job.id}"]`;
    const cardExists = await page.$(jobCardSelector).catch(() => null);

    let description = '';

    if (cardExists) {
      try {
        await cardExists.scrollIntoViewIfNeeded();
        const clickableElement = await cardExists.$('.job-card-list__title, .job-card-container__link').catch(() => cardExists);
        await (clickableElement || cardExists).click({ timeout: 3000 }).catch(async () => {
          await page.evaluate((el) => (el as HTMLElement).click(), cardExists);
        });

        // Aguarda painel lateral estabilizar
        await page.waitForFunction(
          (jobId) => {
            return window.location.href.includes(jobId) || !!document.querySelector('.jobs-search__job-details');
          },
          job.id,
          { timeout: 5000 }
        ).catch(() => {});

        const selectorString = this.DESC_SELECTORS.join(', ');
        await page.waitForSelector(selectorString, { state: 'attached', timeout: 7000 }).catch(() => {});
        await utilRandomDelay(800, 1500);

        await this.clickSeeMore(page);
        description = await this.scrapeDomText(page);
      } catch (e) {
        console.warn(`[Aviso] Painel lateral inacessível para vaga ${job.id}. Acionando fallback em nova aba...`);
      }
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
      await jobPage.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
      await jobPage.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
      const selectorString = this.DESC_SELECTORS.join(', ');
      await jobPage.waitForSelector(selectorString, { state: 'attached', timeout: 8000 }).catch(() => {});
      await utilRandomDelay(500, 1000);
      await this.clickSeeMore(jobPage);
      return await this.scrapeDomText(jobPage);
    } catch (e) {
      console.warn(`[Erro Tolerado] Timeout ou falha ao abrir página standalone da vaga ${jobId}.`);
      if (jobPage && !jobPage.isClosed()) {
        return await this.scrapeDomText(jobPage).catch(() => '');
      }
      return '';
    } finally {
      if (jobPage && !jobPage.isClosed()) {
        try { await jobPage.close(); } catch { /* ignore */ }
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
    ].join(',');
    try {
      const seeMoreBtn = await page.$(btnLocators);
      if (seeMoreBtn && await seeMoreBtn.isVisible()) {
        await seeMoreBtn.click({ timeout: 1500 }).catch(() => {});
        await utilRandomDelay(300, 600);
      }
    } catch {
      /* ignore */
    }
  }

  private async dismissOverlays(page: Page): Promise<void> {
    const overlaySelectors = [
      '.msg-overlay-bubble-header__control--close-btn',
      'button[aria-label*="Dismiss"]',
      'button[aria-label*="Fechar"]',
      'button.artdeco-modal__dismiss'
    ];
    for (const sel of overlaySelectors) {
      try {
        const btn = await page.$(sel);
        if (btn && await btn.isVisible()) {
          await btn.click({ timeout: 800 }).catch(() => {});
        }
      } catch {
        /* ignore */
      }
    }
  }

  // ----------------------------- Aplicação --------------------------------

  private async handleApplication(
    page: Page,
    context: BrowserContext,
    normalizedJob: LinkedInJobRecord,
    applyService: LinkedInApplyService,
    profile: string
  ): Promise<{ job: LinkedInJobRecord; application?: EngineScrapeResult['applications'][number]; manualReview?: EngineScrapeResult['manualReviews'][number] }> {
    const timestamp = new Date().toISOString();

    try {
      const applyResult = await applyService.applyToJob(page, context, normalizedJob.url);

      if (applyResult.status === 'submitted') {
        return {
          job: { ...normalizedJob, status: 'applied', applyResult },
          application: { jobId: normalizedJob.id, status: 'submitted', result: applyResult.details, appliedAt: timestamp }
        };
      }

      const manualReview: EngineScrapeResult['manualReviews'][number] = {
        id: crypto.randomUUID(),
        jobId: normalizedJob.id,
        profile,
        reviewStatus: 'pending' as const,
        reviewReason: applyResult.details,
        reviewNotes: `URL da vaga: ${normalizedJob.url}`,
        createdAt: timestamp,
        updatedAt: timestamp
      };

      return {
        job: { ...normalizedJob, status: 'pending_review', applyResult: applyResult.details },
        manualReview
      };

    } catch (applyErr: any) {
      const errorMsg = applyErr?.message ?? String(applyErr);
      console.error(`🚨 Erro ao aplicar na vaga ${normalizedJob.id}:`, errorMsg);

      const manualReview: EngineScrapeResult['manualReviews'][number] = {
        id: crypto.randomUUID(),
        jobId: normalizedJob.id,
        profile,
        reviewStatus: 'pending' as const,
        reviewReason: `Exceção capturada no Auto-Apply: ${errorMsg}`,
        reviewNotes: `URL da vaga: ${normalizedJob.url}`,
        createdAt: timestamp,
        updatedAt: timestamp
      };

      return {
        job: { ...normalizedJob, status: 'error', applyResult: { status: 'error', details: errorMsg } },
        manualReview
      };
    }
  }

}
