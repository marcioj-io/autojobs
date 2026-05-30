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

export interface LinkedInApplyOptions {
  resumePath?: string;
  coverLetter?: string;
  answers?: Record<string, string>;
  profile?: string;
  useAutoApply?: boolean;
}

export interface LinkedInApplyResult {
  decision: ApplyDecision;
  status: 'submitted' | 'review' | 'aborted';
  score?: number;
  reason?: string;
  appliedAt: string;
  details?: string;
}

export interface LinkedInApplyContext {
  profile: string;
  language: string;
  resumePath?: string;
  answers?: Record<string, string>;
}
