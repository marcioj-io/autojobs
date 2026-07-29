// packages/engine/src/types.ts
// Tipos específicos da engine (scraper, session, resultados)

import type { ProfileContext } from '@autojobs/shared';
import type { Cookie } from 'playwright';
import type { ApplyResult } from '@autojobs/shared';

export interface LinkedInStorageState {
  cookies: Cookie[];
  origins: {
    origin: string;
    localStorage: {
      name: string;
      value: string;
    }[];
  }[];
}

export interface LinkedInSessionAdapter {
  load(sessionId: string): Promise<Cookie[] | null>;
  save(sessionId: string, cookies: Cookie[]): Promise<void>;
}

export interface EngineScrapeRequest {
  profileName: string;
  query: string;
  location: string;
  language: 'PT' | 'EN' | 'ES';
  maxResults: number;
  profile: ProfileContext;
  modalities?: string[];
  storageState?: LinkedInStorageState | any;
}

export interface LinkedInSearchOptions {
  query: string;
  location: string;
  profileName: string;
  language: 'PT' | 'EN' | 'ES';
  profile: ProfileContext;
  modalities?: string[];
  processedJobIds?: string[];
  maxResults?: number;
  storageState?: LinkedInStorageState | any;
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
  language: 'PT' | 'EN' | 'ES';
  profileName: string;
  modality?: 'Remoto' | 'Híbrido' | 'Presencial';
  status?: 'found' | 'failed' | 'rejected' | 'error' | 'applied' | 'submitted' | 'pending' | 'pending_review';
  applyResult?: ApplyResult | any;
  updatedAt?: string;
  createdAt?: string;
  score?: number;
  // padronização camelCase para ai metadata/reason
  aiReason?: string;
  aiMetadata?: any;
  // campos livres para debug/diagnóstico
  [k: string]: any;
}

export interface EngineSessionState {
  storageState?: string;
}
