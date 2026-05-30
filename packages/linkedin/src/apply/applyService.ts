import { Page } from 'playwright';
import { parseEasyApplyForm } from './formParser';
import { classifyApplyForm } from './classifier';
import { buildAnswerMap } from './answerEngine';
import { getResumePath } from './resumeSelector';
import { randomDelay } from '../utils';
import { simulateTyping } from '../behavior/HumanBehavior';
import { SelectorFallbackEngine } from '../selectors/fallbacks/SelectorFallbackEngine';
import type {
  LinkedInApplyOptions,
  LinkedInApplyResult,
  LinkedInApplyContext,
  LinkedInFormField
} from './types';

const EASY_APPLY_BUTTONS = [
  'button:has-text("Easy Apply")',
  'button[data-control-name*="apply"], button[aria-label*="Apply"], button:has-text("Apply")'
];

const CONTINUE_SELECTORS = [
  'button:has-text("Continue")',
  'button[aria-label*="Continue"]',
  'button:has-text("Next")'
];

const SUBMIT_SELECTORS = [
  'button:has-text("Submit application")',
  'button:has-text("Submit")',
  'button[aria-label*="Submit application"]'
];

const SUCCESS_INDICATORS = [
  'text=Application submitted',
  'text=Your application has been submitted',
  '.artdeco-toast-item',
  '.jobs-easy-apply-success'
];

const EASY_APPLY_FALLBACK = [
  'button:has-text("Easy Apply")',
  'button[data-control-name*="apply"]',
  'button[aria-label*="Apply"]',
  'button:has-text("Apply")'
];

const CONTINUE_FALLBACK = [
  'button:has-text("Continue")',
  'button[aria-label*="Continue"]',
  'button:has-text("Next")'
];

const SUBMIT_FALLBACK = [
  'button:has-text("Submit application")',
  'button:has-text("Submit")',
  'button[aria-label*="Submit application"]'
];

export class LinkedInApplyService {
  private fallbackEngine = new SelectorFallbackEngine();

  constructor(private context: LinkedInApplyContext = { profile: 'backend', language: 'PT' }) {}

  async applyToJob(page: Page, jobUrl: string, options: LinkedInApplyOptions = {}): Promise<LinkedInApplyResult> {
    await this.openJobPage(page, jobUrl);
    const easyApplyButton = await this.findEasyApplyButton(page);
    if (!easyApplyButton) {
      return this.buildResult('ABORT', 'aborted', 'Easy Apply button not found');
    }

    await easyApplyButton.click();
    await randomDelay(1000, 1800);

    const form = await parseEasyApplyForm(page);
    const decision = classifyApplyForm(form);
    if (decision !== 'AUTO') {
      return this.buildResult(decision, decision === 'ABORT' ? 'aborted' : 'review', `Form classified as ${decision}`);
    }

    const resumePath = options.resumePath || getResumePath(options.profile ?? this.context.profile);
    const answers = buildAnswerMap(options.answers ?? {});

    if (form.hasFileUpload && !resumePath) {
      return this.buildResult('REVIEW', 'review', 'Resume upload required but no resume path configured.');
    }

    await this.fillForm(page, form.rawFields, answers, resumePath, options.coverLetter);
    const submitted = await this.submitForm(page);

    return this.buildResult(
      'AUTO',
      submitted ? 'submitted' : 'aborted',
      submitted ? 'Application submitted successfully.' : 'Unable to confirm application submission.'
    );
  }

  private buildResult(decision: string, status: LinkedInApplyResult['status'], details: string): LinkedInApplyResult {
    return {
      decision: decision as LinkedInApplyResult['decision'],
      status,
      appliedAt: new Date().toISOString(),
      details
    };
  }

  private async openJobPage(page: Page, jobUrl: string) {
    if (page.url() !== jobUrl) {
      await page.goto(jobUrl, { waitUntil: 'domcontentloaded' });
      await randomDelay(900, 1600);
    }
  }

  private async findEasyApplyButton(page: Page) {
    const selector = await this.fallbackEngine.findFirstSelector(page, EASY_APPLY_FALLBACK);
    return selector ? page.locator(selector).first() : null;
  }

  private async fillForm(
    page: Page,
    fields: LinkedInFormField[],
    answer: (label: string, type: LinkedInFormField['type']) => string,
    resumePath?: string,
    coverLetter?: string
  ) {
    for (const field of fields) {
      const value = answer(field.label, field.type);
      if (field.type === 'file' && resumePath) {
        await this.uploadResume(page, field, resumePath);
        continue;
      }
      if (!value && field.type !== 'yesno' && field.type !== 'checkbox' && field.type !== 'radio') {
        continue;
      }
      await this.fillField(page, field, value, coverLetter);
      await randomDelay(300, 800);
    }
  }

  private async fillField(page: Page, field: LinkedInFormField, value: string, coverLetter?: string) {
    const locator = page.locator(`label:has-text("${field.label}"), [name="${field.name}"], [id="${field.name}"]`).first();
    if (!await locator.count()) {
      return;
    }

    if (field.type === 'textarea') {
      await simulateTyping(locator, coverLetter || value || '');
      return;
    }

    if (field.type === 'text') {
      const finalValue = value || (field.label.toLowerCase().includes('cover letter') ? coverLetter ?? '' : '');
      await simulateTyping(locator, finalValue);
      return;
    }

    if (field.type === 'select') {
      if (field.options?.length) {
        await locator.selectOption({ label: field.options[0] });
      }
      return;
    }

    if (field.type === 'yesno' || field.type === 'radio') {
      const normalized = value || 'Yes';
      const option = page.locator(`label:has-text("${field.label}") ~ div input[type=radio], label:has-text("${field.label}") ~ span input[type=radio], input[type=radio]`);
      if (await option.count()) {
        await option.filter({ hasText: normalized }).first().check({ force: true });
      }
      return;
    }

    if (field.type === 'checkbox') {
      const normalized = value.toLowerCase();
      const checkbox = locator.locator('input[type=checkbox]');
      if (await checkbox.count()) {
        const shouldCheck = normalized === 'yes' || normalized === 'true';
        if (shouldCheck) await checkbox.check({ force: true });
      }
    }
  }

  private async uploadResume(page: Page, field: LinkedInFormField, resumePath: string) {
    const input = page.locator(`input[type="file"]`).first();
    if (await input.count()) {
      await input.setInputFiles(resumePath);
      await randomDelay(1000, 1600);
    }
  }

  private async submitForm(page: Page) {
    let attempts = 0;
    while (attempts < 5) {
      attempts += 1;
      if (await this.fallbackEngine.clickFirst(page, SUBMIT_FALLBACK)) {
        await randomDelay(1300, 2200);
        if (await this.waitForSuccess(page)) {
          return true;
        }
      }

      if (await this.fallbackEngine.clickFirst(page, CONTINUE_FALLBACK)) {
        await randomDelay(1200, 2000);
        continue;
      }

      await randomDelay(800, 1200);
      if (await this.waitForSuccess(page)) {
        return true;
      }
    }
    return false;
  }

  private async waitForSuccess(page: Page) {
    try {
      await page.waitForSelector(SUCCESS_INDICATORS.join(','), { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }
}
