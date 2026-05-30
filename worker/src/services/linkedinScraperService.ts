import { randomUUID } from 'node:crypto';
import {
  BrowserManager,
  LinkedInSessionManager,
  LinkedInApplyService,
  searchLinkedInJobs,
  classifyRecovery,
  SessionRotationService,
  type LinkedInSearchOptions,
  type LinkedInSessionAdapter
} from '@autojobs/linkedin';
import { AuditLogsService, PersistenceService } from '@autojobs/db';
import { calculateScore } from '@autojobs/scoring';
import { backendProfile, frontendProfile, fullstackProfile } from '@autojobs/profiles';

class D1SessionAdapter implements LinkedInSessionAdapter {
  constructor(private persistence: PersistenceService, private sessionId: string, private profile: string) {}

  async load(sessionId: string) {
    const session = await this.persistence.getLinkedInSession(sessionId);
    return session?.cookies ?? null;
  }

  async save(sessionId: string, storageState: string) {
    await this.persistence.upsertLinkedInSession({ id: sessionId, profile: this.profile, cookies: storageState });
  }
}

const profileDefinitions = {
  backend: backendProfile,
  frontend: frontendProfile,
  fullstack: fullstackProfile
};

function normalizeModality(location: string) {
  const normalized = location.toLowerCase();
  if (normalized.includes('remoto') || normalized.includes('remote')) return 'Remoto';
  if (normalized.includes('presencial') || normalized.includes('onsite')) return 'Presencial';
  return 'Híbrido';
}

export class LinkedInScraperService {
  private persistence: PersistenceService;
  private browserManager: BrowserManager;
  private auditLogsService?: AuditLogsService;

  constructor(persistence: PersistenceService, auditLogsService?: AuditLogsService, headless = true) {
    this.persistence = persistence;
    this.browserManager = new BrowserManager({ headless });
    this.auditLogsService = auditLogsService;
  }

  async scrape(options: LinkedInSearchOptions) {
    const sessionId = `linkedin-${options.profile}`;
    const adapter = new D1SessionAdapter(this.persistence, sessionId, options.profile);
    const sessionManager = new LinkedInSessionManager(adapter, sessionId);

    const rotationService = new SessionRotationService();
    const session = await sessionManager.restoreAuthenticatedSession(this.browserManager);
    const healthStatus = session
      ? rotationService.evaluate(sessionId, [])
      : rotationService.evaluate(sessionId, [{ type: 'missing_session', weight: 80 }]);

    if (rotationService.shouldRotate(healthStatus)) {
      await this.auditLogsService?.recordAuditLog({
        eventType: 'session',
        action: 'rotation_required',
        message: `LinkedIn session rotation recommended for profile ${options.profile}.`,
        source: 'worker.linkedin',
        metadata: JSON.stringify({ profile: options.profile, sessionId, healthScore: healthStatus.healthScore }),
        severity: 'warning'
      });
    }

    if (session) {
      await this.auditLogsService?.recordAuditLog({
        eventType: 'session',
        action: 'restored',
        message: `LinkedIn session restored for profile ${options.profile}.`,
        source: 'worker.linkedin',
        metadata: JSON.stringify({ profile: options.profile, sessionId }),
        severity: 'info'
      });
    }

    await this.persistence.persistSessionHealth({
      sessionId: healthStatus.sessionId,
      healthScore: healthStatus.healthScore,
      status: healthStatus.status,
      reason: healthStatus.reason ?? null,
      lastValidatedAt: new Date(healthStatus.lastValidatedAt),
      cooldownUntil: null
    });

    if (!session) {
      await this.auditLogsService?.recordAuditLog({
        eventType: 'session',
        action: 'login_required',
        message: `LinkedIn session missing or invalid for profile ${options.profile}.`,
        source: 'worker.linkedin',
        metadata: JSON.stringify({ profile: options.profile, sessionId }),
        severity: 'error'
      });
      await this.browserManager.close();
      throw new Error('Sessão LinkedIn inválida ou ausente. Execute o bootstrap de login manual antes de usar o scraper.');
    }

    const { page, context } = session;
    const jobs = await searchLinkedInJobs(page, options);
    const profileDefinition = profileDefinitions[options.profile as keyof typeof profileDefinitions] ?? backendProfile;
    const autoApplyEnabled = process.env.LINKEDIN_AUTO_APPLY === 'true';
    const applyService = autoApplyEnabled
      ? new LinkedInApplyService({ profile: options.profile, language: options.language })
      : null;

    for (const job of jobs) {
      const score = calculateScore({
        title: job.title,
        description: job.description ?? '',
        location: job.location,
        modality: job.modality ?? normalizeModality(job.location),
        seniority: profileDefinition.seniority,
        language: options.language,
        easyApply: job.easyApply,
        keywords: [...profileDefinition.searches, ...Object.keys(profileDefinition.keywords)]
      });

      await this.persistence.persistJob({
        ...job,
        modality: job.modality ?? normalizeModality(job.location),
        score,
        status: 'found',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      if (autoApplyEnabled && job.easyApply && applyService) {
        let result;
        try {
          result = await applyService.applyToJob(page, job.url, {
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
          await this.persistence.persistLog({
            type: 'recovery',
            message: recovery.reason,
            source: 'linkedin-scraper',
            level: recovery.transient ? 'warning' : 'error'
          });
          await this.auditLogsService?.recordAuditLog({
            eventType: 'recovery',
            action: recovery.transient ? 'retry' : 'block',
            message: `Recovery event for job ${job.id}: ${recovery.reason}`,
            source: 'worker.linkedin',
            metadata: JSON.stringify({ jobId: job.id, profile: options.profile, transient: recovery.transient }),
            severity: recovery.transient ? 'warning' : 'error'
          });
          if (!recovery.transient) {
            await context.close();
            await this.browserManager.close();
            throw new Error(recovery.reason);
          }
          continue;
        }

        if (result.status === 'submitted') {
          await this.persistence.persistApplication({
            jobId: job.id,
            status: 'submitted',
            result: result.details,
            appliedAt: new Date().toISOString()
          });
          await this.persistence.persistJob({
            ...job,
            modality: job.modality ?? normalizeModality(job.location),
            score,
            status: 'applied',
            applyResult: result.details,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
          await this.auditLogsService?.recordAuditLog({
            eventType: 'application',
            action: 'auto_apply',
            message: `Applied automatically to job ${job.id}.`,
            source: 'worker.linkedin',
            metadata: JSON.stringify({ jobId: job.id, profile: options.profile }),
            severity: 'info'
          });
        } else if (result.status === 'review') {
          await this.persistence.createManualReview({
            id: randomUUID(),
            jobId: job.id,
            profile: options.profile,
            reviewStatus: 'pending',
            reviewReason: result.reason ?? 'Requer revisão humana',
            reviewNotes: result.details,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
          await this.persistence.persistJob({
            ...job,
            modality: job.modality ?? normalizeModality(job.location),
            score,
            status: 'pending_review',
            applyResult: result.details,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
          await this.auditLogsService?.recordAuditLog({
            eventType: 'application',
            action: 'manual_review_required',
            message: `Manual review required for job ${job.id}.`,
            source: 'worker.linkedin',
            metadata: JSON.stringify({ jobId: job.id, profile: options.profile }),
            severity: 'warning'
          });
        }
      }
    }

    await context.close();
    await this.browserManager.close();
    return jobs;
  }
}
