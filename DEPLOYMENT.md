# Deployment Guide

This repository is built for production deployment on Cloudflare using:

- Cloudflare Workers for the runtime worker (`worker/wrangler.toml`)
- Cloudflare Pages for the dashboard frontend with a D1 binding named `AUTOJOBS_D1`
- Cloudflare D1 for the database backend

## Automated deployment

The `.github/workflows/deploy.yml` workflow performs the following steps on `main` or manual dispatch:

1. Checkout repository
2. Install dependencies with `pnpm`
3. Lint and typecheck the dashboard and worker
4. Build the dashboard and worker packages
5. Validate Cloudflare D1 SQL migrations
6. Run Playwright end-to-end tests
7. Apply D1 migrations to the production database
8. Deploy the worker if `CF_API_TOKEN` and `CF_ACCOUNT_ID` secrets are set
9. Deploy the dashboard to Cloudflare Pages if `CF_PAGES_PROJECT_NAME` is set

## Required secrets

Add the following secrets to the repository settings:

- `CF_API_TOKEN` - Cloudflare API token with Pages and Workers permissions
- `CF_ACCOUNT_ID` - Cloudflare account ID for the worker publish
- `CF_PAGES_PROJECT_NAME` - optional Pages project name for dashboard deployment

## Local deploy commands

Deploy the worker locally from the monorepo root:

```bash
corepack pnpm deploy:worker
```

If you need to publish the dashboard manually, use Cloudflare Pages or the Pages CLI with the built `.next` output. The dashboard Pages project should expose a D1 binding called `AUTOJOBS_D1` and the repository now includes this binding in `apps/dashboard/wrangler.toml`.

## Migration workflow

SQL migrations are validated during CI, but applying migrations to production D1 remains a controlled operation. Use the existing `.github/workflows/migrations.yml` workflow with manual dispatch and attach the Cloudflare secrets to the runner.
