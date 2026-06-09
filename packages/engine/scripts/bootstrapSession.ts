import { FileSessionAdapter } from '../src/sessionManager/fileAdapter';
import { LinkedInSessionManager } from '../src/sessionManager/sessionManager';
import { BrowserManager } from '../src/browser/manager';

const sessionId = process.env.LINKEDIN_SESSION_ID ?? 'linkedin-default';
const headless = process.env.LINKEDIN_HEADLESS !== 'false';
const userAgent = process.env.LINKEDIN_USER_AGENT;
const profile = process.env.LINKEDIN_PROFILE ?? 'backend';

async function run() {
  console.log('Bootstrap de sessão LinkedIn iniciado.');
  console.log(`sessionId=${sessionId}`);
  console.log(`profile=${profile}`);
  console.log(`headless=${headless}`);

  const adapter = new FileSessionAdapter();
  const manager = new BrowserManager({ headless, userAgent });
  const sessionManager = new LinkedInSessionManager(adapter, sessionId, {
    loginTimeoutMs: 600000,
    validationTimeoutMs: 30000
  });

  const result = await sessionManager.bootstrapLogin(manager);
  await result.page.waitForTimeout(500);
  await result.context.close();
  await manager.close();

  console.log('Sessão LinkedIn salva com sucesso.');
  console.log(`Arquivo salvo em .linkedin-sessions/${sessionId}.json`);
}

run().catch((error) => {
  console.error('Falha ao bootstrapar a sessão LinkedIn:', error);
  process.exit(1);
});
