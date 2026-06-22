# AutoJobs

Monorepo de automação inteligente para vagas do LinkedIn.

## Estrutura inicial

- `apps/dashboard`: dashboard Next.js App Router
- `worker`: worker Node.js para automação futura
- `packages/shared`: tipagens e schemas compartilhados
- `packages/profiles`: perfis fixos de busca
- `packages/scoring`: engine de score determinística
- `packages/linkedin`: domínio LinkedIn e placeholders de integração
- `infra/github-actions`: modelo de workflow de CI e execução diária

## Scripts

- `corepack pnpm dev` - Inicia o dashboard local
- `corepack pnpm build` - Compila dashboard e worker
- `corepack pnpm lint` - Roda lint no dashboard
- `corepack pnpm typecheck` - Verifica tipagem
- `corepack pnpm test:e2e` - Executa testes Playwright de ponta a ponta
- `corepack pnpm build:dashboard:pages` - Gera saída para deploy no Cloudflare Pages
- `corepack pnpm migrate:apply` - Aplica migrações D1 em produção

> Se `pnpm` não estiver instalado globalmente, use `corepack pnpm` para executar os scripts.

## Production readiness

- `DEPLOYMENT.md` - deploy automatizado e configuração Cloudflare
- `BACKUP_RECOVERY.md` - procedimentos de backup e recuperação de dados
- `PRODUCTION_CHECKLIST.md` - checklist de prontidão de produção

A GitHub Actions deploy workflow is also available at `.github/workflows/deploy.yml`.
