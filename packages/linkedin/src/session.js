"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.restoreLinkedInSession = restoreLinkedInSession;
exports.persistLinkedInSession = persistLinkedInSession;
exports.requireManualLogin = requireManualLogin;
const utils_1 = require("./utils");
const LINKEDIN_HOME = 'https://www.linkedin.com/feed/';
const LOGIN_PAGE = 'https://www.linkedin.com/login';
async function restoreLinkedInSession(context, page, sessionId, adapter) {
    const cookiesJson = await adapter.load(sessionId);
    if (!cookiesJson) {
        return false;
    }
    let cookies;
    try {
        cookies = JSON.parse(cookiesJson);
    }
    catch {
        return false;
    }
    if (Array.isArray(cookies) && cookies.length > 0) {
        await context.addCookies(cookies);
        await page.goto(LINKEDIN_HOME, { waitUntil: 'domcontentloaded' });
        await (0, utils_1.randomDelay)(900, 1500);
        return !(await page.url()).includes('/login');
    }
    return false;
}
async function persistLinkedInSession(context, sessionId, adapter) {
    const cookies = await context.cookies();
    await adapter.save(sessionId, JSON.stringify(cookies));
}
async function requireManualLogin(page) {
    await page.goto(LOGIN_PAGE, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('input[name=username], input#username', { timeout: 60000 });
    console.log('Please complete LinkedIn login in the browser window.');
    await page.waitForFunction(() => !window.location.href.includes('/login'), { timeout: 600000 });
    await (0, utils_1.randomDelay)(1200, 2200);
}
