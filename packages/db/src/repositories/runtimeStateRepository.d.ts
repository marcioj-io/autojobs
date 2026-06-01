import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type { RuntimeStateModel } from '../schema';
export declare class RuntimeStateRepository {
    private db;
    constructor(db: DrizzleD1Database<any>);
    getState(id: string): Promise<{
        id: string;
        currentState: string;
        health: string;
        lastExecutionStartedAt: Date | null;
        lastExecutionFinishedAt: Date | null;
        nextExecutionAt: Date | null;
        consecutiveFailures: number;
        cooldownUntil: Date | null;
        sessionStatus: string | null;
        sessionId: string | null;
        lastError: string | null;
        createdAt: Date;
        updatedAt: Date;
    } | undefined>;
    upsertState(state: RuntimeStateModel): Promise<void>;
    patchState(id: string, patch: Partial<Omit<RuntimeStateModel, 'id' | 'createdAt'>>): Promise<void>;
}
