import type { Page } from 'playwright';
import type { LinkedInFormParseResult } from './types';
export declare function parseEasyApplyForm(page: Page): Promise<LinkedInFormParseResult>;
