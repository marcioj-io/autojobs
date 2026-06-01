"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LinkedInSessionManager = void 0;
const utils_1 = require("../utils");
const LINKEDIN_HOME = 'https://www.linkedin.com/feed/';
const LINKEDIN_LOGIN = 'https://www.linkedin.com/login';
const LINKEDIN_CHECKPOINT = '/checkpoint/';
const LINKEDIN_AUTH_PATH = '/uas/login';
class LinkedInSessionManager {
    adapter;
    sessionId;
    options;
    constructor(adapter, sessionId, options = {}) {
        this.adapter = adapter;
        this.sessionId = sessionId;
        this.options = options;
    }
    async loadStorageState() {
        return this.adapter.load(this.sessionId);
    }
    async saveStorageState(context) {
        const state = await context.storageState();
        await this.adapter.save(this.sessionId, JSON.stringify(state));
    }
    async restoreAuthenticatedSession(browserManager) {
        const storageState = await this.loadStorageState();
        if (!storageState) {
            return null;
        }
        const { context, page } = await this.openPage(browserManager, storageState);
        const active = await this.validateSession(context, page);
        if (!active) {
            await context.close();
            return null;
        }
        return { context, page, restored: true };
    }
    async bootstrapLogin(browserManager) {
        const { context, page } = await this.openPage(browserManager);
        await this.promptManualLogin(page);
        await this.saveStorageState(context);
        return { context, page, restored: false };
    }
    async openPage(browserManager, storageState) {
        const storage = storageState ? JSON.parse(storageState) : undefined;
        const context = await browserManager.newContext({ storageState: storage });
        const page = await context.newPage();
        await (0, utils_1.randomDelay)(800, 1500);
        return { context, page };
    }
    async validateSession(context, page) {
        await (0, utils_1.retry)(async () => {
            await page.goto(LINKEDIN_HOME, { waitUntil: 'domcontentloaded' });
        }, 3, 1200);
        await (0, utils_1.randomDelay)(900, 1700);
        await (0, utils_1.scrollPage)(page, 1000, 600);
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
    async promptManualLogin(page) {
        await (0, utils_1.retry)(async () => {
            await page.goto(LINKEDIN_LOGIN, { waitUntil: 'domcontentloaded' });
        }, 3, 1200);
        await page.waitForSelector('input[name=username], input#username', {
            timeout: this.options.loginTimeoutMs ?? 60000
        });
        console.log('LinkedIn login iniciado. Complete o login na janela do navegador.');
        await page.waitForFunction(() => !window.location.href.includes('/login') && !window.location.href.includes('/checkpoint/') && !window.location.href.includes('/uas/login'), { timeout: this.options.loginTimeoutMs ?? 600000 });
        await (0, utils_1.randomDelay)(1200, 2400);
        await (0, utils_1.scrollPage)(page, 1200, 900);
    }
    isLoginRedirect(url) {
        return (url.includes(LINKEDIN_LOGIN) ||
            url.includes(LINKEDIN_CHECKPOINT) ||
            url.includes(LINKEDIN_AUTH_PATH));
    }
}
exports.LinkedInSessionManager = LinkedInSessionManager;
