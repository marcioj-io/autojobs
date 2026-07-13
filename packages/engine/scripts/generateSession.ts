// packages/engine/scripts/generateSession.ts

import fs from 'node:fs';
import readline from 'node:readline';
import { BrowserManager } from '../src/browser/browserManager';

const WORKER_URL =
  process.env.NEXT_PUBLIC_WORKER_URL ??
  'https://autojobs-worker.marciojunior5872.workers.dev';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function waitEnter(): Promise<void> {
  return new Promise(resolve => {
    rl.question(
      '\nPressione ENTER quando estiver completamente logado no LinkedIn... ',
      () => resolve()
    );
  });
}

async function generate() {
  const browserManager = BrowserManager.getInstance({
    headless: false
  });

  try {
    console.log('🌐 Abrindo navegador...');

    const context = await browserManager.newContext();
    const page = await context.newPage();

    await page.goto('https://www.linkedin.com/', {
      waitUntil: 'domcontentloaded'
    });

    console.log(`
========================================================

1. Faça login normalmente.

2. Resolva CAPTCHA/PIN caso apareça.

3. Aguarde carregar totalmente o FEED.

4. Volte ao terminal.

5. Pressione ENTER.

========================================================
`);

    await waitEnter();

    console.log('\n⏳ Validando sessão...');

    await page.waitForTimeout(5000);

    const cookies = await context.cookies();

    console.table(
      cookies.map((c: any) => ({
        name: c.name,
        domain: c.domain,
        expires: c.expires
      }))
    );

    const cookieNames = new Set(
      cookies.map((c: any) => c.name)
    );

    if (!cookieNames.has('li_at')) {
      throw new Error(
        'Sessão inválida: cookie li_at não encontrado.'
      );
    }

    if (!cookieNames.has('JSESSIONID')) {
      throw new Error(
        'Sessão inválida: cookie JSESSIONID não encontrado.'
      );
    }

    const storageState = await context.storageState();

    fs.writeFileSync(
      'linkedin-session.json',
      JSON.stringify(storageState, null, 2),
      'utf8'
    );

    console.log('💾 linkedin-session.json salvo.');

    const response = await fetch(
      `${WORKER_URL}/session-cookies`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          id: 'linkedin-default',
          profile: 'linkedin-default',
          cookies: JSON.stringify(storageState)
        })
      }
    );

    if (!response.ok) {
      throw new Error(
        `Worker respondeu ${response.status}`
      );
    }

    console.log('✅ Sessão enviada para Worker.');

  } finally {
    await browserManager.close().catch(() => {});
    rl.close();
  }
}

generate().catch(err => {
  console.error('\n❌ ERRO\n');
  console.error(err);
  process.exit(1);
});