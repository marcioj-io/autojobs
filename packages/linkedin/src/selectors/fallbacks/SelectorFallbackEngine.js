"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SelectorFallbackEngine = void 0;
class SelectorFallbackEngine {
    async findFirstSelector(page, selectors) {
        for (const selector of selectors) {
            const locator = page.locator(selector).first();
            if (await locator.count()) {
                return selector;
            }
        }
        return null;
    }
    async clickFirst(page, selectors) {
        const selector = await this.findFirstSelector(page, selectors);
        if (!selector) {
            return false;
        }
        const button = page.locator(selector).first();
        if (await button.isVisible()) {
            await button.click({ force: true });
            return true;
        }
        return false;
    }
    async getLocator(page, selectors) {
        const selector = await this.findFirstSelector(page, selectors);
        return selector ? page.locator(selector).first() : null;
    }
    async count(page, selectors) {
        const selector = await this.findFirstSelector(page, selectors);
        return selector ? await page.locator(selector).count() : 0;
    }
}
exports.SelectorFallbackEngine = SelectorFallbackEngine;
