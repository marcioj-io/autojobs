// packages\engine\src\browser\manager.ts
import { chromium, type Browser, type BrowserContext, type BrowserContextOptions, type Cookie, type LaunchOptions } from 'playwright';
import { randomDelay } from '../utils';
import { buildBrowserFingerprint } from '../fingerprints/BrowserFingerprint';

const DEFAULT_USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
];

export interface BrowserManagerOptions {
  headless?: boolean;
  userAgent?: string;
}

export interface BrowserManagerContextOptions {
  storageState?: string | BrowserContextOptions['storageState'];
  cookies?: Cookie[];
  userAgent?: string;
}

export class BrowserManager {
  private browser: Browser | null = null;

  constructor(private options: BrowserManagerOptions = {}) {}

  async launch() {
    if (this.browser) {
      return this.browser;
    }

    const browserEnvKeys = Object.keys(process.env)
      .filter(k => k.toUpperCase().includes('BROWSER'));

    console.info('[DEBUG] Browser ENV keys:', browserEnvKeys);

    const wsEndpoint = process.env.BROWSER_WS_ENDPOINT;

    console.info('[DEBUG] BROWSER_WS_ENDPOINT exists:', wsEndpoint !== undefined);
    console.info('[DEBUG] BROWSER_WS_ENDPOINT type:', typeof wsEndpoint);
    console.info('[DEBUG] BROWSER_WS_ENDPOINT length:', wsEndpoint?.length ?? 0);

    if (wsEndpoint) {
      console.info(
        '[DEBUG] BROWSER_WS_ENDPOINT preview:',
        `${wsEndpoint.slice(0, 30)}...`
      );
    }

    try {
      if (wsEndpoint?.startsWith('wss://')) {
        console.info('[1] Iniciando conexão Browserless');

        console.info(
          '[DEBUG] Playwright version:',
          require('playwright/package.json').version
        );

        console.info(
          '[DEBUG] Endpoint:',
          `${wsEndpoint.slice(0, 50)}...`
        );

        console.info('[1.1] Antes chromium.connect');

        const browserPromise = chromium.connect({
          wsEndpoint,
          timeout: 100000
        });

        console.info('[1.2] chromium.connect chamado');

        // const timeoutPromise: Promise<never> =
        //   new Promise((_, reject) =>
        //     setTimeout(
        //       () => reject(new Error('Browserless timeout')),
        //       15000
        //     )
        //   );

        this.browser = await Promise.race<Browser>([
          browserPromise,
          // timeoutPromise
        ]);

        console.info('[2] Browserless conectado');
      } else {
        console.info('[1] Iniciando Chromium local');

        const opts: LaunchOptions = {
          headless: this.options.headless ?? true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox'
          ]
        };

        this.browser = await chromium.launch(opts);

        console.info('[2] Chromium local iniciado');
      }
    } catch (error) {
      console.error('[FATAL] Erro ao iniciar browser');
      console.error(error);
      throw error;
    }

    await randomDelay(800, 1400);

    return this.browser;
  }

  async newContext(options: BrowserManagerContextOptions = {}) {
    console.info('[3] Entrando em newContext');

    const browser = await this.launch();

    console.info('[4] Browser obtido');

    const storageState =
      typeof options.storageState === 'string'
        ? JSON.parse(options.storageState)
        : options.storageState;

    const fingerprint = buildBrowserFingerprint();

    const contextOptions: BrowserContextOptions = {
      userAgent:
        options.userAgent ??
        this.options.userAgent ??
        fingerprint.userAgent,

      storageState,

      locale: fingerprint.locale,
      timezoneId: fingerprint.timezoneId,
      viewport: fingerprint.viewport
    };

    console.info('[5] Antes browser.newContext');

    const context = await browser.newContext(contextOptions);

    console.info('[6] Depois browser.newContext');

    if (options.cookies?.length) {
      console.info('[7] Adicionando cookies');

      await context.addCookies(options.cookies);

      console.info('[8] Cookies adicionados');
    }

    await randomDelay(500, 1200);

    console.info('[9] Context pronto');

    return context;
  }

  async newPage(options: BrowserManagerContextOptions = {}) {
    const context = await this.newContext(options);
    const page = await context.newPage();
    await randomDelay(400, 900);
    return page;
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  private pickRandomUserAgent() {
    return DEFAULT_USER_AGENTS[Math.floor(Math.random() * DEFAULT_USER_AGENTS.length)];
  }
}