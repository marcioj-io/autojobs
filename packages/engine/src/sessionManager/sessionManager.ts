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

    try {
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
    } catch (error) {

      console.error(
        '❌ Campo de login não encontrado'
      );

      await this.captureDebugArtifacts(
        page,
        'linkedin-login-selector-failed'
      );

      throw error;
    }

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

    const submitButton =
      page.locator(
        `
        button[type="submit"],
        button:has-text("Entrar"),
        button:has-text("Sign in")
        `
      ).first();

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

      await this.captureDebugArtifacts(
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

      await this.captureDebugArtifacts(
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

  private isLoginRedirect(url: string) {
    return (
      url.includes(LINKEDIN_LOGIN) ||
      url.includes(LINKEDIN_CHECKPOINT) ||
      url.includes(LINKEDIN_AUTH_PATH)
    );
  }

  private async captureDebugArtifacts(
  page: Page,
  reason: string
) {

  try {

    const timestamp =
      Date.now();

    await page.screenshot({
      path:
        `/tmp/${reason}-${timestamp}.png`,
      fullPage: true
    });

    const html =
      await page.content();

    console.error(
      `[DEBUG] ${reason}`
    );

    console.error(
      html.substring(
        0,
        10000
      )
    );

  } catch (error) {

    console.error(
      'Falha ao gerar diagnóstico',
      error
    );

  }
}
}