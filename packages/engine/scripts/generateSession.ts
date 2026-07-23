// imports no topo (já existentes)
import fs from 'node:fs';
import readline from 'node:readline';
import { BrowserManager } from '../src/browser/browserManager';
import { config } from 'dotenv';
import path from 'node:path';
import crypto from 'crypto';

config({ path: path.resolve(__dirname, '../../../.env') });

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

function encryptSessionString(sessionString: string, secret?: string): string {
  if (!secret || secret.length < 16) {
    // sem segredo suficiente, retorna texto plano (com aviso)
    console.warn('[GEN_SESSION] SESSION_SECRET ausente ou muito curto. Salvando em texto plano (INSEGURO).');
    return sessionString;
  }
  const iv = crypto.randomBytes(16);
  const key = crypto.scryptSync(secret, 'salt', 32);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(sessionString, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
}

async function generate() {
  const browserManager = BrowserManager.getInstance({
    headless: false
  });

  try {
    console.log('🌐 Abrindo navegador...');

    // @ts-ignore runtime duck-typing
    const context = typeof (browserManager as any).getContext === 'function'
      ? await (browserManager as any).getContext(undefined, {}, undefined)
      : await (browserManager as any).newContext({});

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

    // Salva o JSON localmente (criptografado se SESSION_SECRET estiver definido)
    const storageJson = JSON.stringify(storageState, null, 2);
    const secret = process.env.SESSION_SECRET;
    const dataToSave = encryptSessionString(storageJson, secret);

    // Se criptografado, salva .enc; caso contrário salva .json (aviso já emitido)
    const fileName = (secret && secret.length >= 16) ? 'linkedin-session.json.enc' : 'linkedin-session.json';
    fs.writeFileSync(fileName, dataToSave, 'utf8');

    console.log(`💾 ${fileName} salvo.`);

    // Envia ao Worker com id 'linkedin-default' — envia a mesma string (criptografada ou não)
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
          cookies: dataToSave
        })
      }
    );

    if (!response.ok) {
      throw new Error(
        `Worker respondeu ${response.status}`
      );
    }

    console.log('✅ Sessão enviada para o Worker.');

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
