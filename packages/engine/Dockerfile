FROM mcr.microsoft.com/playwright:v1.54.0-jammy

WORKDIR /app

COPY . .

RUN corepack enable
RUN pnpm install

RUN pnpm build

EXPOSE 3000

CMD ["node", "dist/index.js"]