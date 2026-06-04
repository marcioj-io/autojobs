// worker\src\index.ts
import { bootstrapDatabase, SearchFilterService } from '@autojobs/db';
import { getServices } from './services';

interface WorkerEnv {
  AUTOD1: any; // D1Database from wrangler
}

/**
 * CORS Configuration & Helper Functions
 */
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'https://autojobs-dashboard-3ox.pages.dev'
];

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
          const db = await bootstrapDatabase(env.AUTOD1);
          if (!db) {
            return withCors(new Response(JSON.stringify({ status: 'error', reason: 'Database init failed' }), {
              status: 500,
              headers: { 'Content-Type': 'application/json' }
            }), origin);
          }

          const { persistence } = await getServices(env);
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
          const db = await bootstrapDatabase(env.AUTOD1);
          if (!db) {
            return withCors(new Response(JSON.stringify({ status: 'error' }), { status: 500 }), origin);
          }

          const { runtime } = await getServices(env);
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
          const db = await bootstrapDatabase(env.AUTOD1);
          if (!db) {
            return withCors(new Response(JSON.stringify({ status: 'error' }), { status: 500 }), origin);
          }

          const { audit } = await getServices(env);
          const logs = await audit.getRecentAuditLogs(50);

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
          const db = await bootstrapDatabase(env.AUTOD1);
          if (!db) {
            return withCors(new Response(JSON.stringify({ status: 'error' }), { status: 500 }), origin);
          }

          const service = new SearchFilterService(db);
          const url = new URL(request.url);
          const profile = url.searchParams.get('profile');
          const id = url.searchParams.get('id');

          if (id) {
            const filter = await service.getSearchFilter(id);
            return withCors(new Response(JSON.stringify(filter), {
              status: filter ? 200 : 404,
              headers: { 'Content-Type': 'application/json' }
            }), origin);
          }

          if (profile) {
            const filters = await service.getProfileSearchFilters(profile);
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
          const db = await bootstrapDatabase(env.AUTOD1);
          if (!db) {
            return withCors(new Response(JSON.stringify({ status: 'error' }), { status: 500 }), origin);
          }

          const body = await request.json();
          const service = new SearchFilterService(db);
          const filter = await service.createSearchFilter(body.profile, body);

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
      if (pathname.startsWith('/search-filters/') && request.method === 'PUT') {
        try {
          const id = pathname.split('/')[2];
          const db = await bootstrapDatabase(env.AUTOD1);
          if (!db) {
            return withCors(new Response(JSON.stringify({ status: 'error' }), { status: 500 }), origin);
          }

          const body = await request.json();
          const service = new SearchFilterService(db);
          const filter = await service.updateSearchFilter(id, body);

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
        try {
          const id = pathname.split('/')[2];
          const db = await bootstrapDatabase(env.AUTOD1);
          if (!db) {
            return withCors(new Response(JSON.stringify({ status: 'error' }), { status: 500 }), origin);
          }

          const service = new SearchFilterService(db);
          const deleted = await service.deleteSearchFilter(id);

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
          const db = await bootstrapDatabase(env.AUTOD1);
          if (!db) {
            return withCors(new Response(JSON.stringify({ jobs: [] }), { status: 200 }), origin);
          }

          const { persistence } = await getServices(env); 
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
          const db = await bootstrapDatabase(env.AUTOD1);
          if (!db) {
            return withCors(new Response(JSON.stringify({ applications: [] }), { status: 200 }), origin);
          }

          const { persistence } = await getServices(env); 
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
          const db = await bootstrapDatabase(env.AUTOD1);
          if (!db) {
            return withCors(new Response(JSON.stringify({ reviews: [] }), { status: 200 }), origin);
          }

          // const persistence = new PersistenceService(db);
          const { persistence } = await getServices(env); 
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
          const db = await bootstrapDatabase(env.AUTOD1);
          if (!db) {
            return withCors(new Response(JSON.stringify({ profiles: [] }), { status: 200 }), origin);
          }

                    // const persistence = new PersistenceService(db);
          const { persistence } = await getServices(env); 
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
          const db = await bootstrapDatabase(env.AUTOD1);
          if (!db) {
            return withCors(new Response(JSON.stringify({ error: 'Database unavailable' }), { status: 500 }), origin);
          }

          const body = await request.json();
          // const persistence = new PersistenceService(db);
          const { persistence } = await getServices(env); 
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
          
          const db = await bootstrapDatabase(env.AUTOD1);
          if (!db) {
            return withCors(new Response(JSON.stringify({}), { status: 200 }), origin);
          }

          const { persistence } = await getServices(env); 
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
          const db = await bootstrapDatabase(env.AUTOD1);
          if (!db) {
            return withCors(new Response(JSON.stringify({ error: 'Database unavailable' }), { status: 500 }), origin);
          }

          const body = await request.json();
          // const persistence = new PersistenceService(db);
          const { persistence } = await getServices(env); 
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
          const db = await bootstrapDatabase(env.AUTOD1);
          if (!db) {
            return withCors(new Response(JSON.stringify([]), { status: 200 }), origin);
          }

          const { audit } = await getServices(env);
          const logs = await audit.getRecentAuditLogs(50);

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
  }
};
