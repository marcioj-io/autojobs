// packages/engine/src/sessionManager/linkedinSessionManager.ts
import crypto from 'crypto';
import type { BrowserContext, BrowserContextOptions, Page, Locator } from 'playwright';
import type { BrowserManager } from '../browser/browserManager';
import { randomDelay, retry } from '../utils';
import type { LinkedInStorageState } from '../types/types';

const LINKEDIN_HOME = 'https://www.linkedin.com/feed/';
const LINKEDIN_LOGIN = 'https://www.linkedin.com/login';
const LINKEDIN_CHECKPOINT = '/checkpoint/';
const LINKEDIN_AUTH_PATH = '/uas/login';

export interface LinkedInSessionManagerOptions {
  loginTimeoutMs?: number;
  validationTimeoutMs?: number;
  minimumDelayMs?: number;
  onHtmlImpediment?: (page: Page, reason: string, error?: unknown) => Promise<void>;
}

export interface LinkedInSessionResult {
  context: BrowserContext;
  page: Page;
  restored: boolean;
}

function isValidStorageState(obj: any): obj is LinkedInStorageState {
  return obj && Array.isArray(obj.cookies) && Array.isArray(obj.origins);
}

export class LinkedInSessionManager {
  constructor(
    private storageState?: LinkedInStorageState,
    private options: LinkedInSessionManagerOptions = {}
  ) {}

  /**
   * Tenta restaurar sessão autenticada usando storageState (se fornecido).
   * Retorna { context, page, restored: true } ou null se não for possível restaurar.
   */
  async restoreAuthenticatedSession(browserManager: BrowserManager): Promise<LinkedInSessionResult | null> {
    if (!this.storageState) return null;

    const sessionId = 'linkedin-default';

    try {
      const { context, page } = await this.openPage(browserManager, this.storageState, sessionId);

      const active = await this.validateSession(context, page);
      if (!active) {
        try { await page.close().catch(() => {}); } catch {}
        try { await context.close().catch(() => {}); } catch {}
        return null;
      }

      return { context, page, restored: true };
    } catch (err) {
      console.warn('[SCRAPER] Falha ao restaurar sessão (não fatal):', err);
      return null;
    }
  }

  /**
   * Faz login manual automatizado (bootstrap) e persiste a sessão criptografada.
   */
  async bootstrapLogin(
    browserManager: BrowserManager,
    credentials?: { username?: string; password?: string; }
  ): Promise<LinkedInSessionResult> {
    const sessionId = 'linkedin-default';
    const { context, page } = await this.openPage(browserManager, undefined, sessionId);

    const user = credentials?.username ?? process.env.LINKEDIN_USERNAME;
    const pass = credentials?.password ?? process.env.LINKEDIN_PASSWORD;

    if (!user?.trim()) {
      await context.close().catch(() => {});
      throw new Error('LINKEDIN_USERNAME não configurado');
    }
    if (!pass?.trim()) {
      await context.close().catch(() => {});
      throw new Error('LINKEDIN_PASSWORD não configurado');
    }

    await this.performAutoLogin(page, user, pass);

    await page.waitForURL(
      url => url.hostname.endsWith('linkedin.com') && !url.pathname.includes('/checkpoint') && !url.pathname.includes('/login'),
      { timeout: this.options.loginTimeoutMs ?? 300000 }
    );

    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);

    const storageState = await context.storageState();

    // Persiste criptografado no arquivo local e envia como string para o Worker (D1)
    await this.persistSession(storageState);

    this.storageState = storageState as LinkedInStorageState;

    console.info('✅ Sessão atualizada e persistida de forma segura.');

    return { context, page, restored: false };
  }

  private async openPage(
    browserManager: BrowserManager,
    storageState?: LinkedInStorageState,
    sessionId = 'linkedin-default'
  ): Promise<{ context: BrowserContext; page: Page }> {
    let safeStorageState: LinkedInStorageState | undefined = undefined;

    if (storageState && isValidStorageState(storageState)) {
      safeStorageState = {
        cookies: Array.isArray(storageState.cookies) ? storageState.cookies : [],
        origins: Array.isArray(storageState.origins) ? storageState.origins : []
      };
      console.log(`[SESSION] StorageState carregado: ${safeStorageState.cookies.length} cookies`);
    } else if (storageState) {
      console.warn('[SESSION] StorageState fornecido inválido; ignorando.');
    }

    const contextOptions: BrowserContextOptions = safeStorageState ? { storageState: safeStorageState } : {};

    const context = await (browserManager as any).getContext(sessionId, contextOptions, safeStorageState);

    try {
      await context.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        Object.defineProperty(navigator, 'platform', { get: () => 'Win32' });
      });
    } catch (e) {
      // não fatal
    }

    let page: Page;
    try {
      const existingPages = context.pages();
      if (existingPages.length > 0) {
        page = existingPages[0];
      } else {
        page = await context.newPage();
      }
    } catch (err) {
      console.warn('[SESSION] context.newPage falhou, tentando novamente', err);
      await new Promise(r => setTimeout(r, 500));
      page = await context.newPage();
    }

    await randomDelay(800, 1500);
    return { context, page };
  }

  private async validateSession(context: BrowserContext, page: Page): Promise<boolean> {
    try {
      const st = await context.storageState();
      const cookieNames = (st.cookies || []).filter((c: any) => c.domain && c.domain.includes('linkedin')).map((c: any) => c.name);
      console.log('storage cookies:', cookieNames);

      await retry(async () => {
        await page.goto(LINKEDIN_HOME, { waitUntil: 'domcontentloaded' });
      }, 3, 1200);

      await page.waitForTimeout(2500);

      const cookies = await context.cookies();
      const names = new Set(cookies.map(c => c.name));
      const currentUrl = page.url();
      console.log('[SESSION] URL:', currentUrl);

      if (this.isLoginRedirect(currentUrl)) return false;

      const loginFormCount = await page.locator('form.login__form, input[name="username"], input#username').count();
      if (loginFormCount > 0) return false;

      return names.has('li_at') && names.has('JSESSIONID');
    } catch (err) {
      console.warn('[SESSION] Falha ao validar sessão:', err);
      return false;
    }
  }

  private async performAutoLogin(page: Page, user: string, pass: string): Promise<void> {
    console.info('[SESSION_MANAGER] Iniciando login automatizado...');
    try {
      await retry(async () => {
        await page.goto(LINKEDIN_LOGIN, { waitUntil: 'domcontentloaded' });
      }, 3, 1200);

      if (page.url().includes(LINKEDIN_CHECKPOINT)) {
        throw new Error('early_checkpoint');
      }

      const usernameField = await this.findVisibleLoginField(page);
      await usernameField.fill(user, { force: true });

      const passwordField = await this.findVisiblePasswordField(page);
      await passwordField.fill(pass, { force: true });

      await randomDelay(500, 1200);

      const submitButton = page.getByRole('button', { name: /^(Sign in|Entrar|Acessar)$/i }).first();

      await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {}),
        submitButton.click({ force: true })
      ]);

      const currentUrl = page.url();

      if (currentUrl.includes(LINKEDIN_CHECKPOINT)) {
        console.warn('🛑 Checkpoint detectado pós-login');
        await this.handleImpediment(page, 'linkedin-checkpoint');
        await page.waitForURL(url => !url.toString().includes(LINKEDIN_CHECKPOINT), { timeout: this.options.loginTimeoutMs ?? 300000 });
      } else if (this.isLoginRedirect(currentUrl)) {
        throw new Error('linkedin-login-failed-redirect');
      } else {
        console.info('[SESSION_MANAGER] Login concluído e redirecionado para feed.');
      }
    } catch (error: any) {
      if (error?.message === 'early_checkpoint' || (!page.isClosed() && page.url().includes(LINKEDIN_CHECKPOINT))) {
        console.warn('🛑 Checkpoint detectado antes/durante a inserção de credenciais');
        await this.handleImpediment(page, 'linkedin-early-checkpoint', error);
        return;
      }
      await this.handleImpediment(page, 'linkedin-login-failed', error);
      console.error('[LOGIN-FATAL]', error);
      throw error;
    }
  }

  private async handleImpediment(page: Page, reason: string, error?: unknown): Promise<void> {
    await this.dumpPageDiagnostics(page, reason);
    if (this.options.onHtmlImpediment) {
      try {
        await this.options.onHtmlImpediment(page, reason, error);
      } catch (auxError) {
        console.error('[DIAGNOSTIC] Falha ao acionar serviço auxiliar de impedimento', auxError);
      }
    }
  }

  private isLoginRedirect(url: string) {
    return url.includes(LINKEDIN_LOGIN) || url.includes(LINKEDIN_CHECKPOINT) || url.includes(LINKEDIN_AUTH_PATH);
  }

  private async findVisibleLoginField(page: Page, timeout = 45000): Promise<Locator> {
    const locator = page.locator('input[autocomplete="username"], input[name="session_key"]').filter({ visible: true }).first();
    await locator.waitFor({ state: 'attached', timeout });
    return locator;
  }

  private async findVisiblePasswordField(page: Page, timeout = 45000): Promise<Locator> {
    const selectors = [
      'input[type="password"]',
      'input[name="session_password"]',
      'input[autocomplete="current-password"]'
    ].join(', ');
    const locator = page.locator(selectors).filter({ visible: true }).first();
    await locator.waitFor({ state: 'attached', timeout });
    return locator;
  }

  private async dumpPageDiagnostics(page: Page, reason: string): Promise<void> {
    try {
      if (page.isClosed()) {
        console.warn(`[DIAGNOSTIC] Ignorado: A página já foi fechada. Motivo: ${reason}`);
        return;
      }

      const timestamp = Date.now();
      console.error(`[DIAGNOSTIC] ${reason} | URL: ${page.url()}`);
      const title = await page.title().catch(() => 'Title indisponível');
      console.error('[DIAGNOSTIC] TITLE:', title);

      const domData = await page.evaluate(() => {
        function extract(selector: string) {
          return Array.from(document.querySelectorAll(selector)).map(n => ({
            tag: n.tagName,
            id: (n as HTMLElement).id || null,
            name: (n as HTMLInputElement).name || null,
            type: (n as HTMLInputElement).type || null,
            visible: (n as HTMLElement).offsetParent !== null
          }));
        }
        return { inputs: extract('input'), buttons: extract('button') };
      }).catch(() => null);

    } catch (error) {
      console.error('[DIAGNOSTIC] FAILED TO DUMP', error);
    }
  }

  /**
   * Persiste a sessão: criptografa o JSON e salva tanto localmente (.enc) quanto no banco D1 do Worker.
   */
  private async persistSession(storageState: any): Promise<void> {
  try {
    const fs = await import('node:fs');
    const path = await import('node:path');

    const sessionString = JSON.stringify(storageState);
    const secret = process.env.SESSION_SECRET;

    let dataToSave = sessionString;
    let isEncrypted = false;

    // 1. Aplica Criptografia caso a chave secreta exista
    if (secret && secret.length >= 16) {
      try {
        const iv = crypto.randomBytes(16);
        const key = crypto.scryptSync(secret, 'salt', 32);
        const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
        let encrypted = cipher.update(sessionString, 'utf8', 'hex');
        encrypted += cipher.final('hex');

        dataToSave = `${iv.toString('hex')}:${encrypted}`;
        isEncrypted = true;
      } catch (cryptoErr) {
        console.warn('[SESSION] Falha na criptografia. Salvando em texto plano.', cryptoErr);
      }
    } else {
      console.warn('[SESSION] SESSION_SECRET ausente ou muito curto. Salvando em texto plano (INSEGURO).');
    }

    // 2. Salva localmente
    const fileName = isEncrypted ? 'linkedin-session.json.enc' : 'linkedin-session.json';
    const sessionPath = path.resolve(process.cwd(), fileName);
    fs.writeFileSync(sessionPath, dataToSave, 'utf8');
    console.info(`💾 Arquivo local ${fileName} atualizado.`);

    // 3. Envia para o Worker (D1 Repository)
    const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL ?? 'https://autojobs-worker.marciojunior5872.workers.dev';
    
    const response = await fetch(`${WORKER_URL}/session-cookies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 'linkedin-default',
        profile: 'linkedin-default',
        // O D1 Repository espera uma string. Passamos a string (criptografada ou não).
        cookies: dataToSave 
      })
    });

    if (!response.ok) {
      throw new Error(`Falha ao persistir sessão no D1 HTTP Status: (${response.status})`);
    }

    console.info('☁️ Sessão salva e protegida no banco de dados D1 (Worker).');
  } catch (err) {
    console.error('[SESSION] Erro crítico ao persistir sessão:', err);
    throw err;
  }
}

}