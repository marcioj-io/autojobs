import { Profile } from "@autojobs/db";
import type { Cookie, BrowserContextOptions } from "playwright";

export type LinkedInLanguage = 'PT' | 'EN' | 'ES';

export type LinkedInStorageState =
  NonNullable<BrowserContextOptions['storageState']>;

export interface LinkedInSessionAdapter {
  load(sessionId: string): Promise<Cookie[] | null>;
  save(sessionId: string, cookies: Cookie[]): Promise<void>;
}

export interface EngineScrapeRequest {
  profile: string;
  query: string;
  location: string;
  language: LinkedInLanguage;
  maxResults: number;
  storageState?: LinkedInStorageState;
  modalities?: string[];
  profileDefinition: Profile;
}

export interface LinkedInSearchOptions {
  query: string;
  location: string;
  profile: string;
  language: LinkedInLanguage;
  maxResults?: number;
  storageState?: LinkedInStorageState;
  modalities?: string[];
  profileDefinition?: any;
  processedJobIds?: string[];
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