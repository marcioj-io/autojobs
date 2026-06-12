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
    if (!this.browser) {
      // Força a leitura direta da variável
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

      if (wsEndpoint && wsEndpoint.startsWith('wss://')) {
        console.info(`[BrowserManager] Conectando ao navegador remoto via WebSocket...`);
        this.browser = await chromium.connect({ wsEndpoint });
      } else {
        console.info(`[BrowserManager] Nenhuma URL válida encontrada, iniciando navegador local...`);
        const opts: LaunchOptions = {
          headless: this.options.headless ?? true,
          args: ['--no-sandbox', '--disable-setuid-sandbox']
        };
        this.browser = await chromium.launch(opts);
      }
      await randomDelay(800, 1400);
    }
    return this.browser;
  }

  async newContext(options: BrowserManagerContextOptions = {}) {
    const browser = await this.launch();
    const storageState = typeof options.storageState === 'string' ? JSON.parse(options.storageState) : options.storageState;
    const fingerprint = buildBrowserFingerprint();
    const contextOptions: BrowserContextOptions = {
      userAgent: options.userAgent ?? this.options.userAgent ?? fingerprint.userAgent,
      storageState,
      locale: fingerprint.locale,
      timezoneId: fingerprint.timezoneId,
      viewport: fingerprint.viewport
    };
    const context = await browser.newContext(contextOptions);
    if (options.cookies?.length) {
      await context.addCookies(options.cookies);
    }
    await randomDelay(500, 1200);
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