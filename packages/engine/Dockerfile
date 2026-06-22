FROM mcr.microsoft.com/playwright:v1.60.0-jammy

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

WORKDIR /app

COPY . .

RUN corepack enable

RUN pnpm install

RUN pnpm --filter @autojobs/engine build

WORKDIR /app/packages/engine

CMD ["pnpm", "start"]