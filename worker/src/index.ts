// worker\src\index.ts
import { SettingsRecord } from '@autojobs/shared';
import { RuntimeController } from './runtime/RuntimeController';
import { getServices } from './services';

// Tipagens nativas do ambiente Cloudflare Workers
import type { ExecutionContext, ScheduledEvent } from '@cloudflare/workers-types';

export interface WorkerEnv {
  AUTOD1: any; // Pode ser D1Database se você tiver o tipo exato exportado
  ENGINE_URL: string;
  // WORKER_SECRET_KEY?: string; // Usado para proteger a rota manual
}

/**
 * CORS Configuration & Helper Functions
 */
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'https://autojobs-dashboard-3ox.pages.dev'
];

async function resolveServices(env: WorkerEnv) {
  return getServices(env);
}

function isOriginAllowed(origin: string): boolean {
  return ALLOWED_ORIGINS.includes(origin);
}

function withCors(response: Response, origin: string): Response {
  const allowedOrigin = isOriginAllowed(origin) ? origin : ALLOWED_ORIGINS[2]; // fallback to production
  
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', allowedOrigin);
  headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  headers.set('Access-Control-Max-Age', '86400');
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

/**
 * Cloudflare Worker Fetch Handler
 */
export default {

  async fetch(request: Request,env: WorkerEnv, ctx: ExecutionContext) {
  const url = new URL(request.url);
  const pathname = url.pathname;
  const origin = request.headers.get('Origin') || '';


    async function runScheduled(env: WorkerEnv, mode?: string) {
      console.log('[SCHEDULER] START runScheduled mode=', mode);

      try {
        const { persistence, db, auditLogsService, engineClient } =
          await getServices(env);

        const profiles = await persistence.getAllProfiles();

        console.log('[SCHEDULER] profiles loaded:', profiles?.length ?? 0);

        if (!profiles?.length) {
          console.log('[SCHEDULER] no profiles - exit');
          return;
        }
        
        for (const profile of profiles) {
          console.log('[SCHEDULER] profile start:', profile.name);
          
          const profileModalities = JSON.parse(profile.allowedModalities || '["remoto", "híbrido"]');
          const controller = new RuntimeController(
            db,
            persistence,
            auditLogsService,
            `manual-${profile.name}`,
            engineClient,
            env
          );

          const queries = (profile.searches ?? '')
            .split(',')
            .map((q: string) => q.trim())
            .filter(Boolean);

          for (const query of queries) {
            console.log('[SCHEDULER] executing:', profile.name, query);

            try {
              await controller.execute({
                runId: crypto.randomUUID(),
                profile: profile.name,
                query,
                location: profile.searchLocation || 'Brasil',
                language: 'PT',
                maxResults: 20,
                modalities: profileModalities,
                profileDefinition: profile
              });

              console.log('[SCHEDULER] done:', profile.name, query);
            } catch (err) {
              console.error('[SCHEDULER] ERROR:', profile.name, query, err);
            }
          }
        }

        console.log('[SCHEDULER] END runScheduled');
      } catch (err) {
        console.error('[SCHEDULER] FATAL runScheduled:', err);
      }
    }

    try {
      // Handle CORS preflight requests (OPTIONS)
      if (request.method === 'OPTIONS') {
        return withCors(
          new Response(null, { status: 204 }),
          origin
        );
      }

      // Health check
      if (pathname === '/health' && request.method === 'GET') {
        try {
          const { persistence } = await resolveServices(env);
          const sessions = await persistence.getSessions();

          return withCors(new Response(JSON.stringify({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            database: 'connected',
            sessions_count: sessions.length
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          }), origin);
        } catch (error) {
          return withCors(new Response(JSON.stringify({
            status: 'error',
            message: error instanceof Error ? error.message : String(error)
          }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          }), origin);
        }
      }

      // Runtime state
      if (pathname === '/runtime' && request.method === 'GET') {
        try {
          const { runtime } = await resolveServices(env);
          await runtime.ensureState('default');
          const state = await runtime.getState('default');

          return withCors(new Response(JSON.stringify(state), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          }), origin);
        } catch (error) {
          return withCors(new Response(JSON.stringify({
            status: 'error',
            message: error instanceof Error ? error.message : String(error)
          }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          }), origin);
        }
      }

      // Audit logs
      if (pathname === '/audit' && request.method === 'GET') {
        try {
          const { auditLogsService } = await resolveServices(env);
          const logs = await auditLogsService.getRecentAuditLogs(50);

          return withCors(new Response(JSON.stringify({ logs }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          }), origin);
        } catch (error) {
          return withCors(new Response(JSON.stringify({
            status: 'error'
          }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          }), origin);
        }
      }

      // Jobs - GET all jobs
      if (pathname === '/jobs' && request.method === 'GET') {
        try {
          const { persistence } = await resolveServices(env);
          const jobs = await persistence.getAllJobs();

          return withCors(new Response(JSON.stringify(jobs), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          }), origin);
        } catch (error) {
          return withCors(new Response(JSON.stringify({ jobs: [] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          }), origin);
        }
      }

      // Applications - GET all applications
      if (pathname === '/applications' && request.method === 'GET') {
        try {
          const { persistence } = await resolveServices(env);
          const applications = await persistence.getApplications();

          return withCors(new Response(JSON.stringify(applications), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          }), origin);
        } catch (error) {
          return withCors(new Response(JSON.stringify({ applications: [] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          }), origin);
        }
      }

      // Reviews - GET all pending reviews
      if (pathname === '/reviews' && request.method === 'GET') {
        try {
          const { persistence } = await resolveServices(env);
          const reviews = await persistence.getPendingReviews();

          return withCors(new Response(JSON.stringify(reviews), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          }), origin);
        } catch (error) {
          return withCors(new Response(JSON.stringify({ reviews: [] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          }), origin);
        }
      }

      // Reviews - POST batch manual reviews
      if (pathname === '/reviews' && request.method === 'POST') {
        try {
          const { persistence } = await resolveServices(env);
          
          // O Engine envia um array de reviews
          const reviewsData = await request.json();

          if (!Array.isArray(reviewsData)) {
            return withCors(new Response(JSON.stringify({ error: 'Payload deve ser um array de reviews' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' }
            }), origin);
          }

          // Inserindo cada review no banco
          for (const review of reviewsData) {
            await persistence.createManualReview(review);
          }

          return withCors(new Response(JSON.stringify({ 
            success: true, 
            message: `${reviewsData.length} reviews manuais salvas com sucesso.` 
          }), {
            status: 201, // 201 Created
            headers: { 'Content-Type': 'application/json' }
          }), origin);

        } catch (error) {
          console.error('Erro ao salvar reviews manuais:', error);
          const errorMessage = error instanceof Error ? error.message : 'Erro interno desconhecido';
          
          return withCors(new Response(JSON.stringify({ error: 'Falha ao salvar reviews manuais', details: errorMessage }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          }), origin);
        }
      }
      
      // Profiles - GET all profiles
      if (pathname === '/profiles' && request.method === 'GET') {
        try {
          const { persistence } = await resolveServices(env);
          const profiles = await persistence.getAllProfiles();

          return withCors(new Response(JSON.stringify(profiles), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          }), origin);
        } catch (error) {
          return withCors(new Response(JSON.stringify({ profiles: [] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          }), origin);
        }
      }

      // Profiles - POST create
      if (pathname === '/profiles' && request.method === 'POST') {
        try {
          const { persistence } = await resolveServices(env);
          const body = await request.json();
          // const persistence = new PersistenceService(db);
          const profile = await persistence.createProfile(body);

          return withCors(new Response(JSON.stringify(profile), {
            status: 201,
            headers: { 'Content-Type': 'application/json' }
          }), origin);
        } catch (error: any) {
        console.error(error);
        console.error(error.cause);

        return new Response(
          JSON.stringify({
            message: error.message,
            cause: error.cause?.message,
            stack: error.stack,
          }),
          {
            status: 500,
            headers: {
              "Content-Type": "application/json",
            },
          }
        );
      }
      }

      // Settings - GET
      if (pathname === '/settings' && request.method === 'GET') {
        try {
          const url = new URL(request.url);
          const id = url.searchParams.get('id') || 'default';
          
          const { persistence } = await resolveServices(env); 
          const settings = await persistence.getSettings(id);

          return withCors(new Response(JSON.stringify(settings || {}), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          }), origin);
        } catch (error) {
          return withCors(new Response(JSON.stringify({}), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          }), origin);
        }
      }

      // Settings - POST/PUT upsert
      if (pathname === '/settings' && (request.method === 'POST' || request.method === 'PUT')) {
        try {
          const { persistence } = await resolveServices(env);
          const body = (await request.json()) as SettingsRecord;
          const settings = await persistence.upsertSettings(body);

          return withCors(new Response(JSON.stringify(settings), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          }), origin);
        } catch (error) {
          return withCors(new Response(JSON.stringify({
            error: error instanceof Error ? error.message : String(error)
          }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          }), origin);
        }
      }

      // Logs - GET recent audit logs
      if (pathname === '/logs' && request.method === 'GET') {
        try {
          const { auditLogsService } = await resolveServices(env);
          const logs = await auditLogsService.getRecentAuditLogs(50);

          return withCors(new Response(JSON.stringify(logs), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          }), origin);
        } catch (error) {
          return withCors(new Response(JSON.stringify([]), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          }), origin);
        }
      }
      
      if (pathname === '/trigger-schedule' && request.method === 'POST') {
        const execution = runScheduled(env, 'manual');

        ctx.waitUntil(execution);

        return Response.json({
          status: 'triggered'
        });
      }

      // 1. Rota para a Engine Local baixar os cookies salvos no D1
      if (pathname === '/session-cookies' && request.method === 'GET') {
        try {
          const { persistence } = await resolveServices(env);
          const session = await persistence.getLinkedInSession('linkedin-default');
          
          return withCors(new Response(JSON.stringify(session || null), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          }), origin);
        } catch (error) {
          return withCors(new Response(JSON.stringify({ error: 'Failed to fetch session' }), { status: 500 }), origin);
        }
      }

      // 2. Rota para a Engine Local enviar as vagas coletadas de volta para o D1
      if (pathname === '/jobs' && request.method === 'POST') {
        try {
          const { persistence } = await resolveServices(env);
          const body = await request.json(); // Pode ser uma vaga única ou Array de vagas
          
          if (Array.isArray(body)) {
            for (const job of body) {
              await persistence.persistJob(job);
            }
          } else {
            await persistence.persistJob(body);
          }

          return withCors(new Response(JSON.stringify({ success: true, message: 'Jobs persisted successfully' }), {
            status: 201,
            headers: { 'Content-Type': 'application/json' }
          }), origin);
        } catch (error) {
          return withCors(new Response(JSON.stringify({
            error: error instanceof Error ? error.message : String(error)
          }), { status: 500 }), origin);
        }
      }

      // 404
      return withCors(new Response('Not Found', { status: 404 }), origin);
    } catch (error) {
      return withCors(new Response('Internal Server Error', { status: 500 }), origin);
    }
  },

  async scheduled(event: ScheduledEvent, env: WorkerEnv, ctx: ExecutionContext) {
    const { persistence, db, auditLogsService, engineClient, searchFilters } = await resolveServices(env);
    
    // 2. Busca todos os perfis cadastrados no banco
    const profiles = await persistence.getAllProfiles();

    if (!profiles || profiles.length === 0) {
      console.log('Cron ignorado: Nenhum perfil encontrado no banco de dados.');
      return;
    }

    ctx.waitUntil(
      (async () => {
        for (const profile of profiles) {
          const profileModalities = JSON.parse(profile.allowedModalities || '["remoto", "híbrido"]');
          const controller = new RuntimeController(
            db,
            persistence,
            auditLogsService,
            `runtime-${profile.name}`,
            engineClient,
            env
          );

          const queries = profile.searches
            .split(',')
            .map((q: string) => q.trim())
            .filter(Boolean);

          for (const query of queries) {
            try {
              await controller.execute({
                runId: crypto.randomUUID(),
                profile: profile.name,
                query,
                location: profile.searchLocation || 'Brasil',
                language: 'PT',
                maxResults: 20,
                modalities: profileModalities,
                profileDefinition: profile
              });
            } catch (error) {
              console.error(
                `[CRON] Erro profile=${profile.name} query=${query}`,
                error
              );
            }
          }
        }
      })()
    );
  }
  
};
