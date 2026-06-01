import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type { SelectorFailureModel } from '../schema';
export declare class SelectorFailuresRepository {
    private db;
    constructor(db: DrizzleD1Database<any>);
    createFailure(entry: SelectorFailureModel): Promise<void>;
    getRecentFailures(limit?: number): Promise<{
        id: string;
        selectorType: string;
        selector: string;
        pageUrl: string | null;
        error: string;
        metadata: string | null;
        timestamp: Date;
    }[]>;
}
