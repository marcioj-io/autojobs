import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type { ScreenshotMetadataModel } from '../schema';
export declare class ScreenshotMetadataRepository {
    private db;
    constructor(db: DrizzleD1Database<any>);
    createMetadata(entry: ScreenshotMetadataModel): Promise<void>;
    getRecentScreenshots(limit?: number): Promise<{
        id: string;
        contextType: string;
        contextId: string | null;
        path: string | null;
        metadata: string | null;
        timestamp: Date;
    }[]>;
}
