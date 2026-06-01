"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BrowserManager = void 0;
const playwright_1 = require("playwright");
const utils_1 = require("../utils");
const BrowserFingerprint_1 = require("../fingerprints/BrowserFingerprint");
const DEFAULT_USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
];
class BrowserManager {
    options;
    browser = null;
    constructor(options = {}) {
        this.options = options;
    }
    async launch() {
        if (!this.browser) {
            const opts = {
                headless: this.options.headless ?? true,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            };
            this.browser = await playwright_1.chromium.launch(opts);
            await (0, utils_1.randomDelay)(800, 1400);
        }
        return this.browser;
    }
    async newContext(options = {}) {
        const browser = await this.launch();
        const storageState = typeof options.storageState === 'string' ? JSON.parse(options.storageState) : options.storageState;
        const fingerprint = (0, BrowserFingerprint_1.buildBrowserFingerprint)();
        const contextOptions = {
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
        await (0, utils_1.randomDelay)(500, 1200);
        return context;
    }
    async newPage(options = {}) {
        const context = await this.newContext(options);
        const page = await context.newPage();
        await (0, utils_1.randomDelay)(400, 900);
        return page;
    }
    async close() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
    }
    pickRandomUserAgent() {
        return DEFAULT_USER_AGENTS[Math.floor(Math.random() * DEFAULT_USER_AGENTS.length)];
    }
}
exports.BrowserManager = BrowserManager;
