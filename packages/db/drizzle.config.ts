// packages\db\drizzle.config.ts
import path from 'node:path';

export default {
  schema: path.resolve(__dirname, 'src', 'schema.ts'),
  migrationsFolder: path.resolve(__dirname, 'migrations'),
  // Note: This file provides minimal config for tooling (drizzle-kit or CI). Fill driver/credentials in CI secrets.
};
