// packages\engine\clients\engineClient.ts
import { EngineScrapeResult } from '../src/types';

export interface EngineScrapeRequest {
  profile: string;
  query: string;
  location: string;
  language: 'PT' | 'EN' | 'ES';
  maxResults: number;
  storageState?: string;
}


function normalizeResponse(data: any): EngineScrapeResult {
  return {
    jobs: Array.isArray(data.jobs) ? data.jobs : [],
    applications: Array.isArray(data.applications) ? data.applications : [],
    manualReviews: Array.isArray(data.manualReviews) ? data.manualReviews : []
  };
}

export class EngineClient {
  constructor(private engineUrl: string) {}

  async scrape(request: EngineScrapeRequest): Promise<EngineScrapeResult> {
    const response = await fetch(`${this.engineUrl}/scrape`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      throw new Error(`Engine scrape failed: ${response.status}`);
    }

    const payload = await response.json();
    return normalizeResponse(payload.data);
  }
}