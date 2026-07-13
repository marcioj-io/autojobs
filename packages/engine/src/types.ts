// packages\engine\src\types.ts
import { Profile } from "@autojobs/db";
import type { Cookie, BrowserContextOptions } from "playwright";
import { ApplyResult } from "./apply";

export type LinkedInLanguage = 'PT' | 'EN' | 'ES';

export type LinkedInStorageState =
  NonNullable<BrowserContextOptions['storageState']>;

export interface LinkedInSessionAdapter {
  load(sessionId: string): Promise<Cookie[] | null>;
  save(sessionId: string, cookies: Cookie[]): Promise<void>;
}

export interface EngineScrapeRequest {
  profileName: string;
  query: string;
  location: string;
  language: LinkedInLanguage;
  maxResults: number;
  profile: Profile;
  modalities?: string[];
  storageState?: LinkedInStorageState;
}

export interface LinkedInSearchOptions {
  query: string;
  location: string;
  profileName: string;
  language: LinkedInLanguage;
  profile: Profile;
  modalities?: string[];
  processedJobIds?: string[];
  maxResults?: number;
  storageState?: LinkedInStorageState;
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
  profileName: string;
  modality?: string;
  status?: 'found' | 'failed' | 'rejected' | 'error' | 'applied' | 'submitted' | 'pending';
  applyResult?: ApplyResult;
  updatedAt?: string;
  createdAt?: string;
  score?: number;
}

export interface EngineSessionState {
  storageState?: string;
}