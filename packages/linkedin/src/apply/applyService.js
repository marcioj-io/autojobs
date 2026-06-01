"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LinkedInApplyService = void 0;
const formParser_1 = require("./formParser");
const classifier_1 = require("./classifier");
const answerEngine_1 = require("./answerEngine");
const resumeSelector_1 = require("./resumeSelector");
const utils_1 = require("../utils");
const HumanBehavior_1 = require("../behavior/HumanBehavior");
const SelectorFallbackEngine_1 = require("../selectors/fallbacks/SelectorFallbackEngine");
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
class LinkedInApplyService {
    context;
    fallbackEngine = new SelectorFallbackEngine_1.SelectorFallbackEngine();
    constructor(context = { profile: 'backend', language: 'PT' }) {
        this.context = context;
    }
    async applyToJob(page, jobUrl, options = {}) {
        await this.openJobPage(page, jobUrl);
        const easyApplyButton = await this.findEasyApplyButton(page);
        if (!easyApplyButton) {
            return this.buildResult('ABORT', 'aborted', 'Easy Apply button not found');
        }
        await easyApplyButton.click();
        await (0, utils_1.randomDelay)(1000, 1800);
        const form = await (0, formParser_1.parseEasyApplyForm)(page);
        const decision = (0, classifier_1.classifyApplyForm)(form);
        if (decision !== 'AUTO') {
            return this.buildResult(decision, decision === 'ABORT' ? 'aborted' : 'review', `Form classified as ${decision}`);
        }
        const resumePath = options.resumePath || (0, resumeSelector_1.getResumePath)(options.profile ?? this.context.profile);
        const answers = (0, answerEngine_1.buildAnswerMap)(options.answers ?? {});
        if (form.hasFileUpload && !resumePath) {
            return this.buildResult('REVIEW', 'review', 'Resume upload required but no resume path configured.');
        }
        await this.fillForm(page, form.rawFields, answers, resumePath, options.coverLetter);
        const submitted = await this.submitForm(page);
        return this.buildResult('AUTO', submitted ? 'submitted' : 'aborted', submitted ? 'Application submitted successfully.' : 'Unable to confirm application submission.');
    }
    buildResult(decision, status, details) {
        return {
            decision: decision,
            status,
            appliedAt: new Date().toISOString(),
            details
        };
    }
    async openJobPage(page, jobUrl) {
        if (page.url() !== jobUrl) {
            await page.goto(jobUrl, { waitUntil: 'domcontentloaded' });
            await (0, utils_1.randomDelay)(900, 1600);
        }
    }
    async findEasyApplyButton(page) {
        const selector = await this.fallbackEngine.findFirstSelector(page, EASY_APPLY_FALLBACK);
        return selector ? page.locator(selector).first() : null;
    }
    async fillForm(page, fields, answer, resumePath, coverLetter) {
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
            await (0, utils_1.randomDelay)(300, 800);
        }
    }
    async fillField(page, field, value, coverLetter) {
        const locator = page.locator(`label:has-text("${field.label}"), [name="${field.name}"], [id="${field.name}"]`).first();
        if (!await locator.count()) {
            return;
        }
        if (field.type === 'textarea') {
            await (0, HumanBehavior_1.simulateTyping)(locator, coverLetter || value || '');
            return;
        }
        if (field.type === 'text') {
            const finalValue = value || (field.label.toLowerCase().includes('cover letter') ? coverLetter ?? '' : '');
            await (0, HumanBehavior_1.simulateTyping)(locator, finalValue);
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
                if (shouldCheck)
                    await checkbox.check({ force: true });
            }
        }
    }
    async uploadResume(page, field, resumePath) {
        const input = page.locator(`input[type="file"]`).first();
        if (await input.count()) {
            await input.setInputFiles(resumePath);
            await (0, utils_1.randomDelay)(1000, 1600);
        }
    }
    async submitForm(page) {
        let attempts = 0;
        while (attempts < 5) {
            attempts += 1;
            if (await this.fallbackEngine.clickFirst(page, SUBMIT_FALLBACK)) {
                await (0, utils_1.randomDelay)(1300, 2200);
                if (await this.waitForSuccess(page)) {
                    return true;
                }
            }
            if (await this.fallbackEngine.clickFirst(page, CONTINUE_FALLBACK)) {
                await (0, utils_1.randomDelay)(1200, 2000);
                continue;
            }
            await (0, utils_1.randomDelay)(800, 1200);
            if (await this.waitForSuccess(page)) {
                return true;
            }
        }
        return false;
    }
    async waitForSuccess(page) {
        try {
            await page.waitForSelector(SUCCESS_INDICATORS.join(','), { timeout: 5000 });
            return true;
        }
        catch {
            return false;
        }
    }
}
exports.LinkedInApplyService = LinkedInApplyService;
