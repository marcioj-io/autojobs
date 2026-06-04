// packages\db\drizzle.config.ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/schema.ts', // Caminho para o seu schema
  out: './migrations',       // Pasta onde as migrations serão salvas
  dialect: 'sqlite',         // <-- ESTA É A LINHA QUE FALTA!
});