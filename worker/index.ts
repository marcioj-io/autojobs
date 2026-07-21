import { normalizeProfileInput, ProfileInputSchema, SettingsRecord } from '@autojobs/shared';
import type { ExecutionContext, ScheduledEvent } from '@cloudflare/workers-types';
import { getServices } from './src/services';
import { RuntimeController } from './src/runtime/RuntimeController';

export interface WorkerEnv {
  AUTOD1: any;
  ENGINE_URL: string;
}

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
  const allowedOrigin = isOriginAllowed(origin)
    ? origin
    : ALLOWED_ORIGINS[2];

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

function parseModalities(value?: string) {
  try {
    return JSON.parse(
      value || '["remoto", "híbrido"]'
    );
  } catch {
    return [
      'remoto',
      'híbrido'
    ];
  }
}

function ensureArray(value: any, fallback: string[]): string[] {
  if (!value) return fallback;
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      return value.split(',').map(s => s.trim());
    }
  }
  return fallback;
}

async function runScheduled(env: WorkerEnv) {
  const {
    persistence,
    db,
    auditLogsService,
    engineClient
  } = await getServices(env);

  const profiles = await persistence.getAllProfiles();

  if (!profiles?.length) {
    console.log('[SCHEDULER] Nenhum profile encontrado');
    return;
  }

  for (const profile of profiles) {
    console.log(
      `[SCHEDULER] Profile: ${profile.name}`
    );

    // 🌟 CORREÇÃO: Usando targetRoles e a proteção de Array
    const queries = ensureArray(profile.targetRoles, ['Desenvolvedor']);

    const controller = new RuntimeController(
      db,
      persistence,
      auditLogsService,
      `runtime-${profile.name}`,
      engineClient,
      env
    );

    for (const query of queries) {
      try {
        console.log(
          `[SCHEDULER] Executando ${profile.name} -> ${query}`
        );

        // 🌟 CORREÇÃO: arrays bem definidos para localidade e modalidade
        const locations = ensureArray(profile.searchLocation, ['Brasil']);
        const locationStr = locations[0] || 'Brasil';
        const modalities = ensureArray(profile.allowedModalities, ['remoto', 'híbrido']);

        await controller.execute({
          runId: crypto.randomUUID(),
          profileName: profile.name,
          profile,
          query,
          location: locationStr,
          language: 'PT',
          maxResults: 20,
          modalities: modalities
        });

      } catch (error) {
        console.error(
          `[SCHEDULER] Erro profile=${profile.name} query=${query}`,
          error
        );
      }
    }
  }
}

export default {

  async scheduled(
    event: ScheduledEvent,
    env: WorkerEnv,
    ctx: ExecutionContext
  ) {
    ctx.waitUntil(
      runScheduled(env)
    );
  },

  async fetch(request: Request, env: WorkerEnv, ctx: ExecutionContext ) {
    const url = new URL(request.url);
    const pathname = url.pathname;
    const origin = request.headers.get('Origin') || '';
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

          // 1) Validação básica com Zod (rejeita payloads malformados)
          const parsed = ProfileInputSchema.safeParse(body);
          if (!parsed.success) {
            const err = parsed.error.flatten();
            return withCors(new Response(JSON.stringify({ message: 'Payload inválido', details: err }), { status: 400, headers: { 'Content-Type': 'application/json' } }), origin);
          }

          // 2) Normalização completa
          const normalized = normalizeProfileInput(parsed.data);

          // 3) Garante id
          if (!normalized.id) normalized.id = crypto.randomUUID();

          // 4) Persist via service (service também normaliza defensivamente)
          const profile = await persistence.createProfile(normalized);

          return withCors(new Response(JSON.stringify(profile), {
            status: 201,
            headers: { 'Content-Type': 'application/json' }
          }), origin);

        } catch (error: any) {
          console.error(error);
          return withCors(new Response(JSON.stringify({
            message: error.message,
            cause: error.cause?.message,
            stack: error.stack
          }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          }), origin);
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
        const execution = runScheduled(env);

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

      if (pathname === '/session-cookies' && request.method === 'POST') {
        try {
          const { persistence } = await resolveServices(env);

          const body = await request.json();

          const session = await persistence.upsertLinkedInSession({
            id: body.profile,
            profile: body.profile,
            cookies: body.cookies
          });

          return withCors(
            Response.json({ success: true, session }),
            origin
          );

        } catch (error) {
          console.error(error);

          return withCors(
            Response.json(
              { error: 'Failed to save session' },
              { status: 500 }
            ),
            origin
          );
        }
      }

      // 404
      return withCors(new Response('Not Found', { status: 404 }), origin);
    } catch (error) {
      return withCors(new Response('Internal Server Error', { status: 500 }), origin);
    }
  },


};
