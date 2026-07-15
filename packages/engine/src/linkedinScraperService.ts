// packages/engine/src/linkedinScraperService.ts
import {
  EngineScrapeResult,
  LinkedInSearchOptions
} from './types';

import { BrowserManager } from './browser/browserManager';
import { LinkedInSessionManager } from './sessionManager';
import { SessionRotationService } from './sessionRotation/SessionRotationService';
import { searchLinkedInJobs } from './search';
import { LinkedInApplyService } from './apply';
import { BrowserContext, Page } from 'playwright';

import { ScoringPipeline } from "@autojobs/scoring";

// ============================================================================
// SERVICE CLASS
// ============================================================================
export function normalizeModality(location: string): 'Remoto' | 'Presencial' | 'Híbrido' {
  const normalized = location.toLowerCase();
  if (normalized.includes('remoto') || normalized.includes('remote')) return 'Remoto';
  if (normalized.includes('presencial') || normalized.includes('onsite')) return 'Presencial';
  return 'Híbrido';
}

export function isAllowedLocation(modality: string, location: string, allowedCities?: string[] | null): boolean {
  if (modality.toLowerCase() !== 'híbrido' || !allowedCities || allowedCities.length === 0) return true;

  try {
    const loc = location.toLowerCase();
    return allowedCities.some(city => loc.includes(city.toLowerCase()));
  } catch (e) {
    console.warn('⚠️ [Filtro Geográfico] Falha ao verificar as cidades híbridas. Bloqueando por segurança.', e);
    return false;
  }
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
        this.browserManager = BrowserManager.getInstance({
            headless
        });
  }

  async scrape(options: LinkedInSearchOptions): Promise<EngineScrapeResult> {      
      const result: EngineScrapeResult = {
          jobs: [],
          applications: [],
          manualReviews: []
      };

      const { page, context } = await this.setupSession(options);

      const autoApplyEnabled = process.env.LINKEDIN_AUTO_APPLY === 'true';

      const applyService = autoApplyEnabled
          ? new LinkedInApplyService({
              profile: options.profile,
              language: options.language
          })
          : null;

      const scoring = new ScoringPipeline();

      const jobs = await searchLinkedInJobs(page, options);

      console.log(
          `\n🔍 Encontradas ${jobs.length} vagas para o profile ${options.profileName}. Iniciando processamento...`
      );

      try {
          for (let i = 0; i < jobs.length; i++) {
              const job = jobs[i];

              console.log(
                  `\n🔍 Vaga [${i + 1}/${jobs.length}]: ${job.title} (${job.id})`
              );

              let normalizedJob: any = null;

              try {
                  if (page.isClosed()) {
                      throw new Error("Aba principal fechada inesperadamente.");
                  }

                  const modality = normalizeModality(job.location);

                  if (
                      !isAllowedLocation(
                          modality,
                          job.location,
                          options.profile.hybridCities
                      )
                  ) {
                      normalizedJob = {
                          ...job,
                          profileName: options.profileName,
                          modality,
                          status: 'rejected',
                          ai_reason: `Geolocalização incompatível: ${modality} em ${job.location}`,
                          createdAt: new Date().toISOString(),
                          updatedAt: new Date().toISOString()
                      };
                      console.log(
                          `[Filtro] Geolocalização rejeitada: ${job.location}`
                      );

                      result.jobs.push(normalizedJob);
                      continue;
                  }

                  const fullDescription = await this.extractJobData(
                      page,
                      context,
                      job
                  );

                  console.log(`🧠 Avaliando com IA: ${job.title}...`);

                  const evaluation = await scoring.evaluate({
                      title: job.title,
                      description: fullDescription,
                      location: job.location,
                      profile: options.profile
                  });

                  const minScore = options.profile.minScore ?? 75;

                  normalizedJob = {
                      ...job,
                      profileName: options.profileName,
                      description: fullDescription,
                      modality,
                      score: evaluation.score,
                      status: 'found',
                      ai_reason: evaluation.reason,
                      ai_metadata: evaluation.metadata, 
                      createdAt: new Date().toISOString(),
                      updatedAt: new Date().toISOString()
                  };
                  
                  if (
                      !evaluation.approved ||
                      evaluation.score < minScore
                  ) {
                      normalizedJob.status = 'rejected';

                      console.log(
                          `❌ [IA Rejeitou] Score: ${evaluation.score}/${minScore}. Motivo: ${evaluation.reason}`
                      );

                      result.jobs.push(normalizedJob);
                      continue;
                  }

                  console.log(
                      `✅ [IA Aprovou] Score: ${evaluation.score}/${minScore}. Iniciando Candidatura...`
                  );

                  if (
                      !autoApplyEnabled ||
                      !job.easyApply ||
                      !applyService
                  ) {
                      result.jobs.push(normalizedJob);
                      continue;
                  }

                  await this.handleApplication(
                      page,
                      normalizedJob,
                      applyService,
                      options.profileName,
                      result
                  );

              } catch (error: any) {
                  console.error(
                      `🚨 Erro crítico no processamento da vaga ${job.id}:`,
                      error.message
                  );

                  const fallbackJob = normalizedJob || {
                      ...job,
                      status: 'error'
                  };

                  result.jobs.push({
                      ...fallbackJob,
                      status: 'error',
                      applyResult: `Crash na esteira: ${error.message}`
                  });
              }
          }
      } finally {
          await context.close();
      }

      return result;
  }

  // ============================================================================
  // MÉTODOS PRIVADOS DE INFRAESTRUTURA
  // ============================================================================

  private async setupSession(options: LinkedInSearchOptions): Promise<{ page: Page, context: BrowserContext }> {
    const sessionId = 'linkedin-default';
    const sessionManager = new LinkedInSessionManager(options.storageState);
    const rotationService = new SessionRotationService();

    let session = await sessionManager.restoreAuthenticatedSession(this.browserManager);
    const healthStatus = session
      ? rotationService.evaluate(sessionId, [])
      : rotationService.evaluate(sessionId, [{ type: 'missing_session', weight: 80 }]);

    if (rotationService.shouldRotate(healthStatus)) {
      // Lógica de rotação
    }

    if (!session) {
        console.warn('⚠️ Sessão inválida. Iniciando login...');
        
        if (this.isHeadless)
            console.warn('⚠️ Aviso: Modo headless ativo. Intervenções de Checkpoint falharão.');

        session = await sessionManager.bootstrapLogin(this.browserManager);
    }
    
    return session;
  }

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

    if (description.length < 50) {
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
        await jobPage.close();
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
      console.error(`🚨 Erro ao aplicar na vaga ${normalizedJob.id}:`, applyErr.message);
      
      const timestamp = new Date().toISOString();
      result.manualReviews.push({
        id: crypto.randomUUID(),
        jobId: normalizedJob.id,
        profile: profile,
        reviewStatus: 'pending',
        reviewReason: `Exceção capturada: ${applyErr.message}`,
        reviewNotes: `URL da vaga: ${normalizedJob.url}`,
        createdAt: timestamp,
        updatedAt: timestamp
      });

      result.jobs.push({
          ...normalizedJob,
          status: 'error',
          applyResult: {
              status: 'error',
              details: applyErr.message
          }
      });

    }
  }
}