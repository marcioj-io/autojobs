import { PersistenceService, bootstrapDatabase, AuditLogsService, RuntimeService, SearchFilterService } from '@autojobs/db';

interface WorkerEnv {
  AUTOD1: any; // D1Database from wrangler
}

/**
 * Cloudflare Worker Fetch Handler
 */
export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;

    try {
      // Health check
      if (pathname === '/health' && request.method === 'GET') {
        try {
          const db = await bootstrapDatabase(env.AUTOD1);
          if (!db) {
            return new Response(JSON.stringify({ status: 'error', reason: 'Database init failed' }), {
              status: 500,
              headers: { 'Content-Type': 'application/json' }
            });
          }

          const persistence = new PersistenceService(db);
          const sessions = await persistence.getSessions();

          return new Response(JSON.stringify({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            database: 'connected',
            sessions_count: sessions.length
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        } catch (error) {
          return new Response(JSON.stringify({
            status: 'error',
            message: error instanceof Error ? error.message : String(error)
          }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }

      // Runtime state
      if (pathname === '/runtime' && request.method === 'GET') {
        try {
          const db = await bootstrapDatabase(env.AUTOD1);
          if (!db) {
            return new Response(JSON.stringify({ status: 'error' }), { status: 500 });
          }

          const runtime = new RuntimeService(db);
          await runtime.ensureState('default');
          const state = await runtime.getState('default');

          return new Response(JSON.stringify(state), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        } catch (error) {
          return new Response(JSON.stringify({
            status: 'error',
            message: error instanceof Error ? error.message : String(error)
          }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }

      // Audit logs
      if (pathname === '/audit' && request.method === 'GET') {
        try {
          const db = await bootstrapDatabase(env.AUTOD1);
          if (!db) {
            return new Response(JSON.stringify({ status: 'error' }), { status: 500 });
          }

          const audit = new AuditLogsService(db);
          const logs = await audit.getRecentAuditLogs(50);

          return new Response(JSON.stringify({ logs }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        } catch (error) {
          return new Response(JSON.stringify({
            status: 'error'
          }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }

      // Search filters - GET all for profile or GET specific
      if (pathname.startsWith('/search-filters') && request.method === 'GET') {
        try {
          const db = await bootstrapDatabase(env.AUTOD1);
          if (!db) {
            return new Response(JSON.stringify({ status: 'error' }), { status: 500 });
          }

          const service = new SearchFilterService(db);
          const url = new URL(request.url);
          const profile = url.searchParams.get('profile');
          const id = url.searchParams.get('id');

          if (id) {
            const filter = await service.getSearchFilter(id);
            return new Response(JSON.stringify(filter), {
              status: filter ? 200 : 404,
              headers: { 'Content-Type': 'application/json' }
            });
          }

          if (profile) {
            const filters = await service.getProfileSearchFilters(profile);
            return new Response(JSON.stringify({ filters }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            });
          }

          return new Response(JSON.stringify({ error: 'profile or id required' }), { status: 400 });
        } catch (error) {
          return new Response(JSON.stringify({
            status: 'error',
            message: error instanceof Error ? error.message : String(error)
          }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }

      // Search filters - POST create
      if (pathname === '/search-filters' && request.method === 'POST') {
        try {
          const db = await bootstrapDatabase(env.AUTOD1);
          if (!db) {
            return new Response(JSON.stringify({ status: 'error' }), { status: 500 });
          }

          const body = await request.json();
          const service = new SearchFilterService(db);
          const filter = await service.createSearchFilter(body.profile, body);

          return new Response(JSON.stringify(filter), {
            status: 201,
            headers: { 'Content-Type': 'application/json' }
          });
        } catch (error) {
          return new Response(JSON.stringify({
            status: 'error',
            message: error instanceof Error ? error.message : String(error)
          }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }

      // Search filters - PUT update
      if (pathname.startsWith('/search-filters/') && request.method === 'PUT') {
        try {
          const id = pathname.split('/')[2];
          const db = await bootstrapDatabase(env.AUTOD1);
          if (!db) {
            return new Response(JSON.stringify({ status: 'error' }), { status: 500 });
          }

          const body = await request.json();
          const service = new SearchFilterService(db);
          const filter = await service.updateSearchFilter(id, body);

          return new Response(JSON.stringify(filter), {
            status: filter ? 200 : 404,
            headers: { 'Content-Type': 'application/json' }
          });
        } catch (error) {
          return new Response(JSON.stringify({
            status: 'error',
            message: error instanceof Error ? error.message : String(error)
          }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }

      // Search filters - DELETE
      if (pathname.startsWith('/search-filters/') && request.method === 'DELETE') {
        try {
          const id = pathname.split('/')[2];
          const db = await bootstrapDatabase(env.AUTOD1);
          if (!db) {
            return new Response(JSON.stringify({ status: 'error' }), { status: 500 });
          }

          const service = new SearchFilterService(db);
          const deleted = await service.deleteSearchFilter(id);

          return new Response(JSON.stringify({ deleted }), {
            status: deleted ? 200 : 404,
            headers: { 'Content-Type': 'application/json' }
          });
        } catch (error) {
          return new Response(JSON.stringify({
            status: 'error',
            message: error instanceof Error ? error.message : String(error)
          }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }

      // Jobs - GET all jobs
      if (pathname === '/jobs' && request.method === 'GET') {
        try {
          const db = await bootstrapDatabase(env.AUTOD1);
          if (!db) {
            return new Response(JSON.stringify({ jobs: [] }), { status: 200 });
          }

          const persistence = new PersistenceService(db);
          const jobs = await persistence.getAllJobs();

          return new Response(JSON.stringify(jobs), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        } catch (error) {
          return new Response(JSON.stringify({ jobs: [] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }

      // Applications - GET all applications
      if (pathname === '/applications' && request.method === 'GET') {
        try {
          const db = await bootstrapDatabase(env.AUTOD1);
          if (!db) {
            return new Response(JSON.stringify({ applications: [] }), { status: 200 });
          }

          const persistence = new PersistenceService(db);
          const applications = await persistence.getApplications();

          return new Response(JSON.stringify(applications), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        } catch (error) {
          return new Response(JSON.stringify({ applications: [] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }

      // Reviews - GET all pending reviews
      if (pathname === '/reviews' && request.method === 'GET') {
        try {
          const db = await bootstrapDatabase(env.AUTOD1);
          if (!db) {
            return new Response(JSON.stringify({ reviews: [] }), { status: 200 });
          }

          const persistence = new PersistenceService(db);
          const reviews = await persistence.getPendingReviews();

          return new Response(JSON.stringify(reviews), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        } catch (error) {
          return new Response(JSON.stringify({ reviews: [] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }

      // Profiles - GET all profiles
      if (pathname === '/profiles' && request.method === 'GET') {
        try {
          const db = await bootstrapDatabase(env.AUTOD1);
          if (!db) {
            return new Response(JSON.stringify({ profiles: [] }), { status: 200 });
          }

          const persistence = new PersistenceService(db);
          const profiles = await persistence.getAllProfiles();

          return new Response(JSON.stringify(profiles), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        } catch (error) {
          return new Response(JSON.stringify({ profiles: [] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }

      // Profiles - POST create
      if (pathname === '/profiles' && request.method === 'POST') {
        try {
          const db = await bootstrapDatabase(env.AUTOD1);
          if (!db) {
            return new Response(JSON.stringify({ error: 'Database unavailable' }), { status: 500 });
          }

          const body = await request.json();
          const persistence = new PersistenceService(db);
          const profile = await persistence.createProfile(body);

          return new Response(JSON.stringify(profile), {
            status: 201,
            headers: { 'Content-Type': 'application/json' }
          });
        } catch (error) {
          return new Response(JSON.stringify({
            error: error instanceof Error ? error.message : String(error)
          }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }

      // Settings - GET
      if (pathname === '/settings' && request.method === 'GET') {
        try {
          const url = new URL(request.url);
          const id = url.searchParams.get('id') || 'default';
          
          const db = await bootstrapDatabase(env.AUTOD1);
          if (!db) {
            return new Response(JSON.stringify({}), { status: 200 });
          }

          const persistence = new PersistenceService(db);
          const settings = await persistence.getSettings(id);

          return new Response(JSON.stringify(settings || {}), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        } catch (error) {
          return new Response(JSON.stringify({}), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }

      // Settings - POST/PUT upsert
      if (pathname === '/settings' && (request.method === 'POST' || request.method === 'PUT')) {
        try {
          const db = await bootstrapDatabase(env.AUTOD1);
          if (!db) {
            return new Response(JSON.stringify({ error: 'Database unavailable' }), { status: 500 });
          }

          const body = await request.json();
          const persistence = new PersistenceService(db);
          const settings = await persistence.upsertSettings(body);

          return new Response(JSON.stringify(settings), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        } catch (error) {
          return new Response(JSON.stringify({
            error: error instanceof Error ? error.message : String(error)
          }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }

      // Logs - GET recent audit logs
      if (pathname === '/logs' && request.method === 'GET') {
        try {
          const db = await bootstrapDatabase(env.AUTOD1);
          if (!db) {
            return new Response(JSON.stringify([]), { status: 200 });
          }

          const audit = new AuditLogsService(db);
          const logs = await audit.getRecentAuditLogs(50);

          return new Response(JSON.stringify(logs), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        } catch (error) {
          return new Response(JSON.stringify([]), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }

      // 404
      return new Response('Not Found', { status: 404 });
    } catch (error) {
      return new Response('Internal Server Error', { status: 500 });
    }
  }
};
