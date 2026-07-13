// packages/engine/src/browser/manager.ts
import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

import type {
    Browser,
    BrowserContextOptions
} from 'playwright';

import { randomDelay } from '../utils';
import { buildBrowserFingerprint } from '../fingerprints/BrowserFingerprint';

chromium.use(StealthPlugin());

export interface BrowserManagerOptions {
    headless?: boolean;
    userAgent?: string;
}

export class BrowserManager {
    private static instance: BrowserManager;

    public static getInstance(options: BrowserManagerOptions = {}): BrowserManager {
        if (!BrowserManager.instance) {
          BrowserManager.instance = new BrowserManager(options);
        }
        return BrowserManager.instance;
    }

    private browser: Browser | null = null;

    private readonly persistentFingerprint = buildBrowserFingerprint();

    private constructor(
        private readonly options: BrowserManagerOptions
    ) {}

    async launch(): Promise<Browser> {
        if (this.browser) {
            return this.browser;
        }
        const wsEndpoint = process.env.BROWSER_WS_ENDPOINT;

        try {
            if (wsEndpoint) {
                console.info("[1 - BROWSER] Conectando Browserless...");
                this.browser = await chromium.connect({
                    wsEndpoint,
                    timeout: 30000
                });
                console.info("[2 - BROWSER] Browserless conectado");
            } else {
                console.info("[1 - BROWSER] Chromium Local");
                this.browser = await chromium.launch({
                    headless: this.options.headless ?? true,
                    args: [
                        "--no-sandbox",
                        "--disable-setuid-sandbox",
                        "--disable-dev-shm-usage",
                        "--disable-gpu",
                        "--disable-software-rasterizer",
                        "--disable-extensions",
                        "--mute-audio",
                        '--js-flags="--max-old-space-size=512"',
                        "--disable-blink-features=AutomationControlled"
                    ]
                });
                console.info("[2 - BROWSER] Chromium iniciado");
            }
        } catch (err) {
            if (this.browser) {
                await this.browser.close().catch(() => {});
                this.browser = null;
            }
            throw err;
        }
        await randomDelay(800, 1400);
        return this.browser;
    }

    async newContext( options: BrowserContextOptions = {}) {
        const browser = await this.launch();
        console.info("[📍 BROWSER_MANAGER] Novo Context");
        return browser.newContext({
            ...options,

            userAgent:
                options.userAgent ??
                this.options.userAgent ??
                this.persistentFingerprint.userAgent,

            locale:
                options.locale ??
                this.persistentFingerprint.locale,

            timezoneId:
                options.timezoneId ??
                this.persistentFingerprint.timezoneId,

            viewport:
                options.viewport ??
                this.persistentFingerprint.viewport
        });
    }

    async newPage( options: BrowserContextOptions = {}) {
        const context = await this.newContext(options);
        const page = await context.newPage();
        await randomDelay(400, 900);
        return page;
    }

    async close() {
        if (!this.browser) {
            return;
        }
        await this.browser.close();
        this.browser = null;
    }
}