import type { AnyD1Database } from 'drizzle-orm/d1';
import { createD1Database } from './client';
import runMigrations from '../scripts/runMigrations';

let cached: ReturnType<typeof createD1Database> | null = null;

/**
 * Initialize database for runtime (Cloudflare Worker D1) — idempotent.
 * - accepts a D1 binding (`D1_MY_DB`) and returns a Drizzle client
 * - applies pending migrations once per cold start
 */
export async function bootstrapDatabase(client?: AnyD1Database) {
  if (!client) return null;
  if (cached) return cached;

  // create drizzle client
  const db = createD1Database(client);

  // Run migrations against raw D1 client (not the drizzle client) — the runner expects AnyD1Database
  try {
    await runMigrations(client);
  } catch (err) {
    // In Workers, throwing during startup will fail the request — bubble up
    console.error('Migration failed during bootstrap:', err);
    throw err;
  }

  cached = db;
  return db;
}

export default bootstrapDatabase;
