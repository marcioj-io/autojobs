import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type { ApplicationModel } from '../schema';
export declare class ApplicationsRepository {
    private db;
    constructor(db: DrizzleD1Database<any>);
    createApplication(application: ApplicationModel): Promise<void>;
    listAll(): Promise<{
        id: string;
        jobId: string;
        status: string;
        result: string | null;
        appliedAt: Date;
    }[]>;
    getById(id: string): Promise<{
        id: string;
        jobId: string;
        status: string;
        result: string | null;
        appliedAt: Date;
    } | undefined>;
    getApplicationsByJob(jobId: string): Promise<{
        id: string;
        jobId: string;
        status: string;
        result: string | null;
        appliedAt: Date;
    }[]>;
    countApplicationsSince(since: Date, status?: string): Promise<number>;
}
