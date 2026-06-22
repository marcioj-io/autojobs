import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { config } from 'dotenv';
import { execSync } from 'node:child_process';

config({
  path: path.resolve(__dirname, '../../../.env.local')
});

import { FileSessionAdapter } from '../src/sessionManager/fileAdapter';
import { LinkedInSessionManager } from '../src/sessionManager/sessionManager';
import { BrowserManager } from '../src/browser/manager';

const sessionId = process.env.LINKEDIN_SESSION_ID ?? 'linkedin-default';
const headless = process.env.LINKEDIN_HEADLESS !== 'false';
const userAgent = process.env.LINKEDIN_USER_AGENT;
const profile = process.env.LINKEDIN_PROFILE ?? 'backend';

async function run() {
  console.log(`Bootstrap iniciado. Sessão: ${sessionId} | Perfil: ${profile}`);

  const adapter = new FileSessionAdapter();
  const manager = new BrowserManager({ headless, userAgent });

  const sessionManager = new LinkedInSessionManager(adapter, sessionId, {
    loginTimeoutMs: 600000,
    validationTimeoutMs: 30000
  });

  const result = await sessionManager.bootstrapLogin(manager);
  await result.page.waitForTimeout(500);

  const storageState = await result.context.storageState();
  const cookies = JSON.stringify(storageState).replace(/'/g, "''");

  const sql = `
INSERT OR REPLACE INTO linkedin_sessions (id, profile, cookies, created_at, updated_at)
VALUES ('${sessionId}', '${profile}', '${cookies}', CAST(unixepoch('now') * 1000 AS INTEGER), CAST(unixepoch('now') * 1000 AS INTEGER));
`;

  const tempSqlPath = path.join(os.tmpdir(), `d1_sync_${Date.now()}.sql`);
  fs.writeFileSync(tempSqlPath, sql);

  try {
    // CORREÇÃO:
    // 1. Usamos o binding 'autojobs-prod' conforme seu wrangler.toml
    // 2. Usamos --remote para salvar no D1 real (remova se quiser local)
    // 3. Usamos 'cwd' para apontar para a pasta onde o wrangler.toml reside
    const wranglerConfigDir = path.resolve(__dirname, '../../worker');
    
    console.log(`Executando wrangler em: ${wranglerConfigDir}`);
        
        const command = `pnpm exec wrangler d1 execute autojobs-prod --remote --yes --file "${tempSqlPath}"`;

        execSync(command, {
          stdio: 'inherit',
          cwd: path.resolve(__dirname, '../../') // Raiz do projeto
        });
        console.log('Sessão LinkedIn salva no D1 com sucesso.');
  } finally {
    if (fs.existsSync(tempSqlPath)) fs.unlinkSync(tempSqlPath);
  }

  await result.context.close();
  await manager.close();
}

run().catch((error) => {
  console.error('Falha no bootstrap:', error);
  process.exit(1);
});