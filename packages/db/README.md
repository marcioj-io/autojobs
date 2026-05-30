# @autojobs/db — Migrations & Usage

Usage notes for migrations and CI.

Local helpers
- Generate a new migration SQL file (versioned):

```
pnpm --filter @autojobs/db run migrate:generate -- my-description
```

- Run migrations (developer):

```
pnpm --filter @autojobs/db run migrate:run
```

Note: `migrate:run` runs the TypeScript runner and expects a D1 client when invoked programmatically. In Cloudflare Workers / Wrangler you should call the exported `runMigrations(client)` function passing the `D1Database` binding.

CI / GitHub Actions
- For CI, use `drizzle-kit` or call a small script that constructs a temporary D1-compatible environment and calls `runMigrations()`.

Design notes
- Migrations are deterministic SQL files stored in `packages/db/migrations` and applied in order. Applied migrations are recorded in the `__migrations` table.
- Runner is intentionally minimal to keep logic centralized and compatible with Cloudflare D1.
