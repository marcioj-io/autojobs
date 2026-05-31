import { PersistenceService, bootstrapDatabase, AuditLogsService, RuntimeService } from '@autojobs/db';

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

      // 404
      return new Response('Not Found', { status: 404 });
    } catch (error) {
      return new Response('Internal Server Error', { status: 500 });
    }
  }
};
