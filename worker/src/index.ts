import { backendProfile, frontendProfile, fullstackProfile } from '@autojobs/profiles';
import { initializeDatabase } from './db';
import { PersistenceService, bootstrapDatabase, AuditLogsService } from '@autojobs/db';
import { LinkedInScraperService } from './services/linkedinScraperService';
import { RuntimeController } from './runtime/RuntimeController';

async function main() {
  const client = undefined as any; // placeholder — Wrangler will inject D1 binding at runtime
  const db = await bootstrapDatabase(client) ?? initializeDatabase(client);
  const persistence = db ? new PersistenceService(db) : null;
  const auditLogs = db ? new AuditLogsService(db) : null;

  console.info('AutoJobs Worker inicializado');
  console.info('Perfis carregados:', [backendProfile.name, frontendProfile.name, fullstackProfile.name]);

  if (persistence && db && auditLogs) {
    await persistence.persistLog({
      type: 'startup',
      message: 'Worker inicializado com suporte a D1',
      source: 'worker',
      level: 'info'
    });

    const scraper = new LinkedInScraperService(persistence, auditLogs, process.env.PLAYWRIGHT_HEADLESS !== 'false');
    const runtime = new RuntimeController(db, persistence, scraper, auditLogs);
    const runtimeResult = await runtime.execute({
      runId: process.env.RUN_ID ?? `run-${Date.now()}`,
      profile: process.env.LINKEDIN_PROFILE ?? 'backend',
      query: process.env.LINKEDIN_QUERY ?? 'Backend Developer',
      location: process.env.LINKEDIN_LOCATION ?? 'Brasil',
      language: (process.env.LINKEDIN_LANGUAGE as 'PT' | 'EN' | 'ES') ?? 'PT',
      maxResults: Number(process.env.LINKEDIN_MAX_RESULTS ?? 12)
    });

    console.info('Resultado da execução do runtime:', runtimeResult);
  }
}

main().catch((error) => {
  console.error('Worker falhou durante a inicialização', error);
  process.exit(1);
});
