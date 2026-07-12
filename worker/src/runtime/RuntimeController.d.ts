import { AuditLogsService, PersistenceService } from '@autojobs/db';
import type { DrizzleD1Database } from '@autojobs/db';
import { Env } from '../env';
import { EngineClient } from '@autojobs/engine';
import type { RuntimePipelineResult } from './types';
export interface WorkerRuntimeOptions {
    runId: string;
    profile: string;
    query: string;
    location: string;
    language: 'PT' | 'EN' | 'ES';
    maxResults: number;
    modalities?: any;
    profileDefinition?: any;
}
export declare class RuntimeController {
    private db;
    private persistence;
    private runtimeStateId;
    private engineClient;
    private env;
    private runtimeService;
    private logger;
    private scheduler;
    private retryPolicy;
    private healthService;
    private limitsService;
    private recoveryService;
    private observabilityService;
    private auditLogsService;
    private normalizeModality;
    private mapEngineJobToJobRecord;
    constructor(db: DrizzleD1Database<any>, persistence: PersistenceService, auditLogsService: AuditLogsService, runtimeStateId: string | undefined, engineClient: EngineClient, env: Env);
    execute(options: WorkerRuntimeOptions): Promise<{
        readonly status: "blocked";
        runId?: undefined;
        pipelineResult?: undefined;
    } | {
        readonly status: "skipped";
        runId?: undefined;
        pipelineResult?: undefined;
    } | {
        runId: string;
        pipelineResult: RuntimePipelineResult;
        status: "blocked" | "success" | "failure";
    }>;
}
