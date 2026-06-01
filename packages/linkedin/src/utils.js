"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.randomInteger = randomInteger;
exports.delay = delay;
exports.randomDelay = randomDelay;
exports.retry = retry;
exports.scrollPage = scrollPage;
function randomInteger(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
async function randomDelay(min = 500, max = 1500) {
    const ms = randomInteger(min, max);
    await delay(ms);
}
async function retry(fn, attempts = 3, delayMs = 1000) {
    let lastError;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
        try {
            return await fn();
        }
        catch (error) {
            lastError = error;
            if (attempt === attempts)
                break;
            await delay(delayMs * attempt);
        }
    }
    throw lastError;
}
async function scrollPage(page, duration = 1000, distance = 500) {
    await page.evaluate(async ({ duration, distance }) => {
        const step = distance / 20;
        const interval = duration / 20;
        for (let offset = 0; offset < distance; offset += step) {
            window.scrollBy(0, step);
            await new Promise((resolve) => setTimeout(resolve, interval));
        }
    }, { duration, distance });
    await randomDelay(300, 800);
}
