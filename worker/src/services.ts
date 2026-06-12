// worker/src/services.ts
import {
  PersistenceService,
  RuntimeService,
  AuditLogsService,
  SearchFilterService,
  bootstrapDatabase
} from '@autojobs/db';

// Importe o client da engine
import { EngineClient } from '@autojobs/engine';

// Tipagem do env atualizada para exigir a URL da engine
export async function getServices(env: { AUTOD1: any; ENGINE_URL: string }) {
  const db = await bootstrapDatabase(env.AUTOD1);

  if (!db) {
    throw new Error('Database unavailable');
  }

  // Inicializando os serviços do DB
  const persistence = new PersistenceService(db);
  const runtime = new RuntimeService(db);
  const auditLogsService = new AuditLogsService(db); // Ajustado o nome para bater com o index.ts
  const searchFilters = new SearchFilterService(db);
  
  // Inicializando o client da Engine repassando a variável de ambiente
  const engineClient = new EngineClient(env.ENGINE_URL);

  return {
    db,               // Faltava exportar o db cru
    persistence,
    runtime,
    auditLogsService, // Nome unificado
    searchFilters,
    engineClient      // Exportando o client da engine
  };
}