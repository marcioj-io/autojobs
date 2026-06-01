export type LinkedInLanguage = 'PT' | 'EN' | 'ES';
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
    modality?: 'Remoto' | 'Híbrido' | 'Presencial';
}
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
}
