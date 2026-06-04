// packages\db\src\bootstrap.ts
import type { AnyD1Database } from 'drizzle-orm/d1';
import { createD1Database } from './client';

let cached: ReturnType<typeof createD1Database> | null = null;

export async function bootstrapDatabase(client?: AnyD1Database) {
  if (!client) {
    return null;
  }

  if (cached) {
    return cached;
  }

  const db = createD1Database(client);

  cached = db;

  return db;
}

export default bootstrapDatabase;