FROM mcr.microsoft.com/playwright:v1.54.0-jammy

WORKDIR /app

# Because the build context is now the monorepo root, 
# COPY . . copies the ENTIRE monorepo into /app
COPY . .

RUN corepack enable

# This will now successfully install everything across the workspace
RUN pnpm install

# Build the engine package (if applicable)
# Using pnpm --filter is the safest way to target your specific package
RUN pnpm --filter @autojobs/engine build

# Shift your working directory to the engine package before starting
# so relative paths in your code still work
WORKDIR /app/packages/engine

# Start the application
CMD ["pnpm", "start"]