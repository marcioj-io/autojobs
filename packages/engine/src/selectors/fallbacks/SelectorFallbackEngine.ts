
// packages\engine\src\selectors\fallbacks\SelectorFallbackEngine.ts
import type { Page } from 'playwright';
export class SelectorFallbackEngine {
  async findFirstSelector(page: Page, selectors: string[]) {
    for (const selector of selectors) {
      const locator = page.locator(selector).first();
      if (await locator.count()) {
        return selector;
      }
    }
    return null;
  }

  async clickFirst(page: Page, selectors: string[]) {
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

  async getLocator(page: Page, selectors: string[]) {
    const selector = await this.findFirstSelector(page, selectors);
    return selector ? page.locator(selector).first() : null;
  }

  async count(page: Page, selectors: string[]) {
    const selector = await this.findFirstSelector(page, selectors);
    return selector ? await page.locator(selector).count() : 0;
  }
}
