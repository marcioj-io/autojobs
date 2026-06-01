import type { LinkedInSessionAdapter } from '../types';
export declare class FileSessionAdapter implements LinkedInSessionAdapter {
    private sessionDirectory;
    constructor(sessionDirectory?: string);
    private getSessionPath;
    load(sessionId: string): Promise<string | null>;
    save(sessionId: string, storageState: string): Promise<void>;
}
