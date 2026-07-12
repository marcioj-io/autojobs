import { AuditLogsService, PersistenceService, type DrizzleD1Database, type Profile } from '@autojobs/db';
import { EngineClient } from '@autojobs/engine';
import type { RuntimePipelineResult } from './types';
import type { Env } from '../env';
export interface WorkerRuntimeOptions {
    runId?: string;
    profile: string;
    query: string;
    location: string;
    language: 'PT' | 'EN' | 'ES';
    maxResults: number;
    modalities?: string[];
    profileDefinition?: Profile;
}
export declare class RuntimeController {
    private readonly db;
    private readonly persistence;
    private readonly runtimeStateId;
    private readonly engineClient;
    private readonly env;
    private readonly runtimeService;
    private readonly logger;
    private readonly scheduler;
    private readonly retryPolicy;
    private readonly healthService;
    private readonly limitsService;
    private readonly recoveryService;
    private readonly observabilityService;
    private readonly auditLogsService;
    constructor(db: DrizzleD1Database<any>, persistence: PersistenceService, auditLogsService: AuditLogsService, runtimeStateId: string | undefined, engineClient: EngineClient, env: Env);
    execute(options: WorkerRuntimeOptions): Promise<{
        status: string;
        runId?: undefined;
        pipelineResult?: undefined;
    } | {
        runId: string;
        pipelineResult: RuntimePipelineResult;
        status: "blocked" | "success" | "failure";
    }>;
    /**
     * Garante compatibilidade antes da persistência.
     *
     * O Engine já entrega:
     * - score
     * - status
     * - modality
     * - timestamps
     *
     * Worker apenas completa campos ausentes.
     */
    /**
   * /Garante compatibilidade antes da persistência.
   */
    private normalizeJob;
}
