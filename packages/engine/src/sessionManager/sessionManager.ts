// packages\engine\src\sessionManager\sessionManager.ts
import type { BrowserContext, BrowserContextOptions, Page } from 'playwright';
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
  ) {}

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
    credentials?: { username?: string; password?: string }
  ): Promise<LinkedInSessionResult> {
    const { context, page } = await this.openPage(browserManager);

    // Tenta pegar as credenciais passadas ou do ambiente
    const user = credentials?.username ?? process.env.LINKEDIN_USERNAME;
    const pass = credentials?.password ?? process.env.LINKEDIN_PASSWORD;

    if (user && pass) {
      await this.performAutoLogin(page, user, pass);
    } else {
      console.warn('⚠️ Credenciais não encontradas. Iniciando login manual...');
      await this.promptManualLogin(page);
    }

    return { context, page, restored: false };
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

  private async performAutoLogin(
    page: Page,
    user: string,
    pass: string
  ): Promise<void> {

    try {

      console.log('🤖 Iniciando login automatizado...');

      await retry(async () => {
        await page.goto(
          LINKEDIN_LOGIN,
          {
            waitUntil: 'domcontentloaded'
          }
        );
      }, 3, 1200);

      await page.waitForLoadState('networkidle');

      console.log('URL:', page.url());
      console.log('TITLE:', await page.title());

      await page.screenshot({
        path: `/tmp/linkedin-login-${Date.now()}.png`,
        fullPage: true
      });

      await page.waitForSelector(
        `
        input[autocomplete*="username"],
        input[type="email"],
        input#username,
        input[name="username"],
        input[name="session_key"]
        `,
        {
          timeout: 15000
        }
      );

      const usernameField =
        page.locator(
          `
          input[autocomplete*="username"],
          input[type="email"],
          input#username,
          input[name="username"],
          input[name="session_key"]
          `
        ).first();

      const passwordField =
        page.locator(
          `
          input[autocomplete="current-password"],
          input[type="password"],
          input#password,
          input[name="password"],
          input[name="session_password"]
          `
        ).first();

      await usernameField.fill(user);

      await randomDelay(
        300,
        800
      );

      await passwordField.fill(pass);

      await randomDelay(
        400,
        1000
      );

      console.log(
        '[LOGIN] Procurando botão Entrar'
      );

      let submitButton;

      try {

        submitButton =
          page
            .getByRole(
              'button',
              {
                name: /entrar|sign in/i
              }
            )
            .first();

        await submitButton.waitFor({
          state: 'visible',
          timeout: 5000
        });

      } catch {

        submitButton =
          page.locator(`
            button:has-text("Entrar"),
            button:has-text("Sign in")
          `).last();

      }

      console.log(
        '[LOGIN] Botão encontrado'
      );

      await submitButton.click();

      try {

        await page.waitForFunction(
          () =>
            !window.location.href.includes('/login') &&
            !window.location.href.includes('/uas/login'),
          {
            timeout: 20000
          }
        );

      } catch {

        console.warn(
          '⚠️ Login não redirecionou'
        );

        await this.dumpPageDiagnostics(
          page,
          'linkedin-login-no-redirect'
        );
      }

      if (
        page.url().includes(
          LINKEDIN_CHECKPOINT
        )
      ) {

        console.warn(
          '🛑 Checkpoint detectado'
        );

        await this.dumpPageDiagnostics(
          page,
          'linkedin-checkpoint'
        );

        await page.waitForFunction(
          () =>
            !window.location.href.includes(
              '/checkpoint/'
            ),
          {
            timeout:
              this.options.loginTimeoutMs ??
              300000
          }
        );
      }

    } catch (error) {

      await this.dumpPageDiagnostics(
        page,
        'linkedin-login-failed'
      );

      throw error;

    }
  }

  private async promptManualLogin(page: Page): Promise<void> {
    await retry(async () => {
      await page.goto(LINKEDIN_LOGIN, { waitUntil: 'domcontentloaded' });
    }, 3, 1200);

    await page.waitForSelector('input[name=username], input#username', {
      timeout: this.options.loginTimeoutMs ?? 60000
    });

    console.log('LinkedIn login iniciado. Complete o login na janela do navegador.');
    await page.waitForFunction(
      () => !window.location.href.includes('/login') && !window.location.href.includes('/checkpoint/') && !window.location.href.includes('/uas/login'),
      { timeout: this.options.loginTimeoutMs ?? 600000 }
    );

    await randomDelay(1200, 2400);
    await scrollPage(page, 1200, 900);
  }

  private async dumpPageDiagnostics(
    page: Page,
    reason: string
  ): Promise<void> {

    try {

      const timestamp =
        Date.now();

      console.error(
        `[DIAGNOSTIC] ${reason}`
      );

      console.error(
        '[DIAGNOSTIC] URL:',
        page.url()
      );

      console.error(
        '[DIAGNOSTIC] TITLE:',
        await page.title()
      );

      await page.screenshot({
        path:
          `/tmp/${reason}-${timestamp}.png`,
        fullPage: true
      });

      const inputs =
        await page
          .locator('input')
          .evaluateAll(
            (nodes: any[]) =>
              nodes.map(
                (n: any) => ({
                  type:
                    n.type,
                  id:
                    n.id,
                  name:
                    n.name,
                  autocomplete:
                    n.autocomplete,
                  visible:
                    n.offsetParent !== null
                })
              )
          );

      console.error(
        '[DIAGNOSTIC] INPUTS'
      );

      console.error(
        JSON.stringify(
          inputs,
          null,
          2
        )
      );

      const buttons =
        await page
          .locator('button')
          .evaluateAll(
            (nodes: any[]) =>
              nodes.map(
                (n: any) => ({
                  text:
                    n.innerText,
                  type:
                    n.type,
                  visible:
                    n.offsetParent !== null
                })
              )
          );

      console.error(
        '[DIAGNOSTIC] BUTTONS'
      );

      console.error(
        JSON.stringify(
          buttons,
          null,
          2
        )
      );

      const domMap =
        await page.evaluate(() => {

          const result: any[] = [];

          document
            .querySelectorAll(
              'input,button,a'
            )
            .forEach(
              (el: any) => {

                result.push({
                  tag:
                    el.tagName,
                  text:
                    el.innerText,
                  id:
                    el.id,
                  name:
                    el.name,
                  type:
                    el.type,
                  visible:
                    el.offsetParent !== null
                });

              }
            );

          return result;

        });

      console.error(
        '[DIAGNOSTIC] DOM_MAP'
      );

      console.error(
        JSON.stringify(
          domMap,
          null,
          2
        )
      );

      const html =
        await page.content();

      console.error(
        '[DIAGNOSTIC] HTML_START'
      );

      console.error(
        html.substring(
          0,
          30000
        )
      );

      console.error(
        '[DIAGNOSTIC] HTML_END'
      );

    } catch (error) {

      console.error(
        '[DIAGNOSTIC] FAILED',
        error
      );

    }
  }
  private isLoginRedirect(url: string) {
    return (
      url.includes(LINKEDIN_LOGIN) ||
      url.includes(LINKEDIN_CHECKPOINT) ||
      url.includes(LINKEDIN_AUTH_PATH)
    );
  }

}