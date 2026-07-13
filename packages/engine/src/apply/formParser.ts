// packages\engine\src\apply\formParser.ts
import type { Page } from 'playwright';
import type { LinkedInFormField, LinkedInFormParseResult, LinkedInFormFieldType, LinkedInFormStep } from './types';
import { selectors } from '../selectors';

const FIELD_SELECTORS = [
  'input',
  'textarea',
  'select',
  'input[type=checkbox]',
  'input[type=radio]'
];

function normalizeLabel(label: string | null): string {
  return label?.trim().replace(/\s+/g, ' ') ?? '';
}

function normalizeFieldType(elementType: string, typeAttribute: string | null, label: string): LinkedInFormFieldType {
  const normalizedLabel = label.toLowerCase();
  if (elementType === 'textarea') return 'textarea';
  if (elementType === 'select') return 'select';
  if (typeAttribute === 'file') return 'file';
  if (typeAttribute === 'checkbox') return normalizedLabel.includes('yes') || normalizedLabel.includes('no') ? 'yesno' : 'checkbox';
  if (typeAttribute === 'radio') return 'radio';
  if (elementType === 'input') return 'text';
  return 'unknown';
}

function guessRequired(element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, label: string): boolean {
  if (element.required) return true;
  const normalized = label.toLowerCase();
  return normalized.includes('required') || normalized.includes('*');
}

export async function parseEasyApplyForm(page: Page): Promise<LinkedInFormParseResult> {
  const formSelector = 'form.jobs-easy-apply-form, .jobs-easy-apply-modal, .jobs-easy-apply__content';
  await page.waitForSelector(formSelector, { timeout: 15000 });

  const fields = await page.$$eval(`${formSelector} ${FIELD_SELECTORS.join(', ')}`, (elements) => {
    return elements.map((element) => {
      const wrapper = element.closest('div') as HTMLElement | null;
      const labelElement = wrapper?.querySelector('label, legend, span, p') as HTMLElement | null;
      const label = labelElement?.textContent?.trim() ?? '';
      const name = (element.getAttribute('name') || element.getAttribute('id') || element.getAttribute('data-test-identifier') || '').trim();
      const typeAttribute = element.getAttribute('type') || '';
      const elementType = element.tagName.toLowerCase();
      const options = element.tagName.toLowerCase() === 'select'
        ? Array.from((element as HTMLSelectElement).options).map((option) => option.textContent?.trim() ?? '')
        : [];
      return {
        name,
        label,
        elementType,
        typeAttribute,
        required: (element as HTMLInputElement).required || false,
        options,
        value: (element as HTMLInputElement).value || ''
      };
    });
  });

  const parsedFields: LinkedInFormField[] = fields
    .filter((field) => field.name || field.label)
    .map((field) => ({
      name: field.name || field.label.toLowerCase().slice(0, 32),
      label: normalizeLabel(field.label),
      type: normalizeFieldType(field.elementType, field.typeAttribute, field.label),
      required: field.required || false,
      options: field.options.length ? field.options : undefined,
      value: field.value
    }));

  const hasCaptcha = await page.$('iframe[src*="captcha"], text=Captcha, text=recaptcha, text=challenge') !== null;
  const hasCoverLetter = parsedFields.some((field) => field.label.toLowerCase().includes('cover letter'));
  const hasFileUpload = parsedFields.some((field) => field.type === 'file');

  const stepCount = await page.$$eval('li[role="presentation"], div[role="progressbar"], span.jobs-easy-apply-form__step-count', (elements) => {
    if (!elements.length) return 1;
    const text = elements[elements.length - 1].textContent || '';
    const match = text.match(/(\d+)\s*of\s*(\d+)/i);
    if (match) return Number(match[2]);
    return elements.length;
  });

  const steps: LinkedInFormStep[] = [{
    index: 1,
    title: undefined,
    fields: parsedFields
  }];

  return {
    steps,
    stepCount,
    hasCaptcha,
    hasCoverLetter,
    hasFileUpload,
    rawFields: parsedFields
  };
}
