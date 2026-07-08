// packages\engine\src\linkedinScraperService.ts
import { randomUUID } from 'node:crypto';

import {
  EngineScrapeResult,
  LinkedInSearchOptions,
} from './types';

import { BrowserManager } from './browser/manager';
import { LinkedInSessionManager } from './sessionManager';
import { SessionRotationService } from './sessionRotation/SessionRotationService';
import { searchLinkedInJobs } from './search';
import { LinkedInApplyService } from './apply';
import { classifyRecovery } from './recovery/RecoveryStrategy';
import { LlmEvaluator } from "@autojobs/scoring/src/llmEvaluator";

function normalizeModality(location: string) {
  const normalized = location.toLowerCase();

  if (normalized.includes('remoto') || normalized.includes('remote')) {
    return 'Remoto';
  }

  if (normalized.includes('presencial') || normalized.includes('onsite')) {
    return 'Presencial';
  }

  return 'Híbrido';
}

// 🛠️ CORREÇÃO: Função de blindagem geográfica (Bloqueia Híbrido fora de SP)
function isAllowedLocation(modality: string, location: string, allowedCitiesStr?: string): boolean {
  if (modality.toLowerCase() === 'híbrido' && allowedCitiesStr) {
    try {
      const hybridCities = JSON.parse(allowedCitiesStr) as string[];
      const loc = location.toLowerCase();
      return hybridCities.some(city => loc.includes(city.toLowerCase()));
    } catch (e) {
      return false; 
    }
  }
  return true; 
}

// 🛠️ CORREÇÃO: Bloqueia júnior/estágio se o perfil for pleno (Sênior passa normalmente)
function isInvalidSeniority(jobTitle: string, profileSeniority: string): boolean {
  const title = jobTitle.toLowerCase();
  const isJuniorOrIntern = /(junior|jr\b|est[áa]gio|trainee)/i.test(title);
  
  if (profileSeniority.toLowerCase() === 'pleno' && isJuniorOrIntern) {
    return true; // É Júnior, mas o perfil é pleno: Rejeita.
  }
  return false; 
}

export class LinkedInScraperService {
  private browserManager: BrowserManager;
  private isHeadless: boolean;

  constructor(headless: boolean) {
    this.isHeadless = headless;
    this.browserManager = new BrowserManager({
      headless
    });
  }

  async scrape(options: LinkedInSearchOptions): Promise<EngineScrapeResult> {
    const result: EngineScrapeResult = {
      jobs: [],
      applications: [],
      manualReviews: []
    };

    const sessionId = 'linkedin-default';
    const sessionManager = new LinkedInSessionManager(options.storageState);
    const rotationService = new SessionRotationService();

    let session = await sessionManager.restoreAuthenticatedSession(
      this.browserManager
    );

    const healthStatus = session
      ? rotationService.evaluate(sessionId, [])
      : rotationService.evaluate(sessionId, [
          { type: 'missing_session', weight: 80 }
        ]);

    if (rotationService.shouldRotate(healthStatus)) {
      // no-op
    }

    if (!session) {
      console.warn('⚠️ Sessão LinkedIn inválida ou ausente. Iniciando rotina de login...');
      
      if (this.isHeadless) {
         console.warn('⚠️ Aviso: O browser está em modo headless (invisível).');
         console.warn('Se o login automático falhar ou cair em um Checkpoint, você não conseguirá interagir.');
      }

      session = await sessionManager.bootstrapLogin(this.browserManager);
      console.log("🚀 ~ LinkedInScraperService ~ scrape ~ session:", session.context)
      const newStorageState = await session.context.storageState();
    }

    const { page, context } = session;
    const jobs = await searchLinkedInJobs(page, options);
    const autoApplyEnabled = process.env.LINKEDIN_AUTO_APPLY === 'true';

      const applyService = autoApplyEnabled
        ? new LinkedInApplyService({
            profile: options.profile,
            language: options.language
          })
        : null;

      // 🧠 Instancia o Motor de IA
      const llmEvaluator = new LlmEvaluator();

      const parseKeywords = (val: any): string[] => {
        if (!val) return [];
        if (typeof val === 'string') return val.split(',').map(v => v.trim().toLowerCase()).filter(v => v);
        if (Array.isArray(val)) return val.map(v => v.toLowerCase());
        return Object.keys(val).map(v => v.toLowerCase()); 
      };

      for (const job of jobs) {
            const profileDefinition = options.profileDefinition;
            if (!profileDefinition) {
              throw new Error("profileDefinition não foi injetado na Engine!");
            }

            const modality = job.modality as 'Remoto' | 'Híbrido' | 'Presencial' ?? normalizeModality(job.location);

            // 🛠️ CORREÇÃO APLICADA: Filtro Geográfico Imediato
            if (!isAllowedLocation(modality, job.location, profileDefinition.hybridCities)) {
              console.log(`❌ [Vazamento Geográfico Rejeitado] Vaga: ${job.title} | Local: ${job.location}`);
              result.jobs.push({
                ...job,
                modality,
                score: 0,
                status: 'ignored_location' as any,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              });
              continue; 
            }

            // 🛠️ CORREÇÃO APLICADA: Filtro de Senioridade Imediato
            if (isInvalidSeniority(job.title, profileDefinition.seniority)) {
              console.log(`❌ [Senioridade Rejeitada] Vaga: ${job.title} é Junior/Estágio, Perfil é Pleno.`);
              result.jobs.push({
                ...job,
                modality,
                score: 0,
                status: 'rejected_seniority' as any,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              });
              continue; 
            }

            try {
              if (page.isClosed()) throw new Error("Página fechada pelo navegador.");
              await page.goto(job.url, { waitUntil: 'domcontentloaded', timeout: 15000 });
              await page.waitForSelector('#job-details, .jobs-description__content, article', { timeout: 4000 }).catch(() => {});
            } catch (error) {
              console.warn(`[Aviso] Erro ao abrir a vaga ${job.id} ou página fechada. Pulando...`);
              continue;
            }

            const fullDescription = await page.evaluate(() => {
              const descElement = document.querySelector(
                '#job-details, .jobs-description__content, .show-more-less-html__markup'
              );
              return descElement ? descElement.textContent?.trim() : '';
            }) || job.description || ''; 

            // ==========================================
            // 🧠 AVALIAÇÃO SEMÂNTICA VIA LLM
            // ==========================================
            console.log(`🧠 Solicitando análise da IA para: ${job.title}...`);
            const minScore = (profileDefinition as any).minScore ?? 75;
            
            const aiEvaluation = await llmEvaluator.evaluate(
              job.title, 
              fullDescription, 
              profileDefinition
            );

            const normalizedJob = {
              ...job,
              modality,
              score: aiEvaluation.score,
              status: 'found' as const,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              ai_reason: aiEvaluation.reason // Salvamos a justificativa da IA
            };

            if (!aiEvaluation.is_match || aiEvaluation.score < minScore) {
              console.log(`❌ [IA Rejeitou] Vaga: ${job.title} | Score: ${aiEvaluation.score}/${minScore}`);
              console.log(`   📝 Motivo: ${aiEvaluation.reason}`);
              
              result.jobs.push(normalizedJob);
              continue; 
            }

            console.log(`✅ [IA Aprovou] Vaga: ${job.title} | Score: ${aiEvaluation.score}/${minScore}`);
            console.log(`   📝 Motivo: ${aiEvaluation.reason}`);
            console.log(`🚀 Iniciando Candidatura...`);
            // ==========================================

            if (!autoApplyEnabled || !job.easyApply || !applyService) {
              result.jobs.push(normalizedJob);
              continue;
            }

            let applyResult: any;

            try {
              applyResult = await applyService.applyToJob(page, job.url, {
                resumePath: process.env.LINKEDIN_CV_PATH,
                coverLetter: process.env.LINKEDIN_COVER_LETTER,
                answers: {
                  email: process.env.LINKEDIN_CONTACT_EMAIL ?? '',
                  phone: process.env.LINKEDIN_CONTACT_PHONE ?? ''
                },
                profile: options.profile
              });
            } catch (error) {
              const recovery = classifyRecovery(error);

              if (!recovery.transient) {
                await context.close();
                await this.browserManager.close();
                throw new Error(recovery.reason);
              }

              result.jobs.push(normalizedJob);
              continue;
            }

            if (applyResult.status === 'submitted') {
              result.applications.push({
                jobId: job.id,
                status: 'submitted',
                result: applyResult.details,
                appliedAt: new Date().toISOString()
              });

              result.jobs.push({
                ...normalizedJob,
                status: 'applied' as const,
                applyResult: applyResult.details,
                updatedAt: new Date().toISOString()
              });

            } else if (applyResult.status === 'review') {
              const reviewId = randomUUID();
              
              result.manualReviews.push({
                id: reviewId,
                jobId: job.id,
                profile: options.profile,
                reviewStatus: 'pending',
                reviewReason: applyResult.reason ?? 'Requer revisão humana',
                reviewNotes: applyResult.details,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              });

              result.jobs.push({
                ...normalizedJob,
                status: 'pending_review' as const,
                applyResult: applyResult.details,
                updatedAt: new Date().toISOString()
              });

            } else {
              result.jobs.push(normalizedJob);
            }
      }

    await context.close();
    return result;
  }
}