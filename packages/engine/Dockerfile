FROM node:22-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

WORKDIR /app

COPY . .

RUN corepack enable

# Instala todas as dependências do monorepo
RUN pnpm install

# (Opcional) Apenas para checar erros de tipagem no build
RUN pnpm --filter @autojobs/engine build

WORKDIR /app/packages/engine

# Roda o servidor usando o tsx que já está configurado no seu package.json
CMD ["pnpm", "start"]