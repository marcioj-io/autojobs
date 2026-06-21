// packages/engine/src/sessionManager/sessionManager.ts
import type { BrowserContext, BrowserContextOptions, Page, Locator } from 'playwright';
import type { BrowserManager } from '../browser/manager';
import { randomDelay, retry, scrollPage } from '../utils';

const LINKEDIN_HOME = 'https://www.linkedin.com/feed/';
const LINKEDIN_LOGIN = 'https://www.linkedin.com/login';
const LINKEDIN_CHECKPOINT = '/checkpoint/';
const LINKEDIN_AUTH_PATH = '/uas/login';

export interface LinkedInSessionManagerOptions {
  loginTimeoutMs?: number;
  validationTimeoutMs?: number;
  minimumDelayMs?: number;
  /**
   * Hook para disparar serviços auxiliares caso ocorram impedimentos
   * na manipulação do HTML ou captchas/checkpoints não resolvidos.
   */
  onHtmlImpediment?: (page: Page, reason: string, error?: unknown) => Promise<void>;
}

export interface LinkedInSessionResult {
  context: BrowserContext;
  page: Page;
  restored: boolean;
}

export class LinkedInSessionManager {
  constructor(
    private storageState?: string,
    private options: LinkedInSessionManagerOptions = {}
  ) {
  }

  async restoreAuthenticatedSession(browserManager: BrowserManager): Promise<LinkedInSessionResult | null> {
    if (!this.storageState) {
      return null;
    }

    const { context, page } = await this.openPage(
      browserManager,
      this.storageState
    );

    const active = await this.validateSession(context, page);
    if (!active) {
      await context.close();
      return null;
    }

    return { context, page, restored: true };
  }

  async bootstrapLogin(
    browserManager: BrowserManager,
    credentials?: {
      username?: string;
      password?: string;
    }
  ): Promise<LinkedInSessionResult> {

    const { context, page } = await this.openPage(browserManager);

    const user = credentials?.username ?? process.env.LINKEDIN_USERNAME;
    const pass = credentials?.password ?? process.env.LINKEDIN_PASSWORD;

    if (!user?.trim()) {
      await context.close();
      throw new Error('LINKEDIN_USERNAME não configurado');
    }

    if (!pass?.trim()) {
      await context.close();
      throw new Error('LINKEDIN_PASSWORD não configurado');
    }

    await this.performAutoLogin(page, user, pass);

    return {
      context,
      page,
      restored: false
    };
  }

  private async openPage(browserManager: BrowserManager, storageState?: string): Promise<{ context: BrowserContext; page: Page }> {
    const storage = storageState ? JSON.parse(storageState) as BrowserContextOptions['storageState'] : undefined;
    
    const contextOptions: BrowserContextOptions = { 
      storageState: storage 
    };

    // [ENTERPRISE] Injeção de Proxy para evitar Checkpoints por divergência de IP
    const proxyServer = process.env.PROXY_SERVER;
    if (proxyServer && process.env.NODE_ENV === 'production') {
      contextOptions.proxy = {
        server: proxyServer,
        username: process.env.PROXY_USERNAME,
        password: process.env.PROXY_PASSWORD,
      };
      console.info('[NETWORK] Contexto Playwright configurado com Proxy Residencial.');
    }

    const context = await browserManager.newContext(contextOptions);
    
    // Evasão básica: Remove a flag de automação do navegador
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });

    const page = await context.newPage();
    await randomDelay(800, 1500);
    return { context, page };
  }

  private async validateSession(context: BrowserContext, page: Page): Promise<boolean> {
    await retry(async () => {
      await page.goto(LINKEDIN_HOME, { waitUntil: 'domcontentloaded' });
    }, 3, 1200);

    await randomDelay(900, 1700);
    await scrollPage(page, 1000, 600);

    const pageUrl = page.url();
    if (this.isLoginRedirect(pageUrl)) {
      return false;
    }

    const loginForm = await page.$('form.login__form, input[name=username], input#username');
    if (loginForm) {
      return false;
    }

    const cookies = await context.cookies();
    return cookies.some((cookie) => ['li_at', 'JSESSIONID', 'bcookie', 'bscookie'].includes(cookie.name));
  }

  private async performAutoLogin(page: Page, user: string, pass: string): Promise<void> {
    console.info('[SESSION_MANAGER] 🤖 Iniciando login automatizado...');

    try {
      await retry(async () => {
        await page.goto(LINKEDIN_LOGIN, { waitUntil: 'domcontentloaded' });
      }, 3, 1200);

      console.info('[LOGIN-01] Página carregada | URL:', page.url());

      // Defesa antecipada: Verifica se o IP já triggou o checkpoint antes de preencher
      if (page.url().includes(LINKEDIN_CHECKPOINT)) {
        throw new Error('early_checkpoint');
      }

      const usernameField = await this.findVisibleLoginField(page);
      console.info('[LOGIN-02] Username encontrado');
      await usernameField.fill(user, { force: true });
      console.info('[LOGIN-03] Username preenchido');

      const passwordField = await this.findVisiblePasswordField(page);
      console.info('[LOGIN-04] Password encontrada');
      await passwordField.fill(pass, { force: true });
      console.info('[LOGIN-05] Password preenchida');

      await randomDelay(500, 1200);
      console.info('[LOGIN-06] Procurando submit');
      
      const submitButton = page.getByRole('button', { name: /^(Sign in|Entrar|Acessar)$/i }).first();
      
      // Submissão Defensiva: Intercepta a navegação junto com o clique (evita timeouts)
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {}),
        submitButton.click({ force: true })
      ]);

      console.info('[LOGIN-07] Clique e navegação submetidos');

      const currentUrl = page.url();
      
      // Tratamento pós-submissão
      if (currentUrl.includes(LINKEDIN_CHECKPOINT)) {
        console.warn('🛑 Checkpoint detectado pós-login');
        await this.handleImpediment(page, 'linkedin-checkpoint');
        
        await page.waitForURL(url => !url.toString().includes(LINKEDIN_CHECKPOINT), {
          timeout: this.options.loginTimeoutMs ?? 300000
        });
        console.info('[LOGIN-08] Checkpoint resolvido');
      } else if (this.isLoginRedirect(currentUrl)) {
        throw new Error('linkedin-login-failed-redirect');
      } else {
        console.info('[LOGIN-08] Redirecionamento concluído para feed');
      }

    } catch (error: any) {
      if (error.message === 'early_checkpoint' || (!page.isClosed() && page.url().includes(LINKEDIN_CHECKPOINT))) {
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
    return (
      url.includes(LINKEDIN_LOGIN) ||
      url.includes(LINKEDIN_CHECKPOINT) ||
      url.includes(LINKEDIN_AUTH_PATH)
    );
  }

  private async findVisibleLoginField(page: Page, timeout = 15000): Promise<Locator> {
    const locator = page.locator('input[autocomplete="username"], input[name="session_key"]').filter({ visible: true }).first();
    await locator.waitFor({ state: 'attached', timeout }); 
    return locator;
  }

  private async findVisiblePasswordField(page: Page, timeout = 15000): Promise<Locator> {
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
      // Proteção primária contra Target closed error
      if (page.isClosed()) {
         console.warn(`[DIAGNOSTIC] Ignorado: A página já foi fechada pelo navegador. Motivo original: ${reason}`);
         return;
      }

      const timestamp = Date.now();
      console.error(`[DIAGNOSTIC] ${reason}`);
      console.error('[DIAGNOSTIC] URL:', page.url());
      
      const title = await page.title().catch(() => 'Title indisponível');
      console.error('[DIAGNOSTIC] TITLE:', title);

      // Descomente se for habilitar screenshots
      // await page.screenshot({ path: `/tmp/${reason}-${timestamp}.png`, fullPage: true }).catch(() => console.error('Falha no screenshot'));

      const domData = await page.evaluate(`
        (() => {
          function extractNodes(selector) {
            const nodes = Array.from(document.querySelectorAll(selector));
            return nodes.map(n => ({
              tag: n.tagName,
              type: n.type,
              id: n.id,
              name: n.name,
              text: n.innerText,
              autocomplete: n.autocomplete,
              visible: n.offsetParent !== null
            }));
          }

          return {
            inputs: extractNodes('input'),
            buttons: extractNodes('button'),
            domMap: extractNodes('input, button, a')
          };
        })()
      `).catch(() => null);

      if (domData) {
        // console.error('[DIAGNOSTIC] DOM_DATA\n', JSON.stringify(domData, null, 2));
      }

      const html = await page.content().catch(() => '');
      if (html) {
        // console.error('[DIAGNOSTIC] HTML_START\n', html.substring(0, 30000));
        // console.error('[DIAGNOSTIC] HTML_END');
      }

    } catch (error) {
      console.error('[DIAGNOSTIC] FAILED TO DUMP', error);
    }
  }
}