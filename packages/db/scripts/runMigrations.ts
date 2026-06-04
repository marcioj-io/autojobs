// packages\db\scripts\runMigrations.ts
import fs from 'node:fs';
import path from 'node:path';
import { AnyD1Database } from 'drizzle-orm/d1';

export async function runMigrations(client: AnyD1Database, migrationsDir?: string) {
  // If migrationsDir is not provided (in Worker context), skip migrations
  // Migrations are already applied in production D1
  if (!migrationsDir) {
    console.info('Skipping migrations (no migrations directory provided — already applied)');
    return;
  }

  // Ensure migrations table
  await client.prepare(`CREATE TABLE IF NOT EXISTS __migrations (id TEXT PRIMARY KEY, filename TEXT NOT NULL, applied_at INTEGER NOT NULL)`).run();

  const files = fs.readdirSync(migrationsDir).filter((f: string) => f.endsWith('.sql')).sort();

  for (const file of files) {
    const id = file.split('-')[0];
    const existing = await client.prepare('SELECT id FROM __migrations WHERE id = ?').bind(id).first();
    if (existing) continue;

    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    // Execute migration SQL. For safety, wrap in a transaction if possible.
    try {
      await client.prepare('BEGIN').run();
      // split statements by semicolon and run sequentially
      const stmts = sql.split(/;\s*$/m).map((s: string) => s.trim()).filter(Boolean);
      for (const stmt of stmts) {
        await client.prepare(stmt).run();
      }
      await client.prepare('INSERT INTO __migrations (id, filename, applied_at) VALUES (?, ?, ?)').bind(id, file, Date.now()).run();
      await client.prepare('COMMIT').run();
      console.log(`Applied migration: ${file}`);
    } catch (err) {
      try { await client.prepare('ROLLBACK').run(); } catch (_) {}
      throw err;
    }
  }
}

// CLI invocation is not supported in Edge/Worker environment
export default runMigrations;
