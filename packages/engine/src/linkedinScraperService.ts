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
import { calculateScore } from '@autojobs/scoring';


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

    // const sessionId = `linkedin-${options.profile}`;
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

    // Se não há sessão restaurada, tenta criar uma nova
    if (!session) {
      console.warn('⚠️ Sessão LinkedIn inválida ou ausente. Iniciando rotina de login...');
      
      if (this.isHeadless) {
         console.warn('⚠️ Aviso: O browser está em modo headless (invisível).');
         console.warn('Se o login automático falhar ou cair em um Checkpoint, você não conseguirá interagir.');
      }

      // O bootstrapLogin agora puxa as credenciais do .env automaticamente na nova versão do SessionManager
      session = await sessionManager.bootstrapLogin(this.browserManager);

      console.log("🚀 ~ LinkedInScraperService ~ scrape ~ session:", session.context)
      
      // IMPORTANTE: Capturar o novo estado (cookies/storage) para os próximos usos
      const newStorageState = await session.context.storageState();
      
      // TODO: Salve `newStorageState` (string JSON ou objeto) no seu banco de dados ou arquivo 
      // usando o perfil do usuário (options.profile) como chave para passar nas futuras execuções.
      // Exemplo: await database.saveState(options.profile, JSON.stringify(newStorageState));
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

      // Função auxiliar para garantir que as palavras-chave virem uma lista (Array) real
      const parseKeywords = (val: any): string[] => {
        if (!val) return [];
        if (typeof val === 'string') return val.split(',').map(v => v.trim().toLowerCase()).filter(v => v);
        if (Array.isArray(val)) return val.map(v => v.toLowerCase());
        return Object.keys(val).map(v => v.toLowerCase()); 
      };

      for (const job of jobs) {
            // 1. ABRIR A PÁGINA COM PROTEÇÃO ANTI-CRASH
            try {
              if (page.isClosed()) throw new Error("Página fechada pelo navegador.");
              await page.goto(job.url, { waitUntil: 'domcontentloaded', timeout: 15000 });
              await page.waitForSelector('#job-details, .jobs-description__content, article', { timeout: 4000 }).catch(() => {});
            } catch (error) {
              console.warn(`[Aviso] Erro ao abrir a vaga ${job.id} ou página fechada. Pulando...`);
              continue;
            }

            // 2. EXTRAIR A DESCRIÇÃO
            const fullDescription = await page.evaluate(() => {
              const descElement = document.querySelector(
                '#job-details, .jobs-description__content, .show-more-less-html__markup'
              );
              return descElement ? descElement.textContent?.trim() : '';
            }) || job.description || ''; 

            const profileDefinition = options.profileDefinition;

            if (!profileDefinition) {
              throw new Error("profileDefinition não foi injetado na Engine!");
             }
             
            // 3. 🔍 SCANNER CORRIGIDO (String -> Array)
            const textToSearch = (job.title + ' ' + fullDescription).toLowerCase();
            const positiveKeys = [...parseKeywords(profileDefinition.searches), ...parseKeywords(profileDefinition.keywords)];
            const negativeKeys = parseKeywords(profileDefinition.negativeKeywords);

            const foundPositives = positiveKeys.filter(k => textToSearch.includes(k));
            const foundNegatives = negativeKeys.filter(k => textToSearch.includes(k));

            // 4. CALCULAR O SCORE
            const score = calculateScore({
              title: job.title,
              description: fullDescription,
              location: job.location,
              modality: job.modality as  'Remoto' | 'Híbrido' | 'Presencial' ?? normalizeModality(job.location),
              seniority: profileDefinition.seniority,
              language: options.language,
              easyApply: job.easyApply,
              positiveKeywords: positiveKeys,
              negativeKeywords: negativeKeys
            });

            const normalizedJob = {
              ...job,
              modality: job.modality ?? normalizeModality(job.location),
              score,
              status: 'found' as const,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              matchedKeywords: foundPositives,
              matchedNegativeKeywords: foundNegatives
            };

            const minScore = (profileDefinition as any).minScore ?? 75;

            // O GATILHO DE CORTE DO SCORE
            if (score < minScore) {
              console.log(`❌ [Rejeitada] Vaga: ${job.title} | Score: ${score}/${minScore}`);
              console.log(`   ✅ Achou Positivas: ${foundPositives.join(', ') || 'Nenhuma'}`);
              console.log(`   🚫 Achou Negativas: ${foundNegatives.join(', ') || 'Nenhuma'}`);
              result.jobs.push(normalizedJob);
              continue; 
            }

            console.log(`✅ [Aprovada] Vaga: ${job.title} | Score: ${score}/${minScore}. Iniciando Candidatura...`);

            // 5. VERIFICAÇÃO FINAL ANTES DE APLICAR
            if (!autoApplyEnabled || !job.easyApply || !applyService) {
              result.jobs.push(normalizedJob);
              continue;
            }

            let applyResult: any;

            try {
              // Como já estamos na página da vaga, o applyService.openJobPage vai pular o page.goto inteligente!
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

            // Tratamento de Sucesso / Review
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