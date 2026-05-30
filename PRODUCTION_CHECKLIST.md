# Production Readiness Checklist

Use this checklist before promoting a release to production.

## Build and test

- [ ] `corepack pnpm install` completes successfully
- [ ] `corepack pnpm lint` passes without errors
- [ ] `corepack pnpm typecheck` passes
- [ ] `corepack pnpm build` completes for dashboard and worker
- [ ] `corepack pnpm test:e2e` passes

## Infrastructure and secrets

- [ ] `CF_API_TOKEN` is configured with Pages and Workers permissions
- [ ] `CF_ACCOUNT_ID` is set for Cloudflare deployments
- [ ] `CF_PAGES_PROJECT_NAME` is set if deploying the dashboard
- [ ] D1 schema migrations are validated and approved

## Deployment validation

- [ ] Cloudflare Worker published successfully
- [ ] Dashboard Pages publish completed successfully
- [ ] Health overview reports `healthy` runtime state
- [ ] Session health and audit logs are available in the dashboard
- [ ] Manual review actions can be taken successfully

## Post-deploy monitoring

- [ ] Deployment success alert is configured
- [ ] Error / anomaly logs are observed for the first 30 minutes
- [ ] Backup exports were generated before deployment
- [ ] Recovery playbook is accessible if rollback is needed
