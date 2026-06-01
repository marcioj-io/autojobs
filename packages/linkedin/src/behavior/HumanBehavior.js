"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.simulateTyping = simulateTyping;
exports.smoothScroll = smoothScroll;
exports.idlePause = idlePause;
exports.randomMouseMove = randomMouseMove;
exports.navigateWithPacing = navigateWithPacing;
async function simulateTyping(locator, text) {
    await locator.fill('');
    for (const char of text) {
        await locator.type(char, { delay: 50 + Math.floor(Math.random() * 120) });
    }
}
async function smoothScroll(page, distance = 300) {
    await page.evaluate(async ({ distance }) => {
        const step = Math.max(20, Math.floor(distance / 10));
        for (let current = 0; current < distance; current += step) {
            window.scrollBy(0, step);
            await new Promise((resolve) => window.setTimeout(resolve, 80 + Math.random() * 80));
        }
    }, { distance });
}
async function idlePause(minMs = 500, maxMs = 1600) {
    const delay = minMs + Math.floor(Math.random() * (maxMs - minMs));
    return new Promise((resolve) => setTimeout(resolve, delay));
}
async function randomMouseMove(page) {
    try {
        const box = await page.evaluate(() => ({
            width: window.innerWidth,
            height: window.innerHeight
        }));
        await page.mouse.move(Math.floor(box.width * 0.5 + (Math.random() - 0.5) * 120), Math.floor(box.height * 0.35 + (Math.random() - 0.5) * 120), { steps: 8 });
    }
    catch {
        // best-effort only
    }
}
async function navigateWithPacing(page, url) {
    await idlePause(600, 1400);
    await page.goto(url, { waitUntil: 'load' });
    await idlePause(700, 1300);
}
