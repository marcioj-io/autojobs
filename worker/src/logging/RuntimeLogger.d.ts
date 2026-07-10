import { PersistenceService } from '@autojobs/db';
export declare class RuntimeLogger {
    private persistence;
    constructor(persistence: PersistenceService);
    logInfo(message: string, source?: string): Promise<void>;
    logWarning(message: string, source?: string): Promise<void>;
    logError(message: string, error?: unknown, source?: string): Promise<void>;
}
