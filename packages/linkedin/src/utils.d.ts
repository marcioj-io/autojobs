import type { Page } from 'playwright';
export declare function randomInteger(min: number, max: number): number;
export declare function delay(ms: number): Promise<unknown>;
export declare function randomDelay(min?: number, max?: number): Promise<void>;
export declare function retry<T>(fn: () => Promise<T>, attempts?: number, delayMs?: number): Promise<T>;
export declare function scrollPage(page: Page, duration?: number, distance?: number): Promise<void>;
