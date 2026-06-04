// worker/src/services.ts
import {
  PersistenceService,
  RuntimeService,
  AuditLogsService,
  SearchFilterService,
  bootstrapDatabase
} from '@autojobs/db';

export async function getServices(env: { AUTOD1: any }) {
  const db = await bootstrapDatabase(env.AUTOD1);

  if (!db) {
    throw new Error('Database unavailable');
  }

  const persistence = new PersistenceService(db);
  const runtime = new RuntimeService(db);
  const audit = new AuditLogsService(db);
  const searchFilters = new SearchFilterService(db);

  return {
    persistence,
    runtime,
    audit,
    searchFilters
  };
}