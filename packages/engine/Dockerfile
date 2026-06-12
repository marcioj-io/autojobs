# Altere de node:20-slim para node:22-slim
FROM node:22-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

WORKDIR /app

COPY . .

RUN corepack enable

RUN pnpm install

RUN pnpm --filter @autojobs/engine build

WORKDIR /app/packages/engine

CMD ["pnpm", "start"]