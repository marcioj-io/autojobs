import type { BrowserContext, Page } from 'playwright';
import type { BrowserManager } from '../browser/manager';
import type { LinkedInSessionAdapter } from '../types';
export interface LinkedInSessionManagerOptions {
    loginTimeoutMs?: number;
    validationTimeoutMs?: number;
    minimumDelayMs?: number;
}
export interface LinkedInSessionResult {
    context: BrowserContext;
    page: Page;
    restored: boolean;
}
export declare class LinkedInSessionManager {
    private adapter;
    private sessionId;
    private options;
    constructor(adapter: LinkedInSessionAdapter, sessionId: string, options?: LinkedInSessionManagerOptions);
    loadStorageState(): Promise<string | null>;
    saveStorageState(context: BrowserContext): Promise<void>;
    restoreAuthenticatedSession(browserManager: BrowserManager): Promise<LinkedInSessionResult | null>;
    bootstrapLogin(browserManager: BrowserManager): Promise<LinkedInSessionResult>;
    private openPage;
    private validateSession;
    private promptManualLogin;
    private isLoginRedirect;
}
