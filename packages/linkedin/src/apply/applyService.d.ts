import { Page } from 'playwright';
import type { LinkedInApplyOptions, LinkedInApplyResult, LinkedInApplyContext } from './types';
export declare class LinkedInApplyService {
    private context;
    private fallbackEngine;
    constructor(context?: LinkedInApplyContext);
    applyToJob(page: Page, jobUrl: string, options?: LinkedInApplyOptions): Promise<LinkedInApplyResult>;
    private buildResult;
    private openJobPage;
    private findEasyApplyButton;
    private fillForm;
    private fillField;
    private uploadResume;
    private submitForm;
    private waitForSuccess;
}
