// worker\src\index.ts
import { SettingsRecord } from '@autojobs/shared';
import { RuntimeController } from './runtime/RuntimeController';
import { getServices } from './services';

// Tipagens nativas do ambiente Cloudflare Workers
import type { ExecutionContext, ScheduledEvent } from '@cloudflare/workers-types';

export interface WorkerEnv {
  AUTOD1: any; // Pode ser D1Database se você tiver o tipo exato exportado
  ENGINE_URL: string;
  WORKER_SECRET_KEY?: string; // Usado para proteger a rota manual
  // Adicione aqui outras variáveis que o RuntimeController espera
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
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
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

      // Search filters - GET all for profile or GET specific
      if (pathname.startsWith('/search-filters') && request.method === 'GET') {
        try {
          const { searchFilters } =
            await resolveServices(env);
          const url = new URL(request.url);
          const profile = url.searchParams.get('profile');
          const id = url.searchParams.get('id');

          if (id) {
            const filter =
            await searchFilters.getSearchFilter(id);
            return withCors(new Response(JSON.stringify(filter), {
              status: filter ? 200 : 404,
              headers: { 'Content-Type': 'application/json' }
            }), origin);
          }

          if (profile) {
            const filters =
            await searchFilters.getProfileSearchFilters(profile);
            return withCors(new Response(JSON.stringify({ filters }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            }), origin);
          }

          return withCors(new Response(JSON.stringify({ error: 'profile or id required' }), { status: 400 }), origin);
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

      // Search filters - POST create
      if (pathname === '/search-filters' && request.method === 'POST') {
        try {
          const { searchFilters } =
            await resolveServices(env);          
          const body = await request.json();
          const filter =
          await searchFilters.createSearchFilter(
            body.profile,
            body
          );
          return withCors(new Response(JSON.stringify(filter), {
            status: 201,
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

      // Search filters - PUT update
      if (pathname.startsWith('/search-filters/') && request.method === 'PUT') {4
          const id = pathname.split('/')[2];

        try {
        const { searchFilters } =
          await resolveServices(env);
          const body = await request.json();
           const filter =await searchFilters.updateSearchFilter(
              id,
              body
            );

          return withCors(new Response(JSON.stringify(filter), {
            status: filter ? 200 : 404,
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

      // Search filters - DELETE
      if (pathname.startsWith('/search-filters/') && request.method === 'DELETE') {
          const id = pathname.split('/')[2];

        try {
          const { searchFilters } =
            await resolveServices(env);
          const deleted =
            await searchFilters.deleteSearchFilter(id);

          return withCors(new Response(JSON.stringify({ deleted }), {
            status: deleted ? 200 : 404,
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
        } catch (error) {
          return withCors(new Response(JSON.stringify({
            error: error instanceof Error ? error.message : String(error)
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

      // 404
      return withCors(new Response('Not Found', { status: 404 }), origin);
    } catch (error) {
      return withCors(new Response('Internal Server Error', { status: 500 }), origin);
    }
  },

  async scheduled(event: ScheduledEvent, env: WorkerEnv, ctx: ExecutionContext) {
    const { persistence, db, auditLogsService, engineClient } = await resolveServices(env);
    
    const controller = new RuntimeController(
      db,
      persistence,
      auditLogsService,
      'main',
      engineClient,
      env
    );

    // O ctx.waitUntil garante que o Worker não morra antes de terminar a raspagem
    ctx.waitUntil(
      controller.execute({
        runId: crypto.randomUUID(),
        profile: 'backend', // Puxe do DB ou de configurações se necessário
        query: 'backend engineer',
        location: 'Brasil',
        language: 'PT',
        maxResults: 20
      })
    );
  }
};
