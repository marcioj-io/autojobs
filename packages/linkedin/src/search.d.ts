import type { Page } from 'playwright';
import type { LinkedInJobRecord, LinkedInSearchOptions } from './types';
export declare function searchLinkedInJobs(page: Page, options: LinkedInSearchOptions): Promise<LinkedInJobRecord[]>;
