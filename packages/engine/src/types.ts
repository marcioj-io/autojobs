import { Cookie } from "playwright";

// packages\engine\src\types.ts
export type LinkedInLanguage = 'PT' | 'EN' | 'ES';

export interface LinkedInSessionAdapter {
  load(sessionId: string): Promise<Cookie[] | null>;
  save(sessionId: string, cookies: Cookie[]): Promise<void>;
}

export interface LinkedInSearchOptions {
  query: string;
  location: string;
  profile: string;
  language: LinkedInLanguage;
  maxResults?: number;
  storageState?: string;
  modalities?: string[],
  profileDefinition?: any;
}

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
  modality?: string;
  status?: string;
  applyResult?: any;
  updatedAt?: string;
  createdAt?: string; 
  score?: number;
}

export interface EngineSessionState {
  storageState?: string;
}
