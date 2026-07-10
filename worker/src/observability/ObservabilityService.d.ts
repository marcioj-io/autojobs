import type { PersistenceService } from '@autojobs/db';
export declare class ObservabilityService {
    private persistence;
    constructor(persistence: PersistenceService);
    logAnomaly(type: string, message: string, details?: unknown, severity?: 'info' | 'warning' | 'error'): Promise<void>;
    recordSelectorFailure(selectorType: string, selector: string, url?: string, error?: string, metadata?: unknown): Promise<void>;
    recordScreenshotMetadata(contextType: string, contextId: string | null, path: string | null, metadata?: unknown): Promise<void>;
}
