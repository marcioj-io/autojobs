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
import {
  backendProfile,
  frontendProfile,
  fullstackProfile
} from '@autojobs/profiles';
import { calculateScore } from '@autojobs/scoring';

const profileDefinitions = {
  backend: backendProfile,
  frontend: frontendProfile,
  fullstack: fullstackProfile
};

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

  constructor(headless = false) {
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

    const sessionId = `linkedin-${options.profile}`;

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
      
      console.log('✅ Nova sessão de login estabelecida!');

      // IMPORTANTE: Capturar o novo estado (cookies/storage) para os próximos usos
      const newStorageState = await session.context.storageState();
      
      // TODO: Salve `newStorageState` (string JSON ou objeto) no seu banco de dados ou arquivo 
      // usando o perfil do usuário (options.profile) como chave para passar nas futuras execuções.
      // Exemplo: await database.saveState(options.profile, JSON.stringify(newStorageState));
    }

    const { page, context } = session;

    const jobs = await searchLinkedInJobs(page, options);

    const profileDefinition =
      profileDefinitions[
        options.profile as keyof typeof profileDefinitions
      ] ?? backendProfile;

    const autoApplyEnabled = process.env.LINKEDIN_AUTO_APPLY === 'true';

    const applyService = autoApplyEnabled
      ? new LinkedInApplyService({
          profile: options.profile,
          language: options.language
        })
      : null;

    for (const job of jobs) {
      const score = calculateScore({
        title: job.title,
        description: job.description ?? '',
        location: job.location,
        modality: (job.modality ?? normalizeModality(job.location)) as
          | 'Remoto'
          | 'Híbrido'
          | 'Presencial',
        seniority: profileDefinition.seniority,
        language: options.language,
        easyApply: job.easyApply,

        positiveKeywords: [
          ...profileDefinition.searches,
          ...Object.keys(profileDefinition.keywords)
        ],

        negativeKeywords: Object.keys(
          profileDefinition.negativeKeywords
        )
      });

      const normalizedJob = {
        ...job,
        modality: job.modality ?? normalizeModality(job.location),
        score,
        status: 'found' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      result.jobs.push(normalizedJob);

      if (!autoApplyEnabled || !job.easyApply || !applyService) {
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
      }

      if (applyResult.status === 'review') {
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
      }
    }

    await context.close();
    await this.browserManager.close();

    return result;
  }
}