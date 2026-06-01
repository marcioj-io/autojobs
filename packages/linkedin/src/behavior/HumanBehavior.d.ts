import type { Locator, Page } from 'playwright';
export declare function simulateTyping(locator: Locator, text: string): Promise<void>;
export declare function smoothScroll(page: Page, distance?: number): Promise<void>;
export declare function idlePause(minMs?: number, maxMs?: number): Promise<unknown>;
export declare function randomMouseMove(page: Page): Promise<void>;
export declare function navigateWithPacing(page: Page, url: string): Promise<void>;
