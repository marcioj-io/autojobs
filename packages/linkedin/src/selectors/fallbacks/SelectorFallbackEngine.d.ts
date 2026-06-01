import type { Page, Locator } from 'playwright';
export declare class SelectorFallbackEngine {
    findFirstSelector(page: Page, selectors: string[]): Promise<string | null>;
    clickFirst(page: Page, selectors: string[]): Promise<boolean>;
    getLocator(page: Page, selectors: string[]): Promise<Locator | null>;
    count(page: Page, selectors: string[]): Promise<number>;
}
