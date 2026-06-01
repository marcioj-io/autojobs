import type { BrowserContext, Page } from 'playwright';
import type { LinkedInSessionAdapter } from './types';
export declare function restoreLinkedInSession(context: BrowserContext, page: Page, sessionId: string, adapter: LinkedInSessionAdapter): Promise<boolean>;
export declare function persistLinkedInSession(context: BrowserContext, sessionId: string, adapter: LinkedInSessionAdapter): Promise<void>;
export declare function requireManualLogin(page: Page): Promise<void>;
