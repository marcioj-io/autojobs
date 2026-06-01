import { type Browser, type BrowserContext, type BrowserContextOptions, type Cookie } from 'playwright';
export interface BrowserManagerOptions {
    headless?: boolean;
    userAgent?: string;
}
export interface BrowserManagerContextOptions {
    storageState?: string | BrowserContextOptions['storageState'];
    cookies?: Cookie[];
    userAgent?: string;
}
export declare class BrowserManager {
    private options;
    private browser;
    constructor(options?: BrowserManagerOptions);
    launch(): Promise<Browser>;
    newContext(options?: BrowserManagerContextOptions): Promise<BrowserContext>;
    newPage(options?: BrowserManagerContextOptions): Promise<import("playwright").Page>;
    close(): Promise<void>;
    private pickRandomUserAgent;
}
