// packages\db\src\client.ts
import { drizzle } from 'drizzle-orm/d1';
import type { AnyD1Database } from 'drizzle-orm/d1';
import { dbSchema } from './schema';

export function createD1Database(client: AnyD1Database) {
  return drizzle(client, { schema: dbSchema });
}
