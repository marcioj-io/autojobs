import type { LinkedInJobRecord } from './types';

function normalizeText(value: string | null | undefined) {
  return value?.trim().replace(/\s+/g, ' ') ?? '';
}

export function normalizeLinkedInJobRecord(raw: Partial<LinkedInJobRecord>): LinkedInJobRecord {
  return {
    id: raw.id ?? '',
    company: normalizeText(raw.company),
    title: normalizeText(raw.title),
    location: normalizeText(raw.location),
    url: raw.url?.trim() ?? '',
    easyApply: raw.easyApply ?? false,
    postedAt: normalizeText(raw.postedAt),
    description: normalizeText(raw.description),
    language: raw.language ?? 'PT',
    profile: raw.profile ?? 'backend'
  };
}

export function buildLinkedInJobRecord(raw: Partial<LinkedInJobRecord>): LinkedInJobRecord {
  return normalizeLinkedInJobRecord(raw);
}
