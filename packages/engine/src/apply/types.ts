// packages\engine\src\apply\types.ts
import { ApplyResult } from "@autojobs/shared";

export type ApplyDecision = 'AUTO' | 'REVIEW' | 'ABORT';

export type LinkedInFormFieldType =
  | 'text'
  | 'textarea'
  | 'select'
  | 'radio'
  | 'checkbox'
  | 'file'
  | 'yesno'
  | 'unknown';

export interface LinkedInFormField {
  name: string;
  label: string;
  type: LinkedInFormFieldType;
  required: boolean;
  options?: string[];
  value?: string;
}

export interface LinkedInFormStep {
  index: number;
  title?: string;
  fields: LinkedInFormField[];
}

export interface LinkedInFormParseResult {
  steps: LinkedInFormStep[];
  stepCount: number;
  hasCaptcha: boolean;
  hasCoverLetter: boolean;
  hasFileUpload: boolean;
  rawFields: LinkedInFormField[];
}

// export interface LinkedInApplyOptions {
//   profile: string;
//   resumePath?: string;
//   coverLetter?: string;
//   answers?: Record<string, string>;
//   useAutoApply?: boolean;
// }

export interface LinkedInApplyResult {
    decision: ApplyDecision;
    result: ApplyResult;
    appliedAt: string;
    score?: number;
    reason?: string;
}

export interface LinkedInApplyContext {
  profile: string;
  language: string;
  resumePath?: string;
  answers?: Record<string, string>;
}
