"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bootstrapDatabase = bootstrapDatabase;
const client_1 = require("./client");
let cached = null;
/**
 * Initialize database for runtime (Cloudflare Worker D1) — idempotent.
 * - accepts a D1 binding (`D1_MY_DB`) and returns a Drizzle client
 * - applies pending migrations once per cold start
 *
 * NOTE: runMigrations is imported dynamically to avoid bundling Node.js-only fs/path modules
 * into Edge Runtime bundles (e.g., Cloudflare Pages). Migrations only run in Node context (Workers).
 */
async function bootstrapDatabase(client) {
    if (!client)
        return null;
    if (cached)
        return cached;
    // create drizzle client
    const db = (0, client_1.createD1Database)(client);
    // Run migrations against raw D1 client (not the drizzle client) — the runner expects AnyD1Database
    try {
        const { runMigrations } = await import('../scripts/runMigrations.js');
        await runMigrations(client);
    }
    catch (err) {
        // In Workers, throwing during startup will fail the request — bubble up
        console.error('Migration failed during bootstrap:', err);
        throw err;
    }
    cached = db;
    return db;
}
exports.default = bootstrapDatabase;
