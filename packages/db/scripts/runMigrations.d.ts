import { AnyD1Database } from 'drizzle-orm/d1';
export declare function runMigrations(client: AnyD1Database, migrationsDir?: string): Promise<void>;
export default runMigrations;
