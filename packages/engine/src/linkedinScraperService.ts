// packages/engine/src/linkedinScraperService.ts
import crypto from 'crypto';
import {
  EngineScrapeResult,
  LinkedInSearchOptions
} from './types/types';

import { BrowserManager } from './browser/browserManager';
import { LinkedInSessionManager } from './sessionManager';
import { SessionRotationService } from './sessionRotation/SessionRotationService';
import { searchLinkedInJobs } from './search';
import { LinkedInApplyService } from './apply';
import type { BrowserContext, Page } from 'playwright';

import { ScoringPipeline, ScoringResult } from "@autojobs/scoring";
import { ApplicationCounter } from './applicationCounter';
import { normalize } from '@autojobs/scoring/src/utils/normalize';

// ============================================================================
// SERVICE CLASS
// ============================================================================

/**
 * Normaliza e classifica a modalidade a partir do texto de localização/modalidade.
 * Usa normalização de strings para evitar problemas com acentos/typos.
 */
export function normalizeModality(location: string): 'Remoto' | 'Presencial' | 'Híbrido' {
  const normalized = normalize(location || '');
  if (normalized.includes('remoto') || normalized.includes('remote')) return 'Remoto';
  if (normalized.includes('presencial') || normalized.includes('onsite') || normalized.includes('onsite')) return 'Presencial';
  return 'Híbrido';
}

/**
 * Verifica se a vaga híbrida está dentro das cidades permitidas.
 * Normaliza strings antes da comparação.
 */
export function isAllowedLocation(modality: string, location: string, allowedCities?: string[] | null): boolean {
  try {
    if (!modality) return true;
    const mod = normalize(modality);
    if (mod !== normalize('híbrido') && mod !== normalize('hibrido')) return true;
    if (!allowedCities || allowedCities.length === 0) return true;

    const loc = normalize(location || '');
    return allowedCities.some(city => loc.includes(normalize(city)));
  } catch (e) {
    console.warn('⚠️ [Filtro Geográfico] Falha ao verificar as cidades híbridas. Bloqueando por segurança.', e);
    return false;
  }
}

/**
 * Validação simples do storageState (objeto Playwright).
 */
function isValidStorageState(obj: any): obj is { cookies: any[]; origins: any[] } {
  return obj && Array.isArray(obj.cookies) && Array.isArray(obj.origins);
}

export class LinkedInScraperService {
  private browserManager: BrowserManager;
  private isHeadless: boolean;

  private readonly DESC_SELECTORS = [
    '[data-testid="expandable-text-box"]',
    '.jobs-description__content',
    '#job-details',
    'article.jobs-description__container'
  ];

  constructor(headless: boolean) {
    this.isHeadless = headless;
    this.browserManager = BrowserManager.getInstance({ headless });
  }

  /**
   * Orquestra o scraping para um conjunto de queries do profile.
   * Observação: NÃO fecha o context (reuso por profile). Fecha apenas a page principal criada para a execução.
   */
  async scrape(options: LinkedInSearchOptions): Promise<EngineScrapeResult> {
    const result: EngineScrapeResult = {
      jobs: [],
      applications: [],
      manualReviews: []
    };

    // sessionId por profile para reuso de context
    const sessionId = `profile-${options.profileName}`;

    // Valida storageState antes de passar adiante
    const storageState = isValidStorageState(options.storageState) ? options.storageState : undefined;
    if (options.storageState && !storageState) {
      console.warn('⚠️ StorageState inválido recebido. Ignorando e forçando bootstrap se necessário.');
    }

    // Cria/obtém context reutilizável e abre a page principal
    const context: BrowserContext = await this.browserManager.getContext(sessionId, {}, storageState);
    const page: Page = await context.newPage();

    // Session manager e rotação (mantemos a lógica, mas não fechamos context aqui)
    const sessionManager = new LinkedInSessionManager(options.storageState);
    const rotationService = new SessionRotationService();

    try {
      // Restaura sessão autenticada se possível (sessionManager pode usar browserManager internamente)
      let session = await sessionManager.restoreAuthenticatedSession(this.browserManager);
      const healthStatus = session
        ? rotationService.evaluate(sessionId, [])
        : rotationService.evaluate(sessionId, [{ type: 'missing_session', weight: 80 }]);

      if (rotationService.shouldRotate(healthStatus)) {
        // Implementar rotação se necessário (ex.: marcar para bootstrapLogin)
      }

      if (!session) {
        console.warn('⚠️ Sessão inválida. Iniciando login...');
        if (this.isHeadless) console.warn('⚠️ Aviso: Modo headless ativo. Intervenções de Checkpoint falharão.');
        session = await sessionManager.bootstrapLogin(this.browserManager);
      }

      const autoApplyEnabled = process.env.LINKEDIN_AUTO_APPLY === 'true';
      const applyService = autoApplyEnabled
        ? new LinkedInApplyService({ profile: options.profile, language: options.language })
        : null;

      const scoring = new ScoringPipeline();

      // Executa a busca usando a page principal
      const jobs = await searchLinkedInJobs(page, options);

      console.log(`\n🔍 Encontradas ${jobs.length} vagas para o profile ${options.profileName}. Iniciando processamento...`);

      for (let i = 0; i < jobs.length; i++) {
        const job = jobs[i];
        console.log(`\n🔍 Vaga [${i + 1}/${jobs.length}]: ${job.title} (${job.id})`);

        let normalizedJob: any = null;
        let jobPage: Page | any = null;

        try {
          if (page.isClosed()) throw new Error('Aba principal fechada inesperadamente.');

          const modality = normalizeModality(job.location || job.modality || '');
          if (!isAllowedLocation(modality, job.location || '', options.profile.hybridCities)) {
            normalizedJob = {
              ...job,
              profileName: options.profileName,
              modality,
              status: 'rejected',
              aiReason: `Geolocalização incompatível: ${modality} em ${job.location}`,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };
            console.log(`[Filtro] Geolocalização rejeitada: ${job.location}`);
            result.jobs.push(normalizedJob);
            continue;
          }

          // Extrai descrição (usa a page principal e fallback para jobPage)
          const fullDescription = await this.extractJobData(page, context, job);

          console.log(`🧠 Avaliando com IA: ${job.title}...`);
          const evaluation: ScoringResult = await scoring.evaluate({
            title: job.title,
            description: fullDescription,
            location: job.location,
            profile: options.profile
          } as any);

          const minScore = options.profile.minScore ?? 75;

          normalizedJob = {
            ...job,
            profileName: options.profileName,
            description: fullDescription,
            modality,
            score: evaluation.score,
            status: 'found',
            aiReason: evaluation.reason,
            aiMetadata: evaluation.metadata,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };

          // Regras de rejeição por score/approval
          if (!evaluation.approved || evaluation.score < minScore) {
            normalizedJob.status = 'rejected';
            console.log(`❌ [IA Rejeitou] Score: ${evaluation.score}/${minScore}. Motivo: ${evaluation.reason}`);
            result.jobs.push(normalizedJob);
            continue;
          }

          // Verifica limite diário antes de tentar aplicar
          const todayCount = await ApplicationCounter.getTodayCount(options.profileName);
          if (todayCount >= (options.profile.dailyLimit ?? 10)) {
            normalizedJob.status = 'rejected';
            normalizedJob.aiReason = `Limite diário atingido (${todayCount}/${options.profile.dailyLimit})`;
            console.log(`⚠️ Limite diário atingido para profile ${options.profileName}: ${todayCount}/${options.profile.dailyLimit}`);
            result.jobs.push(normalizedJob);
            continue;
          }

          console.log(`✅ [IA Aprovou] Score: ${evaluation.score}/${minScore}. Iniciando Candidatura...`);

          if (!autoApplyEnabled || !job.easyApply || !applyService) {
            result.jobs.push(normalizedJob);
            continue;
          }

          // Tenta aplicar; handleApplication adiciona manualReview se necessário
          await this.handleApplication(page, normalizedJob, applyService, options.profileName, result);

        } catch (error: any) {
          console.error(`🚨 Erro crítico no processamento da vaga ${job.id}:`, error?.message ?? error);
          const fallbackJob = normalizedJob || { ...job, status: 'error' };
          result.jobs.push({
            ...fallbackJob,
            status: 'error',
            applyResult: `Crash na esteira: ${error?.message ?? String(error)}`
          });
        } finally {
          // Garantir que qualquer jobPage criado no fallback seja fechado
          if (jobPage && !jobPage.isClosed()) {
            try { await jobPage.close(); } catch { /* ignore */ }
          }
        }
      }

    } finally {
      // NÃO fechamos o context aqui (reuso por profile). Fechamos apenas a page principal.
      try {
        if (!page.isClosed()) await page.close();
      } catch (e) { /* ignore */ }
    }

    return result;
  }

  // ============================================================================
  // MÉTODOS PRIVADOS DE INFRAESTRUTURA
  // ============================================================================

  private async extractJobData(page: Page, context: BrowserContext, job: any): Promise<string> {
    const jobCardSelector = `[data-job-id="${job.id}"], [data-occludable-job-id="${job.id}"]`;
    const cardExists = await page.$(jobCardSelector).catch(() => null);

    let description = '';

    if (cardExists) {
      try {
        await cardExists.scrollIntoViewIfNeeded();
        await cardExists.click();
        const selectorString = this.DESC_SELECTORS.join(', ');
        await page.waitForSelector(selectorString, { state: 'attached', timeout: 4000 });
        await page.waitForTimeout(800);
        await this.clickSeeMore(page);
        description = await this.scrapeDomText(page);
      } catch (e) {
        console.warn(`[Aviso] Falha no painel lateral (${job.id}). Acionando fallback Standalone...`);
      }
    }

    if (!description || description.length < 50) {
      const jobPage = await context.newPage();
      try {
        await jobPage.goto(job.url, { waitUntil: 'domcontentloaded', timeout: 15000 });
        const selectorString = this.DESC_SELECTORS.join(', ');
        await jobPage.waitForSelector(selectorString, { state: 'attached', timeout: 8000 });
        await jobPage.waitForTimeout(1000);
        await this.clickSeeMore(jobPage);
        description = await this.scrapeDomText(jobPage);
      } catch (e) {
        console.warn(`[Erro Tolerado] Timeout no fallback da vaga ${job.id}. Extraindo às cegas...`);
        description = await this.scrapeDomText(jobPage).catch(() => '');
      } finally {
        try { if (!jobPage.isClosed()) await jobPage.close(); } catch { /* ignore */ }
      }
    }

    return description || job.description || '';
  }

  private async scrapeDomText(targetPage: Page): Promise<string> {
    return await targetPage.evaluate((selectors) => {
      for (const sel of selectors) {
        const element = document.querySelector(sel);
        if (element && element.textContent && element.textContent.trim().length > 50) {
          const aboutCompany = element.querySelector('.jobs-company__box');
          if (aboutCompany) aboutCompany.remove();
          return element.textContent.trim();
        }
      }
      return '';
    }, this.DESC_SELECTORS);
  }

  private async clickSeeMore(page: Page): Promise<void> {
    const btnLocators = 'button[aria-label*="see more"], button[aria-label*="Ver mais"], .show-more-less-html__button, .jobs-description__footer-button';
    const seeMoreBtn = await page.$(btnLocators).catch(() => null);
    if (seeMoreBtn) {
      await seeMoreBtn.click().catch(() => {});
      await page.waitForTimeout(500);
    }
  }

  private async handleApplication(page: Page, normalizedJob: any, applyService: LinkedInApplyService, profile: string, result: EngineScrapeResult): Promise<void> {
    try {
      const applyParams = {
        resumePath: process.env.LINKEDIN_CV_PATH,
        coverLetter: process.env.LINKEDIN_COVER_LETTER,
        answers: {
          email: process.env.LINKEDIN_CONTACT_EMAIL ?? '',
          phone: process.env.LINKEDIN_CONTACT_PHONE ?? ''
        },
        profile
      };

      const applyResult = await applyService.applyToJob(page, normalizedJob.url, applyParams);

      if (applyResult.status === 'submitted') {
        result.applications.push({
          jobId: normalizedJob.id,
          status: 'submitted',
          result: applyResult.details,
          appliedAt: new Date().toISOString()
        });
        result.jobs.push({
          ...normalizedJob,
          status: 'applied',
          applyResult
        });
      } else {
        const timestamp = new Date().toISOString();
        result.manualReviews.push({
          id: crypto.randomUUID(),
          jobId: normalizedJob.id,
          profile: profile,
          reviewStatus: 'pending',
          reviewReason: applyResult.details,
          reviewNotes: `URL da vaga: ${normalizedJob.url}`,
          createdAt: timestamp,
          updatedAt: timestamp
        });
        result.jobs.push({ ...normalizedJob, status: 'pending_review', applyResult: applyResult.details });
      }
    } catch (applyErr: any) {
      console.error(`🚨 Erro ao aplicar na vaga ${normalizedJob.id}:`, applyErr?.message ?? applyErr);
      const timestamp = new Date().toISOString();
      result.manualReviews.push({
        id: crypto.randomUUID(),
        jobId: normalizedJob.id,
        profile: profile,
        reviewStatus: 'pending',
        reviewReason: `Exceção capturada: ${applyErr?.message ?? String(applyErr)}`,
        reviewNotes: `URL da vaga: ${normalizedJob.url}`,
        createdAt: timestamp,
        updatedAt: timestamp
      });

      result.jobs.push({
        ...normalizedJob,
        status: 'error',
        applyResult: {
          status: 'error',
          details: applyErr?.message ?? String(applyErr)
        }
      });
    }
  }
}
