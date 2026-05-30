import { createD1Database, type AnyD1Database } from '@autojobs/db';

export function initializeDatabase(client?: AnyD1Database): ReturnType<typeof createD1Database> | null {
  if (!client) return null;
  return createD1Database(client as AnyD1Database);
}
