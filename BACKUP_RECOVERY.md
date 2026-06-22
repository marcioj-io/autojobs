# Backup and Recovery

This document describes the backup and restore process for the AutoJobs production environment.

## Database backups

Cloudflare D1 does not provide native automated snapshots. Use the following approach:

1. Export the D1 database schema and data regularly.
2. Store SQL exports in a secure backup location outside Cloudflare.
3. Keep a rolling retention of at least 7 days.

Example export strategy:

- Use `wrangler d1 execute` or a custom script to dump table contents to SQL
- Save the export to an artifact repository or object storage
- Verify restore by applying the export to a staging D1 instance

## Recovery procedure

1. Identify the failure scope: schema issue, data corruption, or service outage.
2. If schema change caused the issue, restore from the latest validated SQL export.
3. If data corruption occurred, apply the latest clean export to a recovery D1 instance.
4. Restart the dashboard and worker deployments after recovery.

## Worker state recovery

The worker itself is stateless; session state is stored in D1 and audit logs. If a worker deployment fails:

- Roll back to the last known-good worker release
- Confirm D1 connectivity and runtime state using the dashboard health overview

## Validation after recovery

- Confirm dashboard loads successfully
- Confirm runtime overview reads a valid state from D1
- Confirm manual review queue and audit logs remain consistent
- Run `corepack pnpm test:e2e` on a staging environment before returning to production
