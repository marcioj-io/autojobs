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
   *
   * Observação: este método delega a criação do context/page ao openPage,
   * que é resiliente e faz retry defensivo.
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

      // Log cookies and URL for observability
      try {
        const st = await context.storageState();
        const cookieNames = (st.cookies || []).filter((c: any) => c.domain && c.domain.includes('linkedin')).map((c: any) => c.name);
        console.info('[SESSION] Restaurada sessão com cookies:', cookieNames);
        console.info('[SESSION] Página inicial após restauração:', page.url());
      } catch { /* ignore */ }

      return { context, page, restored: true };
    } catch (err) {
      console.warn('[SCRAPER] Falha ao restaurar sessão (não fatal):', err);
      return null;
    }
  }

  /**
   * Faz login manual automatizado (bootstrap) e persiste a sessão.
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

    // persist local + worker
    await this.persistSession(storageState);

    this.storageState = storageState;

    console.info('✅ Sessão atualizada e persistida.');

    return { context, page, restored: false };
  }

  /**
   * Abre um context/page usando o BrowserManager. Usa sessionId para reuso de context.
   * Se storageState inválido, ignora e abre sem storageState.
   *
   * Melhorias:
   * - Usa getContext do BrowserManager (resiliente)
   * - Retry defensivo em getContext e context.newPage
   * - Logs de diagnóstico e validação de cookies/url
   */
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

    // Use getContext do BrowserManager (resiliente)
    let context: BrowserContext;
    try {
      context = await (browserManager as any).getContext(sessionId, contextOptions, safeStorageState);
    } catch (err) {
      console.warn('[SESSION] getContext falhou na primeira tentativa, tentando reiniciar browser', err);
      try {
        await (browserManager as any).close?.().catch(() => {});
      } catch { /* ignore */ }
      await new Promise(r => setTimeout(r, 800));
      context = await (browserManager as any).getContext(sessionId, contextOptions, safeStorageState);
    }

    // init evasions (defensivo)
    try {
      await context.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        Object.defineProperty(navigator, 'platform', { get: () => 'Win32' });
      });
    } catch (e) {
      // não fatal
    }

    // Criar page com retry defensivo
    let page: Page;
    try {
      page = await context.newPage();
    } catch (err) {
      console.warn('[SESSION] context.newPage falhou, tentando novamente', err);
      await new Promise(r => setTimeout(r, 500));
      page = await context.newPage();
    }

    // pequena espera humana
    await randomDelay(800, 1500);

    // Log inicial de URL e cookies para observabilidade
    try {
      await page.goto(LINKEDIN_HOME, { waitUntil: 'domcontentloaded' }).catch(() => {});
      const st = await context.storageState();
      const cookieNames = (st.cookies || []).filter((c: any) => c.domain && c.domain.includes('linkedin')).map((c: any) => c.name);
      console.info('[SESSION] openPage -> URL:', page.url(), 'cookies:', cookieNames);
    } catch {
      // ignore
    }

    return { context, page };
  }

  /**
   * Valida se a sessão está autenticada (cookies e ausência de login redirect)
   */
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

  /**
   * Realiza o fluxo de login automatizado (preenchimento e submissão).
   * Detecta checkpoints e delega para handleImpediment.
   */
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

      if (domData) {
        // optional: keep this commented by default to avoid sensitive logs
        // console.error('[DIAGNOSTIC] DOM_DATA', JSON.stringify(domData, null, 2));
      }

    } catch (error) {
      console.error('[DIAGNOSTIC] FAILED TO DUMP', error);
    }
  }

  private async persistSession(storageState: any): Promise<void> {
    try {
      const fs = await import('node:fs');
      const path = await import('node:path');

      const sessionString = JSON.stringify(storageState, null, 2);

      const sessionPath = path.resolve(process.cwd(), 'linkedin-session.json');
      fs.writeFileSync(sessionPath, sessionString, 'utf8');
      console.info('💾 linkedin-session.json atualizado.');

      const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL ?? 'https://autojobs-worker.marciojunior5872.workers.dev';

      const response = await fetch(`${WORKER_URL}/session-cookies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: 'linkedin-default',
          profile: 'linkedin-default',
          cookies: storageState
        })
      });

      if (!response.ok) {
        throw new Error(`Falha ao persistir sessão (${response.status})`);
      }

      console.info('☁️ Sessão salva no Worker.');
    } catch (err) {
      console.error('[SESSION] Falha ao persistir sessão:', err);
      throw err;
    }
  }
}
