// packages/engine/src/linkedinScraperService.ts

import {
  EngineScrapeResult,
  LinkedInSearchOptions
} from './types';

import { BrowserManager } from './browser/manager';
import { LinkedInSessionManager } from './sessionManager';
import { SessionRotationService } from './sessionRotation/SessionRotationService';
import { searchLinkedInJobs } from './search';
import { LinkedInApplyService } from './apply';
import { LlmEvaluator } from "@autojobs/scoring/src/llmEvaluator";
import { BrowserContext, Page } from 'playwright';

// ============================================================================
// PURE FUNCTIONS (Regras de Negócio Isoladas)
// ============================================================================

export function normalizeModality(location: string): 'Remoto' | 'Presencial' | 'Híbrido' {
  const normalized = location.toLowerCase();
  if (normalized.includes('remoto') || normalized.includes('remote')) return 'Remoto';
  if (normalized.includes('presencial') || normalized.includes('onsite')) return 'Presencial';
  return 'Híbrido';
}

export function isAllowedLocation(modality: string, location: string, allowedCitiesStr?: string): boolean {
  if (modality.toLowerCase() !== 'híbrido' || !allowedCitiesStr) return true;

  try {
    const hybridCities = JSON.parse(allowedCitiesStr) as string[];
    const loc = location.toLowerCase();
    return hybridCities.some(city => loc.includes(city.toLowerCase()));
  } catch (e) {
    console.warn('⚠️ [Filtro Geográfico] Falha ao fazer parse de allowedCitiesStr. Bloqueando por segurança.');
    return false;
  }
}

export function isInvalidSeniority(jobTitle: string, profileSeniority?: string): boolean {
  if (!profileSeniority || profileSeniority.toLowerCase() !== 'pleno') return false;
  const isJuniorOrIntern = /(junior|jr\b|est[áa]gio|trainee)/i.test(jobTitle.toLowerCase());
  return isJuniorOrIntern;
}

// ============================================================================
// SERVICE CLASS
// ============================================================================

export class LinkedInScraperService {
  private browserManager: BrowserManager;
  private isHeadless: boolean;

  // Seletores ordenados por resiliência (O atributo de teste do LinkedIn vem primeiro)
  private readonly DESC_SELECTORS = [
    '[data-testid="expandable-text-box"]',
    '.jobs-description__content',
    '#job-details',
    'article.jobs-description__container'
  ];

  constructor(headless: boolean) {
    this.isHeadless = headless;
    this.browserManager = new BrowserManager({ headless });
  }

  /**
   * Orquestrador principal da esteira de busca, extração, avaliação e candidatura.
   */
  async scrape(options: LinkedInSearchOptions): Promise<EngineScrapeResult> {
    const result: EngineScrapeResult = { jobs: [], applications: [], manualReviews: [] };
    const { page, context } = await this.setupSession(options);
    
    const autoApplyEnabled = process.env.LINKEDIN_AUTO_APPLY === 'true';
    const applyService = autoApplyEnabled ? new LinkedInApplyService({ profile: options.profile, language: options.language }) : null;
    const llmEvaluator = new LlmEvaluator();
    
    const profileDef = options.profileDefinition;
    if (!profileDef) throw new Error("CRÍTICO: profileDefinition não injetado no motor!");

    // 1. Busca inicial das vagas
    const jobs = await searchLinkedInJobs(page, options);

    // 2. Loop de processamento
    for (const job of jobs) {

      for (const [index, job] of jobs.entries()) {
        console.log(
          `\n🔍 Processando ${jobs.length} vagas para o profile ${options.profile}, [${index + 1}] ${job.title} (${job.id})`
        );
      }
      
      try {
        if (page.isClosed()) throw new Error("Aba principal fechada inesperadamente.");

        // --- EARLY EXIT (Filtros Rápidos) ---
        // Não gasta rede, extração de DOM ou tokens de IA se já falhar nas regras básicas
        if (isInvalidSeniority(job.title, profileDef.seniority)) {
          console.log(`[Filtro] Descartada por Senioridade (Perfil ${profileDef.seniority}): ${job.title}`);
          continue;
        }

        const modality = normalizeModality(job.location);
        // Assumindo que profileDef pode ter a string de cidades. Ajuste conforme sua interface.
        if (!isAllowedLocation(modality, job.location, profileDef.allowedCitiesStr)) {
          console.log(`[Filtro] Descartada por Geolocalização: ${modality} em ${job.location}`);
          continue;
        }

        // --- EXTRAÇÃO BLINDADA ---
        const fullDescription = await this.extractJobData(page, context, job);
        
        if (fullDescription.length < 50) {
          console.warn(`⚠️ [Alerta] Descrição muito curta ou inacessível (${fullDescription.length} chars). Pulando.`);
          continue;
        }

        // --- AVALIAÇÃO IA ---
        console.log(`🧠 Avaliando com IA: ${job.title}...`);
        const aiEvaluation = await llmEvaluator.evaluate(job.title, fullDescription, profileDef);
        console.log("🚀 ~ LinkedInScraperService ~ scrape ~ aiEvaluation:", aiEvaluation)
        const minScore = profileDef.minScore ?? 75;

        const normalizedJob = {
          ...job,
          modality: modality as any,
          score: aiEvaluation.score,
          status: 'found' as const,
          ai_reason: aiEvaluation.reason,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        if (!aiEvaluation.is_match || aiEvaluation.score < minScore) {
          console.log(`❌ [IA Rejeitou] Score: ${aiEvaluation.score}/${minScore}. Motivo: ${aiEvaluation.reason}`);
          result.jobs.push(normalizedJob);
          continue;
        }

        console.log(`✅ [IA Aprovou] Score: ${aiEvaluation.score}/${minScore}. Iniciando Candidatura...`);

        // --- CANDIDATURA ---
        if (!autoApplyEnabled || !job.easyApply || !applyService) {
          result.jobs.push(normalizedJob);
          continue;
        }

        await this.handleApplication(page, normalizedJob, applyService, options.profile, result);

      } catch (error: any) {
        console.error(`🚨 Erro crítico no processamento da vaga ${job.id}:`, error.message);
        continue; // Garante que uma vaga corrompida não derrube o processo das outras
      }
    }

    await context.close();
    return result;
  }

  // ============================================================================
  // MÉTODOS PRIVADOS DE INFRAESTRUTURA
  // ============================================================================

  /**
   * Gerencia a autenticação e aquecimento do browser
   */
  private async setupSession(options: LinkedInSearchOptions): Promise<{ page: Page, context: BrowserContext }> {
    const sessionId = 'linkedin-default';
    const sessionManager = new LinkedInSessionManager(options.storageState);
    const rotationService = new SessionRotationService();

    let session = await sessionManager.restoreAuthenticatedSession(this.browserManager);
    const healthStatus = session
      ? rotationService.evaluate(sessionId, [])
      : rotationService.evaluate(sessionId, [{ type: 'missing_session', weight: 80 }]);

    if (rotationService.shouldRotate(healthStatus)) {
      // Lógica de rotação de proxy/sessão (no-op mantido)
    }

    if (!session) {
      console.warn('⚠️ Sessão inválida. Iniciando login...');
      if (this.isHeadless) console.warn('⚠️ Aviso: Modo headless ativo. Intervenções de Checkpoint falharão.');
      
      session = await sessionManager.bootstrapLogin(this.browserManager);
    }
    return session;
  }

  /**
   * Tenta extrair a vaga pelo painel lateral (rápido). 
   * Se falhar, faz fallback para uma nova aba dedicada (seguro).
   */
  private async extractJobData(page: Page, context: BrowserContext, job: any): Promise<string> {
    const jobCardSelector = `[data-job-id="${job.id}"], [data-occludable-job-id="${job.id}"]`;
    const cardExists = await page.$(jobCardSelector).catch(() => null);
    
    let description = '';

    if (cardExists) {
      try {
        await cardExists.scrollIntoViewIfNeeded();
        await cardExists.click();
        
        // Espera qualquer um dos seletores do array aparecer no DOM
        const selectorString = this.DESC_SELECTORS.join(', ');
        await page.waitForSelector(selectorString, { state: 'attached', timeout: 4000 });
        await page.waitForTimeout(800); // Aguarda hidratação do React
        
        await this.clickSeeMore(page);
        description = await this.scrapeDomText(page);
      } catch (e) {
        console.warn(`[Aviso] Falha no painel lateral (${job.id}). Acionando fallback Standalone...`);
      }
    }

    // Fallback: Abre a vaga diretamente via URL se o painel lateral falhou
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

  /**
   * Injetado dentro do browser para ler o texto limpo
   */
  private async scrapeDomText(targetPage: Page): Promise<string> {
    return await targetPage.evaluate((selectors) => {
      for (const sel of selectors) {
        const element = document.querySelector(sel);
        if (element && element.textContent && element.textContent.trim().length > 50) {
          const aboutCompany = element.querySelector('.jobs-company__box');
          if (aboutCompany) aboutCompany.remove(); // Limpa sujeira da empresa
          return element.textContent.trim();
        }
      }
      return '';
    }, this.DESC_SELECTORS);
  }

  /**
   * Clica no botão "Ver mais" de forma resiliente
   */
  private async clickSeeMore(page: Page): Promise<void> {
    const btnLocators = 'button[aria-label*="see more"], button[aria-label*="Ver mais"], .show-more-less-html__button, .jobs-description__footer-button';
    const seeMoreBtn = await page.$(btnLocators).catch(() => null);
    if (seeMoreBtn) {
      await seeMoreBtn.click().catch(() => {}); // Ignora se o botão não for clicável
      await page.waitForTimeout(500);
    }
  }

  /**
   * Isola a lógica pesada de submissão do apply
   */
  private async handleApplication(page: Page, normalizedJob: any, applyService: LinkedInApplyService, profile: any, result: EngineScrapeResult): Promise<void> {
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
      console.log("🚀 ~ LinkedInScraperService ~ handleApplication ~ applyResult:", applyResult)

      if (applyResult.status === 'submitted') {
        result.applications.push({ jobId: normalizedJob.id, status: 'submitted', result: applyResult.details, appliedAt: new Date().toISOString() });
        result.jobs.push({ ...normalizedJob, status: 'applied', applyResult: applyResult.details });
      } else {
        result.jobs.push({ ...normalizedJob, status: 'pending_review', applyResult: applyResult.details });
      }
    } catch (applyErr: any) {
      console.error(`🚨 Erro ao aplicar na vaga ${normalizedJob.id}:`, applyErr.message);
      result.jobs.push(normalizedJob); // Salva como 'found' para retry futuro
    }
  }
}