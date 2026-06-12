# Usa uma imagem oficial do Node.js (versão slim) muito mais leve
FROM node:20-slim AS base

# Instalação de dependências do sistema necessárias para o corepack e pnpm
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

WORKDIR /app

# Copia todo o monorepo
COPY . .

# Habilita o pnpm via corepack
RUN corepack enable

# Instala todas as dependências do workspace
RUN pnpm install

# Compila o pacote engine
RUN pnpm --filter @autojobs/engine build

# Move para o diretório do pacote compilado
WORKDIR /app/packages/engine

# Expõe a porta caso o seu servidor web precise (ex: 3000, 8080)
# EXPOSE 3000

# Inicia a aplicação
CMD ["pnpm", "start"]