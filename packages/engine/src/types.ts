// packages\engine\src\types.ts
export type LinkedInLanguage = 'PT' | 'EN' | 'ES';

export interface LinkedInSessionAdapter {
  load(sessionId: string): Promise<string | null>;
  save(sessionId: string, cookies: string): Promise<void>;
}

export interface LinkedInSearchOptions {
  query: string;
  location: string;
  profile: string;
  language: LinkedInLanguage;
  maxResults?: number;

  storageState?: string;
}
/**
 * ENGINE OUTPUT CONTRACT (SINGLE RESPONSIBILITY)
 * Only raw scraping output.
 */
export interface EngineScrapeResult {
  jobs: LinkedInJobRecord[];

  applications: {
    jobId: string;
    status: 'submitted';
    result: any;
    appliedAt: string;
  }[];

  manualReviews: {
    id: string;
    jobId: string;
    profile: string;
    reviewStatus: 'pending';
    reviewReason: string;
    reviewNotes: any;
    createdAt: string;
    updatedAt: string;
  }[];
}

export interface LinkedInJobRecord {
  id: string;
  company: string;
  title: string;
  location: string;
  url: string;
  easyApply: boolean;
  postedAt?: string;
  description?: string;
  language: LinkedInLanguage;
  profile: string;
}

export interface EngineSessionState {
  storageState?: string;
}
