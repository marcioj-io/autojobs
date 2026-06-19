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
    console.log("🚀 ~ LinkedInSessionManager ~ constructor ~ options:", options)
    console.log("🚀 ~ LinkedInSessionManager ~ constructor ~ storageState:", storageState)
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
    const context = await browserManager.newContext({ storageState: storage });
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
    console.log('🤖 Iniciando login automatizado...');

    try {
      await retry(async () => {
        await page.goto(LINKEDIN_LOGIN, { waitUntil: 'domcontentloaded' });
      }, 3, 1200);

      console.log('[LOGIN-01] Página carregada | URL:', page.url());

      const usernameField = await this.findVisibleLoginField(page);
      console.log('[LOGIN-02] Username encontrado');
      await usernameField.click();
      await usernameField.fill('');
      // Substituído page.type() por pressSequentially (método atualizado e seguro do Playwright)
      await usernameField.pressSequentially(user, { delay: 50 }); 
      console.log('[LOGIN-05] Username preenchido');

      const passwordField = await this.findVisiblePasswordField(page);
      console.log('[LOGIN-06] Password encontrada');
      await passwordField.click();
      await passwordField.fill('');
      await passwordField.pressSequentially(pass, { delay: 50 });
      console.log('[LOGIN-09] Password preenchida');

      await randomDelay(500, 1200);

      console.log('[LOGIN-10] Procurando submit');
      const submitButton = page.getByRole('button', { name: /^(Sign in|Entrar)$/i });
      await submitButton.waitFor({ state: 'visible', timeout: 15000 });
      await submitButton.click();

      console.log('[LOGIN-11] Submit clicado');

      try {
        // waitForURL é mais seguro que waitForFunction avaliando window.location
        await page.waitForURL(url => !this.isLoginRedirect(url.toString()), { timeout: 20000 });
        console.log('[LOGIN-12] Redirecionamento concluído');
      } catch (e) {
        console.warn('[LOGIN-12] Não houve redirecionamento limpo, verificando estado da página...');
        await this.handleImpediment(page, 'linkedin-login-no-redirect', e);
      }

      if (page.url().includes(LINKEDIN_CHECKPOINT)) {
        console.warn('🛑 Checkpoint detectado');
        await this.handleImpediment(page, 'linkedin-checkpoint');

        await page.waitForURL(url => !url.toString().includes(LINKEDIN_CHECKPOINT), {
          timeout: this.options.loginTimeoutMs ?? 300000
        });
        console.log('[LOGIN-13] Checkpoint resolvido');
      }

    } catch (error) {
      await this.handleImpediment(page, 'linkedin-login-failed', error);
      console.error('[LOGIN-FATAL]', error);
      throw error;
    }
  }

  /**
   * Centraliza a emissão de diagnósticos e delega falhas complexas
   * para serviços auxiliares caso configurado.
   */
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

  // Refatorado para usar a engine de seletores do próprio Playwright, 
  // eliminando o loop 'while' manual que consome processamento desnecessário.
  private async findVisibleLoginField(page: Page, timeout = 30000): Promise<Locator> {
      const selectors = [
        'input[autocomplete="username"]',
        'input[autocomplete*="username"]',
        'input[type="email"]',
        'input[name="session_key"]',
        'input[name="username"]',
        'input#username'
      ].join(', ');

      // Corrigido: Usando a propriedade correta 'visible: true' do .filter()
      const locator = page.locator(selectors).filter({ visible: true }).first();
      await locator.waitFor({ state: 'visible', timeout });
      
      return locator;
  }
   
  private async findVisiblePasswordField(page: Page, timeout = 30000): Promise<Locator> {
      const selectors = [
        'input[type="password"]',
        'input[name="session_password"]',
        'input[autocomplete="current-password"]'
      ].join(', ');

      // Corrigido: Usando a propriedade correta 'visible: true' do .filter()
      const locator = page.locator(selectors).filter({ visible: true }).first();
      await locator.waitFor({ state: 'visible', timeout });
      
      return locator;
  }

  private async dumpPageDiagnostics(page: Page, reason: string): Promise<void> {
    try {
      const timestamp = Date.now();
      console.error(`[DIAGNOSTIC] ${reason}`);
      console.error('[DIAGNOSTIC] URL:', page.url());
      console.error('[DIAGNOSTIC] TITLE:', await page.title());

      await page.screenshot({ path: `/tmp/${reason}-${timestamp}.png`, fullPage: true });


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
          `);

      console.error('[DIAGNOSTIC] DOM_DATA\n', JSON.stringify(domData, null, 2));

      const html = await page.content();
      console.error('[DIAGNOSTIC] HTML_START\n', html.substring(0, 30000));
      console.error('[DIAGNOSTIC] HTML_END');

    } catch (error) {
      console.error('[DIAGNOSTIC] FAILED', error);
    }
  }
}